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

// Gets data from global JSON file
function getGlobalData() {
    const config = getConfigFile();

    const globalFile = config.paths.data.globalFile;

    return JSON.parse(fs.readFileSync(globalFile, 'utf-8'));
}

//***************************************

// Gets data from config JSON file
function getConfigFile() {
    return JSON.parse(fs.readFileSync('config.json', 'utf-8'));
}

//***************************************

// Gets data from guild JSON file
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

        return null;
    }
}

//***************************************

// Attempts to remove the guild config file
async function removeGuildFile(guildDataPath: string, debugStrings: any) {
    try {
        fs.rmSync(guildDataPath);
    } catch {
        await handleError(debugStrings.deletedFile);
    }
}

export {
    getGlobalData,
    getConfigFile,
    getGuildData,
    removeGuildFile
}