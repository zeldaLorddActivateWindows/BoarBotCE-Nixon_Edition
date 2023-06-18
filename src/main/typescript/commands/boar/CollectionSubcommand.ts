import {
    ActionRowBuilder, AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction, Client, ColorResolvable, EmbedBuilder,
    Events,
    Interaction,
    MessageComponentInteraction,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextChannel,
    User
} from 'discord.js';
import {BoarUser} from '../../util/boar/BoarUser';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {Queue} from '../../util/interactions/Queue';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {LogDebug} from '../../util/logging/LogDebug';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import {BoarUtils} from '../../util/boar/BoarUtils';
import {CollectionImageGenerator} from '../../util/generators/CollectionImageGenerator';
import {Replies} from '../../util/interactions/Replies';
import {FormatStrings} from '../../util/discord/FormatStrings';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import createRBTree, {Tree} from 'functional-red-black-tree';
import {BoarGift} from '../../util/boar/BoarGift';
import {GuildData} from '../../util/data/global/GuildData';
import {RowConfig} from '../../bot/config/components/RowConfig';
import {StringConfig} from '../../bot/config/StringConfig';
import {ModalConfig} from '../../bot/config/modals/ModalConfig';
import {CollectedBoar} from '../../util/data/userdata/collectibles/CollectedBoar';
import {ItemImageGenerator} from '../../util/generators/ItemImageGenerator';
import {ItemConfig} from '../../bot/config/items/ItemConfig';

enum View {
    Normal,
    Detailed,
    Powerups
}

/**
 * {@link CollectionSubcommand CollectionSubcommand.ts}
 *
 * Used to see a collection of boars, powerups,
 * and other information pertaining to a user.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class CollectionSubcommand implements Subcommand {
    private config = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.config.commandConfigs.boar.collection;
    private guildData: GuildData | undefined;
    private firstInter: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private compInter: ButtonInteraction = {} as ButtonInteraction;
    private collectionImage = {} as CollectionImageGenerator;
    private allBoars: any[] = [];
    private allBoarsTree: Tree<string, number> = createRBTree();
    private boarUser: BoarUser = {} as BoarUser;
    private baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private optionalButtons: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> =
        new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;
    private curView: View = View.Normal;
    private curPage: number = 0;
    private maxPageNormal: number = 0;
    private enhanceStage: number = 0;
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };
    private curModalListener: ((submittedModal: Interaction) => Promise<void>) | undefined;
    private modalShowing: ModalBuilder = {} as ModalBuilder;
    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.guildData = await InteractionUtils.handleStart(interaction, this.config);
        if (!this.guildData) return;

        await interaction.deferReply();
        this.firstInter = interaction;

        // Gets user to interact with
        const userInput: User = interaction.options.getUser(this.subcommandInfo.args[0].name)
            ? interaction.options.getUser(this.subcommandInfo.args[0].name) as User
            : interaction.user;
        const viewInput: View = interaction.options.getInteger(this.subcommandInfo.args[1].name)
            ? interaction.options.getInteger(this.subcommandInfo.args[1].name) as View
            : View.Normal;
        const pageInput: string = interaction.options.getString(this.subcommandInfo.args[2].name)
            ? (interaction.options.getString(this.subcommandInfo.args[2].name) as string)
                .toLowerCase().replace(/\s+/g, '')
            : '1';

        LogDebug.sendDebug(
            `User: ${userInput}, View: ${viewInput}, Page: ${pageInput}`,
            this.config, this.firstInter
        );

        this.boarUser = await new BoarUser(userInput);
        await this.getUserInfo();

        this.maxPageNormal = Math.ceil(
            Object.keys(this.allBoars).length / this.config.numberConfig.collBoarsPerPage
        ) - 1;

        if (
            viewInput === View.Detailed && this.allBoars.length > 0 ||
            viewInput === View.Powerups && Object.keys(this.boarUser.itemCollection.powerups).length > 0
        ) {
            this.curView = viewInput;
        }

        let pageVal: number = 1;
        if (!Number.isNaN(parseInt(pageInput))) {
            pageVal = parseInt(pageInput);
        } else if (this.curView === View.Detailed) {
            pageVal = BoarUtils.getClosestName(pageInput, this.allBoarsTree.root);
        }

        this.setPage(pageVal);

        if (CollectorUtils.collectionCollectors[interaction.user.id]) {
            CollectorUtils.collectionCollectors[interaction.user.id].stop('idle');
        }

        CollectorUtils.collectionCollectors[interaction.user.id] = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        this.collectionImage = new CollectionImageGenerator(this.boarUser, this.allBoars, this.config);
        await this.showCollection();

        CollectorUtils.collectionCollectors[interaction.user.id].on(
            'collect',
            async (inter: ButtonInteraction) => await this.handleCollect(inter)
        );

        CollectorUtils.collectionCollectors[interaction.user.id].once(
            'end',
            async (collected, reason) => await this.handleEndCollect(reason)
        );
    }

    /**
     * Handles collecting button interactions
     *
     * @param inter - The button interaction
     * @private
     */
    private async handleCollect(inter: ButtonInteraction): Promise<void> {
        try {
            const canInteract: boolean = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            if (!inter.isMessageComponent()) return;

            this.compInter = inter;

            LogDebug.sendDebug(
                `${inter.customId.split('|')[0]} on page ${this.curPage} in view ${this.curView}`, this.config, this.firstInter
            );

            const collRowConfig: RowConfig[][] = this.config.commandConfigs.boar.collection.componentFields;
            const collComponents = {
                leftPage: collRowConfig[0][0].components[0],
                inputPage: collRowConfig[0][0].components[1],
                rightPage: collRowConfig[0][0].components[2],
                normalView: collRowConfig[0][1].components[0],
                detailedView: collRowConfig[0][1].components[1],
                powerupView: collRowConfig[0][1].components[2],
                favorite: collRowConfig[1][0].components[0],
                gift: collRowConfig[1][0].components[1],
                editions: collRowConfig[1][0].components[2],
                enhance: collRowConfig[1][0].components[3]
            };

            // User wants to input a page manually
            if (inter.customId.startsWith(collComponents.inputPage.customId)) {
                await this.modalHandle(inter);

                this.enhanceStage--;

                clearInterval(this.timerVars.updateTime);
                return;
            }

            await inter.deferUpdate();

            switch (inter.customId.split('|')[0]) {
                // User wants to go to previous page
                case collComponents.leftPage.customId:
                    this.curPage--;
                    break;

                // User wants to go to the next page
                case collComponents.rightPage.customId:
                    this.curPage++;
                    break;

                case collComponents.normalView.customId:
                    this.curView = View.Normal;
                    this.curPage = 0;
                    break;

                case collComponents.detailedView.customId:
                    this.curView = View.Detailed;
                    this.curPage = 0;
                    break;

                case collComponents.powerupView.customId:
                    this.curView = View.Powerups;
                    this.curPage = 0;
                    break;

                case collComponents.favorite.customId:
                    await Queue.addQueue(() => {
                        this.boarUser.refreshUserData();
                        this.boarUser.stats.general.favoriteBoar = this.allBoars[this.curPage].id;
                        this.boarUser.updateUserData();
                    }, inter.id + this.boarUser.user.id);
                    break;

                case collComponents.editions.customId:
                    await this.doEditions();
                    break;

                case collComponents.enhance.customId:
                    if (this.enhanceStage !== 1) {
                        this.enhanceStage = 2;
                        await this.firstInter.followUp({
                            files: [await this.collectionImage.finalizeEnhanceConfirm(this.curPage)],
                            ephemeral: true
                        });
                    } else {
                        await this.doEnhance();
                    }
                    break;

                case collComponents.gift.customId:
                    await Queue.addQueue(() => {
                        this.boarUser.refreshUserData();
                        this.boarUser.itemCollection.powerups.gift.numTotal--;
                        this.boarUser.itemCollection.powerups.gift.numUsed++;
                        this.boarUser.updateUserData();
                    }, inter.id + this.boarUser.user.id);
                    await new BoarGift(this.boarUser, this.collectionImage, this.config).sendMessage(inter);
                    break;
            }

            this.enhanceStage--;
            await this.showCollection();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            CollectorUtils.collectionCollectors[inter.user.id].stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
    }

    /**
     * Gets the editions of the current boar and send them and their dates
     *
     * @private
     */
    private async doEditions(): Promise<void> {
        const strConfig: StringConfig = this.config.stringConfig;
        let replyString: string = '';

        for (let i=0; i<this.allBoars[this.curPage].editions.length; i++) {
            const edition: number = this.allBoars[this.curPage].editions[i];
            const editionDate: number = Math.floor(this.allBoars[this.curPage].editionDates[i] / 1000);

            replyString += strConfig.collEditionLine
                .replace('%@', edition.toString())
                .replace('%@', FormatStrings.toShortDateTime(editionDate));
        }

        replyString = replyString.substring(0, replyString.length-1).substring(0, 4096);
        await this.compInter.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle(strConfig.collEditionTitle.replace('%@', this.allBoars[this.curPage].name))
                    .setDescription(replyString)
                    .setColor(this.config.colorConfig.green as ColorResolvable)
            ],
            ephemeral: true
        });
    }

    /**
     * Enhances a boar by removing it, giving a random boar of the next rarity, and giving some boar bucks
     *
     * @private
     */
    private async doEnhance(): Promise<void> {
        const enhancedBoar: string =
            BoarUtils.findValid(this.allBoars[this.curPage].rarity[0], this.guildData, this.config);

        if (enhancedBoar === '') {
            await LogDebug.handleError(this.config.stringConfig.dailyNoBoarFound, this.firstInter);
            return;
        }

        LogDebug.sendDebug(`Enhanced boar to '${enhancedBoar}'`, this.config, this.firstInter);

        await Queue.addQueue(() => {
            const enhancersUsed = this.allBoars[this.curPage].rarity[1].enhancersNeeded;
            this.boarUser.refreshUserData();
            this.boarUser.itemCollection.boars[this.allBoars[this.curPage].id].num--;
            this.boarUser.itemCollection.boars[this.allBoars[this.curPage].id].editions.pop();
            this.boarUser.itemCollection.boars[this.allBoars[this.curPage].id].editionDates.pop();
            this.boarUser.stats.general.boarScore -= enhancersUsed * 5;
            this.boarUser.itemCollection.powerups.enhancer.numTotal -= enhancersUsed;
            (this.boarUser.itemCollection.powerups.enhancer.raritiesUsed as number[])
                [this.allBoars[this.curPage].rarity[0]-1]++;
            this.boarUser.updateUserData();
        }, this.compInter.id + this.compInter.user.id);

        const editions: number[] = await this.boarUser.addBoars([enhancedBoar], this.firstInter, this.config);

        await this.getUserInfo();

        this.curPage = BoarUtils.getClosestName(
            this.config.itemConfigs.boars[enhancedBoar].name.toLowerCase().replace(/\s+/g, ''), this.allBoarsTree.root
        ) - 1;

        await Replies.handleReply(this.compInter, this.config.stringConfig.enhanceGotten,
            this.config.colorConfig.font, this.allBoars[this.curPage].name,
            this.allBoars[this.curPage].color, true
        );

        for (const edition of editions) {
            if (edition !== 1) continue;
            await this.compInter.followUp({
                files: [
                    await new ItemImageGenerator(
                        this.compInter.user, 'racer', this.config.stringConfig.giveTitle, this.config
                    ).handleImageCreate()
                ]
            });
        }

        this.collectionImage.updateInfo(this.boarUser, this.allBoars, this.config);
        await this.collectionImage.createNormalBase();
    }

    /**
     * Sends the modal that gets page input
     *
     * @param inter - Used to show the modal and create/remove listener
     * @private
     */
    private async modalHandle(inter: MessageComponentInteraction): Promise<void> {
        const modals: ModalConfig[] = this.config.commandConfigs.boar.collection.modals;

        this.modalShowing = new ModalBuilder(modals[0]);
        this.modalShowing.setCustomId(modals[0].customId + '|' + inter.id);
        await inter.showModal(this.modalShowing);

        inter.client.on(
            Events.InteractionCreate,
            this.curModalListener = this.modalListener
        );
    }

    /**
     * Handles page input that was input in modal
     *
     * @param submittedModal - The interaction to respond to
     * @private
     */
    private modalListener = async (submittedModal: Interaction): Promise<void> => {
        try  {
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
            let canInteract = await CollectorUtils.canInteract(this.timerVars);
            if (!canInteract) return;

            if (
                !submittedModal.isModalSubmit() || CollectorUtils.collectionCollectors[submittedModal.user.id].ended ||
                !submittedModal.guild || submittedModal.customId !== this.modalShowing.data.custom_id
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

            let pageVal: number = 1;
            if (!Number.isNaN(parseInt(submittedPage))) {
                pageVal = parseInt(submittedPage);
            } else if (this.curView === View.Detailed) {
                pageVal = BoarUtils.getClosestName(submittedPage, this.allBoarsTree.root)
            }

            this.setPage(pageVal);

            await this.showCollection();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            CollectorUtils.collectionCollectors[submittedModal.user.id].stop(CollectorUtils.Reasons.Error);
        }

        this.endModalListener(submittedModal.client);
    };

    private endModalListener(client: Client) {
        clearInterval(this.timerVars.updateTime);
        if (this.curModalListener) {
            client.removeListener(Events.InteractionCreate, this.curModalListener);
            this.curModalListener = undefined;
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

    /**
     * Gets information from the user's file
     *
     * @private
     */
    private async getUserInfo() {
        if (!this.firstInter.guild || !this.firstInter.channel) return;

        this.boarUser.refreshUserData();
        this.allBoars = [];

        // Adds information about each boar in user's boar collection to an array
        for (const boarID of Object.keys(this.boarUser.itemCollection.boars)) {
            // Local user boar information
            const boarInfo: CollectedBoar = this.boarUser.itemCollection.boars[boarID];
            if (boarInfo.num === 0) continue;

            const rarity: [number, RarityConfig] = BoarUtils.findRarity(boarID, this.config);
            if (rarity[0] === 0) continue;

            // Global boar information
            const boarDetails: ItemConfig = this.config.itemConfigs.boars[boarID];

            this.allBoars.push({
                id: boarID,
                name: boarDetails.name,
                file: boarDetails.file,
                staticFile: boarDetails.staticFile,
                num: boarInfo.num,
                editions: boarInfo.editions,
                editionDates: boarInfo.editionDates,
                firstObtained: boarInfo.firstObtained,
                lastObtained: boarInfo.lastObtained,
                rarity: rarity,
                color: this.config.colorConfig['rarity' + rarity[0]],
                description: boarDetails.description
            });

            this.allBoarsTree = this.allBoarsTree.insert(
                boarDetails.name.toLowerCase().replace(/\s+/g, ''), this.allBoars.length
            );
        }
    }

    /**
     * Displays the collection image and modifies button states
     *
     * @private
     */
    private async showCollection() {
        const optionalRow: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> =
            new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

        this.disableButtons();

        if (
            !this.collectionImage.normalBaseMade() && !this.collectionImage.detailedBaseMade()
            && !this.collectionImage.powerupsBaseMade()
        ) {
            this.initButtons();
        }

        if (this.curView == View.Normal && !this.collectionImage.normalBaseMade()) {
            await this.collectionImage.createNormalBase();
        }

        if (this.curView == View.Detailed && !this.collectionImage.detailedBaseMade()) {
            await this.collectionImage.createDetailedBase();
        }

        if (this.curView == View.Powerups) {
            await this.collectionImage.createPowerupsBase(this.curPage);
        }

        let finalImage: AttachmentBuilder;

        if (this.curView == View.Normal) {
            finalImage = await this.collectionImage.finalizeNormalImage(this.curPage);
        } else if (this.curView == View.Detailed) {
            finalImage = await this.collectionImage.finalizeDetailedImage(this.curPage);
            optionalRow.addComponents(this.optionalButtons.components[0].setDisabled(
                this.firstInter.user.id !== this.boarUser.user.id
            )); // Favorite button
        } else {
            finalImage = await this.collectionImage.finalizePowerupsImage();
        }

        // Enables next button if there's more than one page
        if (
            this.curView === View.Normal && this.maxPageNormal > this.curPage ||
            this.curView === View.Detailed && this.allBoars.length > this.curPage + 1 ||
            this.curView === View.Powerups && this.config.numberConfig.maxPowPages > this.curPage + 1
        ) {
            this.baseRows[0].components[2].setDisabled(false);
        }

        // Enables previous button if on a page other than the first
        if (this.curPage > 0) {
            this.baseRows[0].components[0].setDisabled(false);
        }

        // Enables manual input button if there's more than one page
        if (
            this.curView === View.Normal && this.maxPageNormal > 0 ||
            this.curView === View.Detailed && this.allBoars.length > 1 ||
            this.curView === View.Powerups
        ) {
            this.baseRows[0].components[1].setDisabled(false);
        }

        // Allows pressing Normal view if not currently on it
        if (this.curView !== View.Normal) {
            this.baseRows[1].components[0].setDisabled(false);
        }

        // Allows pressing Detailed view if not currently on it and if there's boars to view
        if (this.curView !== View.Detailed && this.allBoars.length > 0) {
            this.baseRows[1].components[1].setDisabled(false);
        }

        // Allows pressing Powerup view if not currently on it
        if (this.curView !== View.Powerups && Object.keys(this.boarUser.itemCollection.powerups).length > 0) {
            this.baseRows[1].components[2].setDisabled(false);
        }

        // Enables edition viewing on special boars
        if (this.curView === View.Detailed && this.allBoars[this.curPage].rarity[1].name === 'Special') {
            optionalRow.addComponents(this.optionalButtons.components[2].setDisabled(false));
        }

        // Enables enhance button for daily boars
        if (
            this.curView === View.Detailed &&
            this.allBoars[this.curPage].rarity[1].enhancersNeeded > 0
        ) {
            optionalRow.addComponents(this.optionalButtons.components[3]
                .setDisabled(
                    this.boarUser.itemCollection.powerups.enhancer.numTotal <
                    this.allBoars[this.curPage].rarity[1].enhancersNeeded ||
                    this.firstInter.user.id !== this.boarUser.user.id
                )
            );
        }

        // Gift button enabling
        if (this.curView === View.Powerups) {
            optionalRow.addComponents(
                this.optionalButtons.components[1].setDisabled(
                    this.boarUser.itemCollection.powerups.gift.numTotal === 0 ||
                    this.firstInter.user.id !== this.boarUser.user.id
                )
            );
        }

        if (optionalRow.components.length > 0) {
            await this.firstInter.editReply({ files: [finalImage], components: [...this.baseRows, optionalRow] });
        } else {
            await this.firstInter.editReply({ files: [finalImage], components: this.baseRows });
        }
    }

    /**
     * Creates the buttons and rows used for collection by adding information to IDs
     *
     * @private
     */
    private initButtons(): void {
        const collFieldConfigs: RowConfig[][] = this.config.commandConfigs.boar.collection.componentFields;

        for (let i=0; i<collFieldConfigs.length; i++) {
            const newRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
                ComponentUtils.makeRows(collFieldConfigs[i]);

            ComponentUtils.addToIDs(collFieldConfigs[i], newRows, this.firstInter.id, this.firstInter.user.id);

            if (i === 0) {
                this.baseRows = newRows
            }

            if (i === 1) {
                this.optionalButtons = newRows[0];
            }
        }
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

        for (const component of this.optionalButtons.components) {
            component.setDisabled(true);
        }
    }

    /**
     * Sets the page by min maxing the input value to be within bounds
     *
     * @param pageVal - The page integer to min max
     * @private
     */
    private setPage(pageVal: number): void {
        if (this.curView === View.Normal) {
            this.curPage = Math.max(Math.min(pageVal-1, this.maxPageNormal), 0);
        } else if (this.curView === View.Detailed) {
            this.curPage = Math.max(Math.min(pageVal-1, this.allBoars.length-1), 0);
        } else {
            this.curPage = Math.max(Math.min(pageVal-1, this.config.numberConfig.maxPowPages-1), 0);
        }
    }
}