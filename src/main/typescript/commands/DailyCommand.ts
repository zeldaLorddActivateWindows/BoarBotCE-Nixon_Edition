/************************************************
 * DailyCommand.ts
 * Used to give users their daily boar.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {PermissionFlagsBits} from 'discord-api-types/v10';
import {BoarUser} from '../supporting_files/BoarUser';
import {addQueue} from '../supporting_files/Queue';
import {handleError, sendDebug} from '../logging/LogDebug';
import {applyMultiplier, getDaily} from '../supporting_files/command_specific/DailyFunctions';
import {handleStart} from '../supporting_files/GeneralFunctions';
import {Command} from '../api/commands/Command';
import {BoarBotApp} from '../BoarBotApp';

//***************************************

export default class DailyCommand implements Command {
    private initConfig = BoarBotApp.getBot().getConfig();
    private commandInfo = this.initConfig.stringConfig.commands.daily;
    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.adminOnly ? PermissionFlagsBits.Administrator : undefined);

    public async execute(interaction: ChatInputCommandInteraction) {
        const config = BoarBotApp.getBot().getConfig();

        const guildData = await handleStart(interaction);

        if (!guildData)
            return;

        await interaction.deferReply();

        const debugStrings = config.stringConfig.debug;

        await addQueue(async function() {
            try {
                if (!interaction.guild || !interaction.channel)
                    return;

                // Alias for strings
                const dailyStrings = config.stringConfig.daily;
                const generalStrings = config.stringConfig.general;

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
                const raritiesInfo = config.rarityConfig;
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
            .replace('%@', interaction.commandName)
        );
    }
}