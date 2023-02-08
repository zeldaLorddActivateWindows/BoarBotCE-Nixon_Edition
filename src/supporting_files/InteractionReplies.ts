/***********************************************
 * InteractionReplies.ts
 * Weslay
 *
 * A collection of replies that are commonly
 * executed
 ***********************************************/

import {ChatInputCommandInteraction} from 'discord.js';
import {getConfigFile} from './DataHandlers';
import {sendDebug} from './LogDebug';

//***************************************

/**
 * Handles when user sends command when config file is actively being configured for the first time
 * @param interaction - Interaction to reply to
 */
async function currentConfigReply(interaction: ChatInputCommandInteraction) {
    const config = getConfigFile();

    const debugStrings = config.strings.debug;
    const generalStrings = config.strings.general;

    sendDebug(debugStrings.duringConfig
        .replace('%@', interaction.user.tag)
        .replace('%@', interaction.options.getSubcommand())
    );

    await handleReply(interaction, generalStrings.currentConfig);
}

//***************************************

/**
 * Handles when user sends command in channel not chosen in config
 * @param interaction - Interaction to reply to
 * @param guildData -
 * @param includeTrade
 */
async function wrongChannelReply(interaction: ChatInputCommandInteraction, guildData: any, includeTrade: boolean = false) {
    const config = getConfigFile();

    const debugStrings = config.strings.debug;
    const generalStrings = config.strings.general;

    sendDebug(debugStrings.wrongChannel
        .replace('%@', interaction.user.tag)
        .replace('%@', interaction.options.getSubcommand())
    );

    let strChannels = '\n';

    for (const ch of guildData.channels) {
        strChannels += '> ' + generalStrings.formattedChannel
            .replace('%@', ch) + '\n';
    }

    if (includeTrade)
        strChannels += '> ' + generalStrings.formattedChannel
            .replace('%@', guildData.tradeChannel);

    await handleReply(interaction, generalStrings.wrongChannel + strChannels);
}

//***************************************

/**
 * Handles when user sends command they don't have permission for
 * @param interaction - Interaction to reply to
 */
async function noPermsReply(interaction: ChatInputCommandInteraction) {
    const config = getConfigFile();

    const debugStrings = config.strings.debug;
    const generalStrings = config.strings.general;

    sendDebug(debugStrings.notDev
        .replace('%@', interaction.user.tag)
        .replace('%@', interaction.options.getSubcommand())
    );

    await handleReply(interaction, generalStrings.noPermission);
}

//***************************************

/**
 * Handles when user sends command that has a cooldown too fast
 * @param interaction - Interaction to reply to
 */
async function onCooldownReply(interaction: ChatInputCommandInteraction) {
    const config = getConfigFile();

    const debugStrings = config.strings.debug;
    const generalStrings = config.strings.general;

    sendDebug(debugStrings.onCooldown
        .replace('%@', interaction.user.tag)
        .replace('%@', interaction.options.getSubcommand())
    );

    await handleReply(interaction, generalStrings.onCooldown);
}

//***************************************

/**
 * Handles reply to all types of interaction states
 * @param interaction - Interaction to reply to
 * @param content - Content of the reply
 */
async function handleReply(interaction: ChatInputCommandInteraction, content: string) {
    if (interaction.replied) {
        await interaction.followUp({
            content: content,
            ephemeral: true
        });
    } else if (interaction.deferred) {
        await interaction.editReply(content);
    } else {
        await interaction.reply({
            content: content,
            ephemeral: true
        });
    }
}

//***************************************

export {
    currentConfigReply,
    wrongChannelReply,
    noPermsReply,
    onCooldownReply
}