import {ChatInputCommandInteraction, EmbedBuilder, Message, ModalSubmitInteraction} from 'discord.js';
import {BotConfig} from '../../bot/config/BotConfig';
import {BoarBotApp} from '../../BoarBotApp';

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
 * Handles util.logging information, debugging, and
 * errors.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class LogDebug {
    public static readonly Colors = Colors;
    public static readonly errorEmbed = new EmbedBuilder().setColor(0xFF0000);

    /**
     * [DEBUG] Sends messages to the console
     *
     * @param debugMessage - Message to send to debug
     * @param config - Configuration file
     * @param interaction - Whether to prepend string with command and user info
     */
    public static sendDebug(
        debugMessage: any,
        config: BotConfig,
        interaction?: ChatInputCommandInteraction
    ): void {
        if (!config.debugMode) return;

        const prefix = `[${Colors.Yellow}DEBUG${Colors.White}] `;
        const time = LogDebug.getPrefixTime();

        if (typeof debugMessage !== 'string') {
            debugMessage = JSON.stringify(debugMessage);
        }

        if (interaction) {
            debugMessage = config.stringConfig.commandDebugPrefix
                    .replace('%@', interaction.user.tag)
                    .replace('%@', interaction.commandName)
                    .replace('%@', interaction.options.getSubcommand()) +
                debugMessage
        }

        console.log(prefix + time + debugMessage);
    }

    /**
     * Handles error responses in console and interactions
     *
     * @param err - Error message
     * @param interaction - Interaction to reply to
     */
    public static async handleError(
        err: unknown | string,
        interaction?: ChatInputCommandInteraction | ModalSubmitInteraction
    ): Promise<void> {
        try {
            let errString = typeof err === 'string' ? err : (err as Error).stack;
            const prefix = `[${Colors.Green}CAUGHT ERROR${Colors.White}] `;
            const time = LogDebug.getPrefixTime();

            console.log(prefix + time + errString);

            if (!interaction) return;

            const config = BoarBotApp.getBot().getConfig();
            const errResponse = config.stringConfig.error;

            if (interaction.replied) {
                await interaction.followUp({
                    embeds: [LogDebug.errorEmbed.setTitle(errResponse)],
                    ephemeral: true
                });
            } else if (interaction.deferred) {
                await interaction.editReply({
                    embeds: [LogDebug.errorEmbed.setTitle(errResponse)]
                });
            } else if (Date.now() - interaction.createdTimestamp < 3000) {
                await interaction.reply({
                    embeds: [LogDebug.errorEmbed.setTitle(errResponse)],
                    ephemeral: true
                });
            }
        } catch (err: unknown) {
            await this.handleError(err);
        }
    }

    /**
     * Handles DM reports
     *
     * @param message - Message from DM
     * @param config
     */
    public static async sendReport(message: Message, config: BotConfig): Promise<void> {
        const prefix = `[${Colors.Blue}DM REPORT${Colors.White}] `;
        const time = LogDebug.getPrefixTime();

        console.log(prefix + time + `${message.author.tag} sent: ` + message.content);

        await message.reply(config.stringConfig.dmReceived);
    }

    /**
     * [DEBUG] Pauses the code for a specified amount of time
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
}
