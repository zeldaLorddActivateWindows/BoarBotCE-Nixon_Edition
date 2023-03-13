import fs from 'fs';
import {ChatInputCommandInteraction} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {LogDebug} from '../logging/LogDebug';

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
     * @return guildData - Guild data parsed from JSON (or undefined if it doesn't exist)
     */
    public static async getGuildData(
        interaction: ChatInputCommandInteraction,
        create: boolean = false
    ): Promise<any> {
        const config = BoarBotApp.getBot().getConfig();

        const strConfig = config.stringConfig;

        const guildDataPath = config.pathConfig.guildDataFolder + interaction.guild?.id + '.json';
        let guildData: any;

        try {
            guildData = JSON.parse(fs.readFileSync(guildDataPath, 'utf-8'));
            return guildData;
        } catch {
            if (create) {
                fs.writeFileSync(guildDataPath, '{}');
                guildData = JSON.parse(fs.readFileSync(guildDataPath, 'utf-8'));
                return guildData;
            }

            LogDebug.sendDebug('Setup not configured', config, interaction);

            await interaction.reply({
                content: strConfig.noSetup,
                ephemeral: true
            });

            return undefined;
        }
    }

    /**
     * Attempts to remove the guild config file
     *
     * @param guildDataPath - Path of guild data file
     * @param guildData - Guild data parsed from JSON (or undefined if it doesn't exist)
     */
    public static async removeGuildFile(guildDataPath: string, guildData: any): Promise<void> {
        if (Object.keys(guildData).length !== 0) return;

        try {
            fs.rmSync(guildDataPath);
        } catch {
            await LogDebug.handleError('Already deleted this file!');
        }
    }
}