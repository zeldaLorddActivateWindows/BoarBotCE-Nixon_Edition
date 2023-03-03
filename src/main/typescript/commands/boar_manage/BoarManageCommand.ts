/************************************************
 * BoarManageCommand.ts
 * All management-only boar commands
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {PermissionFlagsBits} from 'discord-api-types/v10';
import {BoarBotApp} from '../../BoarBotApp';
import {Command} from '../../api/commands/Command';
import {BoarManageCommandConfig} from '../../bot/config/commands/BoarManageCommandConfig';
import {handleError} from '../../logging/LogDebug';

//***************************************

export default class BoarManageCommand implements Command {
    private config = BoarBotApp.getBot().getConfig();
    private commandInfo = this.config.commandConfigs.boarManage;

    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.perms)
        .addSubcommand(sub => sub.setName(this.commandInfo.setup.name)
            .setDescription(this.commandInfo.setup.description)
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