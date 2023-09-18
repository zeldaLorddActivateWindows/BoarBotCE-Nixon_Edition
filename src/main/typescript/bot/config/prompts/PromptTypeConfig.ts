import {PromptConfig} from './PromptConfig';

/**
 * {@link PromptTypeConfig PromptTypeConfig.ts}
 *
 * Stores a powerup prompt type configuration for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class PromptTypeConfig {
    readonly [promptKey: string]: PromptConfig | string | number;

    public readonly name = '' as string;
    public readonly description = '' as string;
    public readonly rightStyle = 0 as number;
    public readonly wrongStyle = 0 as number;
}