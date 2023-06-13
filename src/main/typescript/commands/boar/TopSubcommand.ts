import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction, Events, Interaction,
    InteractionCollector,
    MessageComponentInteraction, ModalBuilder,
    SelectMenuComponentOptionData,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    User
} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {GuildData} from '../../util/data/global/GuildData';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {BotConfig} from '../../bot/config/BotConfig';
import {DataHandlers} from '../../util/data/DataHandlers';
import {LeaderboardImageGenerator} from '../../util/generators/LeaderboardImageGenerator';
import {Replies} from '../../util/interactions/Replies';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {RowConfig} from '../../bot/config/components/RowConfig';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import {LogDebug} from '../../util/logging/LogDebug';
import {ModalConfig} from '../../bot/config/modals/ModalConfig';

enum Board {
    Bucks = 'bucks',
    Total = 'total',
    Uniques = 'uniques',
    Streak = 'streak',
    Attempts = 'attempts',
    TopAttempts = 'topAttempts',
    GiftsUsed = 'giftsUsed',
    Multiplier = 'multiplier'
}

/**
 * {@link TopSubcommand TopSubcommand.ts}
 *
 * Used to see leaderboards that rank player stats
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class TopSubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boar.top;
    private firstInter: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private compInter: MessageComponentInteraction = {} as MessageComponentInteraction;
    private imageGen: LeaderboardImageGenerator = {} as LeaderboardImageGenerator;
    private leaderboardData: any;
    private curBoard: Board = Board.Bucks;
    private curBoardData: [string, number][] = [];
    private curPage: number = 0;
    private maxPage: number = 0;
    private rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
    private modalShowing: ModalBuilder = {} as ModalBuilder;
    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildData: GuildData | undefined = await InteractionUtils.handleStart(interaction, this.config);
        if (!guildData) return;

        await interaction.deferReply();

        this.firstInter = interaction;

        this.curBoard = interaction.options.getString(this.subcommandInfo.args[0].name)
            ? interaction.options.getString(this.subcommandInfo.args[0].name) as Board
            : Board.Bucks;
        const userInput: User | null = interaction.options.getUser(this.subcommandInfo.args[1].name);
        const pageInput: number = interaction.options.getInteger(this.subcommandInfo.args[2].name)
            ? interaction.options.getInteger(this.subcommandInfo.args[2].name) as number
            : 1;

        this.leaderboardData = DataHandlers.getGlobalData().leaderboardData;

        this.curBoardData = (Object.entries(this.leaderboardData[this.curBoard]) as [string, number][])
            .sort((a, b) => b[1] - a[1]);

        this.maxPage = Math.floor(this.curBoardData.length / this.config.numberConfig.leaderboardNumPlayers);

        if (!userInput || this.getUserIndex(userInput.id) === -1) {
            this.curPage = Math.max(Math.min(pageInput-1, this.maxPage), 0);
        } else {
            this.curPage = Math.floor(this.getUserIndex(userInput.id) / this.config.numberConfig.leaderboardNumPlayers);
        }

        if (userInput && this.getUserIndex(userInput.id) === -1) {
            await Replies.handleReply(
                interaction, 'The user you entered isn\'t on this leaderboard! Defaulting to first page.',
                undefined, undefined, undefined, true
            );
        }

        if (CollectorUtils.topCollectors[interaction.user.id]) {
            CollectorUtils.topCollectors[interaction.user.id].stop('idle');
        }

        CollectorUtils.topCollectors[interaction.user.id] = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        this.imageGen = new LeaderboardImageGenerator(this.curBoardData, this.curBoard, this.config);
        await this.showLeaderboard();

        CollectorUtils.topCollectors[interaction.user.id].on(
            'collect',
            async (inter: ButtonInteraction | StringSelectMenuInteraction) => await this.handleCollect(inter)
        );

        CollectorUtils.topCollectors[interaction.user.id].once(
            'end',
            async (collected, reason) => await this.handleEndCollect(reason)
        );
    }

    private async handleCollect(inter: ButtonInteraction | StringSelectMenuInteraction) {
        try {
            const canInteract: boolean = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            if (!inter.isMessageComponent()) return;

            this.compInter = inter;

            LogDebug.sendDebug(
                `${inter.customId.split('|')[0]} on page ${this.curPage} in board ${this.curBoard}`,
                this.config, this.firstInter
            );

            const leaderRowConfig: RowConfig[][] = this.config.commandConfigs.boar.top.componentFields;
            const leaderComponents = {
                leftPage: leaderRowConfig[0][0].components[0],
                inputPage: leaderRowConfig[0][0].components[1],
                rightPage: leaderRowConfig[0][0].components[2],
                boardSelect: leaderRowConfig[0][1].components[0]
            };

            // User wants to input a page manually
            if (inter.customId.startsWith(leaderComponents.inputPage.customId)) {
                await this.modalHandle(inter);

                clearInterval(this.timerVars.updateTime);
                return;
            }

            await inter.deferUpdate();

            switch (inter.customId.split('|')[0]) {
                // User wants to go to previous page
                case leaderComponents.leftPage.customId:
                    this.curPage--;
                    break;

                // User wants to go to the next page
                case leaderComponents.rightPage.customId:
                    this.curPage++;
                    break;

                case leaderComponents.boardSelect.customId:
                    this.curBoard = (this.compInter as StringSelectMenuInteraction).values[0] as Board;
                    this.curBoardData = (Object.entries(this.leaderboardData[this.curBoard]) as [string, number][])
                        .sort((a, b) => b[1] - a[1]);
                    this.maxPage = Math.floor(
                        this.curBoardData.length / this.config.numberConfig.leaderboardNumPlayers
                    );
                    this.imageGen.updateInfo(this.curBoardData, this.curBoard, this.config);
                    this.curPage = 0;
                    break;
            }

            await this.showLeaderboard();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
    }

    private async handleEndCollect(reason: string) {
        try {
            LogDebug.sendDebug('Ended collection with reason: ' + reason, this.config, this.firstInter);

            if (reason == CollectorUtils.Reasons.Error) {
                await Replies.handleReply(
                    this.firstInter, this.config.stringConfig.setupError,
                    this.config.colorConfig.error, undefined, undefined, true
                );
            }

            await this.firstInter.editReply({
                components: []
            });
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    private async modalHandle(inter: MessageComponentInteraction) {
        const modals: ModalConfig[] = this.config.commandConfigs.boar.top.modals;

        this.modalShowing = new ModalBuilder(modals[0]);
        this.modalShowing.setCustomId(modals[0].customId + '|' + inter.id);
        await inter.showModal(this.modalShowing);

        inter.client.on(Events.InteractionCreate, this.modalListener);

        setTimeout(() => {
            inter.client.removeListener(Events.InteractionCreate, this.modalListener);
        }, 60000);
    }

    private modalListener = async (submittedModal: Interaction): Promise<void> => {
        try  {
            // If not a modal submission on current interaction, destroy the modal listener
            if (
                submittedModal.isMessageComponent() &&
                submittedModal.customId.endsWith(this.firstInter.id + '|' + this.firstInter.user.id) ||
                BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(this.compInter.user.id)
            ) {
                clearInterval(this.timerVars.updateTime);
                submittedModal.client.removeListener(Events.InteractionCreate, this.modalListener);

                return;
            }

            // Updates the cooldown to interact again
            CollectorUtils.canInteract(this.timerVars);

            if (
                !submittedModal.isModalSubmit() || this.collector.ended ||
                !submittedModal.guild || submittedModal.customId !== this.modalShowing.data.custom_id
            ) {
                clearInterval(this.timerVars.updateTime);
                return;
            }

            await submittedModal.deferUpdate();

            const submittedPage: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedPage, this.config, this.firstInter
            );

            let pageVal: number = 1;
            if (!Number.isNaN(parseInt(submittedPage))) {
                pageVal = parseInt(submittedPage);
            }

            this.curPage = Math.max(Math.min(pageVal-1, this.maxPage), 0);

            await this.showLeaderboard();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
        submittedModal.client.removeListener(Events.InteractionCreate, this.modalListener);
    };

    private async showLeaderboard() {
        if (!this.imageGen.hasMadeImage()) {
            this.initButtons();
        }

        for (const row of this.rows) {
            for (const component of row.components) {
                component.setDisabled(true);
            }
        }

        this.rows[0].components[0].setDisabled(this.curPage === 0);
        this.rows[0].components[1].setDisabled(this.maxPage === 0);
        this.rows[1].components[0].setDisabled(false);
        this.rows[0].components[2].setDisabled(this.curPage === this.maxPage);

        await this.firstInter.editReply({
            files: [await this.imageGen.makeLeaderboardImage(this.curPage)],
            components: this.rows
        });
    }

    private initButtons(): void {
        const leaderFieldConfigs: RowConfig[][] = this.config.commandConfigs.boar.top.componentFields;
        const selectOptions: SelectMenuComponentOptionData[] = [];

        for (const choice of this.config.commandConfigs.boar.top.args[0].choices) {
            selectOptions.push({
                label: choice.name,
                value: choice.value
            });
        }

        for (let i=0; i<leaderFieldConfigs.length; i++) {
            const newRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
                ComponentUtils.makeRows(leaderFieldConfigs[i]);

            ComponentUtils.addToIDs(
                leaderFieldConfigs[i], newRows, this.firstInter.id, this.firstInter.user.id, selectOptions
            );
            this.rows = newRows;
        }
    }

    private getUserIndex(idInput: string) {
        let i=0;
        for (const [id] of this.curBoardData) {
            if (id === idInput) {
                return i;
            }
            i++;
        }
        return -1;
    }
}