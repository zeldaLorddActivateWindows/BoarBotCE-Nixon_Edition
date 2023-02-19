/***********************************************
 * onInteractions.ts
 * An event that runs once the bot detects an
 * interaction.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, EmbedBuilder, Events, Interaction, ModalSubmitInteraction} from 'discord.js';
import {CustomClient} from '../supporting_files/CustomClient';
import {handleError} from '../logging/LogDebug';
import {getConfigFile} from '../supporting_files/DataHandlers';
import {Listener} from '../api/listeners/Listener';
import {BotConfig} from '../bot/config/BotConfig';
import {BoarBotApp} from '../BoarBotApp';

//***************************************

const maintenanceEmbed = new EmbedBuilder()
    .setColor(0xFFFF00);

//***************************************

export default class InteractionListener implements Listener {
    public readonly eventName: Events = Events.InteractionCreate;
    private interaction: ChatInputCommandInteraction | ModalSubmitInteraction | null = null;
    private config: BotConfig | null = null;

    /**
     * Handles all interaction and interaction filtering
     * @param interaction - Interaction that executed this function
     */
    public async execute(interaction: Interaction) {
        if (!interaction.isChatInputCommand() && !interaction.isModalSubmit()) return;

        this.interaction = interaction;
        this.config = BoarBotApp.getBot().getConfig();

        try {
            if (await this.handleBadInteraction()) return;
        } catch (err: unknown) {
            await handleError(err, interaction);
            return;
        }

        let command;
        let modal;

        if (interaction.isChatInputCommand())
            command = (interaction.client as CustomClient).commandList.get(interaction.commandName);
        else if (interaction.isModalSubmit())
            modal = (interaction.client as CustomClient).modals.get(interaction.customId);

        if (command) {
            try {
                await command.execute(interaction);
            } catch (err: unknown) {
                await handleError(err, interaction);
                return;
            }
        }

        if (modal) {
            try {
                await modal.execute(interaction);
            } catch (err: unknown) {
                await handleError(err, interaction);
                return;
            }
        }
    }

    private async handleBadInteraction(): Promise<boolean> {
        if (!this.interaction || !this.config) return false;

        const generalStrings = this.config.stringConfig.general;

        if (this.interaction.channel && this.interaction.channel.isDMBased()) {
            await this.interaction.reply(generalStrings.noGuild);
            return false;
        }

        if (this.config.maintenanceMode && this.interaction.isChatInputCommand() &&
            !this.config.devs.includes(this.interaction.user.id)
        ) {
            await this.interaction.reply({
                embeds: [maintenanceEmbed.setTitle(generalStrings.maintenance)],
                ephemeral: true
            });
            return false;
        }

        return true;
    }
}