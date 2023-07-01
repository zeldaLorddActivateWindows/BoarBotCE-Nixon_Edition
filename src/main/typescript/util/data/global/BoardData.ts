import {TopUserData} from './TopUserData';

/**
 * {@link BoardData BoardData.ts}
 *
 * Stores information about a specific leaderboard
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class BoardData {
    public topUser: string | undefined;
    public userData: TopUserData = new TopUserData;
}