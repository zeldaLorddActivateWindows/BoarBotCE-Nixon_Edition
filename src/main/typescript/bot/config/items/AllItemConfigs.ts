import {ItemConfigs} from './ItemConfigs';

/**
 * {@link AllItemConfigs AllItemConfigs.ts}
 *
 * Stores all item configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class AllItemConfigs {
    [itemType: string]: ItemConfigs;
    public boars: ItemConfigs = new ItemConfigs;
    public badges: ItemConfigs = new ItemConfigs;
    public powerups: ItemConfigs = new ItemConfigs;
}