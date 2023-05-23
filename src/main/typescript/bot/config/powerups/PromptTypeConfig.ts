import {PromptConfig} from './PromptConfig';
import {RowConfig} from '../components/RowConfig';

/**
 * {@link PromptTypeConfig PromptTypeConfig.ts}
 *
 * Stores a powerup prompt type configuration for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class PromptTypeConfig {
    [promptKey: string]: PromptConfig | string | RowConfig[];

    public readonly name: string = ' ';
    public readonly description: string = ' ';
    public readonly rows: RowConfig[] = [];
}