import {ChatInputCommandInteraction} from 'discord.js';
import {BoarUser} from '../../util/boar/BoarUser';
import {BoarBotApp} from '../../BoarBotApp';
import {FormatStrings} from '../../util/discord/FormatStrings';
import {Subcommand} from '../../api/commands/Subcommand';
import {Queue} from '../../util/interactions/Queue';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {LogDebug} from '../../util/logging/LogDebug';
import {BotConfig} from '../../bot/config/BotConfig';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {Replies} from '../../util/interactions/Replies';
import {BoarUtils} from '../../util/boar/BoarUtils';

/**
 * {@link DailySubcommand DailySubcommand.ts}
 *
 * Used to give users their daily boar.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class DailySubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boar.daily;
    private guildData: any = {};
    private interaction: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.config = BoarBotApp.getBot().getConfig();

        this.guildData = await InteractionUtils.handleStart(this.config, interaction);
        if(!this.guildData) return;

        await interaction.deferReply();
        this.interaction = interaction;

        await this.doDaily();
    }

    /**
     * Checks if user can use their daily boar, and if they can,
     * get it, display it, and place it in user data
     *
     * @private
     */
    private async doDaily(): Promise<void> {
        if (!this.interaction.guild || !this.interaction.channel) return;

        let boarUser: BoarUser = {} as BoarUser;
        let boarIDs: string[] = [''];

        await Queue.addQueue(async () => {
            // New boar user object used for easier manipulation of data
            boarUser = new BoarUser(this.interaction.user, true);

            const canUseDaily = await this.canUseDaily(boarUser);
            if (!canUseDaily) return;

            // Gets whether to use boost
            const boostInput: boolean | null = this.interaction.options.getBoolean(this.subcommandInfo.args[0].name);
            const extraInput: boolean | null = this.interaction.options.getBoolean(this.subcommandInfo.args[1].name);

            // Map of rarity index keys and weight values
            let rarityWeights = this.getRarityWeights();
            let userMultiplier: number = boarUser.powerups.multiplier;

            if (boostInput) {
                userMultiplier += boarUser.powerups.multiBoostTotal;
            }

            rarityWeights = this.applyMultiplier(userMultiplier, rarityWeights);

            boarIDs = this.getDailies(rarityWeights, extraInput, boarUser.powerups.extraChanceTotal);

            if (boarIDs.includes('')) {
                await LogDebug.handleError(this.config.stringConfig.dailyNoBoarFound, this.interaction);
                return;
            }

            if (boostInput && boarUser.powerups.multiBoostTotal > 0) {
                boarUser.powerups.multiBoostTotal = 0;
                boarUser.powerups.multiBoostsUsed++;
            }

            if (extraInput && boarUser.powerups.extraChanceTotal > 0) {
                boarUser.powerups.extraChanceTotal = 0;
                boarUser.powerups.extraChancesUsed++;
            }

            boarUser.boarStreak++;
            boarUser.powerups.multiplier++;

            boarUser.powerups.highestMulti = Math.max(boarUser.powerups.multiplier, boarUser.powerups.highestMulti);

            boarUser.lastDaily = Date.now();
            boarUser.numDailies++;

            if (boarUser.firstDaily === 0) {
                boarUser.firstDaily = Date.now();
            }

            boarUser.updateUserData();
        }, this.interaction.id + this.interaction.user.id);

        if (boarIDs.includes('')) return;

        await boarUser.addBoars(this.config, boarIDs, this.interaction, true);
    }

    /**
     * Returns whether the user can use their daily boar
     *
     * @param boarUser - User's boar information
     * @private
     */
    private async canUseDaily(
        boarUser: BoarUser
    ): Promise<boolean> {
        // Midnight of next day (UTC)
        const nextBoarTime = Math.floor(new Date().setUTCHours(24,0,0,0));

        // Returns if user has already used their daily boar
        if (boarUser.lastDaily >= nextBoarTime - (1000 * 60 * 60 * 24) && !this.config.unlimitedBoars) {
            await Replies.handleReply(
                this.interaction,
                this.config.stringConfig.dailyUsed + FormatStrings.toRelTime(nextBoarTime / 1000)
            );
            return false;
        }

        return true
    }

    /**
     * Returns a map storing rarity weights and their indexes
     *
     * @private
     */
    private getRarityWeights(): Map<number, number> {
        const rarities = this.config.rarityConfigs;
        const rarityWeights: Map<number, number> = new Map();

        // Gets weight of each rarity and assigns it to Map object with its index
        for (let i=0; i<rarities.length; i++) {
            let weight: number = rarities[i].weight;

            if (!rarities[i].fromDaily)
                weight = 0;

            rarityWeights.set(i, weight);
        }

        return rarityWeights;
    }

    /**
     * Applies the user multiplier to rarity weights using an arctan function
     *
     * @param userMultiplier - Used to increase weight
     * @param rarityWeights - Map of weights and their indexes
     * @private
     */
    private applyMultiplier(userMultiplier: number, rarityWeights: Map<number, number>): Map<number, number> {
        // Sorts from the highest weight to the lowest weight
        const newWeights = new Map([...rarityWeights.entries()].sort((a,b) => { return b[1] - a[1]; }));

        const highestWeight: number = newWeights.values().next().value;
        const rarityIncreaseConst = this.config.numberConfig.rarityIncreaseConst;

        // Increases probability by increasing weight
        // https://www.desmos.com/calculator/74inrkixxa | x = multiplier, o = weight
        for (const weightInfo of newWeights) {
            const rarityIndex = weightInfo[0];
            const oldWeight = weightInfo[1];

            if (oldWeight == 0) continue;

            newWeights.set(
                rarityIndex,
                oldWeight * (Math.atan(((userMultiplier - 1) * oldWeight) / rarityIncreaseConst) *
                    (highestWeight - oldWeight) / oldWeight + 1)
            );
        }

        // Restores the original order of the Map
        return new Map([...newWeights.entries()].sort((a,b) => { return a[0] - b[0]; }));
    }

    /**
     * Gets the boar to give to the user
     *
     * @param rarityWeights - Map of weights and their indexes
     * @param extra - Whether to apply extra boar chance
     * @param extraVal - User's chance of extra boar
     * @private
     */
    private getDailies(
        rarityWeights: Map<number, number>,
        extra: boolean | null,
        extraVal: number
    ): string[] {
        const boarIDs: string[] = [];
        let numBoars: number = 1;

        // Sorts from the lowest weight to the highest weight
        rarityWeights = new Map([...rarityWeights.entries()].sort((a, b) => { return a[1] - b[1]; }));
        const weightTotal: number = [...rarityWeights.values()].reduce((curSum, weight) => curSum + weight);

        // Sets probabilities by adding the previous probability to the current probability

        let prevProb: number = 0;
        const probabilities: Map<number, number> = new Map([...rarityWeights.entries()].map((val) => {
            const prob: [number, number] = [val[0], val[1] / weightTotal + prevProb];
            prevProb = prob[1];
            return prob;
        }));

        LogDebug.sendDebug(`Probabilities: ${[...probabilities]}`, this.config, this.interaction);

        if (extra) {
            numBoars += Math.floor(extraVal / 100);
            extraVal -= (numBoars-1) * 100;

            if (Math.random() < extraVal / 100) {
                numBoars++;
            }
        }

        for (let i=0; i<numBoars; i++) {
            const randomRarity: number = Math.random();

            // Finds the rarity that was rolled and adds a random boar from that rarity to user profile
            for (const probabilityInfo of probabilities) {
                const rarityIndex = probabilityInfo[0];
                const probability = probabilityInfo[1];

                // Goes to next probability if randomRarity is higher
                // Keeps going if it's the rarity with the highest probability
                if (randomRarity > probability && Math.max(...probabilities.values()) !== probability)
                    continue;

                const boarGotten: string = BoarUtils.findValid(rarityIndex, this.config, this.guildData);

                LogDebug.sendDebug(`Rolled boar with ID '${boarGotten}'`, this.config, this.interaction);

                boarIDs.push(boarGotten);
                break;
            }
        }

        return boarIDs;
    }
}