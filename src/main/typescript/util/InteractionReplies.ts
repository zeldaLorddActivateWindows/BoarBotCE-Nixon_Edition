/***********************************************
 * InteractionReplies.ts
 * A collection of replies that are commonly
 * executed.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction} from 'discord.js';
import {getConfigFile} from './DataHandlers';
import {sendDebug} from '../logging/LogDebug';
import {BoarBotApp} from '../BoarBotApp';
import {BotConfig} from '../bot/config/BotConfig';
import {FormatStrings} from './discord/FormatStrings';

//***************************************

/**
 * Handles when user sends command when config file is actively being configured for the first time
 * @param config
 * @param interaction - Interaction to reply to
 */
async function currentConfigReply(config: BotConfig, interaction: ChatInputCommandInteraction) {
    sendDebug('Tried to run command while setup being configured', config, interaction);

    await handleReply(interaction, config.stringConfig.doingSetup);
}

//***************************************

/**
 * Handles when user sends command in channel not chosen in config
 * @param config
 * @param interaction - Interaction to reply to
 * @param guildData -
 * @param includeTrade
 */
async function wrongChannelReply(
    config: BotConfig,
    interaction: ChatInputCommandInteraction,
    guildData: any,
    includeTrade: boolean = false
) {
    sendDebug('Used in the wrong channel', config, interaction);

    let strChannels = '\n';

    for (const ch of guildData.channels) {
        strChannels += '> ' + FormatStrings.toBasicChannel(ch);
    }

    if (includeTrade) {
        strChannels += '> ' + FormatStrings.toBasicChannel(guildData.tradeChannel);
    }

    await handleReply(interaction, config.stringConfig.wrongChannel + strChannels);
}

//***************************************

/**
 * Handles when user sends command they don't have permission for
 * @param config
 * @param interaction - Interaction to reply to
 */
async function noPermsReply(config: BotConfig, interaction: ChatInputCommandInteraction) {
    sendDebug('Not a developer', config, interaction);

    await handleReply(interaction, config.stringConfig.noPermission);
}

//***************************************

/**
 * Handles when user sends command that has a cooldown too fast
 * @param config
 * @param interaction - Interaction to reply to
 */
async function onCooldownReply(config: BotConfig, interaction: ChatInputCommandInteraction) {
    sendDebug('Currently on cooldown', config, interaction);

    await handleReply(interaction, config.stringConfig.onCooldown);
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