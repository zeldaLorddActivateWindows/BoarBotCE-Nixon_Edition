/************************************************
 * DailyFunctions.ts
 * Functions and for the /boar daily command
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

//***************************************

import {APISelectMenuOption, ButtonStyle, ChannelType, ChatInputCommandInteraction, TextInputStyle} from "discord.js";
import {sendDebug} from "../../logging/LogDebug";
import {BoarUser} from "../BoarUser";
import {BotConfig} from '../../bot/config/BotConfig';

//***************************************

function applyMultiplier(userMultiplier: number, rarityWeights: Map<number, number>) {
    // Sorts from the highest weight to the lowest weight
    const newWeights = new Map(
        [...rarityWeights.entries()].sort((a,b) => { return b[1] - a[1]; })
    );

    // Gives more weight to lower weights and less weight to higher weights
    let i = 0;
    for (const weight of newWeights) {
        newWeights.set(weight[0], weight[1] * Math.pow(userMultiplier, i));
        i++;
    }

    // Restores the original order of the Map
    return new Map(
        [...newWeights.entries()].sort((a,b) => { return a[0] - b[0]; })
    );
}

//***************************************

async function getDaily(
    config: BotConfig,
    guildData: any,
    interaction: ChatInputCommandInteraction,
    boarUser: BoarUser,
    rarityWeights: Map<number, number>
) {
    const strConfig = config.stringConfig;
    const rarities = config.rarityConfigs;
    const boarIDs: any = config.boarItemConfigs;

    const randomRarity: number = Math.random();
    let randomBoar: number = Math.random();

    // Sorts from the lowest weight to the highest weight
    rarityWeights = new Map(
        [...rarityWeights.entries()].sort((a,b) => { return a[1] - b[1]; })
    );

    const weightTotal = [...rarityWeights.values()].reduce((curSum, x) => curSum + x);
    const probabilities = new Map([...rarityWeights.entries()].map(x => [x[0], x[1] / weightTotal]));

    // Finds the rarity that was rolled and adds a random boar from that rarity to user profile
    for (const probability of probabilities) {
        // Goes to next probability if randomRarity is higher
        // Keeps going if it's the rarity with the highest probability
        if (randomRarity > probability[1] && Math.max(...[...probabilities.values()]) !== probability[1])
            continue;

        // Stores the IDs of the current rarity being checked
        const rarityBoars: string[] = rarities[probability[0]].boars;

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

        if (isBlacklisted || !guildData.isSBServer && isSB)
            return undefined;

        sendDebug(strConfig.commandDebugPrefix
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.commandName)
        );

        return boarID;
    }
}

//***************************************

export {
    applyMultiplier,
    getDaily
}