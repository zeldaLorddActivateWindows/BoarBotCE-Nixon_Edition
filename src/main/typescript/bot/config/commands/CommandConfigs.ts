import {CommandConfig} from './CommandConfig';

/**
 * {@link CommandConfigs CommandConfigs.ts}
 *
 * Stores all configurations for all commands for a bot
 * instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CommandConfigs {
    /**
     * {@link CommandConfig Command information} for {@link HelpCommand}
     */
    public readonly help: CommandConfig = new CommandConfig;

    /**
     * {@link CommandConfig Command information} for {@link SetupCommand}
     */
    public readonly setup: CommandConfig = new CommandConfig;

    /**
     * {@link CommandConfig Command information} for {@link DailyCommand}
     */
    public readonly daily: CommandConfig = new CommandConfig;

    /**
     * {@link CommandConfig Command information} for {@link GiveCommand}
     */
    public readonly give: CommandConfig = new CommandConfig;

    /**
     * {@link CommandConfig Command information} for {@link CollectionCommand}
     */
    public readonly collection: CommandConfig = new CommandConfig;
}