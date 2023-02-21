/***********************************************
 * onInteractions.ts
 * An event that runs once the bot detects an
 * interaction.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, EmbedBuilder, Events, Interaction, ModalSubmitInteraction} from 'discord.js';
import {handleError, sendDebug} from '../logging/LogDebug';
import {getConfigFile} from '../util/DataHandlers';
import {Listener} from '../api/listeners/Listener';
import {BotConfig} from '../bot/config/BotConfig';
import {BoarBotApp} from '../BoarBotApp';

//***************************************

export default class InteractionListener implements Listener {
    public readonly eventName: Events = Events.InteractionCreate;
    private interaction: ChatInputCommandInteraction | ModalSubmitInteraction | null = null;
    private config: BotConfig | null = null;
    public static maintenanceEmbed = new EmbedBuilder()
        .setColor(0xFFFF00);

    public async execute(interaction: Interaction) {
        if (!interaction.isChatInputCommand()) return;

        this.interaction = interaction;
        this.config = BoarBotApp.getBot().getConfig();

        try {
            if (!await this.handleMaintenance()) return;
        } catch (err: unknown) {
            await handleError(err, interaction);
            return;
        }

        let command;

        if (interaction.isChatInputCommand())
            command = BoarBotApp.getBot().getCommands().get(interaction.commandName);

        if (command) {
            try {
                await command.execute(interaction);
            } catch (err: unknown) {
                await handleError(err, interaction);
                return;
            }
        }
    }

    private async handleMaintenance(): Promise<boolean> {
        if (!this.interaction || !this.config) return false;

        const generalStrings = this.config.stringConfig.general;

        if (this.config.maintenanceMode && this.interaction.isChatInputCommand() &&
            !this.config.devs.includes(this.interaction.user.id)
        ) {
            await this.interaction.reply({
                embeds: [InteractionListener.maintenanceEmbed.setTitle(generalStrings.maintenance)],
                ephemeral: true
            });
            return false;
        }

        return true;
    }
}