import {
    ChatInputCommandInteraction
} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {BotConfig} from '../../bot/config/BotConfig';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {GuildData} from '../../util/data/global/GuildData';
import {BoarUser} from '../../util/boar/BoarUser';
import {QuestsImageGenerator} from '../../util/generators/QuestsImageGenerator';

/**
 * {@link QuestsSubcommand QuestsSubcommand.ts}
 *
 * Allows a user to view their weekly boar quests
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class QuestsSubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boar.quests;
    private guildData: GuildData | undefined;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.guildData = await InteractionUtils.handleStart(interaction, this.config);
        if (!this.guildData) return;

        await interaction.deferReply({ ephemeral: true });

        await interaction.editReply({
            files: [await QuestsImageGenerator.makeImage(new BoarUser(interaction.user), this.config)]
        });
    }
}