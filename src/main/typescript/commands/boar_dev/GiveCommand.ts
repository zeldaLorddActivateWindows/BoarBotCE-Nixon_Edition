/***********************************************
 * GiveCommand.ts
 * Used to give a user a specific boar.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {PermissionFlagsBits} from 'discord-api-types/v10';
import {BoarUser} from '../../util/BoarUser';
import {addQueue} from '../../util/Queue';
import {handleError, sendDebug} from '../../logging/LogDebug';
import {getConfigFile} from '../../util/DataHandlers';
import {findRarity, handleStart} from '../../util/GeneralFunctions';
import {noPermsReply} from '../../util/InteractionReplies';
import {BoarBotApp} from '../../BoarBotApp';
import {Command} from '../../api/commands/Command';

//***************************************

// ADD ARGUMENT TO CHOOSE IF BADGE OR BOAR

export default class GiveCommand implements Command {
    private initConfig = BoarBotApp.getBot().getConfig();
    private commandInfo = this.initConfig.commandConfigs.give;
    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.adminOnly ? PermissionFlagsBits.Administrator : undefined)
        .addUserOption(option => option.setName(this.commandInfo.args[0].name)
            .setDescription(this.commandInfo.args[0].description)
            .setRequired(this.commandInfo.args[0].required)
        )
        .addStringOption(option => option.setName(this.commandInfo.args[1].name)
            .setDescription(this.commandInfo.args[1].description)
            .setRequired(this.commandInfo.args[1].required)
        ) as SlashCommandBuilder;

    public async execute(interaction: ChatInputCommandInteraction) {
        const config = getConfigFile();

        const guildData = await handleStart(interaction);

        if (!guildData)
            return;

        if (!config.developers.includes(interaction.user.id)) {
            await noPermsReply(interaction);
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const debugStrings = config.strings.debug;
        const generalStrings = config.strings.general;
        const badgeIDs = Object.keys(config.badgeIDs);

        const userInput = interaction.options.getUser(this.commandInfo.args[0].name);
        const idInput = interaction.options.getString(this.commandInfo.args[1].name);
        let rarityFound: number = -1;

        if (!userInput || !idInput) {
            await interaction.editReply(generalStrings.nullValues);
            return;
        }

        // Gets the rarity of boar gotten
        rarityFound = findRarity(idInput);

        // Returns if ID doesn't exist in boars or badges
        if (rarityFound === -1 && !badgeIDs.includes(idInput)) {
            await interaction.editReply(generalStrings.invalidID);
            return;
        }

        await addQueue(async function() {
            try {
                if (!interaction.guild || !interaction.channel)
                    return;

                const boarUser = new BoarUser(userInput);

                // Gives either a boar or a badge depending on input
                if (rarityFound !== -1)
                    await boarUser.addBoar(config, idInput, interaction);
                else
                    await boarUser.addBadge(config, idInput, interaction);
            } catch (err: unknown) {
                await handleError(err, interaction);
            }
        }, interaction.id + userInput.id);

        sendDebug(debugStrings.endCommand
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.commandName)
        );
    }
}