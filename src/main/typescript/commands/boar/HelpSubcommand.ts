import {ChatInputCommandInteraction} from 'discord.js';
import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {GeneralFunctions} from '../../util/GeneralFunctions';
import {LogDebug} from '../../util/logging/LogDebug';

/**
 * {@link HelpSubcommand HelpSubcommand.ts}
 *
 * Used to see information about the bot.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class HelpSubcommand implements Subcommand {
    private initConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.initConfig.commandConfigs.boar.help;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction) {
        const config = BoarBotApp.getBot().getConfig();

        const guildData = await GeneralFunctions.handleStart(config, interaction, true);

        if (!guildData) return;

        await interaction.deferReply({ ephemeral: true });

        const helpImagePath = config.pathConfig.otherAssets + config.pathConfig.helpBackground;

        await interaction.editReply({
            files: [fs.readFileSync(helpImagePath)]
        });

        LogDebug.sendDebug('End of interaction', config, interaction);
    }
}