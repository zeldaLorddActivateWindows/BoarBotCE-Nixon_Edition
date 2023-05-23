import {ChatInputCommandInteraction, TextChannel} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {BotConfig} from '../../bot/config/BotConfig';
import {DataHandlers} from '../data/DataHandlers';
import {Replies} from './Replies';
import {LogDebug} from '../logging/LogDebug';
import {GuildData} from '../data/GuildData';

/**
 * {@link InteractionUtils InteractionUtils.ts}
 *
 * Functions needed by many interactions.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class InteractionUtils {
    /**
     * Handles the beginning of most command interactions to prevent duplicate code
     *
     * @param config - Used to get the string to reply with
     * @param interaction - Interaction to reply to
     * @param includeTrade - Whether to include trade menu when deciding usable channels
     * @return guildData - Guild data parsed from JSON
     */
    public static async handleStart(
        interaction: ChatInputCommandInteraction,
        config: BotConfig,
        includeTrade: boolean = false
    ): Promise<any> {
        if (!interaction.guild || !interaction.channel) return;

        const guildData: GuildData | undefined = await DataHandlers.getGuildData(interaction.guild.id, interaction);
        if (!guildData) return;

        if (!guildData.fullySetup) {
            await Replies.currentConfigReply(interaction, config);
            return;
        }

        const acceptableChannels: string[] = [...guildData.channels];

        if (includeTrade) {
            acceptableChannels.push(guildData.tradeChannel);
        }

        if (!acceptableChannels.includes(interaction.channel.id)) {
            await Replies.wrongChannelReply(interaction, guildData, config, includeTrade);
            return;
        }

        return guildData;
    }

    /**
     * Gets a text channel from ID
     *
     * @param channelID - ID of channel
     */
    public static async getTextChannel(channelID: string): Promise<TextChannel | undefined> {
        let channel: TextChannel;

        try {
            channel = await BoarBotApp.getBot().getClient().channels.fetch(channelID) as TextChannel;
        } catch {
            LogDebug.handleError(
                'Bot cannot find the channel.\nIs the channel ID \'' + channelID +
                '\' correct? Does the bot have view channel permissions?'
            );
            return;
        }

        const memberMe = channel.guild.members.me;
        if (!memberMe) {
            LogDebug.handleError('Bot doesn\'t exist in the server the channel is in.');
            return;
        }

        const memberMePerms = memberMe.permissions.toArray();
        if (!memberMePerms.includes('SendMessages')) {
            LogDebug.handleError('Bot doesn\'t have permission to send messages to channel.', undefined, false);
            return;
        }

        return channel;
    }
}