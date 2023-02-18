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
    const config = getConfigFile();

    const configStrings = config.strings.commands.config.other;

    const channelOptions: APISelectMenuOption[] = [];
    const noChannelOptions = configStrings.noChannelOptions;

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
            parentName = configStrings.noParent;

        channelOptions.push({
            label: configStrings.channelOptionLabel
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
    const config = getConfigFile();

    const configStrings = config.strings.commands.config.other;
    const generalStrings = config.strings.general;

    // Config file aliases
    const fieldOneStrings = configStrings.fieldOne;
    const fieldTwoStrings = configStrings.fieldTwo;
    const otherButtons = configStrings.otherButtons;

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
    const isRefresh = interaction.customId.startsWith(fieldOneStrings.refresh.id) ||
        interaction.customId.startsWith(fieldTwoStrings.refresh.id) ||
        interaction.customId.startsWith(otherButtons.restart.id);

    // Disables next button on refresh as it empties all select menus
    nextButton.setDisabled(isRefresh);

    // Change trade select menu even if boar channels are changed since the user can only go back
    // on restart, meaning changes won't be visible
    fieldOneSelectMenu
        .setOptions(...getTextChannels(interaction, chosenChannels))
        .setPlaceholder(placeholder)
        .setDisabled(getTextChannels(interaction, chosenChannels)[0].label ===
            configStrings.noChannelOptions[0].label
        );

    // Edit trade field content based on if it's a refresh or not
    if (!isRefresh && field === 1) {
        configFields.configFieldOne.content = fieldOneStrings.finished + generalStrings.formattedChannel
            .replace('%@', userResponses.tradeChannelId);
        await configFields.configFieldOne.editReply(interaction);
    } else if (isRefresh && field === 1) {
        configFields.configFieldOne.content = fieldOneStrings.unfinished;
        await configFields.configFieldOne.editReply(interaction);
    }

    // Update boar channel select menus no matter what as changes from trade field must register in
    // boar channel field
    for (const row of fieldTwoSelectMenus) {
        const fieldTwoSelectMenu: SelectMenuBuilder = row.components[0] as SelectMenuBuilder;

        fieldTwoSelectMenu
            .setOptions(...getTextChannels(interaction, chosenChannels))
            .setDisabled(getTextChannels(interaction, chosenChannels)[0].label ===
                configStrings.noChannelOptions[0].label
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
                channelsString += generalStrings.formattedChannel.replace('%@', channel);
        }

        selectMenu.setPlaceholder(placeholder);
        configFields.configFieldTwo.content = fieldTwoStrings.finished + channelsString;

        await configFields.configFieldTwo.editReply(interaction);
    } else if (isRefresh && field === 2) {
        configFields.configFieldTwo.content = fieldTwoStrings.unfinished;
        await configFields.configFieldTwo.editReply(interaction);
    }
}

//***************************************

// Gets the static row that goes at the bottom of every field
function getStaticRow(interaction: ChatInputCommandInteraction, config: any) {
    const configStrings = config.strings.commands.config.other;
    const otherButtons = configStrings.otherButtons;

    return new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
        new ButtonBuilder()
            .setCustomId(otherButtons.cancel.id + interaction.id)
            .setLabel(otherButtons.cancel.label)
            .setStyle(ButtonStyle.Danger)
            .setDisabled(false),
        new ButtonBuilder()
            .setCustomId(otherButtons.restart.id + interaction.id)
            .setLabel(otherButtons.restart.label)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(false),
        new ButtonBuilder()
            .setCustomId(otherButtons.next.id + interaction.id)
            .setLabel(otherButtons.next.label)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
    );
}

//***************************************

function getConfigFields(
    interaction: ChatInputCommandInteraction,
    staticRow: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>,
    config: any
) {
    const configStrings = config.strings.commands.config.other;
    const fieldOneStrings = configStrings.fieldOne;
    const fieldTwoStrings = configStrings.fieldTwo;
    const fieldThreeStrings = configStrings.fieldThree;
    const otherButtons = configStrings.otherButtons;

    return {
        // Field that gets trade channel
        configFieldOne: new FormField(
            fieldOneStrings.unfinished,
            [
                new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                    new SelectMenuBuilder()
                        .setCustomId(fieldOneStrings.selectMenu.id + interaction.id)
                        .setPlaceholder(fieldOneStrings.selectMenu.label)
                        .setOptions(...getTextChannels(interaction))
                ),
                new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                    new ButtonBuilder()
                        .setCustomId(fieldOneStrings.refresh.id + interaction.id)
                        .setLabel(fieldOneStrings.refresh.label)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false),
                    new ButtonBuilder()
                        .setCustomId(otherButtons.findChannel.id + interaction.id)
                        .setEmoji(otherButtons.findChannel.label)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false),
                    new ButtonBuilder()
                        .setCustomId(fieldOneStrings.info.id + interaction.id)
                        .setEmoji(fieldOneStrings.info.label)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false)
                ),
                staticRow
            ]
        ),
        // Field that gets boar channels
        configFieldTwo: new FormField(
        fieldTwoStrings.unfinished,
        [
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new SelectMenuBuilder()
                    .setCustomId(fieldTwoStrings.selectMenuOne.id + interaction.id)
                    .setPlaceholder(fieldTwoStrings.selectMenuOne.label)
                    .setOptions(...getTextChannels(interaction))
            ),
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new SelectMenuBuilder()
                    .setCustomId(fieldTwoStrings.selectMenuTwo.id + interaction.id)
                    .setPlaceholder(fieldTwoStrings.selectMenuTwo.label)
                    .setOptions(...getTextChannels(interaction))
            ),
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new SelectMenuBuilder()
                    .setCustomId(fieldTwoStrings.selectMenuThree.id + interaction.id)
                    .setPlaceholder(fieldTwoStrings.selectMenuThree.label)
                    .setOptions(...getTextChannels(interaction))
            ),
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new ButtonBuilder()
                    .setCustomId(fieldTwoStrings.refresh.id + interaction.id)
                    .setLabel(fieldTwoStrings.refresh.label)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId(otherButtons.findChannel.id + interaction.id)
                    .setEmoji(otherButtons.findChannel.label)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId(fieldTwoStrings.info.id + interaction.id)
                    .setEmoji(fieldTwoStrings.info.label)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(false)
                ),
                staticRow
            ]
        ),
        // Field that gets if server is SB server or not
        configFieldThree: new FormField(
        fieldThreeStrings.unfinished,
        [
            new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>().setComponents(
                new ButtonBuilder()
                    .setCustomId(fieldThreeStrings.sbYes.id + interaction.id)
                    .setLabel(fieldThreeStrings.sbYes.label)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId(fieldThreeStrings.sbNo.id + interaction.id)
                    .setLabel(fieldThreeStrings.sbNo.label)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(false),
                new ButtonBuilder()
                    .setCustomId(fieldThreeStrings.info.id + interaction.id)
                    .setEmoji(fieldThreeStrings.info.label)
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