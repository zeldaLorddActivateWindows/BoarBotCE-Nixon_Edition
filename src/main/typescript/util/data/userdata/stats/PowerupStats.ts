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
    public attempts = 0;
    public oneAttempts = 0;
    public tenAttempts = 0;
    public fiftyAttempts = 0;
    public fastestTime = 0;
    public prompts: PromptStats = new PromptStats;
}