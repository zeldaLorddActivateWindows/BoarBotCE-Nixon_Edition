/***********************************************
 * GiveCommand.ts
 * Used to give a user a specific boar.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {PermissionFlagsBits} from 'discord-api-types/v10';
import {BoarUser} from '../supporting_files/BoarUser';
import {addQueue} from '../supporting_files/Queue';
import {handleError, sendDebug} from '../logging/LogDebug';
import {getConfigFile} from '../supporting_files/DataHandlers';
import {findRarity, handleStart} from '../supporting_files/GeneralFunctions';
import {noPermsReply} from '../supporting_files/InteractionReplies';
import {BoarBotApp} from '../BoarBotApp';
import {Command} from '../api/commands/Command';

//***************************************

export default class GiveCommand implements Command {
    private initConfig = BoarBotApp.getBot().getConfig();
    private commandInfo = this.initConfig.stringConfig.commands.give;
    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.adminOnly ? PermissionFlagsBits.Administrator : undefined)
        .addUserOption(option => option.setName(this.commandInfo.args.arg1.name)
            .setDescription(this.commandInfo.args.arg1.description)
            .setRequired(this.commandInfo.args.arg1.required)
        )
        .addStringOption(option => option.setName(this.commandInfo.args.arg2.name)
            .setDescription(this.commandInfo.args.arg2.description)
            .setRequired(this.commandInfo.args.arg2.required)
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

        const userInput = interaction.options.getUser(this.commandInfo.args.arg1.name);
        const idInput = interaction.options.getString(this.commandInfo.args.arg2.name);
        let rarityFound: string = '';

        if (!userInput || !idInput) {
            await interaction.editReply(generalStrings.nullValues);
            return;
        }

        // Gets the rarity of boar gotten
        rarityFound = findRarity(idInput);

        // Returns if ID doesn't exist in boars or badges
        if (rarityFound === '' && !badgeIDs.includes(idInput)) {
            await interaction.editReply(generalStrings.invalidID);
            return;
        }

        await addQueue(async function() {
            try {
                if (!interaction.guild || !interaction.channel)
                    return;

                const boarUser = new BoarUser(userInput);

                // Gives either a boar or a badge depending on input
                if (rarityFound !== '')
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