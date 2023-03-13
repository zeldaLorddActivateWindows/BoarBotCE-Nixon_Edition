import {BoarBotApp} from '../../BoarBotApp';
import {RarityConfig} from '../../bot/config/items/RarityConfig';

/**
 * {@link BoarUtils BoarUtils.ts}
 *
 * Functions used specifically for boar functionality.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarUtils {
    /**
     * Finds the rarity index from a given boar ID
     *
     * @param boarID - Boar ID to get rarity for
     * @return rarity - Rarity of the boar in index form
     */
    public static findRarity(boarID: string): number {
        const config = BoarBotApp.getBot().getConfig();

        const orderedRarities: RarityConfig[] = [...config.rarityConfigs]
            .sort((rarity1, rarity2) => { return rarity2.weight - rarity1.weight; });
        let foundRarity: number = 0;

        for (let i=0; i<orderedRarities.length; i++) {
            const boarExists: boolean = orderedRarities[i].boars.includes(boarID);

            if (boarExists) {
                foundRarity = i + 1;
                break;
            }
        }

        return foundRarity;
    }
}