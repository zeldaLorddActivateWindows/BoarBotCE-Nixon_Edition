import {ChatInputCommandInteraction} from 'discord.js';
import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {GuildData} from '../../util/data/GuildData';

/**
 * {@link HelpSubcommand HelpSubcommand.ts}
 *
 * Used to see information about the bot.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class HelpSubcommand implements Subcommand {
    private config = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.config.commandConfigs.boar.help;
    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildData: GuildData | undefined = await InteractionUtils.handleStart(interaction, this.config, true);
        if (!guildData) return;

        await interaction.deferReply({ ephemeral: true });

        const helpImagePath: string = this.config.pathConfig.otherAssets + this.config.pathConfig.helpBackground;

        await interaction.editReply({ files: [fs.readFileSync(helpImagePath)] });
    }
}