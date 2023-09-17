import {PromptTypeConfigs} from './PromptTypeConfigs';
import {RowConfig} from '../commands/RowConfig';

/**
 * {@link PromptConfigs PromptConfigs.ts}
 *
 * Stores powerup configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class PromptConfigs {
    public readonly types: PromptTypeConfigs = new PromptTypeConfigs;
    public readonly rows: RowConfig[] = [];
}