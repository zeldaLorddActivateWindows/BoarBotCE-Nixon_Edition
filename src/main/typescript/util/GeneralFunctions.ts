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
import {BoarBotApp} from '../BoarBotApp';
import {RarityConfig} from '../bot/config/items/RarityConfig';
import {BotConfig} from '../bot/config/BotConfig';
import {DataHandlers} from './DataHandlers';
import {Replies} from './Replies';
import {LogDebug} from './logging/LogDebug';

/**
 * {@link GeneralFunctions GeneralFunctions.ts}
 *
 * A collection of functions and variables that
 * still need to be incorporated into individual classes.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class GeneralFunctions {
    private static cooldowns: any = {};

    /**
     * Gets whether bot has attachment perms
     *
     * @param interaction - Gets information from guild
     * @return attachmentPerms - Whether bot has attachment perms
     */
    public static hasAttachmentPerms(
        interaction: ChatInputCommandInteraction | ButtonInteraction |
            SelectMenuInteraction | ModalSubmitInteraction
    ): boolean {
        if (!interaction.guild || !interaction.guild.members.me)
            return false;

        return interaction.guild.members.me.permissions.has('AttachFiles');
    }

    /**
     * Finds the rarity index from a given boar ID
     *
     * @param boarID - Boar ID to get rarity for
     * @return rarity - Rarity of the boar in index form
     */
    public static findRarity(boarID: string): number {
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

    /**
     * Handles the beginning of most command interactions to prevent duplicate code
     *
     * @param config
     * @param interaction - Interaction to reply to
     * @param includeTrade - Whether to include trade menu when deciding usable channels
     * @return guildData - Guild data parsed from JSON
     */
    public static async handleStart(
        config: BotConfig,
        interaction: ChatInputCommandInteraction,
        includeTrade: boolean = false
    ): Promise<any> {
        if (!interaction.guild || !interaction.channel) return;

        LogDebug.sendDebug('Started interaction', config, interaction);

        const guildData = await DataHandlers.getGuildData(interaction);
        if (!guildData) return;

        if (!guildData.channels) {
            await Replies.currentConfigReply(config, interaction);
            return;
        }

        const acceptableChannels: string[] = [].concat(guildData.channels);

        if (includeTrade)
            acceptableChannels.push(guildData.tradeChannel);

        if (!acceptableChannels.includes(interaction.channel.id)) {
            await Replies.wrongChannelReply(config, interaction, guildData, includeTrade);
            return;
        }

        return guildData;
    }

    /**
     * Handles cooldowns for users on certain commands
     *
     * @param config
     * @param interaction - Interaction to reply to
     * @return onCooldown - Whether user is on cooldown or not
     */
    public static async handleCooldown(
        config: BotConfig,
        interaction: ChatInputCommandInteraction
    ): Promise<boolean> {
        const commandName = interaction.commandName;
        const userID = interaction.user.id;

        if (!GeneralFunctions.cooldowns[commandName])
            GeneralFunctions.cooldowns[commandName] = [];

        if (GeneralFunctions.cooldowns[commandName].includes(userID)) {
            await Replies.onCooldownReply(config, interaction);
            return true;
        }

        GeneralFunctions.cooldowns[commandName].push(userID);

        setTimeout(() => {
            const index = GeneralFunctions.cooldowns[commandName].indexOf(userID);
            GeneralFunctions.cooldowns[commandName].splice(index, 1);
        }, 5000);

        return false;
    }
}