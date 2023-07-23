import {
    ActionRowBuilder, ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction,
    InteractionCollector, MessageComponentInteraction,
    StringSelectMenuBuilder, StringSelectMenuInteraction, TextChannel
} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {BotConfig} from '../../bot/config/BotConfig';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {GuildData} from '../../util/data/global/GuildData';
import {LogDebug} from '../../util/logging/LogDebug';
import {Replies} from '../../util/interactions/Replies';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {RowConfig} from '../../bot/config/components/RowConfig';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import fs from 'fs';

/**
 * {@link SelfWipeSubcommand SelfWipeSubcommand.ts}
 *
 * Allows a user to delete all data tied to their account.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class SelfWipeSubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boar.selfWipe;
    private guildData: GuildData | undefined;
    private firstInter: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private compInter: MessageComponentInteraction = {} as MessageComponentInteraction;
    private canDelete = false;
    private baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
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
        this.firstInter = interaction;

        if (CollectorUtils.selfWipeCollectors[interaction.user.id]) {
            const oldCollector = CollectorUtils.selfWipeCollectors[interaction.user.id];
            setTimeout(() => { oldCollector.stop(CollectorUtils.Reasons.Expired) }, 1000);
        }

        this.collector = CollectorUtils.selfWipeCollectors[interaction.user.id] = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        this.collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter));
        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));

        this.showSelfWipe(true);
    }

    /**
     * Handles collecting button interactions
     *
     * @param inter - The button interaction
     * @private
     */
    private async handleCollect(inter: ButtonInteraction): Promise<void> {
        try {
            this.compInter = inter;

            const selfWipeRowConfig: RowConfig[][] = this.config.commandConfigs.boar.selfWipe.componentFields;
            const selfWipeComponents = {
                delete: selfWipeRowConfig[0][0].components[0],
                cancel: selfWipeRowConfig[0][0].components[1]
            };

            await inter.deferUpdate();

            switch (inter.customId.split('|')[0]) {
                // User wants to delete their data
                case selfWipeComponents.delete.customId:
                    this.showSelfWipe();
                    break;

                // User wants to cancel deletion process
                case selfWipeComponents.cancel.customId:
                    this.collector.stop();
                    break;
            }
        } catch (err: unknown) {
            const canStop: boolean = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }
    }

    /**
     * Handles when the collection for navigating through collection is finished
     *
     * @param reason - Why the collection ended
     * @private
     */
    private async handleEndCollect(reason: string): Promise<void> {
        try {
            LogDebug.log('Ended collection with reason: ' + reason, this.config, this.firstInter);

            if (reason === CollectorUtils.Reasons.Error) {
                await Replies.handleReply(
                    this.firstInter, this.config.stringConfig.setupError,
                    this.config.colorConfig.error
                );
            }

            if (reason === CollectorUtils.Reasons.Finished) {
                try {
                    fs.rmSync(this.config.pathConfig.userDataFolder + this.firstInter.user.id + '.json');
                } catch {}

                await this.firstInter.editReply({
                    content: 'Successfully deleted all of your data.',
                    components: []
                });
                return;
            }

            await this.firstInter.editReply({
                content: 'Cancelled the self-wipe process.',
                components: []
            });
        } catch (err: unknown) {
            await LogDebug.handleError(err, this.firstInter);
        }
    }

    /**
     * Updates the deletion process message and buttons
     *
     * @private
     */
    private async showSelfWipe(firstRun = false) {
        try {
            this.disableButtons();

            if (this.canDelete) {
                this.collector.stop(CollectorUtils.Reasons.Finished);
                return;
            }

            if (firstRun) {
                this.initButtons();
            } else {
                this.canDelete = true;
            }

            const contentStr = firstRun
                ? 'Are you **absolutely** sure you want to **completely** wipe your data from BoarBot?'
                : '**THIS WILL DELETE EVERYTHING!** All of your progress will be gone forever and will not be recoverable. So once again, are you **ABSOLUTELY** sure you want to **COMPLETELY** wipe your data from BoarBot?';

            this.baseRows[0].components[1].setDisabled(false);
            await this.firstInter.editReply({ content: contentStr, components: this.baseRows });

            setTimeout(async () => {
                if (this.collector.ended) return;
                this.baseRows[0].components[0].setDisabled(false);
                try {
                    await this.firstInter.editReply({ content: contentStr, components: this.baseRows });
                } catch {}
            }, 5000);
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }
    }

    /**
     * Creates the buttons and rows used for collection by adding information to IDs
     *
     * @private
     */
    private initButtons(): void {
        const selfWipeFieldConfigs: RowConfig[][] = this.config.commandConfigs.boar.selfWipe.componentFields;
        const newRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
            ComponentUtils.makeRows(selfWipeFieldConfigs[0]);

        ComponentUtils.addToIDs(selfWipeFieldConfigs[0], newRows, this.firstInter.id, this.firstInter.user.id);

        this.baseRows = newRows;
    }

    /**
     * Disables all buttons
     *
     * @private
     */
    private disableButtons(): void {
        for (const row of this.baseRows) {
            for (const component of row.components) {
                component.setDisabled(true);
            }
        }
    }
}