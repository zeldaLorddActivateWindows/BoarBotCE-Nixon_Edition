import {BoarBotApp} from '../../BoarBotApp';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import {BoarItemConfigs} from '../../bot/config/items/BoarItemConfigs';
import {BotConfig} from '../../bot/config/BotConfig';

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

    /**
     * Finds a boar that meets the requirements of the
     * guild and isn't blacklisted
     *
     * @param rarityIndex - The rarity index that's being checked
     * @param config
     * @param guildData
     * @private
     */
    public static findValid(rarityIndex: number, config: BotConfig, guildData: any): string {
        const rarities: RarityConfig[] = config.rarityConfigs;
        const boarIDs: BoarItemConfigs = config.boarItemConfigs;
        let randomBoar = Math.random();

        // Stores the IDs of the current rarity being checked

        const validRarityBoars: string[] = [];

        for (const boarID of rarities[rarityIndex].boars) {
            const isBlacklisted = boarIDs[boarID].blacklisted;
            const isSB = boarIDs[boarID].isSB;

            if (isBlacklisted || (!guildData.isSBServer && isSB))
                continue;
            validRarityBoars.push(boarID);
        }

        if (validRarityBoars.length == 0) return '';

        return validRarityBoars[Math.floor(randomBoar * validRarityBoars.length)];
    }
}