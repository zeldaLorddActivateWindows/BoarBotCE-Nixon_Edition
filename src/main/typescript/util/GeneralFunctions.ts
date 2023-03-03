/************************************************
 * GeneralFunctions.ts
 * A collection of different functions and vars
 * needed by several files.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    SelectMenuInteraction
} from 'discord.js';
import {getConfigFile, getGuildData} from './DataHandlers';
import {sendDebug} from '../logging/LogDebug';
import {currentConfigReply, onCooldownReply, wrongChannelReply} from './InteractionReplies';
import {BoarBotApp} from '../BoarBotApp';
import {RarityConfig} from '../bot/config/items/RarityConfig';
import {BotConfig} from '../bot/config/BotConfig';

//***************************************

const cooldowns: any = {};

//***************************************

/**
 * Gets whether bot has attachment perms
 * @param interaction - Gets information from guild
 * @return attachmentPerms - Whether bot has attachment perms
 */
function hasAttachmentPerms(interaction: ChatInputCommandInteraction | ButtonInteraction | SelectMenuInteraction | ModalSubmitInteraction) {
    if (!interaction.guild || !interaction.guild.members.me)
        return false;

    return interaction.guild.members.me.permissions.has('AttachFiles');
}

//***************************************

/**
 * Finds the rarity from a given boar ID
 * @param boarID - Boar ID to get rarity for
 * @return rarity - Rarity of the boar
 */
function findRarity(boarID: string) {
    const config = BoarBotApp.getBot().getConfig();

    const orderedRarities: RarityConfig[] = [...config.rarityConfigs]
        .sort((rarity1, rarity2) => { return rarity2.weight - rarity1.weight; });
    let foundRarity: number = 0;

    for (let i=0; i<orderedRarities.length; i++) {
        const boarExists: boolean = orderedRarities[i].boars.includes(boarID);

        if (boarExists) {
            foundRarity = i + 1;
            break;
        }
    }

    return foundRarity;
}

//***************************************

/**
 * Handles the beginning of most command interactions to prevent duplicate code
 * @param config
 * @param interaction - Interaction to reply to
 * @param includeTrade - Whether to include trade menu when deciding usable channels
 * @return guildData - Guild data parsed from JSON
 */
async function handleStart(
    config: BotConfig,
    interaction: ChatInputCommandInteraction,
    includeTrade: boolean = false
) {
    if (!interaction.guild || !interaction.channel)
        return undefined;

    sendDebug('Started interaction', config, interaction);

    const guildData = await getGuildData(interaction);

    if (!guildData)
        return undefined;

    if (!guildData.channels) {
        await currentConfigReply(config, interaction);
        return undefined;
    }

    const acceptableChannels: string[] = [].concat(guildData.channels);

    if (includeTrade)
        acceptableChannels.push(guildData.tradeChannel);

    if (!acceptableChannels.includes(interaction.channel.id)) {
        await wrongChannelReply(config, interaction, guildData, includeTrade);
        return undefined;
    }

    return guildData;
}

//***************************************

/**
 * Handles cooldowns for users on certain commands
 * @param config
 * @param interaction - Interaction to reply to
 * @return onCooldown - Whether user is on cooldown or not
 */
async function handleCooldown(config: BotConfig, interaction: ChatInputCommandInteraction) {
    const commandName = interaction.commandName;
    const userID = interaction.user.id;

    if (!cooldowns[commandName])
        cooldowns[commandName] = [];

    if (cooldowns[commandName].includes(userID)) {
        await onCooldownReply(config, interaction);
        return true;
    }

    cooldowns[commandName].push(userID);

    setTimeout(() => {
        const index = cooldowns[commandName].indexOf(userID);
        cooldowns[commandName].splice(index, 1);
    }, 5000);

    return false;
}

//***************************************

export {
    hasAttachmentPerms,
    findRarity,
    handleStart,
    handleCooldown
}