import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
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
import {PermissionUtils} from '../util/discord/PermissionUtils';
import {CustomEmbedGenerator} from '../util/generators/CustomEmbedGenerator';

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
            const startTime = Date.now();
            LogDebug.sendDebug('Started interaction', this.config, interaction);

            if (interaction.isChatInputCommand()) {
                let onCooldown: boolean;
                try {
                    onCooldown = await Cooldown.handleCooldown(interaction as ChatInputCommandInteraction, this.config);
                } catch (err: unknown) {
                    await LogDebug.handleError(err, interaction);
                    return;
                }

                if (onCooldown) return;
            }

            if (Date.now() - startTime > 100) {
                await LogDebug.handleError('COOLDOWN SLOWDOWN: ' + (Date.now() - startTime));
            }

            try {
                await command.execute(interaction);

                if (
                    interaction.isChatInputCommand() && (!PermissionUtils.hasPerm(interaction.guild, 'ViewChannel') ||
                    !PermissionUtils.hasPerm(interaction.guild, 'SendMessages') ||
                        !PermissionUtils.hasPerm(interaction.guild, 'AttachFiles')) && Math.random() < .01
                ) {
                    await interaction.followUp({
                        files: [
                            CustomEmbedGenerator.makeEmbed(
                                'This server is missing out on powerups! To allow them to spawn, make sure View ' +
                                'Channels, Send Messages, and Attach Files permissions are all enabled for BoarBot!',
                                this.config.colorConfig.error, this.config
                            )
                        ]
                    });
                }
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
                this.interaction, strConfig.maintenance, this.config.colorConfig.maintenance
            );
            return false;
        }

        return true;
    }
}