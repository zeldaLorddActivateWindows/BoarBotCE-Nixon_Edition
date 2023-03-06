import {SetupModalConfigs} from '../modals/SetupModalConfigs';
import {SubcommandArgsConfig} from './SubcommandArgsConfig';
import {ComponentConfig} from '../components/ComponentConfig';

/**
 * {@link SubcommandConfig SubcommandConfig.ts}
 *
 * Stores configurations for a specific subcommand
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class SubcommandConfig {
    public readonly name: string = '';
    public readonly description: string = '';

    // Arguments the command uses

    public readonly args: SubcommandArgsConfig[] = [];

    // Tags for the command

    public readonly cooldown: boolean = false;

    // Components and modals associated with a command
    // NOTE: Types should expand as more commands with Components and Modals are added

    public readonly component_rows: ComponentConfig[][][] = [[[]]];
    public readonly modals: SetupModalConfigs = new SetupModalConfigs;
}