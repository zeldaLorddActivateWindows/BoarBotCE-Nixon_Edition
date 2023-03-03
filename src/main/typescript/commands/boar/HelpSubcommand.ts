/************************************************
 * HelpSubcommand.ts
 * Used to see information about the bot.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {PermissionFlagsBits} from 'discord-api-types/v10';
import fs from 'fs';
import {getConfigFile} from '../../util/DataHandlers';
import {sendDebug} from '../../logging/LogDebug';
import {handleStart} from '../../util/GeneralFunctions';
import {BoarBotApp} from '../../BoarBotApp';
import {Command} from '../../api/commands/Command';
import {Subcommand} from '../../api/commands/Subcommand';

//***************************************

export default class HelpSubcommand implements Subcommand {
    private initConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.initConfig.commandConfigs.boar.help;
    public readonly data = { name: this.subcommandInfo.name };

    public async execute(interaction: ChatInputCommandInteraction) {
        const config = BoarBotApp.getBot().getConfig();

        const guildData = await handleStart(config, interaction, true);

        if (!guildData) return;

        await interaction.deferReply({ ephemeral: true });

        const helpImagePath = config.pathConfig.otherAssets + config.pathConfig.helpBackground;

        await interaction.editReply({
            files: [fs.readFileSync(helpImagePath)]
        });

        sendDebug('End of interaction', config, interaction);
    }
}