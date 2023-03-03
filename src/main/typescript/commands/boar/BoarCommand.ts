/************************************************
 * BoarCommand.ts
 * All main boar commands
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {PermissionFlagsBits} from 'discord-api-types/v10';
import {BoarBotApp} from '../../BoarBotApp';
import {Command} from '../../api/commands/Command';
import {handleError, sendDebug} from '../../logging/LogDebug';

//***************************************

export default class BoarCommand implements Command {
    private config = BoarBotApp.getBot().getConfig();
    private commandInfo = this.config.commandConfigs.boar;

    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.perms)
        .addSubcommand(sub => sub.setName(this.commandInfo.help.name)
            .setDescription(this.commandInfo.help.description)
        )
        .addSubcommand(sub => sub.setName(this.commandInfo.daily.name)
            .setDescription(this.commandInfo.daily.description)
        )
        .addSubcommand(sub => sub.setName(this.commandInfo.collection.name)
            .setDescription(this.commandInfo.collection.description)
            .addUserOption(option => option.setName(this.commandInfo.collection.args[0].name)
                .setDescription(this.commandInfo.collection.args[0].description)
                .setRequired(this.commandInfo.collection.args[0].required)
            )
        );

    public async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = BoarBotApp.getBot().getSubcommands().get(interaction.options.getSubcommand());

        if (subcommand) {
            try {
                await subcommand.execute(interaction);
            } catch (err: unknown) {
                await handleError(err, interaction);
            }
        }
    }
}