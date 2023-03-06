import {
    ActionRowBuilder,
    APISelectMenuOption,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelType, ChatInputCommandInteraction,
    ComponentType, Events, Interaction,
    InteractionCollector, ModalBuilder, ModalSubmitInteraction, SelectMenuBuilder,
    SelectMenuInteraction, TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {GeneralFunctions} from '../../util/GeneralFunctions';
import {DataHandlers} from '../../util/DataHandlers';
import {BotConfig} from '../../bot/config/BotConfig';
import {FormField} from '../../util/FormField';
import {FormatStrings} from '../../util/discord/FormatStrings';
import {LogDebug} from '../../util/logging/LogDebug';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {ComponentUtils} from '../../util/discord/ComponentUtils';

// Reasons for ending collection
enum Reasons {
    Finished = 'finished',
    Cancelled = 'cancelled',
    Error = 'error',
    Maintenance = 'maintenance',
    Expired = 'idle'
}

/**
 * {@link SetupSubcommand SetupSubcommand.ts}
 *
 * Sets up the bot with style and channels.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class SetupSubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boarManage.setup;
    private interaction: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private staticRow = new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>();
    private setupFields: FormField[] = [];
    private guildDataPath: string = '';
    private guildData: any = {};
    private userResponses = {
        isSBServer: false,
        tradeChannelId: '',
        boarChannels: ['', '', '']
    };
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {}, 0)
    };
    private collector: InteractionCollector<ButtonInteraction | SelectMenuInteraction> = 
        {} as InteractionCollector<ButtonInteraction | SelectMenuInteraction>;
    private curField: number = 1;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guild || !interaction.channel) return;
        
        await interaction.deferReply({ ephemeral: true });

        this.config = BoarBotApp.getBot().getConfig();
        this.interaction = interaction;

        const onCooldown = await GeneralFunctions.handleCooldown(this.config, interaction);
        if (onCooldown) return;

        LogDebug.sendDebug('Started interaction', this.config, interaction);
        
        this.staticRow = this.getStaticRow();
        this.setupFields = this.getSetupFields(this.staticRow);

        this.guildDataPath = this.config.pathConfig.guildDataFolder + interaction.guild.id + '.json';
        this.guildData = await DataHandlers.getGuildData(interaction, true);
        
        this.collector = await this.createCollector(interaction).catch(async (err: unknown) => {
            await DataHandlers.removeGuildFile(this.guildDataPath, this.guildData);
            throw err;
        });

        await this.setupFields[0].editReply(interaction).catch(async (err: unknown) => {
            await DataHandlers.removeGuildFile(this.guildDataPath, this.guildData);
            throw err;
        });

        this.collector.on('collect', async (inter: SelectMenuInteraction) => this.handleCollect(inter));

        this.collector.once('end', async (collected, reason) => this.handleEndCollect(reason));
    }

    private async createCollector(
        interaction: ChatInputCommandInteraction
    ): Promise<InteractionCollector<ButtonInteraction | SelectMenuInteraction>> {
        // Only allows button presses from current interaction
        const filter = async (btnInt: ButtonInteraction | SelectMenuInteraction) => {
            return btnInt.customId.endsWith(interaction.id);
        };

        return interaction.channel?.createMessageComponentCollector({
            filter,
            idle: 1000 * 60 * 2
        }) as InteractionCollector<ButtonInteraction | SelectMenuInteraction>;
    }

    private async handleCollect(inter: SelectMenuInteraction): Promise<void> {
        try {
            const canInteract = await CollectorUtils.canInteract(inter, this.timerVars);
            if (!canInteract) return;

            LogDebug.sendDebug(
                `${inter.customId.split('|')[0]} on field ${this.curField}`, this.config, this.interaction
            );

            const strConfig = this.config.stringConfig;
            const setupRowConfig = this.config.commandConfigs.boarManage.setup.component_rows;
            const setupComponents = {
                tradeSelect: setupRowConfig[0][0][0],
                refreshTrade: setupRowConfig[0][1][0],
                findChannel: setupRowConfig[0][1][1],
                tradeInfo: setupRowConfig[0][1][2],
                boarSelect1: setupRowConfig[1][0][0],
                boarSelect2: setupRowConfig[1][1][0],
                boarSelect3: setupRowConfig[1][2][0],
                refreshBoar: setupRowConfig[1][3][0],
                boarInfo: setupRowConfig[1][3][2],
                sbYes: setupRowConfig[2][0][0],
                sbNo: setupRowConfig[2][0][1],
                sbInfo: setupRowConfig[2][0][2],
                cancel: setupRowConfig[3][0][0],
                restart: setupRowConfig[3][0][1],
                next: setupRowConfig[3][0][2]
            };

            // End collector with reason Maintenance when bot in maintenance (unless user is a dev)
            if (BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(inter.user.id)) {
                this.collector.stop(Reasons.Maintenance);
                return;
            }

            // User wants to input a channel via ID
            if (inter.customId.startsWith(setupComponents.findChannel.customId)) {
                // Returns if the field doesn't accept modal submissions
                if (this.curField !== 1 && this.curField !== 2) {
                    clearInterval(this.timerVars.updateTime);
                    return;
                }

                await this.modalHandle(this.curField, inter);

                clearInterval(this.timerVars.updateTime);
                return;
            }

            await inter.deferUpdate();

            // End collector with reason Finished on finish
            if (inter.customId.startsWith(setupComponents.next.customId) && this.curField === 3) {
                this.collector.stop(Reasons.Finished);
                return
            }

            // End collector with reason Cancelled on cancel
            if (inter.customId.startsWith(setupComponents.cancel.customId)) {
                this.collector.stop(Reasons.Cancelled);
                return;
            }

            // Go to the next field (can only go forward)
            if (inter.customId.startsWith(setupComponents.next.customId) && this.curField !== 3) {
                const nextButton: ButtonBuilder = this.staticRow.components[2] as ButtonBuilder;

                nextButton.setDisabled(true);

                if (this.curField === 1) {
                    await this.setupFields[1].editReply(inter);
                } else if (this.curField === 2) {
                    nextButton.setStyle(ButtonStyle.Success);
                    await this.setupFields[2].editReply(inter);
                }

                this.curField++;
            }

            // User wants to refresh available channels for trade field
            if (inter.customId.startsWith(setupComponents.tradeSelect.customId)) {
                this.userResponses.tradeChannelId = inter.values[0];

                // Gets the label of the chosen option
                const placeholder = inter.component.options.filter(option =>
                    option.value === inter.values[0]
                )[0].label;

                // Refreshes all select menu options, changes placeholder, and tells user field is done
                await this.updateSelectField(this.curField, placeholder, inter);
            }

            // User wants to refresh available channels for boar channels field
            if (inter.customId.startsWith(setupComponents.boarSelect1.customId) ||
                inter.customId.startsWith(setupComponents.boarSelect2.customId) ||
                inter.customId.startsWith(setupComponents.boarSelect3.customId)
            ) {
                // Gets index to change based on ending number in select menu ID
                const selectIndex: number =
                    parseInt(inter.customId.charAt(inter.customId.lastIndexOf('_') + 1)) - 1;
                this.userResponses.boarChannels[selectIndex] = inter.values[0];

                // Gets the label of the chosen option
                const placeholder = inter.component.options.filter(option =>
                    option.value === inter.values[0]
                )[0].label;

                // Refreshes all select menu options, changes placeholder, and tells user field is done
                await this.updateSelectField(this.curField, placeholder, inter, selectIndex);
            }

            // User wants to refresh/restart
            if (inter.customId.startsWith(setupComponents.refreshTrade.customId) ||
                inter.customId.startsWith(setupComponents.refreshBoar.customId) ||
                inter.customId.startsWith(setupComponents.restart.customId)
            ) {
                const isRestart = inter.customId.startsWith(setupComponents.restart.customId);

                if (isRestart || this.curField === 1) {
                    this.userResponses.tradeChannelId = '';
                }

                if (isRestart || this.curField === 2) {
                    this.userResponses.boarChannels = ['','',''];
                }

                // Undoes placeholders and shows newly added channels to the server in options
                await this.updateSelectField(this.curField, strConfig.defaultSelectPlaceholder, inter);

                if (!isRestart) {
                    clearInterval(this.timerVars.updateTime);
                    return;
                }

                const nextButton: ButtonBuilder = this.staticRow.components[2] as ButtonBuilder;

                for (const configField of this.setupFields) {
                    configField.reset();
                }

                this.userResponses.isSBServer = false;

                this.curField = 1;

                nextButton.setStyle(ButtonStyle.Primary).setDisabled(true);

                await this.setupFields[0].editReply(this.interaction);
            }

            // User chose if they want skyblock boars or not
            if (inter.customId.startsWith(setupComponents.sbYes.customId) ||
                inter.customId.startsWith(setupComponents.sbNo.customId)
            ) {
                this.userResponses.isSBServer = inter.customId.startsWith(setupComponents.sbYes.customId);

                this.setupFields[2].content = strConfig.setupFinished3 + (this.userResponses.isSBServer
                    ? setupComponents.sbYes.label
                    : setupComponents.sbNo.label);

                this.staticRow.components[2].setDisabled(false);

                await this.setupFields[2].editReply(inter);
            }

            // Info for the trade channel section
            if (inter.customId.startsWith(setupComponents.tradeInfo.customId)) {
                await inter.followUp({
                    content: strConfig.setupInfoResponse1,
                    ephemeral: true
                });
            }

            // Info for the boar channels section
            if (inter.customId.startsWith(setupComponents.boarInfo.customId)) {
                await inter.followUp({
                    content: strConfig.setupInfoResponse2,
                    ephemeral: true
                });
            }

            // Info for the skyblock section
            if (inter.customId.startsWith(setupComponents.sbInfo.customId)) {
                await inter.followUp({
                    content: strConfig.setupInfoResponse3,
                    ephemeral: true
                });
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
    }

    private async handleEndCollect(reason: string): Promise<void> {
        try {
            LogDebug.sendDebug('Ended collection with reason: ' + reason, this.config, this.interaction);

            const strConfig = this.config.stringConfig;

            let replyContent: string;

            if (reason && reason !== Reasons.Finished) {
                await DataHandlers.removeGuildFile(this.guildDataPath, this.guildData);
            }

            switch (reason) {
                case Reasons.Maintenance:
                    replyContent = strConfig.maintenance;
                    break;
                case Reasons.Cancelled:
                    replyContent = strConfig.setupCancelled;
                    break;
                case Reasons.Error:
                    replyContent = strConfig.setupError;
                    break;
                case Reasons.Expired:
                    replyContent = strConfig.setupExpired;
                    break;
                case Reasons.Finished:
                    this.guildData = {
                        isSBServer: this.userResponses.isSBServer,
                        tradeChannel: this.userResponses.tradeChannelId,
                        channels: this.userResponses.boarChannels.filter((ch) => ch !== '')
                    };

                    fs.writeFileSync(this.guildDataPath, JSON.stringify(this.guildData));

                    replyContent = strConfig.setupFinishedAll;

                    if (!GeneralFunctions.hasAttachmentPerms(this.interaction)) {
                        replyContent += '\n\n' + strConfig.noAttachmentPerms;
                    }

                    break;
                default:
                    replyContent = strConfig.error;
                    break;
            }

            await this.interaction.editReply({
                content: replyContent,
                files: [],
                components: []
            });
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    /**
     * Gets array of channel names and IDs for when
     * selecting channels the bot should work in
     *
     * @param interaction
     * @param blackList
     * @private
     */
    private getTextChannels(
        interaction: ChatInputCommandInteraction | SelectMenuInteraction | ModalSubmitInteraction = this.interaction,
        blackList?: string[]
    ): APISelectMenuOption[] {
        const strConfig = this.config.stringConfig;

        const channelOptions: APISelectMenuOption[] = [];
        const noChannelOptions: APISelectMenuOption[] = [{
            label: 'None',
            value: 'None'
        }];
        
        const textChannels = interaction.guild?.channels.cache.filter(ch => ch.type === ChannelType.GuildText);

        if (!textChannels) {
            return noChannelOptions;
        }

        for (const txtCh of textChannels.values()) {
            if (blackList && blackList.includes(txtCh.id)) continue;

            let parentName: string;

            if (txtCh.parent) {
                parentName = txtCh.parent.name.toUpperCase();
            } else {
                parentName = strConfig.noParentChannel;
            }

            channelOptions.push({
                label: strConfig.channelOptionLabel
                    .replace('%@', txtCh.name)
                    .replace('%@', parentName)
                    .substring(0, 100),
                value: txtCh.id
            });
        }

        return channelOptions.length > 0
            ? channelOptions.slice(0, 25)
            : noChannelOptions;
    }

    /**
     * Sends modals and receives information on modal submission
     *
     * @param field
     * @param inter
     * @private
     */
    private async modalHandle(
        field: number,
        inter: SelectMenuInteraction,
    ): Promise<void> {
        const modals = this.config.commandConfigs.boarManage.setup.modals;
        const modalStrings = modals.modal1;
        const modal1Id = modals.modal1.id;
        const modal2Id = modals.modal2.id;

        const strConfig = this.config.stringConfig;

        const modalTitle = modalStrings.title;
        const modalID = field === 1
            ? modal1Id
            : modal2Id;
        const inputID = modalStrings.inputIDs[0];
        const inputLabel = modalStrings.inputLabels[0];
        const placeholder = modalStrings.inputPlaceholders[0];

        const modal = new ModalBuilder()
            .setCustomId(modalID + inter.id)
            .setTitle(modalTitle);
        const channelInput = new TextInputBuilder()
            .setCustomId(inputID)
            .setLabel(inputLabel)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(placeholder);
        const modalRow = new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput);

        modal.addComponents(modalRow);
        await inter.showModal(modal);

        const modalListener = async (submittedModal: Interaction) => {
            try  {
                // If not a modal submission on current interaction, destroy the modal listener
                if (submittedModal.isMessageComponent() && submittedModal.customId.endsWith(this.interaction.id) ||
                    BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(inter.user.id)
                ) {
                    clearInterval(this.timerVars.updateTime);
                    inter.client.removeListener(Events.InteractionCreate, modalListener);

                    return;
                }

                // Updates the cooldown to interact again
                CollectorUtils.canInteract(inter, this.timerVars, true);

                if (!submittedModal.isModalSubmit() || this.collector.ended ||
                    !submittedModal.guild || submittedModal.customId !== modalID + inter.id
                ) {
                    clearInterval(this.timerVars.updateTime);
                    return;
                }

                await submittedModal.deferUpdate();
                await submittedModal.guild.channels.fetch();

                const submittedChannelID = submittedModal.fields.getTextInputValue(inputID);
                const submittedChannel = submittedModal.guild.channels.cache.get(submittedChannelID);
                const notAlreadyChosen = !this.userResponses.boarChannels.includes(submittedChannelID) &&
                    this.userResponses.tradeChannelId !== submittedChannelID;

                let submittedChannelName: string;
                let submittedChannelParentName: string = strConfig.noParentChannel;

                // Checking if channel exists and getting properties of channel
                if (submittedChannel && submittedChannel.isTextBased() && notAlreadyChosen) {
                    submittedChannelName = submittedChannel.name;

                    if (submittedChannel.parent) {
                        submittedChannelParentName = submittedChannel.parent.name.toUpperCase();
                    }
                } else {
                    await submittedModal.followUp({
                        content: strConfig.notValidChannel,
                        ephemeral: true
                    });

                    clearInterval(this.timerVars.updateTime);
                    return;
                }

                const placeholder = strConfig.channelOptionLabel
                    .replace('%@', submittedChannelName)
                    .replace('%@', submittedChannelParentName)
                    .substring(0, 100);

                if (field === 1) {
                    this.userResponses.tradeChannelId = submittedChannelID;
                }

                // Last select menu index by default
                let selectIndex: number = 2;

                if (field === 2) {
                    // Gets next select menu that can be changed, if all full, change last one
                    for (let i=0; i<2; i++) {
                        const selectMenu: SelectMenuBuilder =
                            this.setupFields[1].components[i].components[0] as SelectMenuBuilder;

                        if (selectMenu.data.placeholder === strConfig.defaultSelectPlaceholder) {
                            selectIndex = i;
                            break;
                        }
                    }

                    this.userResponses.boarChannels[selectIndex] = submittedChannelID;
                }

                await this.updateSelectField(
                    field,
                    placeholder,
                    inter,
                    selectIndex
                );
            } catch (err: unknown) {
                await LogDebug.handleError(err);
                this.collector.stop(Reasons.Error);
            }

            clearInterval(this.timerVars.updateTime);
            inter.client.removeListener(Events.InteractionCreate, modalListener);
        };

        inter.client.on(Events.InteractionCreate, modalListener);

        setTimeout(() => {
            inter.client.removeListener(Events.InteractionCreate, modalListener);
        }, 60000);
    }

    /**
     * Updates fields with select menus
     *
     * @param field
     * @param placeholder
     * @param interaction
     * @param selectIndex
     * @private
     */
    private async updateSelectField(
        field: number,
        placeholder: string,
        interaction: SelectMenuInteraction,
        selectIndex: number = 0,
    ): Promise<void> {
        const strConfig = this.config.stringConfig;
        const setupRowConfigs = this.config.commandConfigs.boarManage.setup.component_rows;
        const setupComponents = {
            tradeRefresh: setupRowConfigs[0][1][0],
            boarRefresh: setupRowConfigs[1][3][0],
            restart: setupRowConfigs[3][0][1]
        };

        // Components that need to be changed
        const fieldOneSelectMenu: SelectMenuBuilder =
            this.setupFields[0].components[0].components[0] as SelectMenuBuilder;
        const fieldTwoSelectMenus: ActionRowBuilder<SelectMenuBuilder>[] =
            this.setupFields[1].components.slice(0,3) as ActionRowBuilder<SelectMenuBuilder>[];
        const nextButton: ButtonBuilder =
            this.staticRow.components[2] as ButtonBuilder;

        // Information about the state of the interaction
        const chosenChannels: string[] =
            this.userResponses.boarChannels.concat(this.userResponses.tradeChannelId);
        const isRefresh = interaction.customId.startsWith(setupComponents.tradeRefresh.customId) ||
            interaction.customId.startsWith(setupComponents.boarRefresh.customId) ||
            interaction.customId.startsWith(setupComponents.restart.customId);

        // Disables next button on refresh as it empties all select menus
        nextButton.setDisabled(isRefresh);

        // Change trade select menu even if boar channels are changed since the user can only go back
        // on restart, meaning changes won't be visible
        fieldOneSelectMenu
            .setOptions(...this.getTextChannels(interaction, chosenChannels))
            .setPlaceholder(placeholder)
            .setDisabled(this.getTextChannels(interaction, chosenChannels)[0].label ===
                this.config.emptySelectMenu[0].label
            );

        // Edit trade field content based on if it's a refresh or not
        if (!isRefresh && field === 1) {
            this.setupFields[0].content = strConfig.setupFinished1 +
                FormatStrings.toBasicChannel(this.userResponses.tradeChannelId);
            await this.setupFields[0].editReply(interaction);
        } else if (isRefresh && field === 1) {
            this.setupFields[0].content = strConfig.setupUnfinished1;
            await this.setupFields[0].editReply(interaction);
        }

        // Update boar channel select menus no matter what as changes from trade field must register in
        // boar channel field
        for (const row of fieldTwoSelectMenus) {
            const fieldTwoSelectMenu: SelectMenuBuilder = row.components[0] as SelectMenuBuilder;

            fieldTwoSelectMenu
                .setOptions(...this.getTextChannels(interaction, chosenChannels))
                .setDisabled(this.getTextChannels(interaction, chosenChannels)[0].label ===
                    this.config.emptySelectMenu[0].label
                );

            if (isRefresh)
                fieldTwoSelectMenu.setPlaceholder(placeholder);
        }

        // Edit boar channels field content based on if it's a refresh or not
        if (!isRefresh && field === 2) {
            const selectMenu: SelectMenuBuilder =
                this.setupFields[1].components[selectIndex].components[0] as SelectMenuBuilder;

            let channelsString = '';

            for (const channel of this.userResponses.boarChannels) {
                if (channel === '') continue;
                channelsString += FormatStrings.toBasicChannel(channel) + ' ';
            }

            selectMenu.setPlaceholder(placeholder);
            this.setupFields[1].content = strConfig.setupFinished2 + channelsString;

            await this.setupFields[1].editReply(interaction);
        } else if (isRefresh && field === 2) {
            this.setupFields[1].content = strConfig.setupUnfinished2;
            await this.setupFields[1].editReply(interaction);
        }
    }

    /**
     * Gets the static row that goes at the bottom of every field
     *
     * @private
     */
    private getStaticRow(): ActionRowBuilder<ButtonBuilder | SelectMenuBuilder> {
        const setupRowConfigs = this.config.commandConfigs.boarManage.setup.component_rows;
        const staticRows = ComponentUtils.createRows(setupRowConfigs[3], this.interaction);

        staticRows[0] = this.addOptionsToRow(staticRows[0]);

        return staticRows[0];
    }

    /**
     * Gets the setup fields and their action rows
     *
     * @param staticRow
     * @private
     */
    private getSetupFields(
        staticRow: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>,
    ): FormField[] {
        const strConfig = this.config.stringConfig;
        const setupRowConfigs = this.config.commandConfigs.boarManage.setup.component_rows;

        const fieldOneRows = ComponentUtils.createRows(setupRowConfigs[0], this.interaction);
        const fieldTwoRows = ComponentUtils.createRows(setupRowConfigs[1], this.interaction);
        const fieldThreeRows = ComponentUtils.createRows(setupRowConfigs[2], this.interaction);

        for (const row in fieldOneRows) {
            fieldOneRows[row] = this.addOptionsToRow(fieldOneRows[row]);
        }

        for (const row in fieldTwoRows) {
            fieldTwoRows[row] = this.addOptionsToRow(fieldTwoRows[row]);
        }

        for (const row in fieldThreeRows) {
            fieldThreeRows[row] = this.addOptionsToRow(fieldThreeRows[row]);
        }

        return [
            new FormField(strConfig.setupUnfinished1, fieldOneRows.concat(staticRow)),
            new FormField(strConfig.setupUnfinished2, fieldTwoRows.concat(staticRow)),
            new FormField(strConfig.setupUnfinished3, fieldThreeRows.concat(staticRow))
        ];
    }

    private addOptionsToRow(
        row: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>
    ): ActionRowBuilder<ButtonBuilder | SelectMenuBuilder> {
        for (const component in row.components) {
            if (row.components[component].data.type !== ComponentType.SelectMenu) continue;
            (row.components[component] as SelectMenuBuilder).setOptions(...this.getTextChannels());
        }

        return row;
    }
}