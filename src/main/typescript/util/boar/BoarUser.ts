import {
    ChatInputCommandInteraction,
    MessageComponentInteraction,
    User
} from 'discord.js';
import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {BotConfig} from '../../bot/config/BotConfig';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import {Queue} from '../interactions/Queue';
import {DataHandlers} from '../data/DataHandlers';
import {LogDebug} from '../logging/LogDebug';
import {CollectedBoar} from '../data/userdata/collectibles/CollectedBoar';
import {PromptTypeData} from '../data/userdata/stats/PromptTypeData';
import {BoarUtils} from './BoarUtils';
import {NumberConfig} from '../../bot/config/NumberConfig';
import {StringConfig} from '../../bot/config/StringConfig';
import {CollectedItems} from '../data/userdata/collectibles/CollectedItems';
import {UserStats} from '../data/userdata/stats/UserStats';
import {CollectedBadge} from '../data/userdata/collectibles/CollectedBadge';
import {CollectedPowerup} from '../data/userdata/collectibles/CollectedPowerup';
import {ItemData} from '../data/global/ItemData';
import {GuildData} from '../data/global/GuildData';
import {ItemsData} from '../data/global/ItemsData';

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

    public itemCollection: CollectedItems = new CollectedItems;
    public stats: UserStats = new UserStats;

    /**
     * Creates a new BoarUser from data file.
     *
     * @param user - User to base BoarUser off of
     * @param createFile - Whether a file for the user should be made
     */
    constructor(user: User, createFile?: boolean) {
        this.user = user;

        const userData: any = this.refreshUserData(createFile);

        if (createFile || this.stats.general.boarStreak > 0) {
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
        const config: BotConfig = BoarBotApp.getBot().getConfig();
        const userFile: string = config.pathConfig.userDataFolder + this.user.id + '.json';

        try {
            userDataJSON = fs.readFileSync(userFile, 'utf-8');
        } catch {
            const { user, ...fixedObject } = this; // Returns object with all properties except user

            if (createFile) {
                LogDebug.log(`New user! ${user.username} (${user.id}) had their file created`, config, undefined, true);
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
        const userData: any = this.getUserData();

        userData.itemCollection = this.itemCollection;
        userData.stats = this.stats;

        this.fixUserData(userData);
    }

    /**
     * Refreshes data stored in the code by reading the JSON file again
     *
     * @param createFile - Whether to create a file if it doesn't exist
     */
    public refreshUserData(createFile = false): any {
        const userData: any = this.getUserData(createFile);

        this.itemCollection = userData.itemCollection;
        this.stats = userData.stats;

        return userData;
    }

    /**
     * Fixes any potential issues with user data and
     * writes to JSON file
     *
     * @param userData - User's parsed JSON data
     * @private
     */
    private fixUserData(userData: any): void {
        const config: BotConfig = BoarBotApp.getBot().getConfig();
        const userFile: string = config.pathConfig.userDataFolder + this.user.id + '.json';

        const boarsGottenIDs: string[] = Object.keys(this.itemCollection.boars);
        const twoDailiesAgo: number = Math.floor(new Date().setUTCHours(24,0,0,0)) - config.numberConfig.oneDay * 2;

        const nums: NumberConfig = BoarBotApp.getBot().getConfig().numberConfig;

        for (const boarID of boarsGottenIDs) {
            if (Object.keys(config.itemConfigs.boars).includes(boarID)) continue;

            this.stats.general.totalBoars -= this.itemCollection.boars[boarID].num;
            delete this.itemCollection.boars[boarID];

            if (this.stats.general.lastBoar === boarID)
                this.stats.general.lastBoar = '';

            if (this.stats.general.favoriteBoar === boarID)
                this.stats.general.favoriteBoar = '';
        }

        for (const promptType of Object.keys(config.promptConfigs.types)) {
            if (!this.stats.powerups.prompts[promptType]) {
                this.stats.powerups.prompts[promptType] = new PromptTypeData;
            }
        }

        for (const promptType of Object.keys(this.stats.powerups.prompts)) {
            if (!config.promptConfigs.types[promptType]) {
                delete this.stats.powerups.prompts[promptType];
                continue;
            }

            for (const promptID of Object.keys(this.stats.powerups.prompts[promptType])) {
                if (!this.promptExists(promptType, promptID, config)) {
                    delete this.stats.powerups.prompts[promptType][promptID];
                }
            }
        }

        if (!this.itemCollection.powerups.miracle) {
            this.itemCollection.powerups.miracle = new CollectedPowerup;
            this.itemCollection.powerups.miracle.numActive = 0;
        }

        if (!this.itemCollection.powerups.gift) {
            this.itemCollection.powerups.gift = new CollectedPowerup;
            this.itemCollection.powerups.gift.numOpened = 0;
        }

        if (!this.itemCollection.powerups.enhancer) {
            this.itemCollection.powerups.enhancer = new CollectedPowerup;
            this.itemCollection.powerups.enhancer.raritiesUsed = [0,0,0,0,0,0,0];
        }

        this.itemCollection.powerups.miracle.numTotal =
            Math.max(0, Math.min(this.itemCollection.powerups.miracle.numTotal, nums.maxPowBase));
        this.itemCollection.powerups.gift.numTotal =
            Math.max(0, Math.min(this.itemCollection.powerups.gift.numTotal, nums.maxPowBase));
        this.itemCollection.powerups.enhancer.numTotal =
            Math.max(0, Math.min(this.itemCollection.powerups.enhancer.numTotal, nums.maxEnhancers));

        if (this.stats.general.lastDaily < twoDailiesAgo) {
            this.stats.general.boarStreak = 0;
        }
        this.stats.general.highestStreak = Math.max(this.stats.general.boarStreak, this.stats.general.highestStreak);

        if (this.stats.general.unbanTime !== undefined) {
            this.stats.general.unbanTime = undefined;
        }

        let uniques = 0;

        for (const boarID of Object.keys(this.itemCollection.boars)) {
            if (this.itemCollection.boars[boarID].num > 0) {
                uniques++;
            }
        }

        this.stats.general.multiplier = uniques + this.stats.general.highestStreak;
        this.stats.general.multiplier = Math.min(this.stats.general.multiplier, nums.maxPowBase);
        this.stats.general.highestMulti = Math.max(this.stats.general.multiplier, this.stats.general.highestMulti);

        this.stats.general.boarScore = Math.max(this.stats.general.boarScore, 0);

        userData.itemCollection = this.itemCollection;
        userData.stats = this.stats;

        fs.writeFileSync(userFile, JSON.stringify(userData));
    }

    /**
     * Returns whether a given prompt type and id in that prompt type exist in config
     *
     * @param promptType - The type of prompt to search through
     * @param promptID - The ID to find
     * @param config - Used to get prompt data
     * @private
     */
    private promptExists(promptType: string, promptID: string, config: BotConfig): boolean {
        const promptIDs: string[] = Object.keys(config.promptConfigs.types[promptType]);

        for (let i=0; i<promptIDs.length; i++) {
            if (promptIDs[i] === promptID) return true;
        }

        return false;
    }

    /**
     * Add a boar to a user's collection and send an image
     *
     * @param config - Global config data parsed from JSON
     * @param boarIDs - IDs of boars to add
     * @param interaction - Interaction to reply to with image
     * @param scores - The scores to add to a user's score
     */
    public async addBoars(
        boarIDs: string[],
        interaction: ChatInputCommandInteraction | MessageComponentInteraction,
        config: BotConfig,
        scores: number[] = []
    ): Promise<number[]> {
        // Config aliases
        const strConfig: StringConfig = config.stringConfig;
        const numConfig: NumberConfig = config.numberConfig;

        // Rarity information
        const rarities: RarityConfig[] = config.rarityConfigs;
        const rarityInfos: RarityConfig[] = [];

        for (let i=0; i<boarIDs.length; i++) {
            rarityInfos.push({} as RarityConfig);
            for (const rarity of rarities) {
                if (rarity.boars.includes(boarIDs[i])) {
                    rarityInfos[i] = BoarUtils.findRarity(boarIDs[i], config)[1];
                    break;
                }
            }
        }

        for (const info of rarityInfos) {
            if (Object.keys(info).length === 0 || boarIDs.length === 0) {
                await LogDebug.handleError(strConfig.dailyNoBoarFound, interaction);
                return [];
            }
        }

        const boarEditions: number[] = [];
        const bacteriaEditions: number[] = [];

        // Updates global edition data
        await Queue.addQueue(async () => {
            try {
                LogDebug.log('Updating global edition info...', config, interaction);
                const itemsData: ItemsData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;

                // Sets edition numbers
                for (let i=0; i<boarIDs.length; i++) {
                    const boarID = boarIDs[i];
                    const rarityName = rarityInfos[i].name;

                    if (!itemsData.boars[boarID]) {
                        LogDebug.log(`First edition of ${boarID}`, config, interaction, true);

                        itemsData.boars[boarID] = new ItemData;
                        itemsData.boars[boarID].curEdition = 0;
                        const lastBuySell = rarityInfos[i].baseScore === 1
                            ? 4
                            : rarityInfos[i].baseScore;
                        itemsData.boars[boarID].lastBuys[1] = lastBuySell;
                        itemsData.boars[boarID].lastSells[1] = lastBuySell;

                        if (rarityName !== 'Special') {
                            let specialEdition = 0;
                            if (!itemsData.boars['bacteria']) {
                                itemsData.boars['bacteria'] = new ItemData;
                                itemsData.boars['bacteria'].curEdition = 0;
                            }

                            specialEdition = ++(itemsData.boars['bacteria'].curEdition as number);
                            bacteriaEditions.push(specialEdition);
                        }
                    }
                    boarEditions.push(++(itemsData.boars[boarID].curEdition as number));
                }

                this.orderGlobalBoars(itemsData, config);
                DataHandlers.saveGlobalData(itemsData, DataHandlers.GlobalFile.Items);
            } catch (err: unknown) {
                await LogDebug.handleError(err, interaction);
            }
        }, interaction.id + 'global').catch((err) => { throw err });

        await Queue.addQueue(async () => {
            try {
                LogDebug.log('Updating user info...', config, interaction);
                this.refreshUserData();

                for (let i=0; i<boarIDs.length; i++) {
                    const boarID: string = boarIDs[i];

                    LogDebug.log(`Adding ${boarID} to collection`, config, interaction, true);

                    if (!this.itemCollection.boars[boarID]) {
                        this.itemCollection.boars[boarID] = new CollectedBoar;
                        this.itemCollection.boars[boarID].firstObtained = Date.now();
                    }

                    this.itemCollection.boars[boarID].num++;
                    this.itemCollection.boars[boarID].lastObtained = Date.now();

                    if (boarEditions[i] <= numConfig.maxTrackedEditions || rarityInfos[i].name === 'Special') {
                        this.itemCollection.boars[boarID].editions.push(boarEditions[i]);
                        this.itemCollection.boars[boarID].editions.sort((a, b) => a-b);
                        this.itemCollection.boars[boarID].editionDates.push(Date.now());
                        this.itemCollection.boars[boarID].editionDates.sort((a, b) => a-b);
                    }

                    this.stats.general.lastBoar = boarID;
                    this.stats.general.boarScore += scores[i] ? scores[i] : 0;
                }

                this.stats.general.totalBoars += boarIDs.length;

                await this.orderBoars(interaction, config);
                this.updateUserData();
            } catch (err: unknown) {
                await LogDebug.handleError(err, interaction);
            }
        }, interaction.id + this.user.id).catch((err) => { throw err });

        if (bacteriaEditions.length > 0) {
            await Queue.addQueue(async () => {
                this.refreshUserData();

                LogDebug.log(`Adding bacteria to collection`, config, interaction, true);

                if (!this.itemCollection.boars['bacteria']) {
                    this.itemCollection.boars['bacteria'] = new CollectedBoar;
                    this.itemCollection.boars['bacteria'].firstObtained = Date.now();
                }

                this.itemCollection.boars['bacteria'].num += bacteriaEditions.length;
                this.itemCollection.boars['bacteria'].lastObtained = Date.now();

                this.itemCollection.boars['bacteria'].editions =
                    this.itemCollection.boars['bacteria'].editions.concat(bacteriaEditions);
                this.itemCollection.boars['bacteria'].editions.sort((a, b) => a - b);
                this.itemCollection.boars['bacteria'].editionDates = this.itemCollection.boars['bacteria'].editionDates
                    .concat(Array(bacteriaEditions.length).fill(Date.now()));
                this.itemCollection.boars['bacteria'].editionDates.sort((a, b) => a - b);

                this.stats.general.lastBoar = 'bacteria';

                this.stats.general.totalBoars += bacteriaEditions.length;

                await this.orderBoars(interaction, config);
                this.updateUserData();
            }, interaction.id + this.user.id).catch((err) => { throw err });
        }

        await Queue.addQueue(async () => await DataHandlers.updateLeaderboardData(this, interaction, config),
            interaction.id + 'global'
        ).catch((err) => { throw err });

        return boarEditions;
    }

    /**
     * Add a badge to a user's profile and send an image
     *
     * @param badgeID - ID of badge to add
     * @param interaction - Interaction to reply to with image
     * @param inQueue - Whether there's currently a queue running (prevents endless waiting)
     * @return success - The function fully executed
     */
    public async addBadge(
        badgeID: string,
        interaction: ChatInputCommandInteraction | MessageComponentInteraction,
        inQueue = false
    ): Promise<boolean> {
        let hasBadge = false;

        if (inQueue) {
            hasBadge = this.addBadgeToUser(badgeID);
        } else {
            await Queue.addQueue(async () => {
                this.refreshUserData();
                hasBadge = this.addBadgeToUser(badgeID);
                this.updateUserData();
            }, interaction.id + this.user.id).catch((err) => { throw err });
        }

        if (!hasBadge) {
            LogDebug.log(`Added ${badgeID} badge to collection`, BoarBotApp.getBot().getConfig(), interaction, true);
        }

        return hasBadge;
    }

    private addBadgeToUser(badgeID: string): boolean {
        const hasBadge = this.itemCollection.badges[badgeID] !== undefined &&
            this.itemCollection.badges[badgeID].possession;
        if (hasBadge) return hasBadge;

        if (!this.itemCollection.badges[badgeID]) {
            this.itemCollection.badges[badgeID] = new CollectedBadge;
            this.itemCollection.badges[badgeID].firstObtained = Date.now();
        }

        this.itemCollection.badges[badgeID].possession = true;
        this.itemCollection.badges[badgeID].curObtained = Date.now();

        return hasBadge;
    }

    /**
     * Removes a badge if a user has it
     *
     * @param badgeID - ID of badge to remove
     * @param interaction
     * @param inQueue
     */
    public async removeBadge(
        badgeID: string,
        interaction: ChatInputCommandInteraction | MessageComponentInteraction,
        inQueue = false,
    ): Promise<void> {
        if (!this.itemCollection.badges[badgeID] || !this.itemCollection.badges[badgeID].possession) return;

        if (inQueue) {
            this.removeBadgeFromUser(badgeID);
        } else {
            await Queue.addQueue(async () => {
                this.refreshUserData();
                this.removeBadgeFromUser(badgeID);
                this.updateUserData();
            }, interaction.id + this.user.id);
        }

        LogDebug.log(`Removed ${badgeID} badge from collection`, BoarBotApp.getBot().getConfig(), interaction, true);

        this.updateUserData();
    }

    private removeBadgeFromUser(badgeID: string) {
        this.itemCollection.badges[badgeID].possession = false;
        this.itemCollection.badges[badgeID].curObtained = -1;
        this.itemCollection.badges[badgeID].lastLost = Date.now();
        this.itemCollection.badges[badgeID].timesLost++;
    }

    /**
     * Reorder a user's boars to appear in order when viewing collection
     *
     * @param config - Global config data parsed from JSON
     * @param interaction - Used to give badge if user has max uniques
     */
    public async orderBoars(
        interaction: ChatInputCommandInteraction | MessageComponentInteraction,
        config: BotConfig
    ): Promise<void> {
        const obtainedBoars: string[] = Object.keys(this.itemCollection.boars);

        const orderedRarities: RarityConfig[] = [...config.rarityConfigs.slice(0,config.rarityConfigs.length-1)]
            .sort((rarity1, rarity2) => { return rarity1.weight - rarity2.weight; });
        orderedRarities.unshift(config.rarityConfigs[config.rarityConfigs.length-1]);
        let numSpecial = 0;
        let numZeroBoars = 0;

        let maxUniques = 0;
        const guildData: GuildData | undefined = await DataHandlers.getGuildData(interaction.guild?.id);
        const isSBServer: boolean | undefined = guildData?.isSBServer;

        for (const rarity of orderedRarities) {
            if (rarity.name !== 'Special') {
                maxUniques += rarity.boars.length;
            }
        }

        for (const boarID of Object.keys(config.itemConfigs.boars)) {
            const boarInfo = config.itemConfigs.boars[boarID];
            if (!isSBServer && boarInfo.isSB) {
                maxUniques--;
            }
        }

        // Looping through all boar classes (Common -> Special)
        for (const rarity of orderedRarities) {
            const orderedBoars: string[] = [];
            const boarsOfRarity: string[] = rarity.boars;

            // Looping through user's boar collection
            for (let j=0; j<obtainedBoars.length; j++) {
                const curBoarID: string = obtainedBoars[j];                              // ID of current boar
                const curBoarData: CollectedBoar = this.itemCollection.boars[curBoarID]; // Data of current boar

                if (!boarsOfRarity.includes(curBoarID) || orderedBoars.includes(curBoarID))
                    continue;

                // Removes boar from front and add it to the back of the list to refresh the order
                delete this.itemCollection.boars[curBoarID];
                this.itemCollection.boars[curBoarID] = curBoarData;

                if (rarity.name == 'Special') {
                    numSpecial++;
                }

                if (this.itemCollection.boars[curBoarID].num == 0) {
                    numZeroBoars++;
                }

                orderedBoars.push(curBoarID);
                j--;
            }
        }

        if (obtainedBoars.length-numSpecial-numZeroBoars >= maxUniques) {
            await this.addBadge('hunter', interaction, true);
        } else {
            await this.removeBadge('hunter', interaction, true);
        }
    }

    private orderGlobalBoars(itemsData: ItemsData, config: BotConfig): void {
        const globalBoars: string[] = Object.keys(itemsData.boars);

        const orderedRarities: RarityConfig[] = [...config.rarityConfigs]
            .sort((rarity1, rarity2) => { return rarity1.weight - rarity2.weight; });

        // Looping through all boar classes (Common -> Special)
        for (const rarity of orderedRarities) {
            const orderedBoars: string[] = [];
            const boarsOfRarity: string[] = rarity.boars;

            // Looping through user's boar collection
            for (let j=0; j<globalBoars.length; j++) {
                const curBoarID: string = globalBoars[j];                           // ID of current boar
                const curBoarData: ItemData = itemsData.boars[curBoarID]; // Data of current boar

                if (!boarsOfRarity.includes(curBoarID) || orderedBoars.includes(curBoarID))
                    continue;

                // Removes boar from front and add it to the back of the list to refresh the order
                delete itemsData.boars[curBoarID];
                itemsData.boars[curBoarID] = curBoarData;

                orderedBoars.push(curBoarID);
                j--;
            }
        }
    }
}