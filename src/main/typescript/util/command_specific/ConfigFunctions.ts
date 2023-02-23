/************************************************
 * ConfigFunctions.ts
 * Functions and enums for the /boar config
 * command.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

//***************************************

import {
    ActionRowBuilder,
    APISelectMenuOption, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType,
    ChatInputCommandInteraction, Events, Interaction, InteractionCollector, ModalBuilder,
    ModalSubmitInteraction, SelectMenuBuilder,
    SelectMenuInteraction, TextInputBuilder, TextInputStyle
} from "discord.js";
import {getConfigFile} from "../DataHandlers";
import {FormField} from "../FormField";
import {handleError} from "../../logging/LogDebug";
import {BotConfig} from '../../bot/config/BotConfig';
import {Bot} from '../../api/bot/Bot';
import {BoarBotApp} from '../../BoarBotApp';
import {FormatStrings} from '../discord/FormatStrings';

//***************************************

enum Reasons {
    Finished = 'finished',
    Cancelled = 'cancelled',
    Error = 'error',
    Maintenance = 'maintenance'
}

//***************************************

// Gets array of channel names and IDs for when selecting channels the bot
// should work in
function getTextChannels(
    interaction: ChatInputCommandInteraction |
        SelectMenuInteraction |
        ModalSubmitInteraction,
    blackList?: string[]
) {
    const config = BoarBotApp.getBot().getConfig();

    const strConfig = config.stringConfig;

    const channelOptions: APISelectMenuOption[] = [];
    const noChannelOptions = config.emptySelectMenu;

    if (!interaction.guild)
        return noChannelOptions;

    const textChannels = interaction.guild.channels.cache.filter(ch => ch.type === ChannelType.GuildText);

    if (!textChannels)
        return noChannelOptions;

    textChannels.forEach((txtCh) => {
        if (blackList && blackList.includes(txtCh.id))
            return;

        let parentName: string;

        if (txtCh.parent)
            parentName = txtCh.parent.name.toUpperCase();
        else
            parentName = strConfig.noParentChannel;

        channelOptions.push({
            label: strConfig.channelOptionLabel
                .replace('%@', txtCh.name)
                .replace('%@', parentName)
                .substring(0, 100),
            value: txtCh.id
        });
    });

    return channelOptions.length > 0
        ? channelOptions.slice(0, 25)
        : noChannelOptions;
}

//***************************************

// Sends modals and receives information on modal submission
async function modalHandle(
    field: number,
    initInteraction: ChatInputCommandInteraction,
    interaction: SelectMenuInteraction,
    timerVars: {timeUntilNextCollect: number, updateTime: NodeJS.Timer},
    collectorObj: {collector: InteractionCollector<ButtonInteraction | SelectMenuInteraction>},
    configFields: {configFieldOne: FormField, configFieldTwo: FormField, configFieldThree: FormField},
    userResponses: {isSBServer: boolean, tradeChannelId: string, boarChannels: string[]}
) {
    const config = getConfigFile();

    // Config file aliases
    const configStrings = config.strings.commands.config.other;
    const modalStrings = configStrings.modal;

    // Modal strings
    const modalTitle = modalStrings.title;
    const modalID = field === 1
        ? modalStrings.tradeID
        : modalStrings.boarID;
    const inputID = modalStrings.inputID;
    const inputLabel = modalStrings.inputLabel;
    const placeholder = modalStrings.inputPlaceholder;

    // Modal elements
    const modal = new ModalBuilder()
        .setCustomId(modalID + interaction.id)
        .setTitle(modalTitle);
    const channelInput = new TextInputBuilder()
        .setCustomId(inputID)
        .setLabel(inputLabel)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(placeholder);
    const modalRow = new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput);

    // Creating the modal
    modal.addComponents(modalRow);
    await interaction.showModal(modal);

    const modalListener = async (submittedModal: Interaction) => {
        try {
            // If not a modal submission, cancel the interaction and remove the listener
            // as the user is clearly no longer in the modal
            if (submittedModal.isMessageComponent() && submittedModal.customId.endsWith(initInteraction.id) ||
                getConfigFile().maintenanceMode && !getConfigFile().developers.includes(interaction.user.id)
            ) {
                clearInterval(timerVars.updateTime);
                interaction.client.removeListener(Events.InteractionCreate, modalListener);

                return;
            }

            // Updates time to collect every 100ms, preventing
            // users from clicking too fast
            timerVars.timeUntilNextCollect = Date.now() + 500;
            timerVars.updateTime = setInterval(() => {
                timerVars.timeUntilNextCollect = Date.now() + 500;
            }, 100);

            if (!submittedModal.isModalSubmit() || collectorObj.collector.ended ||
                !submittedModal.guild || submittedModal.customId !== modalID + interaction.id
            ) {
                clearInterval(timerVars.updateTime);
                return;
            }

            await submittedModal.deferUpdate();
            await submittedModal.guild.channels.fetch();

            // Channel getting
            const submittedChannelID = submittedModal.fields.getTextInputValue(inputID);
            const submittedChannel = submittedModal.guild.channels.cache.get(submittedChannelID);
            const notAlreadyChosen = !userResponses.boarChannels.includes(submittedChannelID) &&
                userResponses.tradeChannelId !== submittedChannelID;

            let submittedChannelName: string;
            let submittedChannelParentName: string;

            // Checking if channel exists and getting properties of channel
            if (submittedChannel && submittedChannel.isTextBased() && notAlreadyChosen) {
                submittedChannelName = submittedChannel.name;

                if (submittedChannel.parent)
                    submittedChannelParentName = submittedChannel.parent.name.toUpperCase();
                else
                    submittedChannelParentName = configStrings.noParent;
            } else {
                await submittedModal.followUp({
                    content: configStrings.notValidChannel,
                    ephemeral: true
                });

                clearInterval(timerVars.updateTime);
                return;
            }

            const placeholder = configStrings.channelOptionLabel
                .replace('%@', submittedChannelName)
                .replace('%@', submittedChannelParentName)
                .substring(0, 100);

            if (field === 1)
                userResponses.tradeChannelId = submittedChannelID;

            let selectIndex: number = 2;

            if (field === 2) {
                // Gets next select menu that can be changed, if all full, change last one
                for (let i=0; i<2; i++) {
                    const selectMenu: SelectMenuBuilder =
                        configFields.configFieldTwo.components[i].components[0] as SelectMenuBuilder;

                    if (selectMenu.data.placeholder === configStrings.noChannelOptions) {
                        selectIndex = i;
                        break;
                    }
                }

                userResponses.boarChannels[selectIndex] = submittedChannelID;
            }

            await updateSelectField(
                field,
                placeholder,
                interaction,
                configFields,
                userResponses,
                selectIndex
            );
        } catch (err: unknown) {
            clearInterval(timerVars.updateTime);
            interaction.client.removeListener(Events.InteractionCreate, modalListener);

            await handleError(err);
            collectorObj.collector.stop(Reasons.Error);
        }

        clearInterval(timerVars.updateTime);
        interaction.client.removeListener(Events.InteractionCreate, modalListener);
    }

    interaction.client.on(Events.InteractionCreate, modalListener);

    setTimeout(() => {
        interaction.client.removeListener(Events.InteractionCreate, modalListener);
    }, 60000);
}

//***************************************

// Updates fields with select menus
async function updateSelectField(
    field: number,
    placeholder: string,
    interaction: SelectMenuInteraction,
    configFields: {configFieldOne: FormField, configFieldTwo: FormField, configFieldThree: FormField},
    userResponses: {isSBServer: boolean, tradeChannelId: string, boarChannels: string[]},
    selectIndex: number = 0
) {
    const config = BoarBotApp.getBot().getConfig();

    const strConfig = config.stringConfig;
    const setupComponentsConfig = config.commandConfigs.setup.components;

    // Components that need to be changed
    const fieldOneSelectMenu: SelectMenuBuilder =
        configFields.configFieldOne.components[0].components[0] as SelectMenuBuilder;
    const fieldTwoSelectMenus: ActionRowBuilder<SelectMenuBuilder>[] =
        configFields.configFieldTwo.components.slice(0,3) as ActionRowBuilder<SelectMenuBuilder>[];
    const nextButton: ButtonBuilder =
        configFields.configFieldOne.components[2].components[2] as ButtonBuilder;

    // Information about the state of the interaction
    const chosenChannels: string[] =
        userResponses.boarChannels.concat(userResponses.tradeChannelId);
    const isRefresh = interaction.customId.startsWith(setupComponentsConfig.refresh1.id) ||
        interaction.customId.startsWith(setupComponentsConfig.refresh2.id) ||
        interaction.customId.startsWith(setupComponentsConfig.restart.id);

    // Disables next button on refresh as it empties all select menus
    nextButton.setDisabled(isRefresh);

    // Change trade select menu even if boar channels are changed since the user can only go back
    // on restart, meaning changes won't be visible
    fieldOneSelectMenu
        .setOptions(...getTextChannels(interaction, chosenChannels))
        .setPlaceholder(placeholder)
        .setDisabled(getTextChannels(interaction, chosenChannels)[0].label ===
            config.emptySelectMenu[0].label
        );

    // Edit trade field content based on if it's a refresh or not
    if (!isRefresh && field === 1) {
        configFields.configFieldOne.content = strConfig.setupFinished1 +
            FormatStrings.toBasicChannel(userResponses.tradeChannelId);
        await configFields.configFieldOne.editReply(interaction);
    } else if (isRefresh && field === 1) {
        configFields.configFieldOne.content = strConfig.setupUnfinished1;
        await configFields.configFieldOne.editReply(interaction);
    }

    // Update boar channel select menus no matter what as changes from trade field must register in
    // boar channel field
    for (const row of fieldTwoSelectMenus) {
        const fieldTwoSelectMenu: SelectMenuBuilder = row.components[0] as SelectMenuBuilder;

        fieldTwoSelectMenu
            .setOptions(...getTextChannels(interaction, chosenChannels))
            .setDisabled(getTextChannels(interaction, chosenChannels)[0].label ===
                config.emptySelectMenu[0].label
            );

        if (isRefresh)
            fieldTwoSelectMenu.setPlaceholder(placeholder);
    }

    // Edit boar channels field content based on if it's a refresh or not
    if (!isRefresh && field === 2) {
        const selectMenu: SelectMenuBuilder =
            configFields.configFieldTwo.components[selectIndex].components[0] as SelectMenuBuilder;

        let channelsString = '';

        for (const channel of userResponses.boarChannels) {
            if (channel !== '')
                channelsString += FormatStrings.toBasicChannel(channel);
        }

        selectMenu.setPlaceholder(placeholder);
        configFields.configFieldTwo.content = strConfig.setupFinished2 + channelsString;

        await configFields.configFieldTwo.editReply(interaction);
    } else if (isRefresh && field === 2) {
        configFields.configFieldTwo.content = strConfig.setupUnfinished2;
        await configFields.configFieldTwo.editReply(interaction);
    }
}

//***************************************

// Gets the static row that goes at the bottom of every field
function getStaticRow(interaction: ChatInputCommandInteraction, config: BotConfig) {
    const setupComponentConfigs = config.commandConfigs.setup.components;

    return new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
        new ButtonBuilder()
            .setCustomId(setupComponentConfigs.cancel.id + '|' + interaction.id)
            .setLabel(setupComponentConfigs.cancel.label)
            .setStyle(ButtonStyle.Danger)
            .setDisabled(false),
        new ButtonBuilder()
            .setCustomId(setupComponentConfigs.restart.id + '|' + interaction.id)
            .setLabel(setupComponentConfigs.restart.label)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(false),
        new ButtonBuilder()
            .setCustomId(setupComponentConfigs.next.id + '|' + interaction.id)
            .setLabel(setupComponentConfigs.next.label)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
    );
}

//***************************************

function getConfigFields(
    interaction: ChatInputCommandInteraction,
    staticRow: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>,
    config: BotConfig
) {
    const strConfig = config.stringConfig;
    const setupComponentConfigs = config.commandConfigs.setup.components;

    return {
        // Field that gets trade channel
        configFieldOne: new FormField(
            strConfig.setupUnfinished1,
            [
                new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                    new SelectMenuBuilder()
                        .setCustomId(setupComponentConfigs.selectMenu1.id + interaction.id)
                        .setPlaceholder(setupComponentConfigs.selectMenu1.label)
                        .setOptions(...getTextChannels(interaction))
                ),
                new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                    new ButtonBuilder()
                        .setCustomId(setupComponentConfigs.refresh1.id + interaction.id)
                        .setLabel(setupComponentConfigs.refresh1.label)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false),
                    new ButtonBuilder()
                        .setCustomId(setupComponentConfigs.findChannel.id + interaction.id)
                        .setEmoji(setupComponentConfigs.findChannel.label)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false),
                    new ButtonBuilder()
                        .setCustomId(setupComponentConfigs.info1.id + interaction.id)
                        .setEmoji(setupComponentConfigs.info1.label)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false)
                ),
                staticRow
            ]
        ),
        // Field that gets boar channels
        configFieldTwo: new FormField(
        strConfig.setupUnfinished2,
        [
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new SelectMenuBuilder()
                    .setCustomId(setupComponentConfigs.selectMenu2_1.id + interaction.id)
                    .setPlaceholder(setupComponentConfigs.selectMenu2_1.label)
                    .setOptions(...getTextChannels(interaction))
            ),
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new SelectMenuBuilder()
                    .setCustomId(setupComponentConfigs.selectMenu2_2.id + interaction.id)
                    .setPlaceholder(setupComponentConfigs.selectMenu2_2.label)
                    .setOptions(...getTextChannels(interaction))
            ),
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new SelectMenuBuilder()
                    .setCustomId(setupComponentConfigs.selectMenu2_3.id + interaction.id)
                    .setPlaceholder(setupComponentConfigs.selectMenu2_3.label)
                    .setOptions(...getTextChannels(interaction))
            ),
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new ButtonBuilder()
                    .setCustomId(setupComponentConfigs.refresh2.id + interaction.id)
                    .setLabel(setupComponentConfigs.refresh2.label)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId(setupComponentConfigs.findChannel.id + interaction.id)
                    .setEmoji(setupComponentConfigs.findChannel.label)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId(setupComponentConfigs.info2.id + interaction.id)
                    .setEmoji(setupComponentConfigs.info2.label)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(false)
                ),
                staticRow
            ]
        ),
        // Field that gets if server is SB server or not
        configFieldThree: new FormField(
        strConfig.setupUnfinished3,
        [
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new ButtonBuilder()
                    .setCustomId(setupComponentConfigs.sbYes.id + interaction.id)
                    .setLabel(setupComponentConfigs.sbYes.label)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId(setupComponentConfigs.sbNo.id + interaction.id)
                    .setLabel(setupComponentConfigs.sbNo.label)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId(setupComponentConfigs.info3.id + interaction.id)
                    .setEmoji(setupComponentConfigs.info3.label)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(false)
                ),
                staticRow
            ]
        )
    }
}

//***************************************

export {
    Reasons,
    getTextChannels,
    modalHandle,
    updateSelectField,
    getStaticRow,
    getConfigFields
}