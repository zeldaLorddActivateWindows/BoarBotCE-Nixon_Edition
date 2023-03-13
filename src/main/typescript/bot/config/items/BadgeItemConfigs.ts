import {BadgeItemConfig} from './BadgeItemConfig';

/**
 * {@link BadgeItemConfigs BadgeItemConfigs.ts}
 *
 * Stores badge item configurations for a
 * bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BadgeItemConfigs {
    [badgeKey: string]: BadgeItemConfig;

    public readonly early_supporter: BadgeItemConfig = new BadgeItemConfig;
    public readonly hunter: BadgeItemConfig = new BadgeItemConfig;
    public readonly artist: BadgeItemConfig = new BadgeItemConfig;
    public readonly athlete: BadgeItemConfig = new BadgeItemConfig;
}