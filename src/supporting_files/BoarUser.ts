/***********************************************
 * BoarUser.ts
 * Handles the manipulation of a user's profile,
 * which is stored in JSON.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import Canvas from 'canvas';
import {AttachmentBuilder, ChatInputCommandInteraction, User} from 'discord.js';
import {Options, PythonShell} from 'python-shell';
import fs from 'fs';
import {getConfigFile, getGlobalData} from './DataHandlers';
import {addQueue} from './Queue';
import {handleError} from './LogDebug';
import {drawCircleImage, drawImageCompact, drawRect, drawText} from './CanvasFunctions';
import {findRarity} from './GeneralFunctions';

//***************************************

export class BoarUser {
    public readonly user: User;

    public lastDaily: number;
    public numDailies: number;
    public totalBoars: number;
    public boarScore: number;
    public favoriteBoar: string;
    public lastBoar: string;
    public firstDaily: number;
    public powerupsWon: number;
    public boarStreak: number;
    public boarCollection: any;
    public powerups: any;
    public theme: string;
    public themes: string[];
    public badges: string[];

    //***************************************

    /**
     * Creates a new BoarUser from data file.
     * If it doesn't exist, create empty BoarUser object
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

    //***************************************

    /**
     * Returns user data from JSON file
     * @return userData - User's parsed JSON data
     * @private
     */
    private getUserData() {
        let userDataJSON: string;
        const config = getConfigFile();
        const userFile = config.paths.data.userFolder + this.user.id + '.json';

        try {
            userDataJSON = fs.readFileSync(userFile, 'utf-8');
        } catch {
            fs.writeFileSync(userFile, JSON.stringify(config.emptyUser));
            userDataJSON = fs.readFileSync(userFile, 'utf-8');
        }

        return JSON.parse(userDataJSON);
    }

    //***************************************

    /**
     * Updates user data in JSON file and in this object
     */
    public updateUserData() {
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

    //***************************************

    /**
     * Fixes any potential issues with user data
     * @param userData - User's parsed JSON data
     * @private
     */
    private fixUserData(userData: any) {
        const config = getConfigFile();
        const userFile = config.paths.data.userFolder + this.user.id + '.json';

        const boarsGottenIDs = Object.keys(this.boarCollection);

        for (const boarID of boarsGottenIDs) {
            if (config.boarIDs[boarID])
                continue;

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

    //***************************************

    /**
     * Add a boar to a user's collection and send an image
     * @param config - Global config data parsed from JSON
     * @param boarID - ID of boar to add
     * @param interaction - Interaction to reply to with image
     * @return success - The function fully executed
     */
    public async addBoar(config: any, boarID: string, interaction: ChatInputCommandInteraction) {
        // Config aliases
        const configPaths = config.paths;
        const dailyStrings = config.strings.commands.daily.other;
        const giveStrings = config.strings.commands.give.other;
        const configStrings = config.strings;
        const generalStrings = configStrings.general;
        const debugStrings = configStrings.debug;

        // Number info
        const numsGeneral = config.numbers.general;
        const trackedEditions = numsGeneral.trackedEditions;

        // Rarity information
        const raritiesInfo = config.raritiesInfo;
        const rarities = Object.keys(raritiesInfo);
        let rarity = '';

        for (const r of rarities) {
            if (raritiesInfo[r].boars.includes(boarID)) {
                rarity = r;
                break;
            }
        }

        if (rarity === '') {
            await handleError(debugStrings.noBoarFound, interaction);
            return false;
        }

        const rarityInfo = raritiesInfo[rarity];

        // Information about interaction
        const wasGiven = interaction.options.getSubcommand() === configStrings.commands.give.name;

        // Image elements to be combined into one final image
        let attachmentTitle = dailyStrings.dailyTitle;

        // If the boar being added is a special boar (Not from daily), change the title to reflect it
        if (!rarityInfo.fromDaily) {
            attachmentTitle = giveStrings.specialGivenTitle;
        } else if (wasGiven) {
            attachmentTitle = giveStrings.givenTitle;
        }

        // Get the image attachment from ID
        const attachment = await this.handleImageCreate(config, boarID, attachmentTitle);

        // If regular boar on '/boar daily', reply to interaction with attachment
        // If given, send as separate message and reply to interaction with success
        if (!wasGiven) {
            await interaction.editReply({ files: [attachment] });
        } else {
            await interaction.editReply(giveStrings.gaveBoar);
            await interaction.followUp({ files: [attachment] });
        }

        let boarEdition: number = 0;

        // Updates global edition data
        await addQueue(() => {
            const globalData = getGlobalData();

            // Sets edition number
            if (!globalData.editions[boarID])
                globalData.editions[boarID] = 0;
            boarEdition = ++globalData.editions[boarID];

            fs.writeFileSync(configPaths.data.globalFile, JSON.stringify(globalData));
        }, interaction.id + generalStrings.globalQueueID);

        // Updating user data
        if (!wasGiven && this.firstDaily === 0)
            this.firstDaily = Date.now();

        if (!this.boarCollection[boarID]) {
            this.boarCollection[boarID] = config.emptyBoar;
            this.boarCollection[boarID].firstObtained = Date.now();
        }

        this.boarCollection[boarID].num++;
        this.boarCollection[boarID].lastObtained = Date.now();

        if (boarEdition <= trackedEditions || !rarityInfo.fromDaily) {
            this.boarCollection[boarID].editions.push(boarEdition);
            this.boarCollection[boarID].editionDates.push(Date.now());
        }

        this.lastBoar = boarID;
        this.boarScore += config.raritiesInfo[rarity].score;
        this.totalBoars++;
        this.numDailies++;

        this.updateUserData();
        await this.orderBoars(config, interaction);

        return true;
    }

    //***************************************

    /**
     * Add a badge to a user's profile and send an image
     * @param config - Global config data parsed from JSON
     * @param badgeID - ID of badge to add
     * @param interaction - Interaction to reply to with image
     * @return success - The function fully executed
     */
    public async addBadge(config: any, badgeID: string, interaction: ChatInputCommandInteraction) {
        const configStrings = config.strings;
        const giveStrings = configStrings.commands.give.other;

        const hasBadge = this.badges.includes(badgeID);
        const wasGiven = interaction.options.getSubcommand() === configStrings.commands.give.name;

        if (hasBadge && wasGiven) {
            await interaction.editReply(giveStrings.alreadyHas);
            return false;
        }

        if (hasBadge && !wasGiven)
            return false;

        const attachmentTitle = wasGiven
            ? giveStrings.badgeTitleGiven
            : giveStrings.badgeTitleObtained;

        const attachment = await this.handleImageCreate(config, badgeID, attachmentTitle);

        // If gotten from regular means, followup interaction with image
        // If given, send as separate message and reply to interaction with success
        if (!wasGiven) {
            await interaction.followUp({ files: [attachment] });
        } else {
            await interaction.editReply(giveStrings.gaveBadge);
            await interaction.followUp({ files: [attachment] });
        }

        this.badges.push(badgeID);

        this.updateUserData();

        return true;
    }

    //***************************************

    /**
     * Creates the image to be sent on boar/badge add
     * @param config - Global config data parsed from JSON
     * @param id - ID of boar/badge to create image for
     * @param attachmentTitle - Title of the image attachment
     * @return attachment - AttachmentBuilder object containing image
     * @private
     */
    private async handleImageCreate(config: any, id: any, attachmentTitle: string) {
        const configStrings = config.strings;

        const isBoar: boolean = config.boarIDs[id];
        let info: any;
        let folderPath: string;
        const hexColors = config.hexColors;
        let backgroundColor: string;

        if (!isBoar) {
            info = config.badgeIDs[id];
            folderPath = config.paths.assets.badges;
            backgroundColor = hexColors.badge;
        } else {
            info = config.boarIDs[id]
            folderPath = config.paths.assets.boars;
            backgroundColor = hexColors[findRarity(id)];
        }

        const imageFilePath = folderPath + info.file;
        const imageExtension = imageFilePath.split('.')[1];
        const isAnimated = imageExtension === 'gif';

        const generalStrings = configStrings.general;
        const generalNums = config.numbers.general;
        const usernameLength = generalNums.usernameLength;

        const userAvatar = this.user.displayAvatarURL({ extension: 'png' });
        const userTag = this.user.username.substring(0, usernameLength) + '#' + this.user.discriminator;

        // Buffer storage
        let buffer: Buffer = Buffer.from([0x00]);

        // Creates a dynamic response attachment depending on the boar's image type
        if (isAnimated) {
            const scriptPath = config.paths.scripts.basePath;
            const scriptPaths = config.paths.scripts;

            // Waits for python code to execute before continuing
            await new Promise((resolve, reject) => {
                const scriptOptions: Options = {
                    args: [
                        backgroundColor,
                        imageFilePath,
                        userAvatar,
                        userTag,
                        attachmentTitle,
                        info.name,
                        isBoar
                    ]
                };

                // Sends python all dynamic image data and receives final animated image
                PythonShell.run(scriptPath + scriptPaths.dynamicImage, scriptOptions, (err, data) => {
                    if (!data) {
                        handleError(err);

                        reject(generalStrings.rejectScript);
                        return;
                    }

                    buffer = Buffer.from(data[0], 'base64');
                    resolve(generalStrings.resolve);
                });
            });
        } else {
            const announceAddFolder = config.paths.assets.announceAdd.basePath;
            const announceAddAssets = config.paths.assets.announceAdd
            const underlayPath = announceAddFolder + announceAddAssets.underlay;
            const backplatePath = announceAddFolder + announceAddAssets.backplate;
            const overlay = announceAddFolder + announceAddAssets.overlay;
            const nameplate = announceAddFolder + announceAddAssets.nameplate;

            // Positioning and dimension info
            const nums = config.numbers.announceAdd;
            const origin = generalNums.originPos;
            const imageSize = nums.imageSize;

            let mainPos: number[];
            let mainSize: number[];

            if (!isBoar) {
                mainPos = nums.badgePos;
                mainSize = nums.badgeSize;
            } else {
                mainPos = nums.boarPos;
                mainSize = nums.boarSize;
            }

            // Font info
            const fontName = configStrings.general.fontName;
            const bigFont = `${generalNums.fontSizes.big}px ${fontName}`;
            const mediumFont = `${generalNums.fontSizes.medium}px ${fontName}`;

            const canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
            const ctx = canvas.getContext('2d');

            // Draws edge/background rarity color
            drawRect(ctx, origin, imageSize, backgroundColor);
            ctx.globalCompositeOperation = 'destination-in';
            drawImageCompact(ctx, await Canvas.loadImage(underlayPath), origin, imageSize);
            ctx.globalCompositeOperation = 'normal';

            // Draws badge and overlay
            drawImageCompact(ctx, await Canvas.loadImage(backplatePath), origin, imageSize);
            drawImageCompact(ctx, await Canvas.loadImage(imageFilePath), mainPos, mainSize);
            drawImageCompact(ctx, await Canvas.loadImage(overlay), origin, imageSize);

            // Draws method of delivery and name of badge
            drawText(ctx, attachmentTitle, nums.titlePos, bigFont, 'center', hexColors.font);
            drawText(ctx, info.name, nums.namePos, mediumFont, 'center', hexColors.font);

            // Draws user information
            drawImageCompact(
                ctx, await Canvas.loadImage(nameplate), nums.nameplatePos,
                [ctx.measureText(userTag).width + nums.nameplatePadding, nums.nameplateHeight]
            );
            drawText(ctx, userTag, nums.userTagPos, mediumFont, 'left', hexColors.font);
            drawCircleImage(ctx, await Canvas.loadImage(userAvatar), nums.userAvatarPos, nums.userAvatarWidth);

            buffer = canvas.toBuffer();
        }

        return new AttachmentBuilder(buffer, { name:`${generalStrings.imageName}.${imageExtension}` });
    }

    //***************************************

    /**
     * Reorder a user's boars to appear in order when viewing collection
     * @param config - Global config data parsed from JSON
     * @param interaction - Used to give badge if user has max uniques
     */
    public async orderBoars(config: any, interaction: ChatInputCommandInteraction) {
        const raritiesInfo = config.raritiesInfo;
        const rarities = Object.keys(raritiesInfo);
        const obtainedBoars = Object.keys(this.boarCollection);

        let maxUniques = 0;

        for (const rarity of rarities)
            maxUniques += raritiesInfo[rarity].boars.length;

        // Looping through all boar classes (Common -> Very Special)
        for (const rarity of rarities.reverse()) {
            const orderedBoars: string[] = [];
            const boarsOfRarity = raritiesInfo[rarity].boars;

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