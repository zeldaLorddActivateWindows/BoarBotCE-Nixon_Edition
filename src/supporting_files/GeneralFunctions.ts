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
import {sendDebug} from './LogDebug';
import {currentConfigReply, onCooldownReply, wrongChannelReply} from './InteractionReplies';

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
    const config = getConfigFile();

    const rarityArray = Object.keys(config.raritiesInfo);
    let finalRarity: string = '';

    for (const rarity of rarityArray) {
        const boarExists: boolean = config.raritiesInfo[rarity].boars.includes(boarID);

        if (boarExists) {
            finalRarity = rarity;
            break;
        }
    }

    return finalRarity;
}

//***************************************

/**
 * Handles the beginning of most command interactions to prevent duplicate code
 * @param interaction - Interaction to reply to
 * @param includeTrade - Whether to include trade menu when deciding usable channels
 * @return guildData - Guild data parsed from JSON
 */
async function handleStart(interaction: ChatInputCommandInteraction, includeTrade: boolean = false) {
    if (!interaction.guild || !interaction.channel)
        return undefined;

    const config = getConfigFile();

    // Alias for debug strings
    const debugStrings = config.strings.debug;

    sendDebug(debugStrings.usedCommand
        .replace('%@', interaction.user.tag)
        .replace('%@', interaction.options.getSubcommand())
    );

    const guildData = await getGuildData(interaction);

    if (!guildData)
        return undefined;

    if (!guildData.channels) {
        await currentConfigReply(interaction);
        return undefined;
    }

    const acceptableChannels: string[] = guildData.channels;

    if (includeTrade)
        acceptableChannels.push(guildData.tradeChannel)

    if (!acceptableChannels.includes(interaction.channel.id)) {
        await wrongChannelReply(interaction, guildData, includeTrade);
        return undefined;
    }

    return guildData;
}

//***************************************

/**
 * Handles cooldowns for users on certain commands
 * @param interaction - Interaction to reply to
 * @return onCooldown - Whether user is on cooldown or not
 */
async function handleCooldown(interaction: ChatInputCommandInteraction) {
    const commandName = interaction.options.getSubcommand();
    const userID = interaction.user.id;

    if (!cooldowns[commandName])
        cooldowns[commandName] = [];

    if (cooldowns[commandName].includes(userID)) {
        await onCooldownReply(interaction);
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