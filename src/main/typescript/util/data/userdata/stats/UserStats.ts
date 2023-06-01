import {GeneralStats} from './GeneralStats';
import {PowerupStats} from './PowerupStats';

/**
 * {@link UserStats UserStats.ts}
 *
 * A collection of user stats.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class UserStats {
    public general: GeneralStats = new GeneralStats;
    public powerups: PowerupStats = new PowerupStats;
}