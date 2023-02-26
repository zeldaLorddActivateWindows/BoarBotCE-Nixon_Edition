/************************************************
 * DailyCommand.ts
 * Used to give users their daily boar.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {PermissionFlagsBits} from 'discord-api-types/v10';
import {BoarUser} from '../../util/BoarUser';
import {addQueue} from '../../util/Queue';
import {handleError, sendDebug} from '../../logging/LogDebug';
import {applyMultiplier, getDaily} from '../../util/command_specific/DailyFunctions';
import {handleStart} from '../../util/GeneralFunctions';
import {Command} from '../../api/commands/Command';
import {BoarBotApp} from '../../BoarBotApp';
import {FormatStrings} from '../../util/discord/FormatStrings';

//***************************************

export default class DailyCommand implements Command {
    private initConfig = BoarBotApp.getBot().getConfig();
    private commandInfo = this.initConfig.commandConfigs.daily;
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

        const strConfig = config.stringConfig;

        await addQueue(async function() {
            try {
                if (!interaction.guild || !interaction.channel)
                    return;

                // New boar user object used for easier manipulation of data
                const boarUser = new BoarUser(interaction.user);

                // Midnight of next day
                const nextBoarTime = Math.floor(
                    new Date().setUTCHours(24,0,0,0)
                );

                // Returns if user has already used their daily boar
                if (boarUser.lastDaily >= nextBoarTime - (1000 * 60 * 60 * 24) && !config.unlimitedBoars) {
                    await interaction.editReply(strConfig.dailyUsed +
                        FormatStrings.toRelTime(nextBoarTime / 1000)
                    );
                    return;
                }

                // Map of rarity index keys and weight values
                let rarityWeights: Map<number, number> = new Map();

                const rarities = config.rarityConfigs;
                const userMultiplier: number = boarUser.powerups.multiplier;

                // Gets weight of each rarity
                for (let i=0; i<rarities.length; i++) {
                    let weight: number = rarities[i].weight;

                    if (!rarities[i].fromDaily)
                        weight = 0;

                    rarityWeights.set(i, weight);
                }

                rarityWeights = applyMultiplier(userMultiplier, rarityWeights);
                boarUser.powerups.multiplier = 1;

                boarUser.lastDaily = Date.now();

                sendDebug([...rarityWeights.entries()]);

                const boarID = await getDaily(config, guildData, interaction, boarUser, rarityWeights);

                if (!boarID) {
                    await handleError(strConfig.dailyNoBoarFound, interaction);
                    return;
                }

                await boarUser.addBoar(config, boarID, interaction);
            } catch (err: unknown) {
                await handleError(err, interaction);
            }
        }, interaction.id + interaction.user.id);

        sendDebug(strConfig.commandDebugPrefix
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.commandName)
        );
    }
}