import {
    AutocompleteInteraction,
    ChatInputCommandInteraction, ColorResolvable,
    Events,
    Interaction,
} from 'discord.js';
import {Listener} from '../api/listeners/Listener';
import {BotConfig} from '../bot/config/BotConfig';
import {BoarBotApp} from '../BoarBotApp';
import {LogDebug} from '../util/logging/LogDebug';
import {Cooldown} from '../util/interactions/Cooldown';
import {Replies} from '../util/interactions/Replies';
import {Command} from '../api/commands/Command';
import {StringConfig} from '../bot/config/StringConfig';

/**
 * {@link InteractionListener InteractionListener.ts}
 *
 * An event that runs once the bot detects an
 * interaction.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class InteractionListener implements Listener {
    public readonly eventName: Events = Events.InteractionCreate;
    private interaction: ChatInputCommandInteraction | AutocompleteInteraction | null = null;
    private config: BotConfig | null = null;

    /**
     * Executes the called subcommand group if it exists
     *
     * @param interaction - The interaction to handle
     */
    public async execute(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;

        this.interaction = interaction;
        this.config = BoarBotApp.getBot().getConfig();

        try {
            if (!await this.handleMaintenance()) return;
        } catch (err: unknown) {
            await LogDebug.handleError(err, interaction);
            return;
        }

        const command: Command | undefined = BoarBotApp.getBot().getCommands().get(interaction.commandName);

        if (command) {
            LogDebug.sendDebug('Started interaction', this.config, interaction);

            const onCooldown = await Cooldown.handleCooldown(interaction as ChatInputCommandInteraction, this.config);
            if (onCooldown) return;

            try {
                await command.execute(interaction);
            } catch (err: unknown) {
                await LogDebug.handleError(err, interaction);
                return;
            }

            LogDebug.sendDebug('End of interaction', this.config, interaction);
        }
    }

    /**
     * Stops interaction from going through if maintenance occurring
     *
     * @private
     */
    private async handleMaintenance(): Promise<boolean> {
        if (!this.interaction || !this.config) return false;

        const strConfig: StringConfig = this.config.stringConfig;

        if (this.config.maintenanceMode && !this.interaction.isAutocomplete()
            && !this.config.devs.includes(this.interaction.user.id)
        ) {
            await Replies.handleReply(
                this.interaction, strConfig.maintenance, this.config.colorConfig.maintenance as ColorResolvable
            );
            return false;
        }

        return true;
    }
}