import {BotConfig} from '../../bot/config/BotConfig';
import {Command} from '../commands/Command';

/**
 * {@link Bot Bot.ts}
 *
 * An interface used to handle a new bot.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export interface Bot {
    buildClient(): void;
    loadConfig(): void;
    getConfig(): BotConfig;
    setCommands(): void;
    getCommands(): Map<string, Command>;
    deployCommands(): void;
    registerListeners(): void;
    onStart(): void;
    login(): void;
}