/************************************************
 * daily.ts
 * Used to give users their daily boar.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {BoarUser} from '../supporting_files/BoarUser';
import {getConfigFile} from '../supporting_files/DataHandlers';
import {addQueue} from '../supporting_files/Queue';
import {handleError, sendDebug} from '../supporting_files/LogDebug';
import {applyMultiplier, getDaily} from '../supporting_files/command_specific/DailyFunctions';
import {handleStart} from '../supporting_files/GeneralFunctions';
import {ChatInputCommandInteraction} from 'discord.js';

//***************************************

const initConfig = getConfigFile();
const commandName = initConfig.strings.commands.daily.name;

//***************************************

/**
 * Code that run on /boar daily
 * @param interaction - Interaction that executed this function
 */
async function execute(interaction: ChatInputCommandInteraction) {
    const config = getConfigFile();

    const guildData = await handleStart(interaction);

    if (!guildData)
        return;

    await interaction.deferReply();

    const debugStrings = config.strings.debug;

    await addQueue(async function() {
        try {
            if (!interaction.guild || !interaction.channel)
                return;

            // Alias for strings
            const dailyStrings = config.strings.daily;
            const generalStrings = config.strings.general;

            // New boar user object used for easier manipulation of data
            const boarUser = new BoarUser(interaction.user);

            // Midnight of next day
            const nextBoarTime = Math.floor(
                new Date().setUTCHours(24,0,0,0)
            );

            // Returns if user has already used their daily boar
            if (boarUser.lastDaily >= nextBoarTime - (1000 * 60 * 60 * 24) && !config.unlimitedBoars) {
                await interaction.editReply(dailyStrings.usedDaily + generalStrings.formattedTime
                    .replace('%@', nextBoarTime / 1000)
                );
                return;
            }

            // Stores rarity and probability information
            const probabilities: number[] = [];
            const raritiesInfo = config.raritiesInfo;
            const rarities: string[] = Object.keys(raritiesInfo);
            const userMultiplier: number = boarUser.powerups.multiplier;

            // Gets probabilities of each rarity
            for (let i=1; i<rarities.length; i++) {
                let rarityProbability: number = raritiesInfo[rarities[i]].probability;

                if (!raritiesInfo[rarities[i]].fromDaily)
                    rarityProbability = 0;

                probabilities.push(rarityProbability)
            }

            boarUser.lastDaily = Date.now();

            applyMultiplier(userMultiplier, probabilities);
            boarUser.powerups.multiplier = 1;

            const boarID = await getDaily(config, guildData, interaction, boarUser, probabilities, rarities);

            if (!boarID) {
                await handleError(debugStrings.noBoarFound, interaction);
                return;
            }

            await boarUser.addBoar(config, boarID, interaction);
        } catch (err: unknown) {
            await handleError(err, interaction);
        }
    }, interaction.id + interaction.user.id);

    sendDebug(debugStrings.endCommand
        .replace('%@', interaction.user.tag)
        .replace('%@', interaction.options.getSubcommand())
    );
}

//***************************************

module.exports = {
    data: { name: commandName },
    execute
};