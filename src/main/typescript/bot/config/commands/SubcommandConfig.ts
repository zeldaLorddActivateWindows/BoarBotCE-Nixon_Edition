import {SubcommandArgsConfig} from './SubcommandArgsConfig';
import {RowConfig} from './RowConfig';
import {ModalConfig} from './ModalConfig';

/**
 * {@link SubcommandConfig SubcommandConfig.ts}
 *
 * Stores a specific subcommand configuration
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

    // Components and modals associated with a command
    // NOTE: Types should expand as more commands with Components and Modals are added

    public readonly componentFields: RowConfig[][] = [];
    public readonly modals: ModalConfig[] = [];

}