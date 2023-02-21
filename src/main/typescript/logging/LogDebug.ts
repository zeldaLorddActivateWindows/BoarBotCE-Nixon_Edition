/************************************************
 * LogDebug.ts
 * Handles logging information, debugging, and
 * errors.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, EmbedBuilder, Message, ModalSubmitInteraction} from 'discord.js';
import {getConfigFile} from '../util/DataHandlers';

//***************************************

// Console colors
enum Colors {
    White = '\x1b[0m',
    Yellow = '\x1b[33m',
    Grey = '\x1b[90m',
    Green = '\x1b[32m',
    Blue = '\x1b[34m'
}

const errorEmbed = new EmbedBuilder()
    .setColor(0xFF0000);

//***************************************

/**
 * [DEBUG] Sends messages to the console
 * @param debugMessage - Message to send to debug
 */
function sendDebug(debugMessage: any) {
    const config = getConfigFile();

    if (!config.debugMode) return;

    const prefix = `[${Colors.Yellow}DEBUG${Colors.White}] `;
    const time = getPrefixTime();

    console.log(prefix + time + debugMessage);
}

//***************************************

/**
 * Handles error responses in console and interactions
 * @param err - Error message
 * @param interaction - Interaction to reply to
 */
async function handleError(err: unknown | string, interaction?: ChatInputCommandInteraction | ModalSubmitInteraction) {
    try {
        let errString = typeof err === 'string' ? err : (err as Error).stack;
        const prefix = `[${Colors.Green}CAUGHT ERROR${Colors.White}] `;
        const time = getPrefixTime();

        console.log(prefix + time + errString);

        if (!interaction) return;

        const config = getConfigFile();

        const errResponse = config.stringConfig.general.error;

        if (interaction.replied) {
            await interaction.followUp({
                embeds: [errorEmbed.setTitle(errResponse)],
                ephemeral: true
            });
        } else if (interaction.deferred) {
            await interaction.editReply({
                embeds: [errorEmbed.setTitle(errResponse)]
            });
        } else if (Date.now() - interaction.createdTimestamp < 3000) {
            await interaction.reply({
                embeds: [errorEmbed.setTitle(errResponse)],
                ephemeral: true
            });
        }
    } catch (err: unknown) {
        await handleError(err);
    }
}

//***************************************

/**
 * Handles DM reports
 * @param message - Message from DM
 */
async function sendReport(message: Message) {
    const config = getConfigFile();

    // Config aliases
    const debugStrings = config.stringConfig.debug;
    const generalStrings = config.stringConfig.general;

    const prefix = `[${Colors.Blue}DM REPORT${Colors.White}] `;
    const time = getPrefixTime();

    console.log(prefix + time + debugStrings.sentDM
        .replace('%@', message.author.tag)
        .replace('%@', message.content)
    );

    await message.reply(generalStrings.dmReceived);
}

//***************************************

/**
 * [DEBUG] Pauses the code for a specified amount of time
 * @param time - Time in ms to sleep
 */
async function sleep(time: number) {
    return new Promise(r => setTimeout(r, time));
}

//***************************************

// Gets the formatted time that goes after the prefix
function getPrefixTime() {
    return `[${Colors.Grey}${new Date().toLocaleString()}${Colors.White}]\n`;
}

//***************************************

export {
    Colors,
    sendDebug,
    handleError,
    sendReport,
    sleep,
    getPrefixTime
}