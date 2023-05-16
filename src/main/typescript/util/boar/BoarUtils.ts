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
    public static findRarity(boarID: string): [number, RarityConfig] {
        const config = BoarBotApp.getBot().getConfig();

        const orderedRarities: RarityConfig[] = [...config.rarityConfigs]
            .sort((rarity1, rarity2) => { return rarity2.weight - rarity1.weight; });

        for (let i=0; i<orderedRarities.length; i++) {
            const boarExists: boolean = orderedRarities[i].boars.includes(boarID);

            if (!boarExists) continue;

            return [i + 1, orderedRarities[i]];
        }

        return [0, orderedRarities[orderedRarities.length-1]]; // Shouldn't ever trigger with proper config validation
    }
}