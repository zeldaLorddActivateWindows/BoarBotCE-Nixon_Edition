import {ChatInputCommandInteraction} from 'discord.js';
import {BoarUser} from '../../util/boar/BoarUser';
import {BoarBotApp} from '../../BoarBotApp';
import {FormatStrings} from '../../util/discord/FormatStrings';
import {Subcommand} from '../../api/commands/Subcommand';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import {BoarItemConfigs} from '../../bot/config/items/BoarItemConfigs';
import {Queue} from '../../util/interactions/Queue';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {LogDebug} from '../../util/logging/LogDebug';
import {BotConfig} from '../../bot/config/BotConfig';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';

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
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.config = BoarBotApp.getBot().getConfig();
        this.guildData = await InteractionUtils.handleStart(this.config, interaction);

        if (Object.keys(this.guildData).length === 0) return;

        await interaction.deferReply();
        this.interaction = interaction;

        await Queue.addQueue(() => this.doDaily(), interaction.id + interaction.user.id);

        LogDebug.sendDebug('End of interaction', this.config, interaction);
    }

    /**
     * Checks if user can use their daily boar, and if they can,
     * get it, display it, and place it in user data
     *
     * @private
     */
    private async doDaily(): Promise<void> {
        try {
            if (!this.interaction.guild || !this.interaction.channel) return;

            // New boar user object used for easier manipulation of data
            const boarUser = new BoarUser(this.interaction.user, true);

            const canUseDaily = await this.canUseDaily(boarUser);
            if (!canUseDaily) return;

            // Map of rarity index keys and weight values
            let rarityWeights = this.getRarityWeights();
            const userMultiplier: number = boarUser.powerups.multiplier;
            rarityWeights = this.applyMultiplier(userMultiplier, rarityWeights);

            boarUser.lastDaily = Date.now();

            const boarID = await this.getDaily(rarityWeights);

            if (!boarID) {
                await LogDebug.handleError(this.config.stringConfig.dailyNoBoarFound, this.interaction);
                return;
            }

            await boarUser.addBoar(this.config, boarID, this.interaction);
        } catch (err: unknown) {
            await LogDebug.handleError(err, this.interaction);
        }
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
            await this.interaction.editReply(
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

        const highestWeight = Math.max(...[...newWeights.values()]);
        const rarityIncreaseConst = this.config.numberConfig.rarityIncreaseConst;

        // Increases probability by increasing weight
        // https://www.desmos.com/calculator/74inrkixxa | x = multiplier, o = weight
        for (const weightInfo of newWeights) {
            const rarityIndex = weightInfo[0];
            const oldWeight = weightInfo[1];

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
     * @private
     */
    private async getDaily(rarityWeights: Map<number, number>) {
        const randomRarity: number = Math.random();

        // Sorts from the lowest weight to the highest weight
        rarityWeights = new Map([...rarityWeights.entries()].sort((a, b) => { return a[1] - b[1]; }));
        const weightTotal = [...rarityWeights.values()].reduce((curSum, weight) => curSum + weight);

        // Sets probabilities by adding the previous probability to the current probability

        let prevProb = 0;
        const probabilities = new Map([...rarityWeights.entries()].map((val) => {
            const prob: [number, number] = [val[0], val[1] / weightTotal + prevProb];
            prevProb = prob[1];
            return prob;
        }));

        // Finds the rarity that was rolled and adds a random boar from that rarity to user profile
        for (const probabilityInfo of probabilities) {
            const rarityIndex = probabilityInfo[0];
            const probability = probabilityInfo[1];

            // Goes to next probability if randomRarity is higher
            // Keeps going if it's the rarity with the highest probability
            if (randomRarity > probability && Math.max(...[...probabilities.values()]) !== probability)
                continue;

            const boarGotten = this.findValid(rarityIndex);

            LogDebug.sendDebug(`Rolled boar with ID '${boarGotten}'`, this.config, this.interaction);

            return boarGotten;
        }
    }

    /**
     * Finds a boar that meets the requirements of the
     * guild and isn't blacklisted
     *
     * @param rarityIndex - The rarity index that's being checked
     * @private
     */
    private findValid(rarityIndex: number): string | undefined {
        const rarities: RarityConfig[] = this.config.rarityConfigs;
        const boarIDs: BoarItemConfigs = this.config.boarItemConfigs;
        let randomBoar = Math.random();

        // Stores the IDs of the current rarity being checked
        const rarityBoars: string[] = rarities[rarityIndex].boars;

        // Stores the ID that was chosen
        let boarID = rarityBoars[Math.floor(randomBoar * rarityBoars.length)];
        let isBlacklisted = boarIDs[boarID].blacklisted;
        let isSB = boarIDs[boarID].isSB;

        const maxLoops = 500;
        let curLoop = 0;

        // Retries getting ID if blacklisted or SB boar in non-SB server
        while ((isBlacklisted || !this.guildData.isSBServer && isSB) && curLoop < maxLoops) {
            randomBoar = Math.random();

            boarID = rarityBoars[Math.floor(randomBoar * rarityBoars.length)];

            isBlacklisted = boarIDs[boarID].blacklisted;
            isSB = boarIDs[boarID].isSB;

            curLoop++;
        }

        if (isBlacklisted || !this.guildData.isSBServer && isSB) return;

        return boarID;
    }
}