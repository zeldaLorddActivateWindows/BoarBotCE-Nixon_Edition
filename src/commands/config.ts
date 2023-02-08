/************************************************
 * config.ts
 * Sets up the bot with style and channels.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {
    APISelectMenuOption,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelType, ChatInputCommandInteraction,
    ComponentType,
    InteractionCollector,
    SelectMenuInteraction,
    TextInputStyle,
} from 'discord.js';
import fs from 'fs';
import {handleCooldown, hasAttachmentPerms} from '../supporting_files/GeneralFunctions';
import {getConfigFile, getGuildData, removeGuildFile} from '../supporting_files/DataHandlers';
import {handleError, sendDebug} from '../supporting_files/LogDebug';
import {
    getConfigFields,
    getStaticRow,
    modalHandle,
    Reasons,
    updateSelectField
} from "../supporting_files/command_specific/ConfigFunctions";
import {noPermsReply} from '../supporting_files/InteractionReplies';

//***************************************

const initConfig = getConfigFile();
const commandName = initConfig.strings.commands.config.name;

//***************************************

module.exports = {
    data: { name: commandName },
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild || !interaction.channel)
            return;

        await interaction.deferReply({ ephemeral: true });

        const onCooldown = await handleCooldown(interaction);

        if (onCooldown)
            return;

        const config = getConfigFile();

        // Alias for debug strings
        const debugStrings = config.strings.debug;

        sendDebug(debugStrings.usedCommand
            .replace('%@', interaction.user.tag)
            .replace('%@', this.data.name)
        );

        // Alias for general strings
        const generalStrings = config.strings.general;

        if ((!interaction.memberPermissions || !interaction.memberPermissions.has('Administrator') && false)) {
            await noPermsReply(interaction);
            return;
        }

        // Aliases specific for /boar config
        const configStrings = config.strings.commands.config.other;
        const otherButtons = configStrings.otherButtons;
        const fieldOneStrings = configStrings.fieldOne;
        const fieldTwoStrings = configStrings.fieldTwo;
        const fieldThreeStrings = configStrings.fieldThree;

        // Action rows and fields
        const staticRow = getStaticRow(interaction, config);
        const configFields = getConfigFields(interaction, staticRow, config);

        // Alias for guild data file
        const guildFolderPath = config.paths.data.guildFolder;

        const guildID = interaction.guild.id;
        const guildDataPath = guildFolderPath + guildID + '.json';

        let guildData = await getGuildData(interaction, true);

        // Stores what the user inputs
        const userResponses = {
            isSBServer: false,
            tradeChannelId: '',
            boarChannels: ['', '', '']
        };

        let curField: number = 1;

        // Handles fast interactions from overlapping
        const timerVars = {
            timeUntilNextCollect: 0,
            updateTime: setInterval(() => clearInterval(this.updateTime))
        };

        // Only allows button presses from current interaction to affect results
        const filter = async (btnInt: ButtonInteraction | SelectMenuInteraction) => {
            return btnInt.customId.split('|')[1] === interaction.id;
        };

        let collectorObj: { collector: InteractionCollector<ButtonInteraction | SelectMenuInteraction> };

        try {
            collectorObj = {
                collector: interaction.channel.createMessageComponentCollector({
                    filter,
                    idle: 120000
                }) as InteractionCollector<ButtonInteraction | SelectMenuInteraction>
            };
        } catch (err: unknown) {
            await removeGuildFile(guildDataPath);
            throw err;
        }

        // Attempts to send first config message
        await configFields.configFieldOne.editReply(interaction).catch(async (err) => {
            await removeGuildFile(guildDataPath);
            throw err;
        });

        collectorObj.collector.on('collect', async (inter: SelectMenuInteraction) => {
            try {
                // If the collection attempt was too quick, cancel it
                if (Date.now() < timerVars.timeUntilNextCollect) {
                    await inter.deferUpdate();
                    return;
                }

                // Updates time to collect every 100ms, preventing
                // users from clicking too fast
                timerVars.timeUntilNextCollect = Date.now() + 500;
                timerVars.updateTime = setInterval(() => {
                    timerVars.timeUntilNextCollect = Date.now() + 500;
                }, 100);

                sendDebug(debugStrings.formInteraction
                    .replace('%@', interaction.user.tag)
                    .replace('%@', inter.customId.split('|')[0])
                    .replace('%@', curField)
                );

                // Terminates interaction when in maintenance mode
                if (getConfigFile().maintenanceMode && !config.developers.includes(inter.user.id)) {
                    collectorObj.collector.stop(Reasons.Maintenance);
                    return;
                }

                // User wants to input a channel via ID
                if (inter.customId === otherButtons.findChannel.id + interaction.id) {
                    if (curField !== 1 && curField !== 2) {
                        clearInterval(timerVars.updateTime);
                        return;
                    }

                    await modalHandle(
                        curField,
                        interaction,
                        inter,
                        timerVars,
                        collectorObj,
                        configFields,
                        userResponses
                    );

                    clearInterval(timerVars.updateTime);
                    return;
                }

                await inter.deferUpdate();

                // End collector with reason Finished on finish
                if (inter.customId === otherButtons.next.id + interaction.id && curField === 3) {
                    collectorObj.collector.stop(Reasons.Finished);
                    return
                }

                // End collector with reason Cancelled on cancel
                if (inter.customId === otherButtons.cancel.id + interaction.id) {
                    collectorObj.collector.stop(Reasons.Cancelled);
                    return;
                }

                // Go to the next field (can only go forward)
                if (inter.customId === otherButtons.next.id + interaction.id && curField !== 3) {
                    const nextButton: ButtonBuilder = staticRow.components[2] as ButtonBuilder;

                    nextButton.setDisabled(true)

                    if (curField === 1) {
                        await configFields.configFieldTwo.editReply(inter);
                    } else if (curField === 2) {
                        nextButton.setLabel(otherButtons.next.labelLast)
                            .setStyle(ButtonStyle.Success)

                        await configFields.configFieldThree.editReply(inter);
                    }

                    curField++;
                }

                // User wants to refresh available channels for trade field
                if (inter.customId === fieldOneStrings.selectMenu.id + interaction.id) {
                    userResponses.tradeChannelId = inter.values[0];

                    // Gets the label of the chosen option
                    const placeholder = inter.component.options.filter(option =>
                        option.value === inter.values[0]
                    )[0].label;

                    // Refreshes all select menu options, changes placeholder, and tells user field is done
                    await updateSelectField(
                        curField,
                        placeholder,
                        inter,
                        configFields,
                        userResponses
                    );
                }

                // User wants to refresh available channels for boar channels field
                if (inter.customId === fieldTwoStrings.selectMenuOne.id + interaction.id ||
                    inter.customId === fieldTwoStrings.selectMenuTwo.id + interaction.id ||
                    inter.customId === fieldTwoStrings.selectMenuThree.id + interaction.id
                ) {
                    // Gets index to change based on ending number in select menu ID
                    const selectIndex: number = parseInt(inter.customId.charAt(inter.customId.indexOf('|') - 1)) - 1;
                    userResponses.boarChannels[selectIndex] = inter.values[0];

                    // Gets the label of the chosen option
                    const placeholder = inter.component.options.filter(option =>
                        option.value === inter.values[0]
                    )[0].label;

                    // Refreshes all select menu options, changes placeholder, and tells user field is done
                    await updateSelectField(
                        curField,
                        placeholder,
                        inter,
                        configFields,
                        userResponses,
                        selectIndex
                    );
                }

                // User wants to refresh/restart
                if (inter.customId === fieldOneStrings.refresh.id + interaction.id ||
                    inter.customId === fieldTwoStrings.refresh.id + interaction.id ||
                    inter.customId === otherButtons.restart.id + interaction.id
                ) {
                    const isRestart = inter.customId.startsWith(otherButtons.restart.id);

                    if (isRestart || curField === 1)
                        userResponses.tradeChannelId = '';
                    if (isRestart || curField === 2)
                        userResponses.boarChannels = ['','',''];

                    // Undoes all placeholders depending on if restarting or refreshing,
                    // opens up channels that were added in the middle of configuring
                    await updateSelectField(
                        curField,
                        configStrings.defaultPlaceholder,
                        inter,
                        configFields,
                        userResponses
                    );

                    // Everything after is only on restart
                    if (!isRestart) {
                        clearInterval(timerVars.updateTime);
                        return;
                    }

                    const nextButton: ButtonBuilder = staticRow.components[2] as ButtonBuilder;

                    // Sets contents of every field back to unfinished
                    let configField: keyof typeof configFields;
                    for (configField in configFields) {
                        configFields[configField].reset();
                    }

                    userResponses.isSBServer = false;

                    curField = 1;

                    // Reverts next button back to original state
                    nextButton.setLabel(otherButtons.next.label)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)

                    // Brings user back to first field
                    await configFields.configFieldOne.editReply(interaction);
                }

                // User chose if they want skyblock boars or not
                if (inter.customId === fieldThreeStrings.sbYes.id + interaction.id ||
                    inter.customId === fieldThreeStrings.sbNo.id + interaction.id
                ) {
                    // Handling updating boar style
                    userResponses.isSBServer = inter.customId.startsWith(fieldThreeStrings.sbYes.id);

                    // Tells user what button they pressed
                    configFields.configFieldThree.content = fieldThreeStrings.finished + (userResponses.isSBServer
                        ? fieldThreeStrings.sbYes.label
                        : fieldThreeStrings.sbNo.label);

                    // Enables finish button
                    configFields.configFieldThree.components[1].components[2].setDisabled(false);

                    await configFields.configFieldThree.editReply(inter);
                }

                // Info for the trade channel section
                if (inter.customId === fieldOneStrings.info.id + interaction.id) {
                    await inter.followUp({
                        content: fieldOneStrings.info.response,
                        ephemeral: true
                    });
                }

                // Info for the boar channels section
                if (inter.customId === fieldTwoStrings.info.id + interaction.id) {
                    await inter.followUp({
                        content: fieldTwoStrings.info.response,
                        ephemeral: true
                    });
                }

                // Info for the skyblock section
                if (inter.customId === fieldThreeStrings.info.id + interaction.id) {
                    await inter.followUp({
                        content: fieldThreeStrings.info.response,
                        ephemeral: true
                    });
                }
            } catch (err: unknown) {
                await handleError(err);
                collectorObj.collector.stop(Reasons.Error);
            }

            clearInterval(timerVars.updateTime);
        });

        collectorObj.collector.once('end', async (collected, reason) => {
            sendDebug(debugStrings.endCollection
                .replace('%@', interaction.user.tag)
                .replace('%@', reason)
            );

            try {
                const fileIsEmpty = Object.keys(guildData).length === 0;
                let replyContent: string;

                if (reason && reason === Reasons.Maintenance) {
                    replyContent = generalStrings.maintenance;
                } else if (reason && reason === Reasons.Cancelled) {
                    if (fileIsEmpty)
                        await removeGuildFile(guildDataPath);

                    replyContent = configStrings.cancelled;
                } else if (reason && reason === Reasons.Error) {
                    if (fileIsEmpty)
                        await removeGuildFile(guildDataPath);

                    replyContent = configStrings.error;
                } else if (reason && reason === Reasons.Finished) {
                    guildData = {
                        isSBServer: userResponses.isSBServer,
                        tradeChannel: userResponses.tradeChannelId,
                        channels: userResponses.boarChannels.filter((ch) => ch !== '')
                    };

                    fs.writeFileSync(guildDataPath, JSON.stringify(guildData));

                    if (hasAttachmentPerms(interaction))
                        replyContent = configStrings.finished;
                    else
                        replyContent = configStrings.finished + configStrings.noAttachmentPerms;
                } else {
                    if (fileIsEmpty)
                        await removeGuildFile(guildDataPath);

                    replyContent = configStrings.expired;
                }

                await interaction.editReply({
                    content: replyContent,
                    files: [],
                    components: []
                });
            } catch (err: unknown) {
                await handleError(err);
            }
        });
    }
};