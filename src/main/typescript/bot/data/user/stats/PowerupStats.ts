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
    public oneAttempts = 0; // Number of first place attempts
    public fastestTime = 0;
    public prompts: PromptStats = new PromptStats; // Average placements for each prompt
}