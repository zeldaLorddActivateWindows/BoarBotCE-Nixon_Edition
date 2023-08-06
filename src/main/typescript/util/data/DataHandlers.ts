import fs from 'fs';
import {ChatInputCommandInteraction, MessageComponentInteraction} from 'discord.js';
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

enum GlobalFile {
    Items,
    Leaderboards,
    BannedUsers,
    Powerups
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
        ItemsData | Record<string, BoardData> | Record<string, number> | PowerupData
    {
        const config: BotConfig = BoarBotApp.getBot().getConfig();

        const fileName = this.getGlobalFilename(file);

        const dataFile: string = config.pathConfig.globalDataFolder + fileName;
        let data: ItemsData | Record<string, BoardData> | Record<string, number> | PowerupData | undefined;

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
            }

            DataHandlers.saveGlobalData(data, file);
        }

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
            }

            DataHandlers.saveGlobalData(data, file);
        }

        return data;
    }

    public static saveGlobalData(
        data: ItemsData | Record<string, BoardData> | Record<string, number> | PowerupData | undefined,
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
        }

        return fileName;
    }

    public static async updateLeaderboardData(
        boarUser: BoarUser, inter: MessageComponentInteraction | ChatInputCommandInteraction, config: BotConfig
    ): Promise<void> {
        try {
            const boardsData = DataHandlers.getGlobalData(GlobalFile.Leaderboards) as Record<string, BoardData>;
            const userID = boarUser.user.id;

            boardsData.bucks.userData[userID] = boarUser.stats.general.boarScore > 0
                ? boarUser.stats.general.boarScore
                : undefined;
            boardsData.total.userData[userID] = boarUser.stats.general.totalBoars > 0
                ? boarUser.stats.general.totalBoars
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
                ? uniques
                : undefined;

            boardsData.uniquesSB.userData[userID] = Object.keys(boarUser.itemCollection.boars).length > 0
                ? Object.keys(boarUser.itemCollection.boars).length
                : undefined;
            boardsData.streak.userData[userID] = boarUser.stats.general.boarStreak > 0
                ? boarUser.stats.general.boarStreak
                : undefined;
            boardsData.attempts.userData[userID] = boarUser.stats.powerups.attempts > 0
                ? boarUser.stats.powerups.attempts
                : undefined;
            boardsData.topAttempts.userData[userID] = boarUser.stats.powerups.topAttempts > 0
                ? boarUser.stats.powerups.topAttempts
                : undefined;
            boardsData.giftsUsed.userData[userID] = boarUser.itemCollection.powerups.gift.numUsed > 0
                ? boarUser.itemCollection.powerups.gift.numUsed
                : undefined;
            boardsData.multiplier.userData[userID] = boarUser.stats.general.multiplier > 1
                ? boarUser.stats.general.multiplier
                : undefined;

            DataHandlers.saveGlobalData(boardsData, GlobalFile.Leaderboards);
        } catch (err: unknown) {
            await LogDebug.handleError(err, inter);
        }
    }

    public static async removeLeaderboardUser(userID: string) {
        try {
            const boardsData = DataHandlers.getGlobalData(GlobalFile.Leaderboards) as Record<string, BoardData>;

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

            DataHandlers.saveGlobalData(boardsData, GlobalFile.Leaderboards);
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
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