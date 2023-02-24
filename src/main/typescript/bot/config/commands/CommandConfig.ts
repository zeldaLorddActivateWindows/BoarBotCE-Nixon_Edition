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
    public readonly name: string = '';
    public readonly description: string = '';

    // Arguments the command uses

    public readonly args: CommandArgsConfig[] = [];

    // Tags for the command

    public readonly adminOnly: boolean = false;
    public readonly cooldown: boolean = false;

    // Components and modals associated with a command
    // NOTE: Types should expand as more commands with Components and Modals are added

    public readonly components: SetupComponentConfigs = new SetupComponentConfigs;
    public readonly modals: SetupModalConfigs = new SetupModalConfigs;
}