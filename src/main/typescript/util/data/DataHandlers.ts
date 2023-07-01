import fs from 'fs';
import {ChatInputCommandInteraction, MessageComponentInteraction} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {LogDebug} from '../logging/LogDebug';
import {Replies} from '../interactions/Replies';
import {GuildData} from './global/GuildData';
import {BotConfig} from '../../bot/config/BotConfig';
import {StringConfig} from '../../bot/config/StringConfig';
import {BoarUser} from '../boar/BoarUser';
import {GlobalData} from './global/GlobalData';

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
    /**
     * Gets data from global JSON file
     *
     * @return globalData - Global data parsed from JSON
     */
    public static getGlobalData(): GlobalData {
        const config: BotConfig = BoarBotApp.getBot().getConfig();

        const globalFile: string = config.pathConfig.globalDataFile;

        return JSON.parse(fs.readFileSync(globalFile, 'utf-8'));
    }

    public static async updateLeaderboardData(
        boarUser: BoarUser, inter: MessageComponentInteraction | ChatInputCommandInteraction, config: BotConfig
    ): Promise<void> {
        try {
            const globalData = DataHandlers.getGlobalData();
            const userID = boarUser.user.id;

            globalData.leaderboardData.bucks.userData[userID] = boarUser.stats.general.boarScore > 0
                ? boarUser.stats.general.boarScore
                : undefined;
            globalData.leaderboardData.total.userData[userID] = boarUser.stats.general.totalBoars > 0
                ? boarUser.stats.general.totalBoars
                : undefined;

            let uniques = 0;

            for (let i=0; i<Object.keys(boarUser.itemCollection.boars).length; i++) {
                const boarInfo = config.itemConfigs.boars[Object.keys(boarUser.itemCollection.boars)[i]];

                if (boarInfo.isSB) continue;

                uniques++;
            }

            globalData.leaderboardData.uniques.userData[userID] = uniques > 0
                ? uniques
                : undefined;

            globalData.leaderboardData.uniquesSB.userData[userID] = Object.keys(boarUser.itemCollection.boars).length > 0
                ? Object.keys(boarUser.itemCollection.boars).length
                : undefined;
            globalData.leaderboardData.streak.userData[userID] = boarUser.stats.general.boarStreak > 0
                ? boarUser.stats.general.boarStreak
                : undefined;
            globalData.leaderboardData.attempts.userData[userID] = boarUser.stats.powerups.attempts > 0
                ? boarUser.stats.powerups.attempts
                : undefined;
            globalData.leaderboardData.topAttempts.userData[userID] = boarUser.stats.powerups.oneAttempts > 0
                ? boarUser.stats.powerups.oneAttempts
                : undefined;
            globalData.leaderboardData.giftsUsed.userData[userID] = boarUser.itemCollection.powerups.gift.numUsed > 0
                ? boarUser.itemCollection.powerups.gift.numUsed
                : undefined;
            globalData.leaderboardData.multiplier.userData[userID] = boarUser.stats.general.multiplier > 1
                ? boarUser.stats.general.multiplier
                : undefined;

            fs.writeFileSync(BoarBotApp.getBot().getConfig().pathConfig.globalDataFile, JSON.stringify(globalData));
        } catch (err: unknown) {
            await LogDebug.handleError(err, inter);
        }
    }

    public static async removeLeaderboardUser(userID: string) {
        try {
            const globalData = DataHandlers.getGlobalData();

            globalData.leaderboardData.bucks.userData[userID] = undefined;
            globalData.leaderboardData.total.userData[userID] = undefined;
            globalData.leaderboardData.uniques.userData[userID] = undefined;
            globalData.leaderboardData.streak.userData[userID] = undefined;
            globalData.leaderboardData.attempts.userData[userID] = undefined;
            globalData.leaderboardData.topAttempts.userData[userID] = undefined;
            globalData.leaderboardData.giftsUsed.userData[userID] = undefined;
            globalData.leaderboardData.multiplier.userData[userID] = undefined;

            globalData.leaderboardData.bucks.topUser = globalData.leaderboardData.bucks.topUser === userID
                ? undefined
                : globalData.leaderboardData.bucks.topUser;
            globalData.leaderboardData.total.topUser = globalData.leaderboardData.total.topUser === userID
                ? undefined
                : globalData.leaderboardData.total.topUser;
            globalData.leaderboardData.uniques.topUser = globalData.leaderboardData.uniques.topUser === userID
                ? undefined
                : globalData.leaderboardData.uniques.topUser;
            globalData.leaderboardData.streak.topUser = globalData.leaderboardData.streak.topUser === userID
                ? undefined
                : globalData.leaderboardData.streak.topUser;
            globalData.leaderboardData.attempts.topUser = globalData.leaderboardData.attempts.topUser === userID
                ? undefined
                : globalData.leaderboardData.attempts.topUser;
            globalData.leaderboardData.topAttempts.topUser = globalData.leaderboardData.topAttempts.topUser === userID
                ? undefined
                : globalData.leaderboardData.topAttempts.topUser;
            globalData.leaderboardData.giftsUsed.topUser = globalData.leaderboardData.giftsUsed.topUser === userID
                ? undefined
                : globalData.leaderboardData.giftsUsed.topUser;
            globalData.leaderboardData.multiplier.topUser = globalData.leaderboardData.multiplier.topUser === userID
                ? undefined
                : globalData.leaderboardData.multiplier.topUser;

            fs.writeFileSync(BoarBotApp.getBot().getConfig().pathConfig.globalDataFile, JSON.stringify(globalData));
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
                LogDebug.sendDebug('Setup not configured', config, interaction);
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
}