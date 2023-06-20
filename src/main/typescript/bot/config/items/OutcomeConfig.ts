import {OutcomeSubConfig} from './OutcomeSubConfig';

/**
 * {@link OutcomeConfig OutcomeConfig.ts}
 *
 * Stores an outcome configuration for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class OutcomeConfig {
    public readonly weight: number = 0;
    public readonly category: string = ' ';
    public readonly suboutcomes: OutcomeSubConfig[] = []
}