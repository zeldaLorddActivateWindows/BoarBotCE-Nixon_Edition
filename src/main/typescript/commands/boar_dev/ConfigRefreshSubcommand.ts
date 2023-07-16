import {ChatInputCommandInteraction} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {Replies} from '../../util/interactions/Replies';

/**
 * {@link ConfigRefreshSubcommand ConfigRefreshSubcommand.ts}
 *
 * Refreshes the config the bot is using.
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
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!this.config.devs.includes(interaction.user.id)) {
            await Replies.noPermsReply(interaction, this.config);
            return;
        }

        BoarBotApp.getBot().loadConfig();
        BoarBotApp.getBot().getPowSpawner().removeMsgs();

        await Replies.handleReply(interaction, 'Successfully refreshed the config.');
    }
}