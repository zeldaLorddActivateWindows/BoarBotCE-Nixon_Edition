/**
 * {@link PowerupData PowerupData.ts}
 *
 * A user's powerups.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class PowerupData {
    public powerupAttempts: number = 0;
    public powerupAttempts1: number = 0;
    public powerupAttempts10: number = 0;
    public powerupAttempts50: number = 0;

    public multiplier: number = 1;
    public multiBoostTotal: number = 0;
    public multiBoostsClaimed: number = 0;
    public multiBoostsUsed: number = 0;
    public highestMulti: number = 0;
    public highestMultiBoost: number = 0;

    public numGifts: number = 0;
    public giftsClaimed: number = 0;
    public giftsUsed: number = 0;
    public giftsOpened: number = 0;
    public mostGifts: number = 0;

    public extraChanceTotal: number = 0;
    public extraChancesClaimed: number = 0;
    public extraChancesUsed: number = 0;
    public highestExtraChance: number = 0;

    public numEnhancers: number = 0;
    public enhancersClaimed: number = 0;
    public enhancedRarities: number[] = [0, 0, 0, 0, 0, 0, 0];

    public promptAvgs: Map<string, number> = new Map<string, number>();
}