import {ChatInputCommandInteraction, User} from 'discord.js';
import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {BotConfig} from '../../bot/config/BotConfig';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import {Queue} from '../interactions/Queue';
import {DataHandlers} from '../data/DataHandlers';
import {LogDebug} from '../logging/LogDebug';
import {CollectedBoar} from './CollectedBoar';
import {PowerupData} from './PowerupData';
import {ItemImageGenerator} from '../generators/ItemImageGenerator';
import {Replies} from '../interactions/Replies';

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
    public boarCollection: Record<string, CollectedBoar> = {};
    public powerups: PowerupData = new PowerupData;
    public theme: string = 'normal';
    public themes: string[] = ['normal'];
    public badges: string[] = [];

    /**
     * Creates a new BoarUser from data file.
     *
     * @param user - User to base BoarUser off of
     * @param createFile - Whether a file for the user should be made
     */
    constructor(user: User, createFile?: boolean) {
        this.user = user;

        const userData = this.getUserData(createFile);

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

        if (createFile || this.boarStreak > 0) {
            this.fixUserData(userData);
        }
    }

    /**
     * Returns user data from JSON file.
     * If it doesn't exist, write new file with empty data
     *
     * @param createFile - Whether a file for the user should be made
     * @return userData - User's parsed JSON data
     * @private
     */
    private getUserData(createFile?: boolean): any {
        let userDataJSON: string;
        const config = BoarBotApp.getBot().getConfig();
        const userFile = config.pathConfig.userDataFolder + this.user?.id + '.json';

        try {
            userDataJSON = fs.readFileSync(userFile, 'utf-8');
        } catch {
            const { user, ...fixedObject } = this; // Returns object with all properties except user

            if (createFile) {
                fs.writeFileSync(userFile, JSON.stringify(fixedObject));
                userDataJSON = fs.readFileSync(userFile, 'utf-8');
            } else {
                return fixedObject;
            }
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
        const twoDailiesAgo = Math.floor(new Date().setUTCHours(24,0,0,0)) - (1000 * 60 * 60 * 24 * 2);

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

        if (this.lastDaily < twoDailiesAgo) {
            userData.powerups.multiplier = this.powerups.multiplier -= this.boarStreak;
            userData.boarStreak = this.boarStreak = 0;
        }

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
    public async addBoar(config: BotConfig, boarID: string, interaction: ChatInputCommandInteraction): Promise<void> {
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
            return;
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
        const attachment = await new ItemImageGenerator(this, config, boarID, attachmentTitle).handleImageCreate(false);

        // If regular boar on '/boar daily', reply to interaction with attachment
        // If given, send as separate message and reply to interaction with success
        if (!wasGiven) {
            await interaction.editReply({ files: [attachment] });
        } else {
            await Replies.handleReply(interaction, strConfig.giveBoar);
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
            this.boarCollection[boarID].editions.sort((a, b) => a-b);
            this.boarCollection[boarID].editionDates.push(Date.now());
            this.boarCollection[boarID].editionDates.sort((a, b) => a-b);
        }

        this.lastBoar = boarID;
        this.boarScore += config.rarityConfigs[rarityIndex].score;
        this.totalBoars++;

        this.updateUserData();
        await this.orderBoars(config, interaction);
    }

    /**
     * Add a badge to a user's profile and send an image
     * @param config - Global config data parsed from JSON
     * @param badgeID - ID of badge to add
     * @param interaction - Interaction to reply to with image
     * @return success - The function fully executed
     */
    public async addBadge(config: BotConfig, badgeID: string, interaction: ChatInputCommandInteraction): Promise<void> {
        const strConfig = config.stringConfig;
        const giveCommandConfig = config.commandConfigs.boarDev.give;

        const hasBadge = this.badges.includes(badgeID);
        const wasGiven = interaction.options.getSubcommand() === giveCommandConfig.name;

        if (hasBadge && wasGiven) {
            await Replies.handleReply(interaction, strConfig.giveBadgeHas);
            return;
        }

        if (hasBadge && !wasGiven)
            return;

        const attachmentTitle = wasGiven
            ? strConfig.giveBadgeTitle
            : strConfig.obtainedBadgeTitle;

        const attachment = await new ItemImageGenerator(this, config, badgeID, attachmentTitle).handleImageCreate(true);

        // If gotten from regular means, followup interaction with image
        // If given, send as separate message and reply to interaction with success
        if (!wasGiven) {
            await interaction.followUp({ files: [attachment] });
        } else {
            await Replies.handleReply(interaction, strConfig.giveBadge);
            await interaction.followUp({ files: [attachment] });
        }

        this.badges.push(badgeID);

        this.updateUserData();
    }

    public removeBadge(config: BotConfig, badgeID: string): void {
        if (!this.badges.includes(badgeID)) return;

        this.badges.splice(this.badges.indexOf(badgeID), 1);
        this.updateUserData();
    }

    /**
     * Reorder a user's boars to appear in order when viewing collection
     * @param config - Global config data parsed from JSON
     * @param interaction - Used to give badge if user has max uniques
     */
    public async orderBoars(config: BotConfig, interaction: ChatInputCommandInteraction): Promise<void> {
        const orderedRarities: RarityConfig[] = [...config.rarityConfigs]
            .sort((rarity1, rarity2) => { return rarity1.weight - rarity2.weight; });
        const obtainedBoars = Object.keys(this.boarCollection);
        let numSpecial = 0;
        let numZeroBoars = 0;

        let maxUniques = 0;

        for (const rarity of orderedRarities) {
            if (rarity.name !== 'Special') {
                maxUniques += rarity.boars.length;
            }
        }

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

                if (rarity.name == 'Special') {
                    numSpecial++;
                }

                if (this.boarCollection[curBoarID].num == 0) {
                    numZeroBoars++;
                }

                orderedBoars.push(curBoarID);
                j--;
            }
        }

        if (obtainedBoars.length-numSpecial-numZeroBoars >= maxUniques) {
            await this.addBadge(config, 'hunter', interaction);
        } else {
            await this.removeBadge(config, 'hunter');
        }

        this.updateUserData();
    }
}