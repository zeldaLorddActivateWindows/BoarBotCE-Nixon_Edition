import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Command} from '../../api/commands/Command';
import {LogDebug} from '../../util/logging/LogDebug';

/**
 * {@link BoarCommand BoarCommand.ts}
 *
 * All main boar commands.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class BoarCommand implements Command {
    private config = BoarBotApp.getBot().getConfig();
    private commandInfo = this.config.commandConfigs.boar;
    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.perms)
        .addSubcommand(sub => sub.setName(this.commandInfo.help.name)
            .setDescription(this.commandInfo.help.description)
        )
        .addSubcommand(sub => sub.setName(this.commandInfo.daily.name)
            .setDescription(this.commandInfo.daily.description)
        )
        .addSubcommand(sub => sub.setName(this.commandInfo.collection.name)
            .setDescription(this.commandInfo.collection.description)
            .addUserOption(option => option.setName(this.commandInfo.collection.args[0].name)
                .setDescription(this.commandInfo.collection.args[0].description)
                .setRequired(this.commandInfo.collection.args[0].required)
            )
        );

    /**
     * Executes the called subcommand if it exists
     *
     * @param interaction - An interaction that could've called a boar subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = BoarBotApp.getBot().getSubcommands().get(interaction.options.getSubcommand());

        if (subcommand) {
            const exports = require(subcommand.data.path);
            const commandClass = new exports.default();

            try {
                await commandClass.execute(interaction);
            } catch (err: unknown) {
                await LogDebug.handleError(err, interaction);
            }
        }
    }
}