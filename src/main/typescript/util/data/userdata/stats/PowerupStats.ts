import {PromptStats} from './PromptStats';

/**
 * {@link PowerupStats PowerupStats.ts}
 *
 * A collection of user powerup stats.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class PowerupStats {
    public attempts: number = 0;
    public oneAttempts: number = 0;
    public tenAttempts: number = 0;
    public fiftyAttempts: number = 0;
    public prompts: PromptStats = new PromptStats;
}