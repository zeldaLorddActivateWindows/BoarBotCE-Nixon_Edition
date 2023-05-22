import {
    AutocompleteInteraction,
    ChatInputCommandInteraction, ColorResolvable,
    Message, MessageComponentInteraction,
    ModalSubmitInteraction
} from 'discord.js';
import {BotConfig} from '../../bot/config/BotConfig';
import {BoarBotApp} from '../../BoarBotApp';
import {InteractionUtils} from '../interactions/InteractionUtils';
import {Replies} from '../interactions/Replies';

// Console colors
enum Colors {
    White = '\x1b[0m',
    Yellow = '\x1b[33m',
    Grey = '\x1b[90m',
    Green = '\x1b[32m',
    Blue = '\x1b[34m'
}

/**
 * {@link LogDebug LogDebug.ts}
 *
 * Handles util logging information, debugging, and
 * errors.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class LogDebug {
    /**
     * Sends messages to the console
     *
     * @param debugMessage - Message to send to debug
     * @param config - Used to get debug prefix and see if debug mode
     * @param interaction - Whether to prepend string with command and user info
     */
    public static sendDebug(
        debugMessage: any,
        config: BotConfig,
        interaction?: ChatInputCommandInteraction | AutocompleteInteraction | MessageComponentInteraction
    ): void {
        if (!config.debugMode) return;

        const prefix = `[${Colors.Yellow}DEBUG${Colors.White}] `;
        const time = LogDebug.getPrefixTime();

        if (typeof debugMessage !== 'string') {
            debugMessage = JSON.stringify(debugMessage);
        }

        if (interaction && !interaction.isMessageComponent()) {
            debugMessage = config.stringConfig.commandDebugPrefix
                .replace('%@', interaction.user.tag)
                .replace('%@', interaction.commandName)
                .replace('%@', interaction.options.getSubcommand()) +
                debugMessage
        } else if (interaction) {
            debugMessage = config.stringConfig.commandDebugPrefix
                .replace('%@', interaction.user.tag)
                .replace('%@', interaction.customId.split('|')[0])
                .replace('%@', '') +
                debugMessage
        }

        const completeString = prefix + time + debugMessage;

        this.sendLogMessage(completeString, config);
    }

    /**
     * Handles error responses in console and interactions
     *
     * @param err - Error message
     * @param interaction - Interaction to reply to
     */
    public static async handleError(
        err: unknown | string,
        interaction?: ChatInputCommandInteraction | ModalSubmitInteraction |
            AutocompleteInteraction | MessageComponentInteraction
    ): Promise<void> {
        try {
            let errString = typeof err === 'string' ? err : (err as Error).stack;
            const prefix = `[${Colors.Green}CAUGHT ERROR${Colors.White}] `;
            const time = LogDebug.getPrefixTime();
            const config = BoarBotApp.getBot().getConfig();

            let completeString = prefix + time;
            if (interaction && interaction.isChatInputCommand()) {
                completeString += config.stringConfig.commandDebugPrefix
                    .replace('%@', interaction.user.tag)
                    .replace('%@', interaction.commandName)
                    .replace('%@', interaction.options.getSubcommand()) +
                    errString;
            } else {
                completeString += errString;
            }

            await this.sendLogMessage(completeString, config);

            if (!interaction || !interaction.isChatInputCommand()) return;

            let errResponse = config.stringConfig.error;

            await Replies.handleReply(interaction, errResponse, config.colorConfig.error as ColorResolvable);
        } catch (err: unknown) {
            await this.handleError(err);
        }
    }

    /**
     * Handles DM reports
     *
     * @param message - Message from DM
     * @param config - Used to get DM reply string
     */
    public static async sendReport(message: Message, config: BotConfig): Promise<void> {
        const prefix = `[${Colors.Blue}DM REPORT${Colors.White}] `;
        const time = LogDebug.getPrefixTime();
        const completeString = prefix + time + `${message.author.tag} sent: ` + message.content;

        await this.sendLogMessage(completeString, config);

        await message.reply(config.stringConfig.dmReceived);
    }

    /**
     * Pauses the code for a specified amount of time
     *
     * @param time - Time in ms to sleep
     */
    public static async sleep(time: number): Promise<unknown> {
        return new Promise(r => setTimeout(r, time));
    }

    /**
     * Gets the formatted time that goes after the prefix
     *
     * @private
     */
    private static getPrefixTime(): string {
        return `[${Colors.Grey}${new Date().toLocaleString()}${Colors.White}]\n`;
    }

    private static async sendLogMessage(message: string, config: BotConfig): Promise<void> {
        console.log(message);

        if (BoarBotApp.getBot().getClient().isReady()) {
            InteractionUtils.getTextChannel(config.logChannel).then(async (logChannel) => {
                if (!logChannel) return;
                await logChannel.send('```ansi\n' + message.substring(0, 1900) + '```');
            });
        }
    }
}
