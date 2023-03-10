/**
 * {@link SubcommandArgsConfig SubcommandArgsConfig.ts}
 *
 * Stores subcommand argument configurations for a bot
 * instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
import {ChoicesConfig} from './ChoicesConfig';

export class SubcommandArgsConfig {
    public readonly name: string = '';
    public readonly description: string = '';
    public readonly required: boolean = false;
    public readonly autocomplete: boolean = false;
    public readonly choices: ChoicesConfig[] = [];
}