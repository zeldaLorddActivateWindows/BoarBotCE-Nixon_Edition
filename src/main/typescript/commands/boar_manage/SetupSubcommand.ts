import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelType, ChatInputCommandInteraction, ColorResolvable,
    ComponentType, Events, Interaction,
    InteractionCollector, ModalBuilder, PermissionsBitField, SelectMenuComponentOptionData,
    StringSelectMenuBuilder, StringSelectMenuInteraction, TextChannel,
    TextInputStyle,
} from 'discord.js';
import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {DataHandlers} from '../../util/data/DataHandlers';
import {BotConfig} from '../../bot/config/BotConfig';
import {FormField} from '../../util/interactions/FormField';
import {FormatStrings} from '../../util/discord/FormatStrings';
import {LogDebug} from '../../util/logging/LogDebug';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import {Replies} from '../../util/interactions/Replies';
import {GuildData} from '../../util/data/GuildData';

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

    // The initiating interaction
    private firstInter: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    // The current component interaction
    private compInter: StringSelectMenuInteraction | ButtonInteraction =
        {} as StringSelectMenuInteraction | ButtonInteraction;

    private staticRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private setupFields: FormField[] = [];
    private guildDataPath: string = '';
    private guildData: GuildData = {} as GuildData;
    private userResponses = {
        isSBServer: false,
        tradeChannelId: '',
        boarChannels: ['', '', '']
    };
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {}, 0)
    };
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
    private curField: number = 1;

    // The modal that's shown to a user if they opened one
    private modalShowing: ModalBuilder = {} as ModalBuilder;

    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guild || !interaction.channel) return;
        
        await interaction.deferReply({ ephemeral: true });
        this.firstInter = interaction;

        this.config = BoarBotApp.getBot().getConfig();
        
        this.staticRows = this.getStaticRows();
        this.setupFields = this.getSetupFields(this.staticRows);

        this.guildDataPath = this.config.pathConfig.guildDataFolder + interaction.guild.id + '.json';
        this.guildData = await DataHandlers.getGuildData(interaction.guild.id, interaction, true) as GuildData;
        
        this.collector = await CollectorUtils.createCollector(interaction.channel as TextChannel, interaction.id)
            .catch(async (err: unknown) => {
                await DataHandlers.removeGuildFile(this.guildDataPath, this.guildData);
                throw err;
            });

        await this.setupFields[0].editReply(interaction).catch(async (err: unknown) => {
            await DataHandlers.removeGuildFile(this.guildDataPath, this.guildData);
            throw err;
        });

        this.collector.on('collect', async (inter: StringSelectMenuInteraction | ButtonInteraction) =>
            await this.handleCollect(inter)
        );
        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));
    }

    /**
     * Handles collecting and directing responses for those interactions
     *
     * @param inter - The interaction associated with a component interaction
     * @private
     */
    private async handleCollect(inter: StringSelectMenuInteraction | ButtonInteraction): Promise<void> {
        try {
            const canInteract = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            if (!inter.isMessageComponent()) return;

            this.compInter = inter;

            LogDebug.sendDebug(
                `${inter.customId.split('|')[0]} on field ${this.curField}`, this.config, this.firstInter
            );

            const setupRowConfig = this.config.commandConfigs.boarManage.setup.componentFields;
            const setupComponents = {
                tradeSelect: setupRowConfig[0][0].components[0],
                refreshTrade: setupRowConfig[0][1].components[0],
                findChannel: setupRowConfig[0][1].components[1],
                tradeInfo: setupRowConfig[0][1].components[2],
                boarSelect1: setupRowConfig[1][0].components[0],
                boarSelect2: setupRowConfig[1][1].components[0],
                boarSelect3: setupRowConfig[1][2].components[0],
                refreshBoar: setupRowConfig[1][3].components[0],
                boarInfo: setupRowConfig[1][3].components[2],
                sbYes: setupRowConfig[2][0].components[0],
                sbNo: setupRowConfig[2][0].components[1],
                sbInfo: setupRowConfig[2][0].components[2],
                cancel: setupRowConfig[3][0].components[0],
                restart: setupRowConfig[3][0].components[1],
                next: setupRowConfig[3][0].components[2]
            };

            // User wants to input a channel via ID
            if (
                inter.customId.startsWith(setupComponents.findChannel.customId) &&
                (this.curField === 1 || this.curField === 2)
            ) {
                await this.modalHandle(inter);
                clearInterval(this.timerVars.updateTime);
                return;
            }

            await inter.deferUpdate();

            switch (inter.customId.split('|')[0]) {
                // User wants to finish or go to next field
                case setupComponents.next.customId:
                    if (this.curField === 3) {
                        this.collector.stop(CollectorUtils.Reasons.Finished);
                        break;
                    }

                    await this.doNext();
                    break;

                // User wants to cancel setup
                case setupComponents.cancel.customId:
                    this.collector.stop(CollectorUtils.Reasons.Cancelled);
                    break;

                // User selects the trade channel
                case setupComponents.tradeSelect.customId:
                    await this.doTradeSelect();
                    break;

                // User selects a boar channel
                case setupComponents.boarSelect1.customId:
                case setupComponents.boarSelect2.customId:
                case setupComponents.boarSelect3.customId:
                    await this.doBoarSelect();
                    break;

                // User wants to refresh a trade menu or restart the setup process
                case setupComponents.refreshTrade.customId:
                case setupComponents.refreshBoar.customId:
                case setupComponents.restart.customId:
                    await this.doRefreshRestart(setupComponents);
                    break;

                // User chooses if the server is an SB server or not
                case setupComponents.sbYes.customId:
                case setupComponents.sbNo.customId:
                    await this.doSb(setupComponents);
                    break;

                // User wants more information on trade channel
                case setupComponents.tradeInfo.customId:
                    await Replies.handleReply(inter, this.config.stringConfig.setupInfoResponse1);
                    break;

                // User wants more information on boar channels
                case setupComponents.boarInfo.customId:
                    await Replies.handleReply(inter, this.config.stringConfig.setupInfoResponse2);
                    break;

                // User wants more information on SB boars
                case setupComponents.sbInfo.customId:
                    await Replies.handleReply(inter, this.config.stringConfig.setupInfoResponse3);
                    break;
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
    }

    /**
     * Handles when the user wants to go to the next field
     *
     * @private
     */
    private async doNext(): Promise<void> {
        const nextButton: ButtonBuilder = this.staticRows[0].components[2] as ButtonBuilder;
        nextButton.setDisabled(true);

        if (this.curField === 1) {
            await this.setupFields[1].editReply(this.compInter);
        } else if (this.curField === 2) {
            nextButton.setStyle(ButtonStyle.Success);
            await this.setupFields[2].editReply(this.compInter);
        }

        this.curField++;
    }

    /**
     * Handles when the user selects a trade channel
     *
     * @private
     */
    private async doTradeSelect(): Promise<void> {
        const selectInter = this.compInter as StringSelectMenuInteraction;
        this.userResponses.tradeChannelId = selectInter.values[0];

        // Gets the label of the chosen option
        const placeholder = selectInter.component.options.filter(option =>
            option.value === selectInter.values[0]
        )[0].label;

        // Refreshes all select menu options, changes placeholder, and tells user field is done
        await this.updateSelectField(placeholder);
    }

    /**
     * Handles when the user selects a boar channel
     *
     * @private
     */
    private async doBoarSelect(): Promise<void> {
        const selectInter = this.compInter as StringSelectMenuInteraction;

        // Gets index to change based on ending number in select menu ID
        const selectIndex: number =
            parseInt(this.compInter.customId.charAt(this.compInter.customId.lastIndexOf('_') + 1)) - 1;
        this.userResponses.boarChannels[selectIndex] = selectInter.values[0];

        // Gets the label of the chosen option
        const placeholder = selectInter.component.options.filter(option =>
            option.value === selectInter.values[0]
        )[0].label;

        // Refreshes all select menu options, changes placeholder, and tells user field is done
        await this.updateSelectField(placeholder, selectIndex);
    }

    /**
     * Handles when user would like to refresh the
     * select menus or restart completely
     *
     * @param setupComponents - Used to find if restarting and disabling the next button
     * @private
     */
    private async doRefreshRestart(setupComponents: any): Promise<void> {
        const strConfig = this.config.stringConfig;
        const isRestart = this.compInter.customId.startsWith(setupComponents.restart.customId);
        const nextButton: ButtonBuilder = this.staticRows[0].components[2] as ButtonBuilder;

        if (isRestart || this.curField === 1) {
            this.userResponses.tradeChannelId = '';
        }

        if (isRestart || this.curField === 2) {
            this.userResponses.boarChannels = ['','',''];
        }

        // Undoes placeholders and shows newly added channels to the server in options
        await this.updateSelectField(strConfig.defaultSelectPlaceholder);

        if (!isRestart) {
            clearInterval(this.timerVars.updateTime);
            return;
        }

        for (const configField of this.setupFields) {
            configField.reset();
        }

        this.userResponses.isSBServer = false;

        this.curField = 1;

        nextButton.setStyle(ButtonStyle.Primary).setDisabled(true);

        await this.setupFields[0].editReply(this.firstInter);
    }

    /**
     * Handles when user chooses whether server is a SkyBlock server
     *
     * @param setupComponents - Used to find what user chose and getting labels to display back
     * @private
     */
    private async doSb(setupComponents: any): Promise<void> {
        const strConfig = this.config.stringConfig;
        this.userResponses.isSBServer = this.compInter.customId.startsWith(setupComponents.sbYes.customId);

        this.setupFields[2].content = strConfig.setupFinished3 + (this.userResponses.isSBServer
            ? setupComponents.sbYes.label
            : setupComponents.sbNo.label);

        this.staticRows[0].components[2].setDisabled(false);

        await this.setupFields[2].editReply(this.compInter);
    }

    /**
     * Handles when the collector is terminated
     *
     * @param reason - The reason the collector was terminated
     * @private
     */
    private async handleEndCollect(reason: string): Promise<void> {
        try {
            LogDebug.sendDebug('Ended collection with reason: ' + reason, this.config, this.firstInter);

            const strConfig = this.config.stringConfig;

            let replyContent: string;
            let color: ColorResolvable | undefined;

            if (reason && reason !== CollectorUtils.Reasons.Finished || !this.compInter.guild) {
                await DataHandlers.removeGuildFile(this.guildDataPath, this.guildData);
            }

            switch (reason) {
                case CollectorUtils.Reasons.Cancelled:
                    replyContent = strConfig.setupCancelled;
                    break;
                case CollectorUtils.Reasons.Error:
                    replyContent = strConfig.setupError;
                    color = 0xED4245;
                    break;
                case CollectorUtils.Reasons.Expired:
                    replyContent = strConfig.setupExpired;
                    break;
                case CollectorUtils.Reasons.Finished:
                    this.guildData = {
                        fullySetup: true,
                        isSBServer: this.userResponses.isSBServer,
                        tradeChannel: this.userResponses.tradeChannelId,
                        channels: this.userResponses.boarChannels.filter((ch) => ch !== '')
                    };

                    fs.writeFileSync(this.guildDataPath, JSON.stringify(this.guildData));

                    replyContent = strConfig.setupFinishedAll;
                    color = 0x3BA55C;

                    break;
                default:
                    replyContent = strConfig.error;
                    break;
            }

            await Replies.handleReply(this.firstInter, replyContent, color);
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    /**
     * Gets array of channel names and IDs for when
     * selecting channels the bot should work in
     *
     * @param interaction - Used to get up-to-date channel info
     * @param blackList - Channel IDs to ignore
     * @private
     */
    private getTextChannels(
        interaction: Interaction = this.firstInter,
        blackList?: string[]
    ): SelectMenuComponentOptionData[] {
        const strConfig = this.config.stringConfig;

        const channelOptions: SelectMenuComponentOptionData[] = [];
        const noChannelOptions: SelectMenuComponentOptionData[] = [{
            label: strConfig.emptySelect,
            value: strConfig.emptySelect
        }];

        const textChannels = interaction.guild?.channels.cache.filter(ch => {
                return ch.type === ChannelType.GuildText && ch.guild && ch.guild.members.me &&
                    ch.permissionsFor(ch.guild.members.me).has([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.AttachFiles
                    ]);
            }
        );

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
     * @param inter - Used to show the modal and create/remove listener
     * @private
     */
    private async modalHandle(inter: StringSelectMenuInteraction | ButtonInteraction): Promise<void> {
        const modals = this.config.commandConfigs.boarManage.setup.modals;

        this.modalShowing = new ModalBuilder(modals[this.curField-1]);
        this.modalShowing.setCustomId(modals[this.curField-1].customId + + '|' + inter.id);
        await inter.showModal(this.modalShowing);

        inter.client.on(
            Events.InteractionCreate,
            this.modalListener
        );

        setTimeout(() => {
            inter.client.removeListener(Events.InteractionCreate, this.modalListener);
        }, 60000);
    }

    /**
     * Handles when the user makes an interaction that could be a modal submission
     *
     * @param submittedModal - The interaction to respond to
     * @private
     */
    private modalListener = async (submittedModal: Interaction) => {
        try  {
            // If not a modal submission on current interaction, destroy the modal listener
            if (submittedModal.isMessageComponent() && submittedModal.customId.endsWith(this.firstInter.id as string) ||
                BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(this.compInter.user.id)
            ) {
                clearInterval(this.timerVars.updateTime);
                submittedModal.client.removeListener(Events.InteractionCreate, this.modalListener);

                return;
            }

            // Updates the cooldown to interact again
            CollectorUtils.canInteract(this.timerVars);

            if (!submittedModal.isModalSubmit() || this.collector.ended ||
                !submittedModal.guild || submittedModal.customId !== this.modalShowing.data.custom_id
            ) {
                clearInterval(this.timerVars.updateTime);
                return;
            }

            await submittedModal.deferUpdate();
            await submittedModal.guild.channels.fetch();

            const strConfig = this.config.stringConfig;

            const submittedChannelID = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            );
            const submittedChannel = submittedModal.guild.channels.cache.get(submittedChannelID);
            const notAlreadyChosen = !this.userResponses.boarChannels.includes(submittedChannelID) &&
                this.userResponses.tradeChannelId !== submittedChannelID;

            let submittedChannelName: string;
            let submittedChannelParentName: string = strConfig.noParentChannel;

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedChannelID,
                this.config,
                this.firstInter
            );

            // Checking if channel exists and getting properties of channel
            if (submittedChannel && submittedChannel.isTextBased() && notAlreadyChosen) {
                submittedChannelName = submittedChannel.name;

                if (submittedChannel.parent) {
                    submittedChannelParentName = submittedChannel.parent.name.toUpperCase();
                }
            } else {
                await Replies.handleReply(submittedModal,strConfig.notValidChannel);

                clearInterval(this.timerVars.updateTime);
                submittedModal.client.removeListener(Events.InteractionCreate, this.modalListener);
                return;
            }

            const placeholder = strConfig.channelOptionLabel
                .replace('%@', submittedChannelName)
                .replace('%@', submittedChannelParentName)
                .substring(0, 100);

            if (this.curField === 1) {
                this.userResponses.tradeChannelId = submittedChannelID;
            }

            // Last select menu index by default
            let selectIndex: number = 2;

            if (this.curField === 2) {
                // Gets next select menu that can be changed, if all full, change last one
                for (let i=0; i<2; i++) {
                    const selectMenu: StringSelectMenuBuilder =
                        this.setupFields[1].components[i].components[0] as StringSelectMenuBuilder;

                    if (selectMenu.data.placeholder === strConfig.defaultSelectPlaceholder) {
                        selectIndex = i;
                        break;
                    }
                }

                this.userResponses.boarChannels[selectIndex] = submittedChannelID;
            }

            await this.updateSelectField(
                placeholder,
                selectIndex
            );
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
        submittedModal.client.removeListener(Events.InteractionCreate, this.modalListener);
    };

    /**
     * Updates fields with select menus
     *
     * @param placeholder - The placeholder to use on the select menu(s)
     * @param selectIndex - Used to find what select menu to change if there's multiple
     * @private
     */
    private async updateSelectField(
        placeholder: string,
        selectIndex: number = 0,
    ): Promise<void> {
        const strConfig = this.config.stringConfig;
        const setupRowConfigs = this.config.commandConfigs.boarManage.setup.componentFields;
        const setupComponents = {
            tradeRefresh: setupRowConfigs[0][1].components[0],
            boarRefresh: setupRowConfigs[1][3].components[0],
            restart: setupRowConfigs[3][0].components[1]
        };

        // Components that need to be changed
        const fieldOneSelectMenu: StringSelectMenuBuilder =
            this.setupFields[0].components[0].components[0] as StringSelectMenuBuilder;
        const fieldTwoSelectMenus: ActionRowBuilder<StringSelectMenuBuilder>[] =
            this.setupFields[1].components.slice(0,3) as ActionRowBuilder<StringSelectMenuBuilder>[];
        const nextButton: ButtonBuilder =
            this.staticRows[0].components[2] as ButtonBuilder;

        // Information about the state of the interaction
        const chosenChannels: string[] =
            this.userResponses.boarChannels.concat(this.userResponses.tradeChannelId);
        const isRefresh = this.compInter.customId.startsWith(setupComponents.tradeRefresh.customId) ||
            this.compInter.customId.startsWith(setupComponents.boarRefresh.customId) ||
            this.compInter.customId.startsWith(setupComponents.restart.customId);

        // Disables next button on refresh as it empties all select menus
        nextButton.setDisabled(isRefresh);

        // Change trade select menu even if boar channels are changed since the user can only go back
        // on restart, meaning changes won't be visible
        fieldOneSelectMenu
            .setOptions(...this.getTextChannels(this.compInter, chosenChannels))
            .setPlaceholder(placeholder)
            .setDisabled(this.getTextChannels(this.compInter, chosenChannels)[0].label === strConfig.emptySelect);

        // Edit trade field content based on if it's a refresh or not
        if (!isRefresh && this.curField === 1) {
            this.setupFields[0].content = strConfig.setupFinished1 +
                FormatStrings.toBasicChannel(this.userResponses.tradeChannelId);
            await this.setupFields[0].editReply(this.compInter);
        } else if (isRefresh && this.curField === 1) {
            this.setupFields[0].content = strConfig.setupUnfinished1;
            await this.setupFields[0].editReply(this.compInter);
        }

        // Update boar channel select menus no matter what as changes from trade field must register in
        // boar channel field
        for (const row of fieldTwoSelectMenus) {
            const fieldTwoSelectMenu: StringSelectMenuBuilder = row.components[0] as StringSelectMenuBuilder;

            fieldTwoSelectMenu
                .setOptions(...this.getTextChannels(this.compInter, chosenChannels))
                .setDisabled(this.getTextChannels(this.compInter, chosenChannels)[0].label === strConfig.emptySelect);

            if (isRefresh)
                fieldTwoSelectMenu.setPlaceholder(placeholder);
        }

        // Edit boar channels field content based on if it's a refresh or not
        if (!isRefresh && this.curField === 2) {
            const selectMenu: StringSelectMenuBuilder =
                this.setupFields[1].components[selectIndex].components[0] as StringSelectMenuBuilder;

            let channelsString = '';

            for (const channel of this.userResponses.boarChannels) {
                if (channel === '') continue;
                channelsString += FormatStrings.toBasicChannel(channel) + ' ';
            }

            selectMenu.setPlaceholder(placeholder);
            this.setupFields[1].content = strConfig.setupFinished2 + channelsString;

            await this.setupFields[1].editReply(this.compInter);
        } else if (isRefresh && this.curField === 2) {
            this.setupFields[1].content = strConfig.setupUnfinished2;
            await this.setupFields[1].editReply(this.compInter);
        }
    }

    /**
     * Creates a row on the bottom of all fields using configurations and returns it
     *
     * @private
     */
    private getStaticRows(): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
        const staticRowsConfig = this.config.commandConfigs.boarManage.setup.componentFields[3];
        let staticRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
            ComponentUtils.makeRows(staticRowsConfig);

        ComponentUtils.addToIDs(staticRowsConfig, staticRows, this.firstInter.id);

        return staticRows;
    }

    /**
     * Creates {@link FormField form fields} from configurations and returns them
     *
     * @private
     * @param staticRows
     */
    private getSetupFields(
        staticRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[],
    ): FormField[] {
        const strConfig = this.config.stringConfig;
        const setupFieldConfigs = this.config.commandConfigs.boarManage.setup.componentFields;

        const allFields: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[][] = [];

        for (const field in setupFieldConfigs) {
            const rowsConfig = setupFieldConfigs[field];
            const newRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
                ComponentUtils.makeRows(rowsConfig);

            ComponentUtils.addToIDs(
                rowsConfig, newRows, this.firstInter.id, undefined, this.getTextChannels()
            );

            allFields[field] = newRows;
            allFields[field].push(staticRows[0]);
        }

        return [
            new FormField(strConfig.setupUnfinished1, allFields[0]),
            new FormField(strConfig.setupUnfinished2, allFields[1]),
            new FormField(strConfig.setupUnfinished3, allFields[2])
        ];
    }
}