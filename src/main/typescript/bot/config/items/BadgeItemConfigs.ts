/**
 * {@link BadgeItemConfigs BadgeItemConfigs.ts}
 *
 * Stores badge item configurations for a
 * bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
import {BadgeItemConfig} from './BadgeItemConfig';

export class BadgeItemConfigs {
    [badgeKey: string]: BadgeItemConfig;

    public early_supporter: BadgeItemConfig = new BadgeItemConfig;
    public hunter: BadgeItemConfig = new BadgeItemConfig;
    public artist: BadgeItemConfig = new BadgeItemConfig;
    public athlete: BadgeItemConfig = new BadgeItemConfig;
}