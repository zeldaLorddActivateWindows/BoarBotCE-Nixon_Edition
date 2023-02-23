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

    public normal: BoarItemConfig = new BoarItemConfig;
    public explosionless: BoarItemConfig = new BoarItemConfig;
    public tiny: BoarItemConfig = new BoarItemConfig;

    // Uncommon boar items

    public carrot: BoarItemConfig = new BoarItemConfig;
    public buff: BoarItemConfig = new BoarItemConfig;
    public chocolate: BoarItemConfig = new BoarItemConfig;
    public emo: BoarItemConfig = new BoarItemConfig;
    public matrix: BoarItemConfig = new BoarItemConfig;
    public soda: BoarItemConfig = new BoarItemConfig;

    // Rare boar items

    public clown: BoarItemConfig = new BoarItemConfig;
    public sphere: BoarItemConfig = new BoarItemConfig;
    public killer: BoarItemConfig = new BoarItemConfig;
    public fish: BoarItemConfig = new BoarItemConfig;
    public fruit: BoarItemConfig = new BoarItemConfig;
    public rainy: BoarItemConfig = new BoarItemConfig;
    public golden: BoarItemConfig = new BoarItemConfig;

    // Epic boar items

    public creepy: BoarItemConfig = new BoarItemConfig;
    public robot: BoarItemConfig = new BoarItemConfig;
    public coffee: BoarItemConfig = new BoarItemConfig;
    public moon: BoarItemConfig = new BoarItemConfig;
    public necron: BoarItemConfig = new BoarItemConfig;
    public wizard: BoarItemConfig = new BoarItemConfig;
    public aurora: BoarItemConfig = new BoarItemConfig;

    // Legendary boar items

    public minimumwage: BoarItemConfig = new BoarItemConfig;
    public backrooms: BoarItemConfig = new BoarItemConfig;
    public jumpscare: BoarItemConfig = new BoarItemConfig;

    // Mythic boar items

    public cowboy: BoarItemConfig = new BoarItemConfig;
    public realistic: BoarItemConfig = new BoarItemConfig;
    public farmer: BoarItemConfig = new BoarItemConfig;

    // Divine boar items

    public rickroll: BoarItemConfig = new BoarItemConfig;
    public morbius: BoarItemConfig = new BoarItemConfig;
    public god: BoarItemConfig = new BoarItemConfig;
    public imposter: BoarItemConfig = new BoarItemConfig;
    public curious: BoarItemConfig = new BoarItemConfig;
}