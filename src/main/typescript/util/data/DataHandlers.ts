import fs from 'fs';
import {ChatInputCommandInteraction, MessageComponentInteraction, User} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {LogDebug} from '../logging/LogDebug';
import {Replies} from '../interactions/Replies';
import {GuildData} from './global/GuildData';
import {BotConfig} from '../../bot/config/BotConfig';
import {StringConfig} from '../../bot/config/StringConfig';
import {BoarUser} from '../boar/BoarUser';
import {ItemData} from './global/ItemData';
import {BoardData} from './global/BoardData';
import {GitHubData} from './global/GitHubData';
import {ItemsData} from './global/ItemsData';
import {PowerupData} from './global/PowerupData';
import {QuestData} from './global/QuestData';

enum GlobalFile {
    Items,
    Leaderboards,
    BannedUsers,
    Powerups,
    Quest
}

/**
 * {@link DataHandlers DataHandlers.ts}
 *
 * Handles getting/removing/creating data to/from
 * data files.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class DataHandlers {
    public static GlobalFile = GlobalFile;

    /**
     * Gets data from items data JSON file
     *
     * @return itemsData - Items data parsed from JSON
     */
    public static getGlobalData(file: GlobalFile, updating = false):
        ItemsData | Record<string, BoardData> | Record<string, number> | PowerupData | QuestData
    {
        const config: BotConfig = BoarBotApp.getBot().getConfig();

        const fileName = this.getGlobalFilename(file);

        const dataFile: string = config.pathConfig.globalDataFolder + fileName;
        let data: ItemsData | Record<string, BoardData> | Record<string, number> | PowerupData | QuestData | undefined;

        try {
            data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        } catch {}

        if (!data) {
            LogDebug.log('Creating global data file \'' + fileName + '\'...', config);

            switch (file) {
                case GlobalFile.Items:
                    data = new ItemsData();

                    for (const powerupID of Object.keys(config.itemConfigs.powerups)) {
                        data.powerups[powerupID] = new ItemData;
                    }

                    break;
                case GlobalFile.Leaderboards:
                    data = {};

                    for (let i=0; i<config.commandConfigs.boar.top.args[0].choices.length; i++) {
                        const boardID = config.commandConfigs.boar.top.args[0].choices[i].value;
                        data[boardID] = new BoardData;
                    }

                    break;
                case GlobalFile.BannedUsers:
                    data = {};
                    break;
                case GlobalFile.Powerups:
                    data = new PowerupData();
                    break;
                case GlobalFile.Quest:
                    data = new QuestData();
                    break;
            }

            this.saveGlobalData(data, file);
        }

        data = data as ItemsData | Record<string, BoardData> | Record<string, number> | PowerupData | QuestData;

        if (updating) {
            switch (file) {
                case GlobalFile.Items:
                    data = data as ItemsData;
                    for (const powerupID of Object.keys(config.itemConfigs.powerups)) {
                        if (!data.powerups[powerupID]) {
                            data.powerups[powerupID] = new ItemData;
                        }
                    }

                    for (const powerupID of Object.keys(data.powerups)) {
                        if (!Object.keys(config.itemConfigs.powerups).includes(powerupID)) {
                            const powItemData = data.powerups[powerupID];
                            for (const buyOrder of powItemData.buyers) {
                                const boarUser = new BoarUser({id: buyOrder.userID} as User);
                                boarUser.itemCollection.powerups[powerupID].numTotal +=
                                    buyOrder.filledAmount - buyOrder.claimedAmount;
                                boarUser.stats.general.boarScore +=
                                    (buyOrder.num - buyOrder.filledAmount) * buyOrder.price;
                                boarUser.updateUserData();
                            }
                            for (const sellOrder of data.powerups[powerupID].sellers) {
                                const boarUser = new BoarUser({id: sellOrder.userID} as User);
                                boarUser.itemCollection.powerups[powerupID].numTotal +=
                                    sellOrder.num - sellOrder.filledAmount;
                                boarUser.stats.general.boarScore +=
                                    (sellOrder.filledAmount - sellOrder.claimedAmount) * sellOrder.price;
                                boarUser.updateUserData();
                            }
                            delete data.powerups[powerupID];
                        }
                    }

                    break;
                case GlobalFile.Leaderboards:
                    data = data as Record<string, BoardData>;
                    for (let i=0; i<config.commandConfigs.boar.top.args[0].choices.length; i++) {
                        const boardID = config.commandConfigs.boar.top.args[0].choices[i].value;

                        if (!data[boardID]) {
                            data[boardID] = new BoardData;
                        }
                    }

                    for (const boardID of Object.keys(data)) {
                        const boardChoices = config.commandConfigs.boar.top.args[0].choices;
                        const boardValues = boardChoices.map((choice) => { return choice.value; });

                        if (!boardValues.includes(boardID)) {
                            delete data[boardID];
                        }
                    }

                    break;
                case GlobalFile.Quest:
                    data = data as QuestData;

                    if (data.questsStartTimestamp + config.numberConfig.oneDay * 7 < Date.now()) {
                        data = this.updateQuestData(config);
                    }

                    break;
            }

            this.saveGlobalData(data, file);
        }

        return data;
    }

    public static saveGlobalData(
        data: ItemsData | Record<string, BoardData> | Record<string, number> | PowerupData | QuestData | undefined,
        file: GlobalFile
    ) {
        const config: BotConfig = BoarBotApp.getBot().getConfig();
        fs.writeFileSync(config.pathConfig.globalDataFolder + this.getGlobalFilename(file), JSON.stringify(data));
    }

    private static getGlobalFilename(file: GlobalFile): string {
        const config: BotConfig = BoarBotApp.getBot().getConfig();
        let fileName = '';

        switch (file) {
            case GlobalFile.Items:
                fileName = config.pathConfig.itemDataFileName;
                break;
            case GlobalFile.Leaderboards:
                fileName = config.pathConfig.leaderboardsFileName;
                break;
            case GlobalFile.BannedUsers:
                fileName = config.pathConfig.bannedUsersFileName;
                break;
            case GlobalFile.Powerups:
                fileName = config.pathConfig.powerupDataFileName;
                break;
            case GlobalFile.Quest:
                fileName = config.pathConfig.questDataFileName;
                break;
        }

        return fileName;
    }

    public static updateLeaderboardData(
        boarUser: BoarUser, config: BotConfig, inter?: MessageComponentInteraction | ChatInputCommandInteraction
    ): void {
        try {
            const boardsData = this.getGlobalData(GlobalFile.Leaderboards) as Record<string, BoardData>;
            const userID = boarUser.user.id;
            const username = boarUser.user.username;

            boardsData.bucks.userData[userID] = boarUser.stats.general.boarScore > 0
                ? [username, boarUser.stats.general.boarScore]
                : undefined;
            boardsData.total.userData[userID] = boarUser.stats.general.totalBoars > 0
                ? [username, boarUser.stats.general.totalBoars]
                : undefined;

            let uniques = 0;
            for (let i=0; i<Object.keys(boarUser.itemCollection.boars).length; i++) {
                const boarData = boarUser.itemCollection.boars[Object.keys(boarUser.itemCollection.boars)[i]];
                const boarInfo = config.itemConfigs.boars[Object.keys(boarUser.itemCollection.boars)[i]];

                if (boarInfo.isSB) continue;

                if (boarData.num > 0) {
                    uniques++;
                }
            }

            boardsData.uniques.userData[userID] = uniques > 0
                ? [username, uniques]
                : undefined;
            boardsData.uniquesSB.userData[userID] = Object.keys(boarUser.itemCollection.boars).length > 0
                ? [username, Object.keys(boarUser.itemCollection.boars).length]
                : undefined;
            boardsData.streak.userData[userID] = boarUser.stats.general.boarStreak > 0
                ? [username, boarUser.stats.general.boarStreak]
                : undefined;
            boardsData.attempts.userData[userID] = boarUser.stats.powerups.attempts > 0
                ? [username, boarUser.stats.powerups.attempts]
                : undefined;
            boardsData.topAttempts.userData[userID] = boarUser.stats.powerups.oneAttempts > 0
                ? [username, boarUser.stats.powerups.oneAttempts]
                : undefined;
            boardsData.giftsUsed.userData[userID] = boarUser.itemCollection.powerups.gift.numUsed > 0
                ? [username, boarUser.itemCollection.powerups.gift.numUsed]
                : undefined;

            let multiplier = boarUser.stats.general.multiplier;
            for (let i=0; i<(boarUser.itemCollection.powerups.miracle.numActive as number); i++) {
                multiplier += Math.min(Math.ceil(multiplier * 0.05), config.numberConfig.miracleIncreaseMax);
            }

            boardsData.multiplier.userData[userID] = multiplier > 0
                ? [username, multiplier]
                : undefined;
            boardsData.fastest.userData[userID] = boarUser.stats.powerups.fastestTime > 0
                ? [username, boarUser.stats.powerups.fastestTime]
                : undefined;

            this.saveGlobalData(boardsData, GlobalFile.Leaderboards);
        } catch (err: unknown) {
            LogDebug.handleError(err, inter);
        }
    }

    public static async removeLeaderboardUser(userID: string) {
        try {
            const boardsData = this.getGlobalData(GlobalFile.Leaderboards) as Record<string, BoardData>;

            delete boardsData.bucks.userData[userID];
            delete boardsData.total.userData[userID];
            delete boardsData.uniques.userData[userID];
            delete boardsData.streak.userData[userID];
            delete boardsData.attempts.userData[userID];
            delete boardsData.topAttempts.userData[userID];
            delete boardsData.giftsUsed.userData[userID];
            delete boardsData.multiplier.userData[userID];

            boardsData.bucks.topUser = boardsData.bucks.topUser === userID
                ? undefined
                : boardsData.bucks.topUser;
            boardsData.total.topUser = boardsData.total.topUser === userID
                ? undefined
                : boardsData.total.topUser;
            boardsData.uniques.topUser = boardsData.uniques.topUser === userID
                ? undefined
                : boardsData.uniques.topUser;
            boardsData.streak.topUser = boardsData.streak.topUser === userID
                ? undefined
                : boardsData.streak.topUser;
            boardsData.attempts.topUser = boardsData.attempts.topUser === userID
                ? undefined
                : boardsData.attempts.topUser;
            boardsData.topAttempts.topUser = boardsData.topAttempts.topUser === userID
                ? undefined
                : boardsData.topAttempts.topUser;
            boardsData.giftsUsed.topUser = boardsData.giftsUsed.topUser === userID
                ? undefined
                : boardsData.giftsUsed.topUser;
            boardsData.multiplier.topUser = boardsData.multiplier.topUser === userID
                ? undefined
                : boardsData.multiplier.topUser;

            this.saveGlobalData(boardsData, GlobalFile.Leaderboards);
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    public static updateQuestData(config: BotConfig) {
        const data = this.getGlobalData(GlobalFile.Quest) as QuestData;
        const questIDs = Object.keys(config.questConfigs);

        data.questsStartTimestamp = new Date().setUTCHours(0,0,0,0) -
            new Date().getUTCDay() * config.numberConfig.oneDay;

        for (let i=0; i<data.curQuestIDs.length; i++) {
            data.curQuestIDs[i] = questIDs.splice(Math.floor(Math.random() * questIDs.length), 1)[0];
        }

        this.saveGlobalData(data, GlobalFile.Quest);

        return data;
    }

    /**
     * Gets data from guild JSON file
     *
     * @param interaction - Interaction to reply to
     * @param create - Whether to create the guildData file if it doesn't exist
     * @param guildID - Used as replacement for interaction
     * @return guildData - Guild data parsed from JSON (or undefined if it doesn't exist)
     */
    public static async getGuildData(
        guildID: string | undefined,
        interaction?: ChatInputCommandInteraction | MessageComponentInteraction,
        create = false,
    ): Promise<GuildData | undefined> {
        if (!guildID) return;

        const config: BotConfig = BoarBotApp.getBot().getConfig();
        const strConfig: StringConfig = config.stringConfig;

        const guildDataPath: string = config.pathConfig.guildDataFolder + guildID + '.json';

        try {
            return JSON.parse(fs.readFileSync(guildDataPath, 'utf-8'));
        } catch {
            if (create) {
                fs.writeFileSync(guildDataPath, JSON.stringify(new GuildData));
                return JSON.parse(fs.readFileSync(guildDataPath, 'utf-8'));
            }

            if (interaction) {
                LogDebug.log('Setup not configured', config, interaction);
                await Replies.handleReply(interaction, strConfig.noSetup);
            }
        }
    }

    /**
     * Attempts to remove the guild config file
     *
     * @param guildDataPath - Path of guild data file
     * @param guildData - Guild data parsed from JSON (or undefined if it doesn't exist)
     */
    public static async removeGuildFile(guildDataPath: string, guildData: GuildData | undefined): Promise<void> {
        if (!guildData || guildData.fullySetup) return;

        try {
            fs.rmSync(guildDataPath);
        } catch {
            await LogDebug.handleError('Already deleted this file!');
        }
    }

    public static getGithubData(): GitHubData | undefined {
        const config: BotConfig = BoarBotApp.getBot().getConfig();

        const githubFile: string = config.pathConfig.globalDataFolder + config.pathConfig.githubFileName;
        let githubData: GitHubData | undefined;

        try {
            githubData = JSON.parse(fs.readFileSync(githubFile, 'utf-8'));
        } catch {
            if (config.pathConfig.githubFileName) {
                try {
                    githubData = new GitHubData();
                    fs.writeFileSync(githubFile, JSON.stringify(githubData));
                } catch {}
            }
        }

        return githubData;
    }
}