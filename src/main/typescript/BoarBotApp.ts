import {BoarBot} from './bot/BoarBot';
import {Bot} from './api/bot/Bot';
import {LogDebug} from './util/logging/LogDebug';

/**
 * {@link BoarBotApp BoarBotApp.ts}
 *
 * Creates the bot instance using
 * CLI args.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarBotApp {
    private static bot: Bot;

    public static async main(): Promise<void> {
        const boarBot: BoarBot = new BoarBot();
        this.bot = boarBot;

        await boarBot.create();

        if (process.argv[2] === 'deploy') {
            await boarBot.deployCommands();
        }
    }

    public static getBot(): Bot {
        return this.bot;
    }
}

try {
    BoarBotApp.main();
} catch (err: unknown) {
    LogDebug.handleError(err);
}