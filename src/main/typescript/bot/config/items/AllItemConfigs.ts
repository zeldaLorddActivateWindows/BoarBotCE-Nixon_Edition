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
    readonly [itemType: string]: ItemConfigs;
    public readonly boars: ItemConfigs = new ItemConfigs;
    public readonly badges: ItemConfigs = new ItemConfigs;
    public readonly powerups: ItemConfigs = new ItemConfigs;
}