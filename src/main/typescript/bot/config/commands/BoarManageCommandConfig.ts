import {SubcommandConfig} from './SubcommandConfig';
import {CommandConfig} from './CommandConfig';

/**
 * {@link BoarManageCommandConfig BoarManageCommandConfig.ts}
 *
 * Stores configurations for the boar command
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarManageCommandConfig extends CommandConfig {
    /**
     * {@link SubcommandConfig Subcommand information} for {@link SetupSubcommand}
     */
    public readonly setup: SubcommandConfig = new SubcommandConfig;
}