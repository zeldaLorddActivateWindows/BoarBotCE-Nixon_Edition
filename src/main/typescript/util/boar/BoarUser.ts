import Canvas from 'canvas';
import {AttachmentBuilder, ChatInputCommandInteraction, User} from 'discord.js';
import {Options, PythonShell} from 'python-shell';
import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {BotConfig} from '../../bot/config/BotConfig';
import {BoarItemConfig} from '../../bot/config/items/BoarItemConfig';
import {BadgeItemConfig} from '../../bot/config/items/BadgeItemConfig';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import {Queue} from '../interactions/Queue';
import {DataHandlers} from '../data/DataHandlers';
import {LogDebug} from '../logging/LogDebug';
import {BoarUtils} from './BoarUtils';
import {CanvasUtils} from '../generators/CanvasUtils';

/**
 * {@link BoarUser BoarUser.ts}
 *
 * Handles the manipulation of a user's profile,
 * which is stored in JSON.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarUser {
    public readonly user: User;

    public lastDaily: number = 0;
    public numDailies: number = 0;
    public totalBoars: number = 0;
    public boarScore: number = 0;
    public favoriteBoar: string = '';
    public lastBoar: string = '';
    public firstDaily: number = 0;
    public powerupsWon: number = 0;
    public boarStreak: number = 0;
    public boarCollection: any = {}; // update to own class, empty object that fills or an array
    public powerups: any = {
        multiplier: 1,
        enhancers: 0,
        gifts: 0
    }; // update to own class
    public theme: string = 'normal';
    public themes: string[] = ['normal'];
    public badges: string[] = [];

    /**
     * Creates a new BoarUser from data file.
     *
     * @param user - User to base BoarUser off of
     */
    constructor(user: User) {
        this.user = user;

        const userData = this.getUserData();

        this.lastDaily = userData.lastDaily;
        this.numDailies = userData.numDailies;
        this.totalBoars = userData.totalBoars;
        this.boarScore = userData.boarScore;
        this.favoriteBoar = userData.favoriteBoar;
        this.lastBoar = userData.lastBoar;
        this.firstDaily = userData.firstDaily;
        this.powerupsWon = userData.powerupsWon;
        this.boarStreak = userData.boarStreak;
        this.boarCollection = userData.boarCollection;
        this.powerups = userData.powerups;
        this.theme = userData.theme;
        this.themes = userData.themes;
        this.badges = userData.badges;

        this.fixUserData(userData);
    }

    /**
     * Returns user data from JSON file.
     * If it doesn't exist, write new file with empty data
     *
     * @return userData - User's parsed JSON data
     * @private
     */
    private getUserData(): any {
        let userDataJSON: string;
        const config = BoarBotApp.getBot().getConfig();
        const userFile = config.pathConfig.userDataFolder + this.user?.id + '.json';

        try {
            userDataJSON = fs.readFileSync(userFile, 'utf-8');
        } catch {
            const { user, ...fixedObject } = this; // Returns object with all properties except user

            fs.writeFileSync(userFile, JSON.stringify(fixedObject));
            userDataJSON = fs.readFileSync(userFile, 'utf-8');
        }

        return JSON.parse(userDataJSON);
    }

    /**
     * Updates user data in JSON file and in this instance
     */
    public updateUserData(): void {
        let userData = this.getUserData();

        userData.lastDaily = this.lastDaily;
        userData.numDailies = this.numDailies;
        userData.boarScore = this.boarScore;
        userData.totalBoars = this.totalBoars;
        userData.boarCollection = this.boarCollection;
        userData.favoriteBoar = this.favoriteBoar;
        userData.lastBoar = this.lastBoar;
        userData.firstDaily = this.firstDaily;
        userData.powerupsWon = this.powerupsWon;
        userData.boarStreak = this.boarStreak;
        userData.powerups = this.powerups;
        userData.theme = this.theme;
        userData.themes = this.themes;
        userData.badges = this.badges;

        this.fixUserData(userData);
    }

    /**
     * Fixes any potential issues with user data and
     * writes to JSON file
     *
     * @param userData - User's parsed JSON data
     * @private
     */
    private fixUserData(userData: any): void {
        const config = BoarBotApp.getBot().getConfig();
        const userFile = config.pathConfig.userDataFolder + this.user.id + '.json';

        const boarsGottenIDs = Object.keys(this.boarCollection);

        for (const boarID of boarsGottenIDs) {
            if (boarID !in config.boarItemConfigs) continue;

            this.totalBoars -= this.boarCollection[boarID].num;
            delete this.boarCollection[boarID];

            if (this.lastBoar === boarID)
                this.lastBoar = '';

            if (this.favoriteBoar === boarID)
                this.favoriteBoar = '';
        }

        userData.boarCollection = this.boarCollection;
        userData.totalBoars = this.totalBoars;
        userData.favoriteBoar = this.favoriteBoar;
        userData.lastBoar = this.lastBoar;

        fs.writeFileSync(userFile, JSON.stringify(userData));
    }

    /**
     * Add a boar to a user's collection and send an image
     *
     * @param config - Global config data parsed from JSON
     * @param boarID - ID of boar to add
     * @param interaction - Interaction to reply to with image
     * @return success - The function fully executed
     */
    public async addBoar(config: BotConfig, boarID: string, interaction: ChatInputCommandInteraction) {
        // Config aliases
        const pathConfig = config.pathConfig;
        const strConfig = config.stringConfig;
        const numConfig = config.numberConfig;
        const giveCommandConfig = config.commandConfigs.boarDev.give;

        // Rarity information
        const rarities = config.rarityConfigs;
        let rarityIndex: number = -1;

        for (let i=0; i<rarities.length; i++) {
            if (rarities[i].boars.includes(boarID)) {
                rarityIndex = i;
                break;
            }
        }

        if (rarityIndex === -1) {
            await LogDebug.handleError(strConfig.dailyNoBoarFound, interaction);
            return false;
        }

        const rarityInfo = rarities[rarityIndex];

        // Information about interaction
        const wasGiven = interaction.options.getSubcommand() === giveCommandConfig.name;

        // Image elements to be combined into one final image
        let attachmentTitle = strConfig.dailyTitle;

        // If the boar being added is a special boar (Not from daily), change the title to reflect it
        if (!rarityInfo.fromDaily) {
            attachmentTitle = strConfig.giveSpecialTitle;
        } else if (wasGiven) {
            attachmentTitle = strConfig.giveTitle;
        }

        // Get the image attachment from ID
        const attachment = await this.handleImageCreate(config, boarID, attachmentTitle);

        // If regular boar on '/boar daily', reply to interaction with attachment
        // If given, send as separate message and reply to interaction with success
        if (!wasGiven) {
            await interaction.editReply({ files: [attachment] });
        } else {
            await interaction.editReply(strConfig.giveBoar);
            await interaction.followUp({ files: [attachment] });
        }

        let boarEdition: number = 0;

        // Updates global edition data
        await Queue.addQueue(() => {
            const globalData = DataHandlers.getGlobalData();

            // Sets edition number
            if (!globalData.editions[boarID])
                globalData.editions[boarID] = 0;
            boarEdition = ++globalData.editions[boarID];

            fs.writeFileSync(pathConfig.globalDataFile, JSON.stringify(globalData));
        }, interaction.id + 'global');

        // Updating user data
        if (!wasGiven && this.firstDaily === 0)
            this.firstDaily = Date.now();

        if (!this.boarCollection[boarID]) {
            this.boarCollection[boarID] = {
                num: 0,
                editions: [],
                editionDates: [],
                firstObtained: 0,
                lastObtained: 0
            };
            this.boarCollection[boarID].firstObtained = Date.now();
        }

        this.boarCollection[boarID].num++;
        this.boarCollection[boarID].lastObtained = Date.now();

        if (boarEdition <= numConfig.maxTrackedEditions || !rarityInfo.fromDaily) {
            this.boarCollection[boarID].editions.push(boarEdition);
            this.boarCollection[boarID].editionDates.push(Date.now());
        }

        this.lastBoar = boarID;
        this.boarScore += config.rarityConfigs[rarityIndex].score;
        this.totalBoars++;
        this.numDailies++;

        this.updateUserData();
        await this.orderBoars(config, interaction);

        return true;
    }

    /**
     * Add a badge to a user's profile and send an image
     * @param config - Global config data parsed from JSON
     * @param badgeID - ID of badge to add
     * @param interaction - Interaction to reply to with image
     * @return success - The function fully executed
     */
    public async addBadge(config: BotConfig, badgeID: string, interaction: ChatInputCommandInteraction) {
        const strConfig = config.stringConfig;
        const giveCommandConfig = config.commandConfigs.boarDev.give;

        const hasBadge = this.badges.includes(badgeID);
        const wasGiven = interaction.options.getSubcommand() === giveCommandConfig.name;

        if (hasBadge && wasGiven) {
            await interaction.editReply(strConfig.giveBadgeHas);
            return false;
        }

        if (hasBadge && !wasGiven)
            return false;

        const attachmentTitle = wasGiven
            ? strConfig.giveBadgeTitle
            : strConfig.obtainedBadgeTitle;

        const attachment = await this.handleImageCreate(config, badgeID, attachmentTitle);

        // If gotten from regular means, followup interaction with image
        // If given, send as separate message and reply to interaction with success
        if (!wasGiven) {
            await interaction.followUp({ files: [attachment] });
        } else {
            await interaction.editReply(strConfig.giveBadge);
            await interaction.followUp({ files: [attachment] });
        }

        this.badges.push(badgeID);

        this.updateUserData();

        return true;
    }

    /**
     * Creates the image to be sent on boar/badge add
     * @param config - Global config data parsed from JSON
     * @param id - ID of boar/badge to create image for
     * @param attachmentTitle - Title of the image attachment
     * @return attachment - AttachmentBuilder object containing image
     * @private
     */
    private async handleImageCreate(config: BotConfig, id: string, attachmentTitle: string) {
        const strConfig = config.stringConfig;
        const colorConfig = config.colorConfig;
        const pathConfig = config.pathConfig;
        const numConfig = config.numberConfig;

        const isBoar: boolean = id in config.boarItemConfigs;
        let info: BoarItemConfig | BadgeItemConfig;
        let folderPath: string;
        let backgroundColor: string;

        if (!isBoar) {
            info = config.badgeItemConfigs[id];
            folderPath = pathConfig.badgeImages;
            backgroundColor = colorConfig.badge;
        } else {
            info = config.boarItemConfigs[id];
            folderPath = pathConfig.boarImages;
            backgroundColor = config.colorConfig['rarity' + BoarUtils.findRarity(id)];
        }

        const imageFilePath = folderPath + info.file;
        const imageExtension = imageFilePath.split('.')[1];
        const isAnimated = imageExtension === 'gif';

        const usernameLength = numConfig.maxUsernameLength;

        const userAvatar = this.user.displayAvatarURL({ extension: 'png' });
        const userTag = this.user.username.substring(0, usernameLength) + '#' + this.user.discriminator;

        // Buffer storage
        let buffer: Buffer = Buffer.from([0x00]);

        // Creates a dynamic response attachment depending on the boar's image type
        if (isAnimated) {
            const script = pathConfig.dynamicImageScript;

            // Waits for python code to execute before continuing
            await new Promise((resolve, reject) => {
                const scriptOptions: Options = {
                    args: [
                        JSON.stringify(config),
                        backgroundColor,
                        imageFilePath,
                        userAvatar,
                        userTag,
                        attachmentTitle,
                        info.name,
                        isBoar.toString()
                    ]
                };

                // Sends python all dynamic image data and receives final animated image
                PythonShell.run(script, scriptOptions, (err, data) => {
                    if (!data) {
                        LogDebug.handleError(err);

                        reject('Python Error!');
                        return;
                    }

                    buffer = Buffer.from(data[0], 'base64');
                    resolve('Script ran successfully!');
                });
            });
        } else {
            const itemAssetsFolder = pathConfig.itemAssets;
            const underlayPath = itemAssetsFolder + pathConfig.itemUnderlay;
            const backplatePath = itemAssetsFolder + pathConfig.itemBackplate;
            const overlay = itemAssetsFolder + pathConfig.itemOverlay;
            const nameplate = itemAssetsFolder + pathConfig.itemNameplate;

            // Positioning and dimension info

            const origin = numConfig.originPos;
            const imageSize = numConfig.itemImageSize;
            let nameplateSize: [number, number];

            let mainPos: [number, number];
            let mainSize: [number, number];

            if (!isBoar) {
                mainPos = numConfig.itemBadgePos;
                mainSize = numConfig.itemBadgeSize;
            } else {
                mainPos = numConfig.itemBoarPos;
                mainSize = numConfig.itemBoarSize;
            }

            // Font info

            const fontName = strConfig.fontName;
            const bigFont = `${numConfig.fontBig}px ${fontName}`;
            const mediumFont = `${numConfig.fontMedium}px ${fontName}`;

            const canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
            const ctx = canvas.getContext('2d');

            // Draws edge/background rarity color

            CanvasUtils.drawRect(ctx, origin, imageSize, backgroundColor);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(await Canvas.loadImage(underlayPath), ...origin, ...imageSize);
            ctx.globalCompositeOperation = 'normal';

            // Draws badge and overlay

            ctx.drawImage(await Canvas.loadImage(backplatePath), ...origin, ...imageSize);
            ctx.drawImage(await Canvas.loadImage(imageFilePath), ...mainPos, ...mainSize);
            ctx.drawImage(await Canvas.loadImage(overlay), ...origin, ...imageSize);

            // Draws method of delivery and name of badge

            CanvasUtils.drawText(ctx, attachmentTitle, numConfig.itemTitlePos, bigFont, 'center', colorConfig.font);
            CanvasUtils.drawText(ctx, info.name, numConfig.itemNamePos, mediumFont, 'center', colorConfig.font);

            // Draws user information

            nameplateSize = [
                ctx.measureText(userTag).width + numConfig.itemNameplatePadding,
                numConfig.itemNameplateHeight
            ];
            ctx.drawImage(await Canvas.loadImage(nameplate), ...numConfig.itemNameplatePos, ...nameplateSize);
            CanvasUtils.drawText(ctx, userTag, numConfig.itemUserTagPos, mediumFont, 'left', colorConfig.font);
            CanvasUtils.drawCircleImage(
                ctx, await Canvas.loadImage(userAvatar), numConfig.itemUserAvatarPos, numConfig.itemUserAvatarWidth
            );

            buffer = canvas.toBuffer();
        }

        return new AttachmentBuilder(buffer, { name:`${strConfig.imageName}.${imageExtension}` });
    }

    /**
     * Reorder a user's boars to appear in order when viewing collection
     * @param config - Global config data parsed from JSON
     * @param interaction - Used to give badge if user has max uniques
     */
    public async orderBoars(config: BotConfig, interaction: ChatInputCommandInteraction) {
        const orderedRarities: RarityConfig[] = [...config.rarityConfigs]
            .sort((rarity1, rarity2) => { return rarity1.weight - rarity2.weight; });
        const obtainedBoars = Object.keys(this.boarCollection);

        let maxUniques = 0;

        for (const rarity of orderedRarities)
            maxUniques += rarity.boars.length;

        // Looping through all boar classes (Common -> Very Special)
        // FIX THIS, CREATE AND SORT MAP BASED ON WEIGHT INSTEAD OF REVERSING
        for (const rarity of orderedRarities) {
            const orderedBoars: string[] = [];
            const boarsOfRarity = rarity.boars;

            // Looping through user's boar collection
            for (let j=0; j<obtainedBoars.length; j++) {
                const curBoarID = obtainedBoars[j]; // ID of current boar
                const curBoarData = this.boarCollection[curBoarID];    // Data of current boar

                if (!boarsOfRarity.includes(curBoarID) || orderedBoars.includes(curBoarID))
                    continue;

                // Removes boar from front and add it to the back of the list to refresh the order
                delete this.boarCollection[curBoarID];
                this.boarCollection[curBoarID] = curBoarData;

                orderedBoars.push(curBoarID);
                j--;
            }
        }

        if (obtainedBoars.length >= maxUniques)
            await this.addBadge(config, 'badge_hunter', interaction);

        this.updateUserData();
    }
}