/************************************************
 * LogDebug.ts
 * Weslay
 *
 * Handles logging information, debugging, and
 * errors
 ***********************************************/

import {ChatInputCommandInteraction, EmbedBuilder, Message, ModalSubmitInteraction} from 'discord.js';
import {getConfigFile} from './DataHandlers';

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

// [DEBUG] Sends messages to the console
function sendDebug(debugMessage: any) {
    const config = getConfigFile();

    if (!config.debugMode) return;

    const prefix = `[${Colors.Yellow}DEBUG${Colors.White}] `;
    const time = getPrefixTime();

    console.log(prefix + time + debugMessage);
}

//***************************************

// Handles error responses in console and interactions
async function handleError(err: unknown | string, interaction?: ChatInputCommandInteraction | ModalSubmitInteraction) {
    try {
        let errString = typeof err === 'string' ? err : (err as Error).stack;
        const prefix = `[${Colors.Green}SAFE${Colors.White}] `;
        const time = getPrefixTime();

        console.log(prefix + time + errString);

        if (!interaction) return;

        const config = getConfigFile();

        const errResponse = config.strings.general.error;

        if (interaction.replied) {
            await interaction.followUp({
                embeds: [errorEmbed.setTitle(errResponse)],
                ephemeral: true
            });
        } else if (interaction.deferred) {
            await interaction.editReply({
                embeds: [errorEmbed.setTitle(errResponse)]
            });
        } else {
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

// Handles DM reports
async function sendReport(message: Message) {
    const config = getConfigFile();

    // Config aliases
    const debugStrings = config.strings.debug;
    const generalStrings = config.strings.general;

    const prefix = `[${Colors.Blue}DM REPORT${Colors.White}] `;
    const time = getPrefixTime();

    console.log(prefix + time + debugStrings.sentDM
        .replace('%@', message.author.tag)
        .replace('%@', message.content)
    );

    await message.reply(generalStrings.dmReceived);
}

//***************************************

// [DEBUG] Pauses the code for a specified amount of time
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