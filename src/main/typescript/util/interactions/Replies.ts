import {
    ChatInputCommandInteraction,
    ColorResolvable,
    MessageComponentInteraction,
    ModalSubmitInteraction, TextChannel
} from 'discord.js';
import {BotConfig} from '../../bot/config/BotConfig';
import {LogDebug} from '../logging/LogDebug';
import {BoarBotApp} from '../../BoarBotApp';
import {GuildData} from '../data/GuildData';
import {CustomEmbedGenerator} from '../generators/CustomEmbedGenerator';

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
        interaction: ChatInputCommandInteraction,
        config: BotConfig
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
        interaction: ChatInputCommandInteraction,
        guildData: GuildData | undefined,
        config: BotConfig,
        includeTrade: boolean = false
    ): Promise<void> {
        LogDebug.sendDebug('Used in the wrong channel', config, interaction);

        let strChannels = ' ';

        if (guildData) {
            for (const ch of guildData.channels) {
                try {
                    strChannels += '#' + (
                        await BoarBotApp.getBot().getClient().channels.fetch(ch) as TextChannel
                    ).name + ', ';
                } catch {}
            }

            if (includeTrade) {
                try {
                    strChannels += '#' + (
                        await BoarBotApp.getBot().getClient().channels.fetch(guildData.tradeChannel) as TextChannel
                    ).name;
                } catch {}
            }
        }

        if (strChannels === ' ') {
            strChannels += 'No channels found';
        }

        if (strChannels.endsWith(', ')) {
            strChannels = strChannels.substring(0, strChannels.length-2);
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
        interaction: ChatInputCommandInteraction,
        config: BotConfig
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
        interaction: ChatInputCommandInteraction,
        config: BotConfig
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
        const embedImage = CustomEmbedGenerator.makeEmbed(content, BoarBotApp.getBot().getConfig());

        if (!forceFollowup && interaction.deferred && interaction.isChatInputCommand()) {
            await interaction.editReply({
                files: [embedImage]
            });
        } else if (forceFollowup || interaction.replied || !interaction.isChatInputCommand()) {
            await interaction.followUp({
                files: [embedImage],
                ephemeral: true
            });
        } else {
            await interaction.reply({
                files: [embedImage],
                ephemeral: true
            });
        }
    }
}