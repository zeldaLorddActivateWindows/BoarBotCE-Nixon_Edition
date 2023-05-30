import fs from 'fs';
import {ChatInputCommandInteraction, MessageComponentInteraction} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {LogDebug} from '../logging/LogDebug';
import {Replies} from '../interactions/Replies';
import {GuildData} from './GuildData';
import {BotConfig} from '../../bot/config/BotConfig';
import {StringConfig} from '../../bot/config/StringConfig';
import {BoarUser} from '../boar/BoarUser';

/**
 * {@link DataHandlers DataHandlers.ts}
 *
 * Handles getting/removing/creating data to/from
 * data files.
 * MOVE USER DATA HANDLING HERE MAYBE [FIXFIXFIX]
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
    public static getGlobalData(): any {
        const config: BotConfig = BoarBotApp.getBot().getConfig();

        const globalFile: string = config.pathConfig.globalDataFile;

        return JSON.parse(fs.readFileSync(globalFile, 'utf-8'));
    }

    public static updateLeaderboardData(boarUser: BoarUser): void {
        const globalData = DataHandlers.getGlobalData();
        const userID = boarUser.user.id;

        globalData.leaderboardData.bucks[userID] = boarUser.boarScore > 0
            ? boarUser.boarScore
            : undefined;
        globalData.leaderboardData.total[userID] = boarUser.totalBoars > 0
            ? boarUser.totalBoars
            : undefined;
        globalData.leaderboardData.uniques[userID] = Object.keys(boarUser.boarCollection).length > 0
            ? Object.keys(boarUser.boarCollection).length
            : undefined;
        globalData.leaderboardData.streak[userID] = boarUser.boarStreak > 0
            ? boarUser.boarStreak
            : undefined;
        globalData.leaderboardData.attempts[userID] = boarUser.powerups.powerupAttempts > 0
            ? boarUser.powerups.powerupAttempts
            : undefined;
        globalData.leaderboardData.topAttempts[userID] = boarUser.powerups.powerupAttempts1 > 0
            ? boarUser.powerups.powerupAttempts1
            : undefined;
        globalData.leaderboardData.giftsUsed[userID] = boarUser.powerups.giftsUsed > 0
            ? boarUser.powerups.giftsUsed
            : undefined;
        globalData.leaderboardData.multiplier[userID] = boarUser.powerups.multiplier > 1
            ? boarUser.powerups.multiplier
            : undefined;

        fs.writeFileSync(BoarBotApp.getBot().getConfig().pathConfig.globalDataFile, JSON.stringify(globalData));
    }

    public static removeLeaderboardUser(userID: string) {
        const globalData = DataHandlers.getGlobalData();

        globalData.leaderboardData.bucks[userID] = undefined;
        globalData.leaderboardData.total[userID] = undefined;
        globalData.leaderboardData.uniques[userID] = undefined;
        globalData.leaderboardData.streak[userID] = undefined;
        globalData.leaderboardData.attempts[userID] = undefined;
        globalData.leaderboardData.topAttempts[userID] = undefined;
        globalData.leaderboardData.giftsUsed[userID] = undefined;
        globalData.leaderboardData.multiplier[userID] = undefined;

        fs.writeFileSync(BoarBotApp.getBot().getConfig().pathConfig.globalDataFile, JSON.stringify(globalData));
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
        create: boolean = false,
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