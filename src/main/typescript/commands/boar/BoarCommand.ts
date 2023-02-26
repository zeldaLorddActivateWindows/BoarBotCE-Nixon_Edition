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

//***************************************

export default class BoarCommand implements Command {
    private config = BoarBotApp.getBot().getConfig();
    private commandInfo = this.config.commandConfigs.boar;

    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.staffOnly ? PermissionFlagsBits.ManageGuild : undefined);

    public async execute(interaction: ChatInputCommandInteraction) {

    }
}