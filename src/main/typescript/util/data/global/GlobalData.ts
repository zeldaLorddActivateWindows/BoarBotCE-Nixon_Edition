import {ItemsData} from './ItemsData';
import {BoardData} from './BoardData';

/**
 * {@link GlobalData GlobalData.ts}
 *
 * Structure of global data for a bot instance
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class GlobalData {
    public itemData: ItemsData = new ItemsData;
    public leaderboardData: Record<string, BoardData> = {};
    public nextPowerup = 0;
}