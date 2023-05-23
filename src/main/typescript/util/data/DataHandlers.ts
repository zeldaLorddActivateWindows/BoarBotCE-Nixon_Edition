import fs from 'fs';
import {ChatInputCommandInteraction, MessageComponentInteraction} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {LogDebug} from '../logging/LogDebug';
import {Replies} from '../interactions/Replies';
import {GuildData} from './GuildData';

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
        const config = BoarBotApp.getBot().getConfig();

        const globalFile = config.pathConfig.globalDataFile;

        return JSON.parse(fs.readFileSync(globalFile, 'utf-8'));
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

        const config = BoarBotApp.getBot().getConfig();
        const strConfig = config.stringConfig;

        const guildDataPath = config.pathConfig.guildDataFolder + guildID + '.json';

        try {
            JSON.parse(fs.readFileSync(guildDataPath, 'utf-8'));
            return BoarBotApp.getBot().getGuildData()[guildID];
        } catch {
            if (create) {
                fs.writeFileSync(guildDataPath, JSON.stringify(new GuildData));
                return BoarBotApp.getBot().getGuildData()[guildID] =
                    JSON.parse(fs.readFileSync(guildDataPath, 'utf-8')) as GuildData;
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