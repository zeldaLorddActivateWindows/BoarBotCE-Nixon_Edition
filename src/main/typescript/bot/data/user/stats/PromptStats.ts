/**
 * {@link PromptStats PromptStats.ts}
 *
 * A collection of user powerup prompt stats.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
import {PromptTypeData} from './PromptTypeData';

export class PromptStats {
    [promptType: string]: PromptTypeData;
}