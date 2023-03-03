/************************************************
 * DataHandlers.ts
 * Handles getting/removing/creating data to/from
 * files.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import fs from 'fs';
import {ChatInputCommandInteraction} from 'discord.js';
import {handleError, sendDebug} from '../logging/LogDebug';
import {BoarBotApp} from '../BoarBotApp';

//***************************************

/**
 * Gets data from global JSON file
 * @return globalData - Global data parsed from JSON
 */
function getGlobalData() {
    const config = BoarBotApp.getBot().getConfig();

    const globalFile = config.pathConfig.globalDataFile;

    return JSON.parse(fs.readFileSync(globalFile, 'utf-8'));
}

//***************************************

/**
 * Gets data from config JSON file
 * @return configData - Global config data parsed from JSON
 */
function getConfigFile() {
    return JSON.parse(fs.readFileSync('config.json', 'utf-8'));
}

//***************************************

/**
 * Gets data from guild JSON file
 * @param interaction - Interaction to reply to
 * @param create - Whether to create the guildData file if it doesn't exist
 * @return guildData - Guild data parsed from JSON (or undefined if it doesn't exist)
 */
async function getGuildData(interaction: ChatInputCommandInteraction, create: boolean = false) {
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

        sendDebug('Setup not configured', config, interaction);

        await interaction.reply({
            content: strConfig.noSetup,
            ephemeral: true
        });

        return undefined;
    }
}

//***************************************

/**
 * Attempts to remove the guild config file
 * @param guildDataPath - Path of guild data file
 */
async function removeGuildFile(guildDataPath: string) {
    const strConfig = BoarBotApp.getBot().getConfig().stringConfig;

    try {
        fs.rmSync(guildDataPath);
    } catch {
        await handleError('Already deleted this file!');
    }
}

//***************************************

export {
    getGlobalData,
    getConfigFile,
    getGuildData,
    removeGuildFile
}