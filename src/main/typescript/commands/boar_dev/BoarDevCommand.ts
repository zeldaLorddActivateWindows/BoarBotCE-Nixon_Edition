/************************************************
 * BoarDevCommand.ts
 * All dev-only boar commands
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Command} from '../../api/commands/Command';
import {handleError} from '../../logging/LogDebug';

//***************************************

export default class BoarDevCommand implements Command {
    private config = BoarBotApp.getBot().getConfig();
    private commandInfo = this.config.commandConfigs.boarDev;

    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.perms)
        .addSubcommand(sub => sub.setName(this.commandInfo.give.name)
            .setDescription(this.commandInfo.give.description)
            .addUserOption(option => option.setName(this.commandInfo.give.args[0].name)
                .setDescription(this.commandInfo.give.args[0].description)
                .setRequired(this.commandInfo.give.args[0].required)
            )
            .addStringOption(option => option.setName(this.commandInfo.give.args[1].name)
                .setDescription(this.commandInfo.give.args[1].description)
                .setRequired(this.commandInfo.give.args[1].required)
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