import {
    ChatInputCommandInteraction,
    ColorResolvable,
    EmbedBuilder,
    MessageComponentInteraction,
    ModalSubmitInteraction
} from 'discord.js';
import {BotConfig} from '../../bot/config/BotConfig';
import {FormatStrings} from '../discord/FormatStrings';
import {LogDebug} from '../logging/LogDebug';
import {BoarBotApp} from '../../BoarBotApp';

/**
 * {@link Replies Replies.ts}
 *
 * A collection of replies that are commonly
 * executed.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class Replies {
    /**
     * Handles when user sends command when config file is actively being configured for the first time
     *
     * @param config - Used to get the string to reply with
     * @param interaction - Interaction to reply to
     */
    public static async currentConfigReply(
        config: BotConfig,
        interaction: ChatInputCommandInteraction
    ): Promise<void> {
        LogDebug.sendDebug('Tried to run command while setup being configured', config, interaction);
        await Replies.handleReply(interaction, config.stringConfig.doingSetup);
    }

    /**
     * Handles when user sends command in channel not chosen in config
     *
     * @param config - Used to get the string to reply with
     * @param interaction - Interaction to reply to
     * @param guildData - Used to get the channels that can be used
     * @param includeTrade - Whether to include trade channel in usable channels
     */
    public static async wrongChannelReply(
        config: BotConfig,
        interaction: ChatInputCommandInteraction,
        guildData: any,
        includeTrade: boolean = false
    ): Promise<void> {
        LogDebug.sendDebug('Used in the wrong channel', config, interaction);

        let strChannels = '';

        for (const ch of guildData.channels) {
            strChannels += '\n> ' + FormatStrings.toBasicChannel(ch);
        }

        if (includeTrade) {
            strChannels += '\n> ' + FormatStrings.toBasicChannel(guildData.tradeChannel);
        }

        await Replies.handleReply(interaction, config.stringConfig.wrongChannel + strChannels);
    }

    /**
     * Handles when user sends command they don't have permission for
     *
     * @param config - Used to get the string to reply with
     * @param interaction - Interaction to reply to
     */
    public static async noPermsReply(
        config: BotConfig,
        interaction: ChatInputCommandInteraction
    ): Promise<void> {
        LogDebug.sendDebug('Not a developer', config, interaction);
        await Replies.handleReply(interaction, config.stringConfig.noPermission);
    }

    /**
     * Handles when user sends command that has a cooldown too fast
     *
     * @param config - Used to get the string to reply with
     * @param interaction - Interaction to reply to
     */
    public static async onCooldownReply(
        config: BotConfig,
        interaction: ChatInputCommandInteraction
    ): Promise<void> {
        LogDebug.sendDebug('Currently on cooldown', config, interaction);
        await Replies.handleReply(interaction, config.stringConfig.onCooldown);
    }

    /**
     * Handles reply to all types of interaction states
     *
     * @param interaction - Interaction to reply to
     * @param content - Content of the reply
     * @param color - Color of the embed
     * @param forceFollowup - Forces interaction reply to be a followup
     */
    public static async handleReply(
        interaction: ChatInputCommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
        content: string,
        color: ColorResolvable = BoarBotApp.getBot().getConfig().colorConfig.baseEmbed as ColorResolvable,
        forceFollowup: boolean = false
    ): Promise<void> {
        const responseEmbed: EmbedBuilder = new EmbedBuilder()
            .setColor(color);

        if (content.length > 256) {
            responseEmbed.setDescription(content);
        } else {
            responseEmbed.setTitle(content);
        }

        if (!forceFollowup && interaction.deferred && interaction.isChatInputCommand()) {
            await interaction.editReply({
                content: '',
                files: [],
                components: [],
                embeds: [responseEmbed]
            });
        } else if (forceFollowup || interaction.replied || !interaction.isChatInputCommand()) {
            await interaction.followUp({
                content: '',
                files: [],
                components: [],
                embeds: [responseEmbed],
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '',
                files: [],
                components: [],
                embeds: [responseEmbed],
                ephemeral: true
            });
        }
    }
}