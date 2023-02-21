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

// Sends modals and receives information on modal submission
function applyMultiplier(userMultiplier: number, probabilities: number[]) {
    if (userMultiplier === 1)
        return;

    // Used to prevent total probability from going over 100%
    let probabilityTotal: number = 0;

    // Limits for multipliers
    const highestMultiplier = 1 / probabilities[probabilities.length - 1];
    const noCommonMultiplier = 1 / probabilities[0];

    // Multiplies each probability from least common to most common by multiplier,
    // If it results in a total probability over 100%, decrease multiplier slowly until a value is found
    for (let i=probabilities.length-1; i>=0; i--) {
        for (let j=userMultiplier > highestMultiplier ? highestMultiplier : userMultiplier; j>=0; j--) {
            if (probabilityTotal + j * probabilities[i] > 1)
                continue;

            probabilities[i] = j * probabilities[i];
            probabilityTotal += probabilities[i];

            break;
        }
    }

    // Prevents user from getting commons once the multiplier hits a threshold
    for (let i=0; i<probabilities.length-1 && userMultiplier > noCommonMultiplier; i++) {
        if (probabilities[i] !== 0) {
            probabilities[i] += 1 - probabilityTotal;
            break;
        }
    }
}

//***************************************

async function getDaily(
    config: BotConfig,
    guildData: any,
    interaction: ChatInputCommandInteraction,
    boarUser: BoarUser,
    probabilities: number[],
    rarities: string[]
) {
    const debugStrings = config.stringConfig.debug;
    const raritiesInfo = config.rarityConfig;
    const boarIDs: any = config.boarCollectibles;

    const randomRarity: number = Math.random();
    let randomBoar: number = Math.random();

    // Stores the rarity that's currently being checked based on probability
    let rarityChecking = 1 - probabilities.reduce((a, b) => { return a + b });

    // Finds the rarity that was rolled and adds a random boar from that rarity to user profile
    for (const rarity of rarities) {
        // If the value gotten is lower than the rarity being checked,
        // go to next highest rarity
        if (randomRarity >= rarityChecking) {
            rarityChecking += probabilities[rarities.indexOf(rarity)];
            continue;
        }

        // Stores the IDs of the current rarity being checked
        const rarityBoars: string[] = raritiesInfo[rarity].boars;

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

        sendDebug(debugStrings.boarGotten
            .replace('%@', interaction.user.tag)
            .replace('%@', boarID)
        );

        return boarID;
    }
}

//***************************************

export {
    applyMultiplier,
    getDaily
}