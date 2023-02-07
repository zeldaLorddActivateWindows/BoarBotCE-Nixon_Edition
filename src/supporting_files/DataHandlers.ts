/************************************************
 * DataHandlers.ts
 * Weslay
 *
 * Handles getting/removing/creating data to/from
 * files
 ***********************************************/

import fs from 'fs';
import {ChatInputCommandInteraction} from 'discord.js';
import {handleError, sendDebug} from './LogDebug';

//***************************************

/**
 * Gets data from global JSON file
 * @return globalData - Global data parsed from JSON
 */
function getGlobalData() {
    const config = getConfigFile();

    const globalFile = config.paths.data.globalFile;

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
    const config = getConfigFile();

    // Config aliases
    const debugStrings = config.strings.debug;
    const generalStrings = config.strings.general;

    const guildDataPath = config.paths.data.guildFolder + interaction.guild?.id + '.json';
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

        sendDebug(debugStrings.noConfig
            .replace('%@', interaction.user.tag)
        );

        await interaction.reply({
            content: generalStrings.noConfig,
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
    const debugStrings = getConfigFile().strings.debug;

    try {
        fs.rmSync(guildDataPath);
    } catch {
        await handleError(debugStrings.deletedFile);
    }
}

//***************************************

export {
    getGlobalData,
    getConfigFile,
    getGuildData,
    removeGuildFile
}