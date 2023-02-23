import {CommandArgsConfig} from './CommandArgsConfig';
import {SetupComponentConfigs} from '../components/SetupComponentConfigs';
import {SetupModalConfigs} from '../modals/SetupModalConfigs';

/**
 * {@link CommandConfig CommandConfig.ts}
 *
 * Stores configurations for a specific command
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CommandConfig {
    public name: string = '';
    public description: string = '';

    // Arguments the command uses
    public args: CommandArgsConfig[] = [];

    // Tags for the command
    public adminOnly: boolean = false;
    public cooldown: boolean = false;

    // Components and modals associated with a command
    // NOTE: Types should expand as more commands with Components and Modals are added
    public components: SetupComponentConfigs = new SetupComponentConfigs;
    public modals: SetupModalConfigs = new SetupModalConfigs;
}