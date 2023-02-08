/************************************************
 * help.ts
 * Used to see information about the bot.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import fs from 'fs';
import {getConfigFile} from '../supporting_files/DataHandlers';
import {sendDebug} from '../supporting_files/LogDebug';
import {handleStart} from '../supporting_files/GeneralFunctions';
import {ChatInputCommandInteraction} from 'discord.js';

//***************************************

const initConfig = getConfigFile();
const commandName = initConfig.strings.commands.help.name;

//***************************************

module.exports = {
    data: { name: commandName },
    async execute(interaction: ChatInputCommandInteraction) {
        const config = getConfigFile();

        const guildData = await handleStart(interaction, true);

        if (!guildData)
            return;

        await interaction.deferReply({ ephemeral: true });

        const debugStrings = config.strings.debug;

        sendDebug(debugStrings.usedCommand
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.options.getSubcommand())
        );

        const otherAssets = config.paths.assets.other;
        const helpImagePath = otherAssets.basePath + otherAssets.help;

        await interaction.editReply({
            files: [fs.readFileSync(helpImagePath)]
        });

        sendDebug(debugStrings.endCommand
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.options.getSubcommand())
        );
    }
};