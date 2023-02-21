/************************************************
 * HelpCommand.ts
 * Used to see information about the bot.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {PermissionFlagsBits} from 'discord-api-types/v10';
import fs from 'fs';
import {getConfigFile} from '../util/DataHandlers';
import {sendDebug} from '../logging/LogDebug';
import {handleStart} from '../util/GeneralFunctions';
import {BoarBotApp} from '../BoarBotApp';
import {Command} from '../api/commands/Command';

//***************************************

export default class HelpCommand implements Command {
    private initConfig = BoarBotApp.getBot().getConfig();
    private commandInfo = this.initConfig.stringConfig.commands.help;
    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.adminOnly ? PermissionFlagsBits.Administrator : undefined);

    public async execute(interaction: ChatInputCommandInteraction) {
        const config = getConfigFile();

        const guildData = await handleStart(interaction, true);

        if (!guildData)
            return;

        await interaction.deferReply({ ephemeral: true });

        const debugStrings = config.strings.debug;

        sendDebug(debugStrings.usedCommand
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.commandName)
        );

        const otherAssets = config.paths.assets.other;
        const helpImagePath = otherAssets.basePath + otherAssets.help;

        await interaction.editReply({
            files: [fs.readFileSync(helpImagePath)]
        });

        sendDebug(debugStrings.endCommand
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.commandName)
        );
    }
}