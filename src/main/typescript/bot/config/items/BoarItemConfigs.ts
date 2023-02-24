/**
 * {@link BoarItemConfigs BoarItemConfigs.ts}
 *
 * Stores boar item configurations for a
 * bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
import {BoarItemConfig} from './BoarItemConfig';
import {BadgeItemConfig} from './BadgeItemConfig';

export class BoarItemConfigs {
    [boarKey: string]: BadgeItemConfig;

    // Common boar items

    public readonly normal: BoarItemConfig = new BoarItemConfig;
    public readonly explosionless: BoarItemConfig = new BoarItemConfig;
    public readonly tiny: BoarItemConfig = new BoarItemConfig;

    // Uncommon boar items

    public readonly carrot: BoarItemConfig = new BoarItemConfig;
    public readonly buff: BoarItemConfig = new BoarItemConfig;
    public readonly chocolate: BoarItemConfig = new BoarItemConfig;
    public readonly emo: BoarItemConfig = new BoarItemConfig;
    public readonly matrix: BoarItemConfig = new BoarItemConfig;
    public readonly soda: BoarItemConfig = new BoarItemConfig;

    // Rare boar items

    public readonly clown: BoarItemConfig = new BoarItemConfig;
    public readonly sphere: BoarItemConfig = new BoarItemConfig;
    public readonly killer: BoarItemConfig = new BoarItemConfig;
    public readonly fish: BoarItemConfig = new BoarItemConfig;
    public readonly fruit: BoarItemConfig = new BoarItemConfig;
    public readonly rainy: BoarItemConfig = new BoarItemConfig;
    public readonly golden: BoarItemConfig = new BoarItemConfig;

    // Epic boar items

    public readonly creepy: BoarItemConfig = new BoarItemConfig;
    public readonly robot: BoarItemConfig = new BoarItemConfig;
    public readonly coffee: BoarItemConfig = new BoarItemConfig;
    public readonly moon: BoarItemConfig = new BoarItemConfig;
    public readonly necron: BoarItemConfig = new BoarItemConfig;
    public readonly wizard: BoarItemConfig = new BoarItemConfig;
    public readonly aurora: BoarItemConfig = new BoarItemConfig;

    // Legendary boar items

    public readonly minimumwage: BoarItemConfig = new BoarItemConfig;
    public readonly backrooms: BoarItemConfig = new BoarItemConfig;
    public readonly jumpscare: BoarItemConfig = new BoarItemConfig;

    // Mythic boar items

    public readonly cowboy: BoarItemConfig = new BoarItemConfig;
    public readonly realistic: BoarItemConfig = new BoarItemConfig;
    public readonly farmer: BoarItemConfig = new BoarItemConfig;

    // Divine boar items

    public readonly rickroll: BoarItemConfig = new BoarItemConfig;
    public readonly morbius: BoarItemConfig = new BoarItemConfig;
    public readonly god: BoarItemConfig = new BoarItemConfig;
    public readonly imposter: BoarItemConfig = new BoarItemConfig;
    public readonly curious: BoarItemConfig = new BoarItemConfig;
}