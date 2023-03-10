import {ChatInputCommandInteraction, User} from 'discord.js';
import {BoarUser} from '../../util/BoarUser';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {Queue} from '../../util/Queue';
import {GeneralFunctions} from '../../util/GeneralFunctions';
import {Replies} from '../../util/Replies';
import {LogDebug} from '../../util/logging/LogDebug';

/**
 * {@link ConfigRefreshSubcommand ConfigRefreshSubcommand.ts}
 *
 * Refreshes the config the bot is using
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class ConfigRefreshSubcommand implements Subcommand {
    private config = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.config.commandConfigs.boarDev.configRefresh;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction) {
        LogDebug.sendDebug('Started interaction', this.config, interaction);

        BoarBotApp.getBot().loadConfig();

        await interaction.reply({ content: 'Successfully refreshed the config.', ephemeral: true });

        LogDebug.sendDebug('End of interaction', this.config, interaction);
    }
}