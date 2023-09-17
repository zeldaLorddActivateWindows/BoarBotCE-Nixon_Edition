import {AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Command} from '../../api/commands/Command';
import {LogDebug} from '../../util/logging/LogDebug';
import {Subcommand} from '../../api/commands/Subcommand';

/**
 * {@link BoarDevCommand BoarDevCommand.ts}
 *
 * All dev-only boar commands.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
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
                .setRequired(this.commandInfo.give.args[0].required !== undefined)
            )
            .addStringOption(option => option.setName(this.commandInfo.give.args[1].name)
                .setDescription(this.commandInfo.give.args[1].description)
                .setRequired(this.commandInfo.give.args[1].required !== undefined)
                .setAutocomplete(this.commandInfo.give.args[1].autocomplete)
            )
        )
        .addSubcommand(sub => sub.setName(this.commandInfo.ban.name)
            .setDescription(this.commandInfo.ban.description)
            .addUserOption(option => option.setName(this.commandInfo.ban.args[0].name)
                .setDescription(this.commandInfo.ban.args[0].description)
                .setRequired(this.commandInfo.ban.args[0].required !== undefined)
            )
            .addIntegerOption(option => option.setName(this.commandInfo.ban.args[1].name)
                .setDescription(this.commandInfo.ban.args[1].description)
                .setRequired(this.commandInfo.ban.args[1].required !== undefined)
            )
        );

    /**
     * Executes the called subcommand if it exists
     *
     * @param interaction - An interaction that could've called a boar-dev subcommand
     */
    public async execute(interaction: AutocompleteInteraction | ChatInputCommandInteraction): Promise<void> {
        const subcommand: Subcommand | undefined = BoarBotApp.getBot().getSubcommands()
            .get(interaction.options.getSubcommand());

        if (!subcommand) return;

        const exports = require(subcommand.data.path);
        const commandClass = new exports.default();

        if (interaction.isAutocomplete()) {
            try {
                await commandClass.autocomplete(interaction);
            } catch (err: unknown) {
                await LogDebug.handleError(err, interaction);
            }
        } else if (interaction.isChatInputCommand()) {
            try {
                await commandClass.execute(interaction);
            } catch (err: unknown) {
                await LogDebug.handleError(err, interaction);
            }
        }



    }
}