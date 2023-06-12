import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction, ButtonStyle,
    ChatInputCommandInteraction,
    Events,
    Interaction,
    InteractionCollector,
    MessageComponentInteraction,
    ModalBuilder,
    ModalSubmitInteraction,
    SelectMenuComponentOptionData,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel
} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {GuildData} from '../../util/data/global/GuildData';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {BotConfig} from '../../bot/config/BotConfig';
import {Replies} from '../../util/interactions/Replies';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {RowConfig} from '../../bot/config/components/RowConfig';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import {LogDebug} from '../../util/logging/LogDebug';
import {DataHandlers} from '../../util/data/DataHandlers';
import {BuySellData} from '../../util/data/global/BuySellData';
import createRBTree, {Node, Tree} from 'functional-red-black-tree';
import {MarketImageGenerator} from '../../util/generators/MarketImageGenerator';
import {BoarUser} from '../../util/boar/BoarUser';
import {ModalConfig} from '../../bot/config/modals/ModalConfig';
import {BoarUtils} from '../../util/boar/BoarUtils';
import {Queue} from '../../util/interactions/Queue';

enum View {
    Overview,
    BuySell,
    UserOrders
}

/**
 * {@link MarketSubcommand MarketSubcommand.ts}
 *
 * Used to buy and sell boars and items
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class MarketSubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boar.market;
    private imageGen: MarketImageGenerator = {} as MarketImageGenerator;
    private firstInter: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private compInter: MessageComponentInteraction = {} as MessageComponentInteraction;
    private pricingData: {id: string, type: string, instaSells: BuySellData[], instaBuys: BuySellData[]}[] = [];
    private pricingDataTree: Tree<string, number> = createRBTree();
    private boarUser: BoarUser = {} as BoarUser;
    private userBuyOrders: {list: BuySellData, id: string, type: string}[] = [];
    private userSellOrders: {list: BuySellData, id: string, type: string}[] = [];
    private curView: View = View.Overview;
    private curPage: number = 0;
    private curEdition: number = 0;
    private maxPageOverview: number = 0;
    private maxPageOrders: number = 0;
    private baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private optionalRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
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

        this.curView = interaction.options.getInteger(this.subcommandInfo.args[0].name)
            ? interaction.options.getInteger(this.subcommandInfo.args[0].name) as View
            : View.Overview;
        const pageInput: string = interaction.options.getString(this.subcommandInfo.args[1].name)
            ? (interaction.options.getString(this.subcommandInfo.args[1].name) as string)
                .toLowerCase().replace(/\s+/g, '')
            : '1';

        this.getPricingData();
        this.boarUser = new BoarUser(interaction.user);

        this.maxPageOverview = Math.floor(this.pricingData.length / 8);
        this.maxPageOrders = Math.floor(this.userBuyOrders.concat(this.userSellOrders).length / 4);

        let pageVal: number = 1;
        if (!Number.isNaN(parseInt(pageInput))) {
            pageVal = parseInt(pageInput);
        } else if (this.curView === View.BuySell) {
            pageVal = this.getPageFromName(pageInput, this.pricingDataTree.root);
        }

        this.setPage(pageVal);

        this.collector = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        this.imageGen = new MarketImageGenerator(this.pricingData, this.config);
        await this.showMarket(true);

        this.collector.on('collect', async (inter: ButtonInteraction | StringSelectMenuInteraction) =>
            await this.handleCollect(inter)
        );
        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));
    }

    private async handleCollect(inter: ButtonInteraction | StringSelectMenuInteraction) {
        try {
            const canInteract: boolean = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            if (!inter.isMessageComponent()) return;

            this.compInter = inter;

            LogDebug.sendDebug(
                `${inter.customId.split('|')[0]} on page ${this.curPage} in view ${this.curView}`, this.config, this.firstInter
            );

            const marketRowConfig: RowConfig[][] = this.config.commandConfigs.boar.market.componentFields;
            const marketComponents = {
                leftPage: marketRowConfig[0][0].components[0],
                inputPage: marketRowConfig[0][0].components[1],
                rightPage: marketRowConfig[0][0].components[2],
                refresh: marketRowConfig[0][0].components[3],
                overviewView: marketRowConfig[0][1].components[0],
                buySellView: marketRowConfig[0][1].components[1],
                ordersView: marketRowConfig[0][1].components[2],
                instaBuy: marketRowConfig[1][0].components[0],
                instaSell: marketRowConfig[1][0].components[1],
                buyOrder: marketRowConfig[1][1].components[0],
                sellOrder: marketRowConfig[1][1].components[1],
                editionSelect: marketRowConfig[1][3].components[0]
            };

            const isPageInput = inter.customId.startsWith(marketComponents.inputPage.customId);
            const isInstaBuy = inter.customId.startsWith(marketComponents.instaBuy.customId);
            const isInstaSell = inter.customId.startsWith(marketComponents.instaSell.customId);
            const isBuyOrder = inter.customId.startsWith(marketComponents.buyOrder.customId);
            const isSellOrder = inter.customId.startsWith(marketComponents.sellOrder.customId);

            // User wants to input a page manually
            if (isPageInput) {
                await this.modalHandle(inter);

                clearInterval(this.timerVars.updateTime);
                return;
            }

            let showModal: boolean = true;
            if (isInstaBuy || isInstaSell) {
                await Queue.addQueue(async () => {
                    showModal = await this.canInstaModal(inter, isInstaBuy, isInstaSell);
                }, inter.id + inter.user.id);

                if (showModal) {
                    await this.modalHandle(inter);
                }

                clearInterval(this.timerVars.updateTime);
                return;
            }

            if (isBuyOrder || isSellOrder) {
                await Queue.addQueue(async () => {
                    showModal = await this.canOrderModal(inter, isBuyOrder, isSellOrder);
                }, inter.id + inter.user.id);

                if (showModal) {
                    await this.modalHandle(inter);
                }

                await this.showMarket();
                clearInterval(this.timerVars.updateTime);
                return;
            }

            await inter.deferUpdate();

            switch (inter.customId.split('|')[0]) {
                // User wants to go to previous page
                case marketComponents.leftPage.customId:
                    this.curPage--;
                    this.curEdition = 0;
                    break;

                // User wants to go to the next page
                case marketComponents.rightPage.customId:
                    this.curPage++;
                    this.curEdition = 0;
                    break;

                case marketComponents.refresh.customId:
                    this.getPricingData();
                    this.imageGen.updateInfo(this.pricingData, this.config);
                    this.boarUser.refreshUserData();
                    this.curEdition = 0;
                    break;

                case marketComponents.overviewView.customId:
                    this.curView = View.Overview;
                    this.curPage = 0;
                    this.curEdition = 0;
                    break;

                case marketComponents.buySellView.customId:
                    this.curView = View.BuySell;
                    this.curPage = 0;
                    this.curEdition = 0;
                    break;

                case marketComponents.ordersView.customId:
                    this.curView = View.UserOrders;
                    this.curPage = 0;
                    this.curEdition = 0;
                    break;

                case marketComponents.editionSelect.customId:
                    this.curEdition = Number.parseInt((inter as StringSelectMenuInteraction).values[0]);
                    break;
            }

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
    }

    private async canInstaModal(
        inter: MessageComponentInteraction,
        isInstaBuy: boolean,
        isInstaSell: boolean
    ): Promise<boolean> {
        try {
            this.boarUser.refreshUserData();
            const itemData = this.pricingData[this.curPage];
            let showModal = true;

            let sellOrder: BuySellData | undefined;

            if (isInstaBuy && BoarUtils.findRarity(itemData.id, this.config)[1].name === 'Special') {
                for (const instaBuy of itemData.instaBuys) {
                    if (instaBuy.editions[0] !== this.curEdition) continue;
                    sellOrder = instaBuy;
                    break;
                }
            }

            if (
                isInstaBuy && this.curEdition > 0 && sellOrder &&
                this.boarUser.stats.general.boarScore < sellOrder.price ||
                isInstaBuy && this.boarUser.stats.general.boarScore < itemData.instaBuys[0].price
            ) {
                showModal = false;
                await Replies.handleReply(
                    inter, 'You don\'t have enough boar bucks for this!', this.config.colorConfig.error
                );
            } else if (
                isInstaSell && this.curEdition > 0 && this.boarUser.itemCollection.boars[itemData.id] &&
                !this.boarUser.itemCollection.boars[itemData.id].editions.includes(this.curEdition)
            ) {
                showModal = false;
                await Replies.handleReply(
                    inter, 'You don\'t have this edition so you cannot sell it!',
                    this.config.colorConfig.error
                );
            } else if (
                isInstaSell && itemData.type === 'boars' &&
                !this.boarUser.itemCollection.boars[itemData.id] ||
                isInstaSell && itemData.type === 'powerups' &&
                !this.boarUser.itemCollection.boars[itemData.id]
            ) {
                showModal = false;
                await Replies.handleReply(
                    inter, 'You don\'t have any of this item!', this.config.colorConfig.error
                );
            }
            return showModal;
        } catch (err: unknown) {
            await LogDebug.handleError(err, inter);
            return false;
        }
    }

    private async canOrderModal(
        inter: MessageComponentInteraction,
        isBuyOrder: boolean,
        isSellOrder: boolean
    ): Promise<boolean> {
        try {
            this.boarUser.refreshUserData();
            const itemData = this.pricingData[this.curPage];
            let showModal = true;

            const strConfig = this.config.stringConfig;

            if (
                isSellOrder && itemData.type === 'boars' &&
                (!this.boarUser.itemCollection.boars[itemData.id] ||
                    this.boarUser.itemCollection.boars[itemData.id].num === 0) ||
                isSellOrder && itemData.type === 'powerups' &&
                (!this.boarUser.itemCollection.powerups[itemData.id] ||
                    this.boarUser.itemCollection.powerups[itemData.id].numTotal === 0)
            ) {
                await inter.deferUpdate();
                showModal = false;
                await Replies.handleReply(
                    inter, 'You don\'t have any of this item!', this.config.colorConfig.error,
                    undefined, undefined, true
                );
            } else if (
                isBuyOrder && (this.optionalRows[1].components[0] as ButtonBuilder).data.style === 4 ||
                isSellOrder && (this.optionalRows[1].components[1] as ButtonBuilder).data.style === 4
            ) {
                await inter.deferUpdate();
                showModal = false;
                await Replies.handleReply(
                    inter, strConfig.marketOrderComplete, this.config.colorConfig.green,
                    undefined, undefined, true
                );

                (this.optionalRows[1].components[0] as ButtonBuilder).setStyle(3);
                (this.optionalRows[1].components[1] as ButtonBuilder).setStyle(3);
            }

            return showModal;
        } catch (err: unknown) {
            await LogDebug.handleError(err, inter);
            return false;
        }
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

    private getPricingData(): void {
        const itemData = DataHandlers.getGlobalData().itemData;
        const curItem = this.pricingData.length > 0
            ? this.pricingData[this.curPage]
            : undefined;

        this.pricingData = [];

        for (const itemType of Object.keys(itemData)) {
            for (const itemID of Object.keys(itemData[itemType])) {
                this.pricingData.push({
                    id: itemID,
                    type: itemType,
                    instaSells: itemData[itemType][itemID].buyers.sort((a, b) => b.price - a.price),
                    instaBuys: itemData[itemType][itemID].sellers.sort((a, b) => a.price - b.price)
                });

                this.pricingDataTree = this.pricingDataTree.insert(
                    this.config.itemConfigs[itemType][itemID].name.toLowerCase().replace(/\s+/g, ''),
                    this.pricingData.length
                );
            }
        }

        for (const priceData of this.pricingData) {
            for (const buyData of priceData.instaBuys) {
                if (buyData.userID !== this.firstInter.user.id) continue;
                this.userSellOrders.push({
                    list: buyData,
                    id: priceData.id,
                    type: priceData.type
                });
            }
            for (const sellData of priceData.instaSells) {
                if (sellData.userID !== this.firstInter.user.id) continue;
                this.userBuyOrders.push({
                    list: sellData,
                    id: priceData.id,
                    type: priceData.type
                });
            }
        }

        while (this.curView === View.BuySell && curItem && this.pricingData[this.curPage].id !== curItem.id) {
            this.curPage++;
        }
    }

    /**
     * Sends the modal that gets page input
     *
     * @param inter - Used to show the modal and create/remove listener
     * @private
     */
    private async modalHandle(inter: MessageComponentInteraction): Promise<void> {
        const modals: ModalConfig[] = this.config.commandConfigs.boar.market.modals;
        const marketRowConfig: RowConfig[][] = this.config.commandConfigs.boar.market.componentFields;
        let modalNum = 0;
        let modalTitle = modals[0].title;

        const isInstaBuy = inter.customId.startsWith(marketRowConfig[1][0].components[0].customId);
        const isInstaSell = inter.customId.startsWith(marketRowConfig[1][0].components[1].customId);
        const isBuyOrder = inter.customId.startsWith(marketRowConfig[1][1].components[0].customId);
        const isSellOrder = inter.customId.startsWith(marketRowConfig[1][1].components[1].customId);

        const itemData = this.config.itemConfigs[this.pricingData[this.curPage].type]
            [this.pricingData[this.curPage].id];

        if ((isInstaBuy || isInstaSell) && this.curEdition === 0) {
            modalNum = 1;
            modalTitle = (isInstaBuy
                ? marketRowConfig[1][0].components[0].label
                : marketRowConfig[1][0].components[1].label) + ': ' + itemData.pluralName;
        }

        if ((isInstaBuy || isInstaSell) && this.curEdition > 0) {
            modalNum = 2;
            modalTitle = (isInstaBuy
                ? marketRowConfig[1][0].components[0].label
                : marketRowConfig[1][0].components[1].label) + ': ' + itemData.name + ' #' + this.curEdition;
        }

        if ((isBuyOrder || isSellOrder) && this.curEdition === 0) {
            modalNum = 3;
            modalTitle = (isBuyOrder
                ? marketRowConfig[1][1].components[0].label
                : marketRowConfig[1][1].components[1].label) + ': ' + itemData.pluralName;
        }

        if ((isBuyOrder || isSellOrder) && this.curEdition > 0) {
            modalNum = 4;
            modalTitle = (isBuyOrder
                ? marketRowConfig[1][1].components[0].label
                : marketRowConfig[1][1].components[1].label) + ': ' + itemData.name;
        }

        this.modalShowing = new ModalBuilder(modals[modalNum]);
        this.modalShowing.setCustomId(modals[modalNum].customId + '|' + inter.id);
        this.modalShowing.setTitle(modalTitle);
        await inter.showModal(this.modalShowing);

        let listener: (submittedModal: Interaction) => Promise<void>;

        if (modalNum === 0) {
            listener = this.modalListenerPage;
        } else if (modalNum === 1) {
            listener = this.modalListenerInsta;
        } else if (modalNum === 2) {
            listener = this.modalListenerInstaSpecial;
        } else if (modalNum === 3) {
            listener = this.modalListenerOrder;
        } else {
            listener = this.modalListenerOrderSpecial;
        }

        inter.client.on(Events.InteractionCreate, listener);

        setTimeout(() => {
            inter.client.removeListener(Events.InteractionCreate, listener);
        }, 60000);
    }

    /**
     * Handles page input that was input in modal
     *
     * @param submittedModal - The interaction to respond to
     * @private
     */
    private modalListenerPage = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal, this.modalListenerPage)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const submittedPage: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedPage, this.config, this.firstInter
            );

            let pageVal: number = 1;
            if (!Number.isNaN(parseInt(submittedPage))) {
                pageVal = parseInt(submittedPage);
            } else if (this.curView === View.BuySell) {
                pageVal = this.getPageFromName(submittedPage, this.pricingDataTree.root)
            }

            this.setPage(pageVal);

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
        submittedModal.client.removeListener(Events.InteractionCreate, this.modalListenerPage);
    };

    private modalListenerInsta = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal, this.modalListenerInsta)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;

            const isInstaBuy = this.modalShowing.data.title?.startsWith(
                this.config.commandConfigs.boar.market.componentFields[1][0].components[0].label
            );
            const responseStr = isInstaBuy ? strConfig.marketConfirmInstaBuy : strConfig.marketConfirmInstaSell;

            const submittedNum: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedNum, this.config, this.firstInter
            );

            let numVal: number = 0;
            if (!Number.isNaN(parseInt(submittedNum))) {
                numVal = parseInt(submittedNum);
            }

            if (numVal <= 0) {
                await Replies.handleReply(
                    submittedModal, 'Invalid input! Input(s) must be greater than zero.', this.config.colorConfig.error,
                    undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            this.boarUser.refreshUserData();

            this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.config);

            const itemData = this.pricingData[this.curPage];

            if (
                !isInstaBuy &&
                (itemData.type === 'boars' && this.boarUser.itemCollection.boars[itemData.id].num < numVal ||
                itemData.type === 'powerups' && this.boarUser.itemCollection.powerups[itemData.id].numTotal < numVal)
            ) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have enough of this item!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            let numGrabbed = 0;
            let curPrice = 0;
            let curIndex = 0;
            while (numGrabbed < numVal) {
                let numToAdd = 0;
                if (isInstaBuy && curIndex < itemData.instaBuys.length) {
                    numToAdd = Math.min(numVal - numGrabbed, itemData.instaBuys[curIndex].num);
                    curPrice += itemData.instaBuys[curIndex].price * numToAdd;
                } else if (curIndex < itemData.instaSells.length) {
                    numToAdd = Math.min(numVal - numGrabbed, itemData.instaSells[curIndex].num);
                    curPrice += itemData.instaSells[curIndex].price * numToAdd;
                } else {
                    break;
                }

                numGrabbed += numToAdd;
                curIndex++;
            }

            if (numVal !== numGrabbed) {
                await Replies.handleReply(
                    submittedModal, 'Not enough orders of this item to complete this transaction!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            const itemName = numVal + ' ' + (numVal > 1
                ? this.config.itemConfigs[itemData.type][itemData.id].pluralName
                : this.config.itemConfigs[itemData.type][itemData.id].name);

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', curPrice.toLocaleString),
                this.config.colorConfig.font, undefined, undefined, true
            );

            if (isInstaBuy) {
                (this.optionalRows[0].components[0] as ButtonBuilder).setStyle(4);
            } else {
                (this.optionalRows[0].components[1] as ButtonBuilder).setStyle(4);
            }

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
        submittedModal.client.removeListener(Events.InteractionCreate, this.modalListenerPage);
    };

    private modalListenerInstaSpecial = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal, this.modalListenerInstaSpecial)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;

            const isInstaBuy = this.modalShowing.data.title?.startsWith(
                this.config.commandConfigs.boar.market.componentFields[1][0].components[0].label
            );
            const responseStr = isInstaBuy ? strConfig.marketConfirmInstaBuy : strConfig.marketConfirmInstaSell;

            const submittedNum: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedNum, this.config, this.firstInter
            );

            let editionVal: number = 0;
            if (!Number.isNaN(parseInt(submittedNum))) {
                editionVal = parseInt(submittedNum);
            }

            if (editionVal <= 0) {
                await Replies.handleReply(
                    submittedModal, 'Invalid input! Input(s) must be greater than zero.',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            this.boarUser.refreshUserData();

            this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.config);

            const itemData = this.pricingData[this.curPage];

            if (
                !isInstaBuy && !this.boarUser.itemCollection.boars[itemData.id].editions.includes(this.curEdition)
            ) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have edition #' + this.curEdition + ' of this item so you cannot sell it!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            if (editionVal !== this.curEdition) {
                await Replies.handleReply(
                    submittedModal, 'The edition number you input didn\'t match the edition you were trying to buy/sell!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            let curPrice = 0;

            if (isInstaBuy) {
                for (const instaBuy of itemData.instaBuys) {
                    if (instaBuy.editions[0] !== this.curEdition) continue;
                    curPrice = instaBuy.price;
                    break;
                }
            } else {
                for (const instaSell of itemData.instaSells) {
                    if (instaSell.editions[0] !== this.curEdition) continue;
                    curPrice = instaSell.price;
                    break;
                }
            }

            if (curPrice === 0) {
                await Replies.handleReply(
                    submittedModal, 'Not enough orders of this item edition to complete this transaction!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            const itemName = this.config.itemConfigs[itemData.type][itemData.id].name + ' #' + this.curEdition;

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', curPrice.toLocaleString()),
                this.config.colorConfig.font, undefined, undefined, true
            );

            if (isInstaBuy) {
                (this.optionalRows[0].components[0] as ButtonBuilder).setStyle(4);
            } else {
                (this.optionalRows[0].components[1] as ButtonBuilder).setStyle(4);
            }

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
        submittedModal.client.removeListener(Events.InteractionCreate, this.modalListenerPage);
    };

    private modalListenerOrder = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal, this.modalListenerOrder)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;

            const isBuyOrder = this.modalShowing.data.title?.startsWith(
                this.config.commandConfigs.boar.market.componentFields[1][1].components[0].label
            );
            const responseStr = isBuyOrder ? strConfig.marketConfirmBuyOrder : strConfig.marketConfirmSellOrder;

            const submittedNum: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');
            const submittedPrice: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[1].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input values: ${submittedNum}, ${submittedPrice}`,
                this.config, this.firstInter
            );

            let numVal: number = 0;
            let priceVal: number = 0;
            if (!Number.isNaN(parseInt(submittedNum))) {
                numVal = parseInt(submittedNum);
            }
            if (!Number.isNaN(parseInt(submittedPrice))) {
                priceVal = parseInt(submittedPrice);
            }

            if (numVal <= 0 || priceVal <= 0) {
                await Replies.handleReply(
                    submittedModal, 'Invalid input! Input(s) must be greater than zero.',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            this.boarUser.refreshUserData();

            this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.config);

            const itemData = this.pricingData[this.curPage];

            if (
                !isBuyOrder &&
                (itemData.type === 'boars' && this.boarUser.itemCollection.boars[itemData.id].num < numVal ||
                itemData.type === 'powerups' && this.boarUser.itemCollection.powerups[itemData.id].numTotal < numVal)
            ) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have enough of this item!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            const price = priceVal * numVal;

            const bucksBoardData = DataHandlers.getGlobalData().leaderboardData['bucks'];
            let maxBucks = 1000000;
            for (const userID of Object.keys(bucksBoardData)) {
                maxBucks = Math.max(maxBucks, bucksBoardData[userID] as number * 10);
            }

            if (!isBuyOrder && priceVal > maxBucks) {
                await Replies.handleReply(
                    submittedModal, 'Order price must be $' + maxBucks.toLocaleString() + ' or lower.',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            if (isBuyOrder && price > this.boarUser.stats.general.boarScore) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have enough boar bucks to create this order!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            const itemName = numVal + ' ' + (numVal > 1
                ? this.config.itemConfigs[itemData.type][itemData.id].pluralName
                : this.config.itemConfigs[itemData.type][itemData.id].name);

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', price.toLocaleString()),
                this.config.colorConfig.font, undefined, undefined, true
            );

            if (isBuyOrder) {
                (this.optionalRows[1].components[0] as ButtonBuilder).setStyle(4);
            } else {
                (this.optionalRows[1].components[1] as ButtonBuilder).setStyle(4);
            }

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
        submittedModal.client.removeListener(Events.InteractionCreate, this.modalListenerPage);
    };

    private modalListenerOrderSpecial = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal, this.modalListenerOrderSpecial)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;

            const isBuyOrder = this.modalShowing.data.title?.startsWith(
                this.config.commandConfigs.boar.market.componentFields[1][1].components[0].label
            );
            const responseStr = isBuyOrder ? strConfig.marketConfirmBuyOrder : strConfig.marketConfirmSellOrder;

            const submittedEdition: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');
            const submittedPrice: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[1].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input values: ${submittedEdition}, ${submittedPrice}`,
                this.config, this.firstInter
            );

            let editionVal: number = 0;
            let priceVal: number = 0;
            if (!Number.isNaN(parseInt(submittedEdition))) {
                editionVal = parseInt(submittedEdition);
            }
            if (!Number.isNaN(parseInt(submittedPrice))) {
                priceVal = parseInt(submittedPrice);
            }

            if (editionVal <= 0 || priceVal <= 0) {
                await Replies.handleReply(
                    submittedModal, 'Invalid input! Input(s) must be greater than zero.',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            this.boarUser.refreshUserData();

            this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.config);

            const itemData = this.pricingData[this.curPage];

            if (!isBuyOrder && !this.boarUser.itemCollection.boars[itemData.id].editions.includes(this.curEdition)) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have edition #' + editionVal + 'of this item so you cannot sell it!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            if (isBuyOrder && this.boarUser.itemCollection.boars[itemData.id].editions.includes(editionVal)) {
                await Replies.handleReply(
                    submittedModal, 'You already have edition #' + editionVal + ' of this item!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            const bucksBoardData = DataHandlers.getGlobalData().leaderboardData['bucks'];
            let maxBucks = 1000000;
            for (const userID of Object.keys(bucksBoardData)) {
                maxBucks = Math.max(maxBucks, bucksBoardData[userID] as number * 10);
            }

            if (!isBuyOrder && priceVal > maxBucks) {
                await Replies.handleReply(
                    submittedModal, 'Order price must be $' + maxBucks.toLocaleString() + ' or lower.',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            if (isBuyOrder && priceVal > this.boarUser.stats.general.boarScore) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have enough boar bucks to create this order!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                clearInterval(this.timerVars.updateTime);
                return;
            }

            const itemName = this.config.itemConfigs[itemData.type][itemData.id].name + ' #' + editionVal;

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', priceVal.toLocaleString()),
                this.config.colorConfig.font, undefined, undefined, true
            );

            if (isBuyOrder) {
                (this.optionalRows[1].components[0] as ButtonBuilder).setStyle(4);
            } else {
                (this.optionalRows[1].components[1] as ButtonBuilder).setStyle(4);
            }

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
        submittedModal.client.removeListener(Events.InteractionCreate, this.modalListenerPage);
    };

    private async beginModal(
        submittedModal: Interaction, listener: (submittedModal: Interaction) => Promise<void>
    ): Promise<boolean> {
        if (
            submittedModal.isMessageComponent() &&
            submittedModal.customId.endsWith(this.firstInter.id + '|' + this.firstInter.user.id) ||
            BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(this.compInter.user.id)
        ) {
            clearInterval(this.timerVars.updateTime);
            submittedModal.client.removeListener(Events.InteractionCreate, listener);

            return false;
        }

        // Updates the cooldown to interact again
        CollectorUtils.canInteract(this.timerVars);

        if (
            !submittedModal.isModalSubmit() || this.collector.ended ||
            !submittedModal.guild || submittedModal.customId !== this.modalShowing.data.custom_id
        ) {
            clearInterval(this.timerVars.updateTime);
            return false;
        }

        await submittedModal.deferUpdate();
        return true;
    }

    private async showMarket(firstRun: boolean = false) {
        if (firstRun) {
            this.initButtons();
        }

        this.disableButtons();

        let rowsToAdd: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

        this.baseRows[0].components[0].setDisabled(this.curPage === 0);
        this.baseRows[0].components[1].setDisabled(
            this.curView === View.Overview && this.maxPageOverview === 0 ||
            this.curView === View.BuySell && this.pricingData.length-1 === 0 ||
            this.curView === View.UserOrders && this.maxPageOrders === 0
        );
        this.baseRows[0].components[2].setDisabled(
            this.curView === View.Overview && this.curPage === this.maxPageOverview ||
            this.curView === View.BuySell && this.curPage === this.pricingData.length-1 ||
            this.curView === View.UserOrders && this.curPage === this.maxPageOrders
        );
        this.baseRows[0].components[3].setDisabled(false);

        this.baseRows[1].components[0].setDisabled(this.curView === View.Overview);
        this.baseRows[1].components[1].setDisabled(this.curView === View.BuySell);
        this.baseRows[1].components[2].setDisabled(this.curView === View.UserOrders);

        if (this.curView === View.BuySell) {
            const item = this.pricingData[this.curPage];
            const itemRarity = BoarUtils.findRarity(item.id, this.config);
            const isSpecial = itemRarity[0] !== 0
                ? itemRarity[1].name === 'Special'
                : false;

            rowsToAdd.push(this.optionalRows[0]);
            rowsToAdd.push(this.optionalRows[1]);

            this.optionalRows[0].components[0].setDisabled(item.instaBuys.length === 0);
            this.optionalRows[0].components[1].setDisabled(item.instaSells.length === 0);
            this.optionalRows[1].components[0].setDisabled(false);
            this.optionalRows[1].components[1].setDisabled(false);

            if (isSpecial) {
                let selectOptions: SelectMenuComponentOptionData[] = [];
                const instaBuyEditions: number[] = [];
                const instaSellEditions: number[] = [];

                for (let i=0; i<item.instaBuys.length; i++) {
                    const editionNum: number = item.instaBuys[i].editions[0];

                    if (!instaBuyEditions.includes(editionNum)) {
                        selectOptions.push({
                            label: 'Edition #' + editionNum,
                            value: editionNum.toString()
                        });
                    }

                    instaBuyEditions.push(editionNum);
                }

                for (let i=0; i<item.instaSells.length; i++) {
                    const editionNum: number = item.instaSells[i].editions[0];

                    if (!instaBuyEditions.includes(editionNum) && !instaSellEditions.includes(editionNum)) {
                        selectOptions.push({
                            label: 'Edition #' + editionNum,
                            value: editionNum.toString()
                        });
                    }

                    instaSellEditions.push(editionNum);
                }

                if (selectOptions.length === 0) {
                    selectOptions.push({
                        label: this.config.stringConfig.emptySelect,
                        value: this.config.stringConfig.emptySelect
                    });
                } else {
                    this.optionalRows[3].components[0].setDisabled(false);
                    if (this.curEdition === 0 && instaBuyEditions.length > 0) {
                        this.curEdition = instaBuyEditions[0];
                    } else if (this.curEdition === 0) {
                        this.curEdition = instaSellEditions[0];
                    }
                }

                selectOptions = selectOptions.slice(0, 25);

                (this.optionalRows[3].components[0] as StringSelectMenuBuilder).setOptions(selectOptions);
                this.optionalRows[0].components[0].setDisabled(!instaBuyEditions.includes(this.curEdition));
                this.optionalRows[0].components[1].setDisabled(!instaSellEditions.includes(this.curEdition));
                rowsToAdd.push(this.optionalRows[3]);
            }
        }

        let imageToSend: AttachmentBuilder;

        if (this.curView === View.Overview) {
            imageToSend = await this.imageGen.makeOverviewImage(this.curPage);
        } else {
            imageToSend = await this.imageGen.makeBuySellImage(this.curPage ,this.curEdition);
        }

        await this.firstInter.editReply({
            files: [imageToSend],
            components: this.baseRows.concat(rowsToAdd)
        });
    }

    private disableButtons(): void {
        for (const row of this.baseRows.concat(this.optionalRows)) {
            for (const component of row.components) {
                component.setDisabled(true);
            }
        }
    }

    private initButtons() {
        const marketFieldConfigs: RowConfig[][] = this.config.commandConfigs.boar.market.componentFields;
        // const selectOptions: SelectMenuComponentOptionData[] = [];
        //
        // for (let i=0; i<this.userBuyOrders.length; i++) {
        //     const buyOrder = this.userBuyOrders[i];
        //     selectOptions.push({
        //         label: 'BUY: ' + this.config.itemConfigs[buyOrder.type][buyOrder.id].name +
        //             '(' + buyOrder.list.price + ')',
        //         value: i.toString()
        //     });
        // }
        //
        // for (let i=0; i<this.userSellOrders.length; i++) {
        //     const sellOrder = this.userSellOrders[i];
        //     selectOptions.push({
        //         label: 'BUY: ' + this.config.itemConfigs[sellOrder.type][sellOrder.id].name +
        //             '(' + sellOrder.list.price + ')',
        //         value: i.toString()
        //     });
        // }
        //
        // if (selectOptions.length === 0) {
        //     selectOptions.push({
        //         label: this.config.stringConfig.emptySelect,
        //         value: this.config.stringConfig.emptySelect
        //     });
        // }

        for (let i=0; i<marketFieldConfigs.length; i++) {
            const newRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
                ComponentUtils.makeRows(marketFieldConfigs[i]);

            ComponentUtils.addToIDs(
                marketFieldConfigs[i], newRows, this.firstInter.id, this.firstInter.user.id,
                [{label: this.config.stringConfig.emptySelect, value: this.config.stringConfig.emptySelect}]
            );

            if (i === 0) {
                this.baseRows = newRows
            } else {
                this.optionalRows = newRows;
            }
        }
    }

    private getPageFromName(pageInput: string, root: Node<string, number>): number {
        if (root.key.includes(pageInput))
            return root.value;
        if (pageInput > root.key && root.right !== null)
            return this.getPageFromName(pageInput, root.right);
        if (pageInput < root.key && root.left !== null)
            return this.getPageFromName(pageInput, root.left);
        return root.value;
    }

    private setPage(pageVal: number): void {
        if (this.curView === View.Overview) {
            this.curPage = Math.max(Math.min(pageVal-1, this.maxPageOverview), 0);
        } else if (this.curView === View.BuySell) {
            this.curPage = Math.max(Math.min(pageVal-1, this.pricingData.length-1), 0);
        } else {
            this.curPage = Math.max(Math.min(pageVal-1, this.maxPageOrders), 0);
        }
    }
}