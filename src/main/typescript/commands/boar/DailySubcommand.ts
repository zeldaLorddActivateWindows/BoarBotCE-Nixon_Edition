/************************************************
 * DailySubcommand.ts
 * Used to give users their daily boar.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction} from 'discord.js';
import {BoarUser} from '../../util/BoarUser';
import {addQueue} from '../../util/Queue';
import {handleError, sendDebug} from '../../logging/LogDebug';
import {handleStart} from '../../util/GeneralFunctions';
import {BoarBotApp} from '../../BoarBotApp';
import {FormatStrings} from '../../util/discord/FormatStrings';
import {Subcommand} from '../../api/commands/Subcommand';
import {BotConfig} from '../../bot/config/BotConfig';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import {BoarItemConfigs} from '../../bot/config/items/BoarItemConfigs';

//***************************************

export default class DailySubcommand implements Subcommand {
    private initConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.initConfig.commandConfigs.boar.daily;
    public readonly data = { name: this.subcommandInfo.name };

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const config = BoarBotApp.getBot().getConfig();

        const guildData = await handleStart(config, interaction);

        if (!guildData) return;

        await interaction.deferReply();

        const doDaily = () => this.doDaily(guildData, config, interaction);

        await addQueue(async function() {
            try {
                await doDaily();
            } catch (err: unknown) {
                await handleError(err, interaction);
            }
        }, interaction.id + interaction.user.id);

        sendDebug('End of interaction', config, interaction);
    }

    private async doDaily(
        guildData: any,
        config: BotConfig,
        interaction: ChatInputCommandInteraction
    ): Promise<void> {
        if (!interaction.guild || !interaction.channel) return;

        // New boar user object used for easier manipulation of data
        const boarUser = new BoarUser(interaction.user);

        if (!(await this.canUseDaily(boarUser, config, interaction))) return;

        // Map of rarity index keys and weight values
        let rarityWeights = this.getRarityWeights(config);
        const userMultiplier: number = boarUser.powerups.multiplier;
        rarityWeights = this.applyMultiplier(config, userMultiplier, rarityWeights);

        boarUser.lastDaily = Date.now();

        const boarID = await this.getDaily(config, guildData, interaction, rarityWeights);

        if (!boarID) {
            await handleError(config.stringConfig.dailyNoBoarFound, interaction);
            return;
        }

        await boarUser.addBoar(config, boarID, interaction);
    }

    private async canUseDaily(
        boarUser: BoarUser,
        config: BotConfig,
        interaction: ChatInputCommandInteraction
    ): Promise<boolean> {
        // Midnight of next day (UTC)
        const nextBoarTime = Math.floor(new Date().setUTCHours(24,0,0,0));

        // Returns if user has already used their daily boar
        if (boarUser.lastDaily >= nextBoarTime - (1000 * 60 * 60 * 24) && !config.unlimitedBoars) {
            await interaction.editReply(config.stringConfig.dailyUsed +
                FormatStrings.toRelTime(nextBoarTime / 1000)
            );
            return false;
        }

        return true
    }

    private getRarityWeights(config: BotConfig): Map<number, number> {
        const rarities = config.rarityConfigs;
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

    private applyMultiplier(
        config: BotConfig,
        userMultiplier: number,
        rarityWeights: Map<number, number>
    ): Map<number, number> {
        // Sorts from the highest weight to the lowest weight
        const newWeights = new Map([...rarityWeights.entries()].sort((a,b) => { return b[1] - a[1]; }));

        const highestWeight = Math.max(...[...newWeights.values()]);
        const rarityIncreaseConst = config.numberConfig.rarityIncreaseConst;

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

    private async getDaily(
        config: BotConfig,
        guildData: any,
        interaction: ChatInputCommandInteraction,
        rarityWeights: Map<number, number>
    ) {
        const rarities = config.rarityConfigs;
        const boarIDs: any = config.boarItemConfigs;

        const randomRarity: number = Math.random();
        let randomBoar: number = Math.random();

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

            const boarGotten = this.findValid(config, rarityIndex, guildData);

            sendDebug(`Rolled boar with ID '${boarGotten}'`, config, interaction);

            return boarGotten;
        }
    }

    private findValid(config: BotConfig, rarityIndex: number, guildData: any): string | undefined {
        const rarities: RarityConfig[] = config.rarityConfigs;
        const boarIDs: BoarItemConfigs = config.boarItemConfigs;
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
        while ((isBlacklisted || !guildData.isSBServer && isSB) && curLoop < maxLoops) {
            randomBoar = Math.random();

            boarID = rarityBoars[Math.floor(randomBoar * rarityBoars.length)];

            isBlacklisted = boarIDs[boarID].blacklisted;
            isSB = boarIDs[boarID].isSB;

            curLoop++;
        }

        if (isBlacklisted || !guildData.isSBServer && isSB) return;

        return boarID;
    }
}