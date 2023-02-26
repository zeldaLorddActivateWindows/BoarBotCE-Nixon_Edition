import {SubcommandConfig} from './SubcommandConfig';
import {CommandConfig} from './CommandConfig';

/**
 * {@link BoarDevCommandConfig BoarDevCommandConfig.ts}
 *
 * Stores configurations for the boar command
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarDevCommandConfig extends CommandConfig {
    /**
     * {@link SubcommandConfig Subcommand information} for {@link GiveCommand}
     */
    public readonly give: SubcommandConfig = new SubcommandConfig;
}