import {SubcommandConfig} from './SubcommandConfig';
import {CommandConfig} from './CommandConfig';

/**
 * {@link BoarCommandConfig BoarCommandConfig.ts}
 *
 * Stores configurations for the {@link BoarCommand boar command}
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarCommandConfig extends CommandConfig {
    /**
     * {@link SubcommandConfig Subcommand information} for {@link HelpSubcommand}
     */
    public readonly help: SubcommandConfig = new SubcommandConfig;

    /**
     * {@link SubcommandConfig Subcommand information} for {@link DailySubcommand}
     */
    public readonly daily: SubcommandConfig = new SubcommandConfig;

    /**
     * {@link SubcommandConfig Subcommand information} for {@link CollectionSubcommand}
     */
    public readonly collection: SubcommandConfig = new SubcommandConfig;

    /**
     * {@link SubcommandConfig Subcommand information} for {@link TopSubcommand}
     */
    public readonly top: SubcommandConfig = new SubcommandConfig;
}