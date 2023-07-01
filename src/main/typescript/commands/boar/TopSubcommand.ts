import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction, Client, Events, Interaction, InteractionCollector,
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
import {BoardData} from '../../util/data/global/BoardData';
import {BoarUser} from '../../util/boar/BoarUser';
import {Queue} from '../../util/interactions/Queue';
import fs from 'fs';
import {GlobalData} from '../../util/data/global/GlobalData';

enum Board {
    Bucks = 'bucks',
    Total = 'total',
    Uniques = 'uniques',
    UniquesSB = 'uniquesSB',
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
    private leaderboardData: Record<string, BoardData> = {};
    private curBoard: Board = Board.Bucks;
    private curBoardData: [string, number][] = [];
    private curPage = 0;
    private maxPage = 0;
    private rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };
    private modalShowing: ModalBuilder = {} as ModalBuilder;
    private curModalListener: ((submittedModal: Interaction) => Promise<void>) | undefined;
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

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

        // Leaderboard to start out in
        this.curBoard = interaction.options.getString(this.subcommandInfo.args[0].name)
            ? interaction.options.getString(this.subcommandInfo.args[0].name) as Board
            : Board.Bucks;

        // Used to get the page of the board a user is on
        const userInput: User | null = interaction.options.getUser(this.subcommandInfo.args[1].name);

        // Used to get the page to start out on
        const pageInput: number = interaction.options.getInteger(this.subcommandInfo.args[2].name)
            ? interaction.options.getInteger(this.subcommandInfo.args[2].name) as number
            : 1;

        this.leaderboardData = DataHandlers.getGlobalData().leaderboardData;

        this.curBoardData = (Object.entries(this.leaderboardData[this.curBoard].userData) as [string, number][])
            .sort((a, b) => b[1] - a[1]);
        await this.doAthleteBadge();

        this.maxPage = Math.ceil(this.curBoardData.length / this.config.numberConfig.leaderboardNumPlayers) - 1;

        if (userInput === null || this.getUserIndex(userInput.id) === -1) {
            this.curPage = Math.max(Math.min(pageInput-1, this.maxPage), 0);
        } else {
            this.curPage = Math.ceil(
                this.getUserIndex(userInput.id) / this.config.numberConfig.leaderboardNumPlayers
            ) - 1;
        }

        if (CollectorUtils.topCollectors[interaction.user.id]) {
            const oldCollector = CollectorUtils.topCollectors[interaction.user.id];
            setTimeout(() => { oldCollector.stop(CollectorUtils.Reasons.Expired) }, 1000);
        }

        this.collector = CollectorUtils.topCollectors[interaction.user.id] = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        this.imageGen = new LeaderboardImageGenerator(this.curBoardData, this.curBoard, this.config);
        this.showLeaderboard();

        if (userInput && this.getUserIndex(userInput.id) === -1) {
            await Replies.handleReply(
                interaction, this.config.stringConfig.notInBoard, this.config.colorConfig.error,
                undefined, undefined, true
            );
        }

        this.collector.on(
            'collect', async (inter: ButtonInteraction | StringSelectMenuInteraction) => await this.handleCollect(inter)
        );

        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));
    }

    /**
     * Handles collecting button and select menu interactions
     *
     * @param inter - The button interaction
     * @private
     */
    private async handleCollect(inter: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
        try {
            const canInteract: boolean = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            if (!inter.isMessageComponent()) return;

            if (!inter.customId.includes(this.firstInter.id)) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }

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

                // User wants to change the boars they're viewing
                case leaderComponents.boardSelect.customId:
                    this.curBoard = (this.compInter as StringSelectMenuInteraction).values[0] as Board;
                    this.curBoardData = (Object.entries(
                        this.leaderboardData[this.curBoard].userData
                    ) as [string, number][]).sort((a, b) => b[1] - a[1]);
                    await this.doAthleteBadge();
                    this.maxPage = Math.ceil(
                        this.curBoardData.length / this.config.numberConfig.leaderboardNumPlayers
                    ) - 1;
                    this.imageGen.updateInfo(this.curBoardData, this.curBoard, this.config);
                    this.curPage = 0;
                    break;
            }

            await this.showLeaderboard();
        } catch (err: unknown) {
            const canStop: boolean = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        clearInterval(this.timerVars.updateTime);
    }

    /**
     * Handles when the collection for navigating through leaderboard menu
     *
     * @param reason - Why the collection ended
     * @private
     */
    private async handleEndCollect(reason: string): Promise<void> {
        try {
            LogDebug.sendDebug('Ended collection with reason: ' + reason, this.config, this.firstInter);

            if (reason == CollectorUtils.Reasons.Error) {
                await Replies.handleReply(
                    this.firstInter, this.config.stringConfig.setupError, this.config.colorConfig.error
                );
            }

            this.endModalListener(this.compInter.client);
            await this.firstInter.editReply({
                components: []
            });
        } catch (err: unknown) {
            await LogDebug.handleError(err, this.firstInter);
        }
    }

    /**
     * Sends the modal that gets page input
     *
     * @param inter - Used to show the modal and create/remove listener
     * @private
     */
    private async modalHandle(inter: MessageComponentInteraction): Promise<void> {
        const modals: ModalConfig[] = this.config.commandConfigs.boar.top.modals;

        this.modalShowing = new ModalBuilder(modals[0]);
        this.modalShowing.setCustomId(modals[0].customId + '|' + inter.id);
        await inter.showModal(this.modalShowing);

        inter.client.on(Events.InteractionCreate, this.modalListener);
    }

    /**
     * Handles page input that was input in modal
     *
     * @param submittedModal - The interaction to respond to
     * @private
     */
    private modalListener = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (submittedModal.user.id !== this.firstInter.user.id) return;

            // If not a modal submission on current interaction, destroy the modal listener
            if (
                submittedModal.isMessageComponent() &&
                submittedModal.customId.endsWith(this.firstInter.id + '|' + this.firstInter.user.id) ||
                BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(this.compInter.user.id)
            ) {
                this.endModalListener(submittedModal.client);
                return;
            }

            // Updates the cooldown to interact again
            const canInteract = await CollectorUtils.canInteract(this.timerVars);
            if (!canInteract) {
                this.endModalListener(submittedModal.client);
                return;
            }

            if (
                !submittedModal.isModalSubmit() || this.collector.ended || !submittedModal.guild ||
                submittedModal.customId !== this.modalShowing.data.custom_id
            ) {
                this.endModalListener(submittedModal.client);
                return;
            }

            await submittedModal.deferUpdate();

            const submittedPage: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedPage, this.config, this.firstInter
            );

            let pageVal = 1;
            if (!Number.isNaN(parseInt(submittedPage))) {
                pageVal = parseInt(submittedPage);
            }

            this.curPage = Math.max(Math.min(pageVal-1, this.maxPage), 0);

            await this.showLeaderboard();
        } catch (err: unknown) {
            const canStop: boolean = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        this.endModalListener(submittedModal.client);
    };

    /**
     * Ends the current modal listener that's active
     *
     * @param client - Used to remove the listener
     * @private
     */
    private endModalListener(client: Client): void {
        clearInterval(this.timerVars.updateTime);
        if (this.curModalListener) {
            client.removeListener(Events.InteractionCreate, this.curModalListener);
            this.curModalListener = undefined;
        }
    }

    /**
     * Displays the leaderboard image and modifies button states
     *
     * @private
     */
    private async showLeaderboard(): Promise<void> {
        try {
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
            this.rows[0].components[2].setDisabled(this.curPage === this.maxPage);
            this.rows[1].components[0].setDisabled(false);

            await this.firstInter.editReply({
                files: [await this.imageGen.makeLeaderboardImage(this.curPage)],
                components: this.rows
            });
        } catch (err: unknown) {
            const canStop: boolean = await LogDebug.handleError(err, this.firstInter);
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

    /**
     * Gets the index position of user on leaderboard
     *
     * @param idInput - User ID input to look for
     * @private
     */
    private getUserIndex(idInput: string): number {
        let i = 0;
        for (const [id] of this.curBoardData) {
            if (id === idInput) {
                return i;
            }
            i++;
        }
        return -1;
    }

    /**
     * Attempts to give the top user of the current board the athlete badge
     *
     * @private
     */
    private async doAthleteBadge(): Promise<void> {
        const newTopUserID: string | undefined = this.curBoardData.length > 0
            ? this.curBoardData[0][0]
            : undefined;
        const oldTopUserID: string | undefined = this.leaderboardData[this.curBoard].topUser;

        if (newTopUserID && newTopUserID !== oldTopUserID) {
            try {
                const newTopUser: User = await this.firstInter.client.users.fetch(newTopUserID);
                const newTopBoarUser: BoarUser = new BoarUser(newTopUser);

                await newTopBoarUser.addBadge('athlete', this.firstInter);

                await Queue.addQueue(async () => {
                    const globalData: GlobalData = DataHandlers.getGlobalData();
                    globalData.leaderboardData[this.curBoard].topUser = newTopUserID;
                    fs.writeFileSync(this.config.pathConfig.globalDataFile, JSON.stringify(globalData));
                }, newTopUserID + 'global').catch((err) => { throw err });
            } catch {}
        }
    }
}