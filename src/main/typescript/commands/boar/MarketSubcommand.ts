import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction, ButtonStyle,
    ChatInputCommandInteraction, Client,
    Events,
    Interaction,
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
import createRBTree, {Tree} from 'functional-red-black-tree';
import {MarketImageGenerator} from '../../util/generators/MarketImageGenerator';
import {BoarUser} from '../../util/boar/BoarUser';
import {ModalConfig} from '../../bot/config/modals/ModalConfig';
import {BoarUtils} from '../../util/boar/BoarUtils';
import {Queue} from '../../util/interactions/Queue';
import fs from 'fs';
import {CollectedBoar} from '../../util/data/userdata/collectibles/CollectedBoar';

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
    private userBuyOrders: {data: BuySellData, id: string, type: string}[] = [];
    private userSellOrders: {data: BuySellData, id: string, type: string}[] = [];
    private curView: View = View.Overview;
    private curPage: number = 0;
    private curEdition: number = 0;
    private modalData: [number, number, number] = [0, 0, 0];
    private maxPageOverview: number = 0;
    private baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private optionalRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };
    private modalShowing: ModalBuilder = {} as ModalBuilder;
    private curModalListener: ((submittedModal: Interaction) => Promise<void>) | undefined;
    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildData: GuildData | undefined = await InteractionUtils.handleStart(interaction, this.config);
        if (!guildData) return;

        await interaction.deferReply({ ephemeral: true });

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

        if (this.curView === View.UserOrders && this.userBuyOrders.concat(this.userSellOrders).length === 0) {
            this.curView = View.Overview;
        }

        this.maxPageOverview = Math.ceil(this.pricingData.length / 8) - 1;

        let pageVal: number = 1;
        if (!Number.isNaN(parseInt(pageInput))) {
            pageVal = parseInt(pageInput);
        } else if (this.curView === View.BuySell) {
            pageVal = BoarUtils.getClosestName(pageInput, this.pricingDataTree.root);
        }

        this.setPage(pageVal);

        if (CollectorUtils.marketCollectors[interaction.user.id]) {
            CollectorUtils.marketCollectors[interaction.user.id].stop('idle');
        }

        CollectorUtils.marketCollectors[interaction.user.id] = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        this.imageGen = new MarketImageGenerator(
            this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
        );
        await this.showMarket(true);

        CollectorUtils.marketCollectors[interaction.user.id].on(
            'collect', async (inter: ButtonInteraction | StringSelectMenuInteraction) =>
            await this.handleCollect(inter)
        );

        CollectorUtils.marketCollectors[interaction.user.id].once(
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
                editionSelect: marketRowConfig[1][2].components[0],
                claimOrder: marketRowConfig[1][3].components[0],
                updateOrder: marketRowConfig[1][3].components[1],
                cancelOrder: marketRowConfig[1][3].components[2],
                selectOrder: marketRowConfig[1][4].components[0]
            };

            const isPageInput = inter.customId.startsWith(marketComponents.inputPage.customId);
            const isInstaBuy = inter.customId.startsWith(marketComponents.instaBuy.customId);
            const isInstaSell = inter.customId.startsWith(marketComponents.instaSell.customId);
            const isBuyOrder = inter.customId.startsWith(marketComponents.buyOrder.customId);
            const isSellOrder = inter.customId.startsWith(marketComponents.sellOrder.customId);
            const isUpdate = inter.customId.startsWith(marketComponents.updateOrder.customId);

            // User wants to input a page manually
            if (isPageInput) {
                await this.modalHandle(inter);

                if (this.undoRedButtons()) {
                    this.showMarket();
                }

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

                clearInterval(this.timerVars.updateTime);
                return;
            }

            if (isUpdate) {
                await Queue.addQueue(async () => {
                    showModal = await this.canUpdateModal(inter);
                }, inter.id + inter.user.id);

                if (showModal) {
                    await this.modalHandle(inter);
                }

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
                    this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);
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

                case marketComponents.claimOrder.customId:
                    await this.doClaim();
                    break;

                case marketComponents.cancelOrder.customId:
                    await this.doCancel();
                    break;

                case marketComponents.selectOrder.customId:
                    this.curPage = Number.parseInt((inter as StringSelectMenuInteraction).values[0]);
                    break;
            }

            this.undoRedButtons();

            this.modalData = [0, 0, 0];
            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            CollectorUtils.marketCollectors[inter.user.id].stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
    }

    private async doClaim() {
        let orderInfo: {data: BuySellData, id: string, type: string};
        let isSell = false;
        let numToClaim = 0;

        if (this.curPage < this.userBuyOrders.length) {
            orderInfo = this.userBuyOrders[this.curPage];
        } else {
            isSell = true;
            orderInfo = this.userSellOrders[this.curPage - this.userBuyOrders.length];
        }

        numToClaim = await this.returnOrderToUser(orderInfo, isSell, true);

        await Queue.addQueue(async () => {
            try {
                const globalData = DataHandlers.getGlobalData();

                const buyOrders = globalData.itemData[orderInfo.type][orderInfo.id].buyers;
                const sellOrders = globalData.itemData[orderInfo.type][orderInfo.id].sellers;

                for (let i = 0; i < buyOrders.length && !isSell; i++) {
                    const buyOrder = buyOrders[i];
                    const isSameOrder = buyOrder.userID === orderInfo.data.userID &&
                        buyOrder.listTime === orderInfo.data.listTime;
                    const canRemoveOrder = orderInfo.data.num === orderInfo.data.filledAmount &&
                        orderInfo.data.filledAmount === orderInfo.data.claimedAmount + numToClaim;

                    if (isSameOrder && canRemoveOrder) {
                        globalData.itemData[orderInfo.type][orderInfo.id].buyers.splice(i, 1);
                        break;
                    } else if (isSameOrder) {
                        globalData.itemData[orderInfo.type][orderInfo.id].buyers[i].editions.splice(
                            0, numToClaim
                        );
                        globalData.itemData[orderInfo.type][orderInfo.id].buyers[i].editionDates.splice(
                            0, numToClaim
                        );
                        globalData.itemData[orderInfo.type][orderInfo.id].buyers[i].claimedAmount += numToClaim;
                        break;
                    }
                }

                for (let i = 0; i < sellOrders.length && isSell; i++) {
                    const sellOrder = sellOrders[i];
                    const isSameOrder = sellOrder.userID === orderInfo.data.userID &&
                        sellOrder.listTime === orderInfo.data.listTime;
                    const canRemoveOrder = orderInfo.data.num === orderInfo.data.filledAmount &&
                        orderInfo.data.filledAmount === orderInfo.data.claimedAmount + numToClaim;

                    if (isSameOrder && canRemoveOrder) {
                        globalData.itemData[orderInfo.type][orderInfo.id].sellers.splice(i, 1);
                        break;
                    } else if (isSameOrder) {
                        globalData.itemData[orderInfo.type][orderInfo.id].sellers[i].claimedAmount +=
                            numToClaim;
                        break;
                    }
                }

                fs.writeFileSync(this.config.pathConfig.globalDataFile, JSON.stringify(globalData));
                this.getPricingData();
                this.imageGen.updateInfo(
                    this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                );
            } catch (err: unknown) {
                await LogDebug.handleError(err, this.compInter);
            }
        }, this.compInter.id + 'global');

        if (numToClaim > 0) {
            await Replies.handleReply(
                this.compInter, 'Successfully claimed your items/bucks!', this.config.colorConfig.green, undefined,
                undefined, true
            );
            this.curPage = 0;
        } else {
            await Replies.handleReply(
                this.compInter, 'You\'ve reached the maximum amount of this item in your collection!',
                this.config.colorConfig.error, undefined, undefined, true
            );
        }
    }

    private async doCancel() {
        let orderInfo: {data: BuySellData, id: string, type: string};
        let isSell = false;
        let canCancel = true;

        if (this.curPage < this.userBuyOrders.length) {
            orderInfo = this.userBuyOrders[this.curPage];
        } else {
            isSell = true;
            orderInfo = this.userSellOrders[this.curPage - this.userBuyOrders.length];
        }

        await Queue.addQueue(async () => {
            try {
                const globalData = DataHandlers.getGlobalData();

                const buyOrders = globalData.itemData[orderInfo.type][orderInfo.id].buyers;
                const sellOrders = globalData.itemData[orderInfo.type][orderInfo.id].sellers;

                for (let i = 0; i < buyOrders.length && !isSell; i++) {
                    const buyOrder = buyOrders[i];
                    const isSameOrder = buyOrder.userID === orderInfo.data.userID &&
                        buyOrder.listTime === orderInfo.data.listTime;
                    canCancel = orderInfo.data.filledAmount === buyOrder.filledAmount;

                    if (isSameOrder && canCancel) {
                        const hasEnoughRoom = (await this.returnOrderToUser(orderInfo, isSell, false)) > 0;

                        if (hasEnoughRoom) {
                            await Replies.handleReply(
                                this.compInter, 'Successfully cancelled your order!',
                                this.config.colorConfig.green, undefined, undefined, true
                            );
                            globalData.itemData[orderInfo.type][orderInfo.id].buyers.splice(i, 1);
                            this.curPage = 0;
                        } else {
                            await Replies.handleReply(
                                this.compInter, 'Your collection can\'t fit the items that would be returned!',
                                this.config.colorConfig.error, undefined, undefined, true
                            );
                        }

                        break;
                    } else if (isSameOrder) {
                        await Replies.handleReply(
                            this.compInter, 'You have items/bucks to claim! Claim them if you want to cancel!',
                            this.config.colorConfig.green, undefined, undefined, true
                        );
                        break;
                    }
                }

                for (let i = 0; i < sellOrders.length && isSell; i++) {
                    const sellOrder = sellOrders[i];
                    const isSameOrder = sellOrder.userID === orderInfo.data.userID &&
                        sellOrder.listTime === orderInfo.data.listTime;
                    canCancel = orderInfo.data.filledAmount === sellOrder.filledAmount;

                    if (isSameOrder && canCancel) {
                        const hasEnoughRoom = (await this.returnOrderToUser(orderInfo, isSell, false)) > 0;

                        if (hasEnoughRoom) {
                            await Replies.handleReply(
                                this.compInter, 'Successfully cancelled your order!',
                                this.config.colorConfig.green, undefined, undefined, true
                            );
                            globalData.itemData[orderInfo.type][orderInfo.id].sellers.splice(i, 1);
                            this.curPage = 0;
                        } else {
                            await Replies.handleReply(
                                this.compInter, 'Your collection can\'t fit the items that would be returned!',
                                this.config.colorConfig.error, undefined, undefined, true
                            );
                        }

                        break;
                    } else if (isSameOrder) {
                        await Replies.handleReply(
                            this.compInter, 'You have items/bucks to claim! Claim them if you want to cancel!',
                            this.config.colorConfig.green, undefined, undefined, true
                        );
                        break;
                    }
                }

                fs.writeFileSync(this.config.pathConfig.globalDataFile, JSON.stringify(globalData));
                this.getPricingData();
                this.imageGen.updateInfo(
                    this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                );
            } catch (err: unknown) {
                await LogDebug.handleError(err, this.compInter);
            }
        }, this.compInter.id + 'global');
    }

    private async returnOrderToUser(
        orderInfo: {data: BuySellData, id: string, type: string}, isSell: boolean, isClaim: boolean
    ) {
        let numToReturn = 0;
        let hasEnoughRoom = true;

        if (!isClaim) {
            isSell = !isSell;
        }

        await Queue.addQueue(async () => {
            try {
                this.boarUser.refreshUserData();

                if (isClaim) {
                    numToReturn = orderInfo.data.filledAmount - orderInfo.data.claimedAmount;
                } else {
                    numToReturn = orderInfo.data.num - orderInfo.data.filledAmount;
                }


                if (!isSell && orderInfo.type === 'boars') {
                    if (!this.boarUser.itemCollection.boars[orderInfo.id]) {
                        this.boarUser.itemCollection.boars[orderInfo.id] = new CollectedBoar;
                        this.boarUser.itemCollection.boars[orderInfo.id].firstObtained = Date.now();
                    }

                    this.boarUser.itemCollection.boars[orderInfo.id].lastObtained = Date.now();
                    this.boarUser.itemCollection.boars[orderInfo.id].editions =
                        this.boarUser.itemCollection.boars[orderInfo.id].editions.concat(
                            orderInfo.data.editions.slice(0, numToReturn)
                        ).sort((a, b) => a - b);
                    this.boarUser.itemCollection.boars[orderInfo.id].editionDates =
                        this.boarUser.itemCollection.boars[orderInfo.id].editionDates.concat(
                            orderInfo.data.editionDates.slice(0, numToReturn)
                        ).sort((a, b) => a - b);
                    this.boarUser.stats.general.lastBoar = orderInfo.id;
                    this.boarUser.stats.general.totalBoars += numToReturn;
                    this.boarUser.itemCollection.boars[orderInfo.id].num += numToReturn;
                } else if (!isSell && orderInfo.type === 'powerups') {
                    if (orderInfo.id === 'extraChance') {
                        hasEnoughRoom = this.boarUser.itemCollection.powerups[orderInfo.id].numTotal + numToReturn <=
                            this.config.numberConfig.maxExtraChance;

                        if (isClaim) {
                            numToReturn = Math.min(
                                numToReturn,
                                this.config.numberConfig.maxExtraChance -
                                this.boarUser.itemCollection.powerups[orderInfo.id].numTotal
                            );
                        }
                    } else if (orderInfo.id === 'enhancer') {
                        hasEnoughRoom = this.boarUser.itemCollection.powerups[orderInfo.id].numTotal + numToReturn <=
                            this.config.numberConfig.maxEnhancers;

                        if (isClaim) {
                            numToReturn = Math.min(
                                numToReturn,
                                this.config.numberConfig.maxEnhancers -
                                this.boarUser.itemCollection.powerups[orderInfo.id].numTotal
                            );
                        }
                    }

                    if (hasEnoughRoom || isClaim) {
                        this.boarUser.itemCollection.powerups[orderInfo.id].numTotal += numToReturn;
                        this.boarUser.itemCollection.powerups[orderInfo.id].highestTotal = Math.max(
                            this.boarUser.itemCollection.powerups[orderInfo.id].numTotal,
                            this.boarUser.itemCollection.powerups[orderInfo.id].highestTotal
                        );
                    }
                } else {
                    this.boarUser.stats.general.boarScore += numToReturn * orderInfo.data.price;
                }

                this.boarUser.updateUserData();
            } catch (err: unknown) {
                await LogDebug.handleError(err, this.compInter);
            }
        }, this.compInter.id + this.compInter.user.id);

        return !hasEnoughRoom && !isClaim ? 0 : numToReturn;
    }

    private async canInstaModal(
        inter: MessageComponentInteraction, isInstaBuy: boolean, isInstaSell: boolean
    ): Promise<boolean> {
        try {
            this.boarUser.refreshUserData();
            let itemData = this.pricingData[this.curPage];
            let showModal = true;
            let undoRed = true;

            const strConfig = this.config.stringConfig;
            const nums = this.config.numberConfig;

            let sellOrder: BuySellData | undefined;
            const itemRarity = BoarUtils.findRarity(itemData.id, this.config);
            const isSpecial = itemRarity[1].name === 'Special' && itemRarity[0] !== 0;

            if (isInstaBuy && isSpecial) {
                for (const instaBuy of itemData.instaBuys) {
                    const noEditionExists = instaBuy.num === instaBuy.filledAmount ||
                        instaBuy.listTime + nums.orderExpire < Date.now() ||
                        instaBuy.editions[0] !== this.curEdition;

                    if (noEditionExists) continue;

                    sellOrder = instaBuy;
                    break;
                }
            }

            const noEditionBucks = isInstaBuy && this.curEdition > 0 && sellOrder &&
                this.boarUser.stats.general.boarScore < sellOrder.price;
            const noItemBucks = isInstaBuy && this.boarUser.stats.general.boarScore < itemData.instaBuys[0].price;

            const noHaveEdition = isInstaSell && this.curEdition > 0 &&
                this.boarUser.itemCollection.boars[itemData.id] &&
                !this.boarUser.itemCollection.boars[itemData.id].editions.includes(this.curEdition);

            const noHaveItems = isInstaSell && (itemData.type === 'boars' &&
                !this.boarUser.itemCollection.boars[itemData.id] ||
                itemData.type === 'powerups' && !this.boarUser.itemCollection.boars[itemData.id]);

            const completeBuy = isInstaBuy && (this.optionalRows[0].components[0] as ButtonBuilder).data.style === 4;
            const completeSell = isInstaSell && (this.optionalRows[0].components[1] as ButtonBuilder).data.style === 4;

            if (noEditionBucks || noItemBucks) {
                showModal = false;
                await Replies.handleReply(
                    inter, 'You don\'t have enough boar bucks for this!', this.config.colorConfig.error
                );
            } else if (noHaveEdition) {
                showModal = false;
                await Replies.handleReply(
                    inter, 'You don\'t have this edition so you cannot sell it!',
                    this.config.colorConfig.error
                );
            } else if (noHaveItems) {
                showModal = false;
                await Replies.handleReply(
                    inter, 'You don\'t have any of this item!', this.config.colorConfig.error
                );
            } else if (completeBuy) {
                await inter.deferUpdate();
                showModal = false;

                if (this.boarUser.stats.general.boarScore >= this.modalData[1]) {
                    let failedBuy = false;
                    const orderFillAmounts: number[] = [];
                    let editionOrderIndex: number = -1;

                    await Queue.addQueue(async () => {
                        try {
                            const globalData = DataHandlers.getGlobalData();
                            const newItemData = globalData.itemData[itemData.type][itemData.id];

                            let curPrice = 0;

                            if (this.curEdition === 0) {
                                let numGrabbed = 0;
                                let curIndex = 0;
                                while (numGrabbed < this.modalData[0]) {
                                    if (curIndex >= newItemData.sellers.length) break;

                                    let numToAdd = 0;
                                    numToAdd = Math.min(
                                        this.modalData[0] - numGrabbed,
                                        newItemData.sellers[curIndex].num - newItemData.sellers[curIndex].filledAmount
                                    );
                                    curPrice += newItemData.sellers[curIndex].price * numToAdd;

                                    numGrabbed += numToAdd;
                                    orderFillAmounts.push(numToAdd);
                                    curIndex++;
                                }

                                if (this.modalData[0] !== numGrabbed) {
                                    await Replies.handleReply(
                                        inter, 'Not enough orders of this item to complete this transaction!',
                                        this.config.colorConfig.font, undefined, undefined, true
                                    );

                                    failedBuy = true;
                                    return;
                                }
                            } else {
                                for (const instaBuy of newItemData.sellers) {
                                    const noEditionExists = instaBuy.num === instaBuy.filledAmount ||
                                        instaBuy.listTime + nums.orderExpire < Date.now() ||
                                        instaBuy.editions[0] !== this.curEdition;

                                    editionOrderIndex++;

                                    if (noEditionExists) continue;

                                    curPrice = instaBuy.price;
                                    break;
                                }

                                if (curPrice === 0) {
                                    await Replies.handleReply(
                                        inter, 'Not enough orders of this item edition to complete this transaction!',
                                        this.config.colorConfig.error, undefined, undefined, true
                                    );

                                    failedBuy = true;
                                    return;
                                }
                            }

                            if (this.modalData[1] < curPrice) {
                                await Replies.handleReply(
                                    inter, strConfig.marketUpdatedInstaBuy.replace('%@', curPrice.toLocaleString()),
                                    this.config.colorConfig.error, undefined, undefined, true
                                );

                                this.modalData[1] = curPrice;
                                undoRed = false;
                                failedBuy = true;
                                return;
                            }

                            for (let i = 0; i < orderFillAmounts.length; i++) {
                                newItemData.sellers[i].filledAmount += orderFillAmounts[i];
                            }

                            if (editionOrderIndex >= 0) {
                                newItemData.sellers[editionOrderIndex].filledAmount = 1;
                            }

                            fs.writeFileSync(this.config.pathConfig.globalDataFile, JSON.stringify(globalData));
                            this.getPricingData();
                            this.imageGen.updateInfo(
                                this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                            );
                        } catch (err: unknown) {
                            await LogDebug.handleError(err, inter);
                        }
                    }, inter.id + 'global');

                    if (!failedBuy && itemData.type === 'boars') {
                        itemData = this.pricingData[this.curPage];

                        if (!this.boarUser.itemCollection.boars[itemData.id]) {
                            this.boarUser.itemCollection.boars[itemData.id] = new CollectedBoar;
                            this.boarUser.itemCollection.boars[itemData.id].firstObtained = Date.now();
                        }

                        this.boarUser.itemCollection.boars[itemData.id].num += this.modalData[0];
                        this.boarUser.itemCollection.boars[itemData.id].lastObtained = Date.now();
                        this.boarUser.stats.general.totalBoars += this.modalData[0];
                        this.boarUser.stats.general.lastBoar = itemData.id;

                        if (this.curEdition === 0) {
                            for (let i=0; i<orderFillAmounts.length; i++) {
                                if (itemData.instaBuys[i].editions.length === 0) continue;

                                this.boarUser.itemCollection.boars[itemData.id].editions =
                                    this.boarUser.itemCollection.boars[itemData.id].editions.concat(
                                        itemData.instaBuys[i].editions.slice(0, orderFillAmounts[i])
                                    ).sort((a,b) => a - b);

                                this.boarUser.itemCollection.boars[itemData.id].editionDates =
                                    this.boarUser.itemCollection.boars[itemData.id].editionDates.concat(
                                        itemData.instaBuys[i].editionDates.slice(0, orderFillAmounts[i])
                                    ).sort((a,b) => a - b);
                            }
                        } else {
                            let sellOrder: BuySellData | undefined;

                            for (const instaBuy of itemData.instaBuys) {
                                if (instaBuy.editions[0] !== this.curEdition) continue;
                                sellOrder = instaBuy;
                            }

                            this.boarUser.itemCollection.boars[itemData.id].editions =
                                this.boarUser.itemCollection.boars[itemData.id].editions.concat([this.curEdition])
                                    .sort((a,b) => a - b);

                            if (sellOrder) {
                                this.boarUser.itemCollection.boars[itemData.id].editionDates =
                                    this.boarUser.itemCollection.boars[itemData.id].editionDates.concat(
                                        sellOrder.editionDates
                                    ).sort((a,b) => a - b);
                            }

                            this.curEdition = 0;
                        }
                    } else if (!failedBuy && itemData.type === 'powerups') {
                        this.boarUser.itemCollection.powerups[itemData.id].numTotal += this.modalData[0];
                        this.boarUser.itemCollection.powerups[itemData.id].highestTotal = Math.max(
                            this.boarUser.itemCollection.powerups[itemData.id].numTotal,
                            this.boarUser.itemCollection.powerups[itemData.id].highestTotal
                        );
                    }

                    if (!failedBuy) {
                        this.boarUser.stats.general.boarScore -= this.modalData[1];
                        this.boarUser.updateUserData();

                        await Replies.handleReply(
                            inter, strConfig.marketInstaComplete, this.config.colorConfig.green,
                            undefined, undefined, true
                        );
                    }
                } else {
                    await Replies.handleReply(
                        inter, 'You don\'t have enough boar bucks!', this.config.colorConfig.error,
                        undefined, undefined, true
                    );
                }
            } else if (completeSell) {
                await inter.deferUpdate();
                showModal = false;

                if (
                    this.curEdition > 0 && this.boarUser.itemCollection.boars[itemData.id].num >= this.modalData[0] &&
                    this.boarUser.itemCollection.boars[itemData.id].editions.includes(this.curEdition) ||
                    itemData.type === 'boars' &&
                    this.boarUser.itemCollection.boars[itemData.id].num >= this.modalData[0] ||
                    itemData.type === 'powerups' &&
                    this.boarUser.itemCollection.powerups[itemData.id].numTotal >= this.modalData[0]
                ) {
                    let failedSale = false;
                    const orderFillAmounts: number[] = [];
                    let editionOrderIndex: number = -1;

                    await Queue.addQueue(async () => {
                        try {
                            const globalData = DataHandlers.getGlobalData();
                            const newItemData = globalData.itemData[itemData.type][itemData.id];

                            let curPrice = 0;

                            if (this.curEdition === 0) {
                                let numGrabbed = 0;
                                let curIndex = 0;
                                while (numGrabbed < this.modalData[0]) {
                                    if (curIndex >= newItemData.buyers.length) break;

                                    let numToAdd = 0;
                                    numToAdd = Math.min(
                                        this.modalData[0] - numGrabbed,
                                        newItemData.buyers[curIndex].num - newItemData.buyers[curIndex].filledAmount
                                    );
                                    curPrice += newItemData.buyers[curIndex].price * numToAdd;

                                    numGrabbed += numToAdd;
                                    orderFillAmounts.push(numToAdd);
                                    curIndex++;
                                }

                                if (this.modalData[0] !== numGrabbed) {
                                    await Replies.handleReply(
                                        inter, 'Not enough orders of this item to complete this transaction!',
                                        this.config.colorConfig.font, undefined, undefined, true
                                    );

                                    failedSale = true;
                                    return;
                                }
                            } else {
                                for (const instaSell of newItemData.buyers) {
                                    const noEditionExists = instaSell.num === instaSell.filledAmount ||
                                        instaSell.listTime + nums.orderExpire < Date.now() ||
                                        instaSell.editions[0] !== this.curEdition;

                                    editionOrderIndex++;

                                    if (noEditionExists) continue;

                                    curPrice = instaSell.price;
                                    break;
                                }

                                if (curPrice === 0) {
                                    await Replies.handleReply(
                                        inter, 'Not enough orders of this item edition to complete this transaction!',
                                        this.config.colorConfig.error, undefined, undefined, true
                                    );

                                    failedSale = true;
                                    return;
                                }
                            }

                            if (this.modalData[1] > curPrice) {
                                await Replies.handleReply(
                                    inter, strConfig.marketUpdatedInstaSell.replace('%@', curPrice.toLocaleString()),
                                    this.config.colorConfig.error, undefined, undefined, true
                                );

                                this.modalData[1] = curPrice;
                                undoRed = false;
                                failedSale = true;
                                return;
                            }

                            for (let i = 0; i < orderFillAmounts.length; i++) {
                                const editionIndex = this.boarUser.itemCollection.boars[itemData.id].editions.length -
                                    orderFillAmounts[i];
                                const editionLength = this.boarUser.itemCollection.boars[itemData.id].editions.length;

                                newItemData.buyers[i].editions = newItemData.buyers[i].editions.concat(
                                    this.boarUser.itemCollection.boars[itemData.id].editions.splice(
                                        editionIndex, editionLength
                                    )
                                ).sort((a, b) => a - b);

                                newItemData.buyers[i].editionDates = newItemData.buyers[i].editionDates.concat(
                                    this.boarUser.itemCollection.boars[itemData.id].editionDates.splice(
                                        editionIndex, editionLength
                                    )
                                ).sort((a, b) => a - b);

                                newItemData.buyers[i].filledAmount += orderFillAmounts[i];
                            }

                            if (editionOrderIndex >= 0) {
                                const editionIndex = this.boarUser.itemCollection.boars[itemData.id].editions
                                    .indexOf(this.curEdition);

                                this.boarUser.itemCollection.boars[itemData.id].editions.splice(editionIndex, 1);

                                newItemData.buyers[editionOrderIndex].editionDates =
                                    newItemData.buyers[editionOrderIndex].editionDates.concat(
                                        this.boarUser.itemCollection.boars[itemData.id].editionDates.splice(editionIndex, 1)
                                    ).sort((a, b) => a - b);

                                newItemData.buyers[editionOrderIndex].filledAmount = 1;

                                this.curEdition = 0;
                            }

                            fs.writeFileSync(this.config.pathConfig.globalDataFile, JSON.stringify(globalData));
                            this.getPricingData();
                            this.imageGen.updateInfo(
                                this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                            );
                        } catch (err: unknown) {
                            await LogDebug.handleError(err, inter);
                        }
                    }, inter.id + 'global');

                    if (itemData.type === 'boars') {
                        this.boarUser.itemCollection.boars[itemData.id].num -= this.modalData[0];
                        this.boarUser.stats.general.totalBoars -= this.modalData[0];
                    } else {
                        this.boarUser.itemCollection.powerups[itemData.id].numTotal -= this.modalData[0];
                    }

                    this.boarUser.stats.general.boarScore += this.modalData[1];
                    this.boarUser.updateUserData();

                    await Replies.handleReply(
                        inter, strConfig.marketInstaComplete, this.config.colorConfig.green,
                        undefined, undefined, true
                    );
                } else if (this.curEdition > 0) {
                    await Replies.handleReply(
                        inter, 'You don\'t have edition #' + this.modalData[2] + ' of this item so you cannot sell it!',
                        this.config.colorConfig.error, undefined, undefined, true
                    );
                } else {
                    await Replies.handleReply(
                        inter, 'You don\'t have enough of this item!',
                        this.config.colorConfig.error, undefined, undefined, true
                    );
                }
            }

            if (undoRed) {
                this.undoRedButtons();
            }

            if (!showModal) {
                this.showMarket();
            }

            return showModal;
        } catch (err: unknown) {
            await LogDebug.handleError(err, inter);
            return false;
        }
    }

    private async canOrderModal(
        inter: MessageComponentInteraction, isBuyOrder: boolean, isSellOrder: boolean
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
            } else if (this.userBuyOrders.length + this.userSellOrders.length >= 8) {
                await inter.deferUpdate();
                showModal = false;

                await Replies.handleReply(
                    inter,
                    'You reached the maximum number of orders you can place! Cancel or claim one of your orders to ' +
                    ' create another order!',
                    this.config.colorConfig.error, undefined, undefined, true
                );
            } else if (isBuyOrder && (this.optionalRows[1].components[0] as ButtonBuilder).data.style === 4) {
                await inter.deferUpdate();
                showModal = false;

                if (this.boarUser.stats.general.boarScore >= this.modalData[0] * this.modalData[1]) {
                    await Queue.addQueue(async () => {
                        try {
                            const globalData = DataHandlers.getGlobalData();
                            const order: BuySellData = {
                                userID: inter.user.id,
                                num: this.modalData[0],
                                price: this.modalData[1],
                                editions: this.modalData[2] > 0 ? [this.modalData[2]] : [],
                                editionDates: [],
                                listTime: Date.now(),
                                filledAmount: 0,
                                claimedAmount: 0
                            };

                            globalData.itemData[itemData.type][itemData.id].buyers.push(order);
                            fs.writeFileSync(this.config.pathConfig.globalDataFile, JSON.stringify(globalData));
                            this.getPricingData();
                            this.imageGen.updateInfo(
                                this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                            );
                        } catch (err: unknown) {
                            await LogDebug.handleError(err, inter);
                        }
                    }, inter.id + 'global');

                    this.boarUser.stats.general.boarScore -= this.modalData[0] * this.modalData[1];
                    this.boarUser.updateUserData();

                    await Replies.handleReply(
                        inter, strConfig.marketOrderComplete, this.config.colorConfig.green,
                        undefined, undefined, true
                    );
                } else {
                    await Replies.handleReply(
                        inter, 'You don\'t have enough boar bucks!', this.config.colorConfig.error,
                        undefined, undefined, true
                    );
                }
            } else if (isSellOrder && (this.optionalRows[1].components[1] as ButtonBuilder).data.style === 4) {
                await inter.deferUpdate();
                showModal = false;

                if (
                    this.modalData[2] > 0 && this.boarUser.itemCollection.boars[itemData.id].num >= this.modalData[0] &&
                    this.boarUser.itemCollection.boars[itemData.id].editions.includes(this.modalData[2]) ||
                    itemData.type === 'boars' &&
                    this.boarUser.itemCollection.boars[itemData.id].num >= this.modalData[0] ||
                    itemData.type === 'powerups' &&
                    this.boarUser.itemCollection.powerups[itemData.id].numTotal >= this.modalData[0]
                ) {
                    let editionIndex = 100;

                    if (itemData.type === 'boars') {
                        editionIndex = this.modalData[2] > 0
                            ? this.boarUser.itemCollection.boars[itemData.id].editions.indexOf(this.modalData[2])
                            : this.boarUser.itemCollection.boars[itemData.id].num - this.modalData[0];
                    }

                    await Queue.addQueue(async () => {
                        try {
                            const globalData = DataHandlers.getGlobalData();

                            const editions = itemData.type === 'boars'
                                ? this.boarUser.itemCollection.boars[itemData.id]
                                    .editions.splice(editionIndex, this.modalData[2] > 0 ? 1 : 100)
                                : [];
                            const editionDates = itemData.type === 'boars'
                                ? this.boarUser.itemCollection.boars[itemData.id]
                                    .editionDates.splice(editionIndex, this.modalData[2] > 0 ? 1 : 100)
                                : [];

                            const order: BuySellData = {
                                userID: inter.user.id,
                                num: this.modalData[0],
                                price: this.modalData[1],
                                editions: editions,
                                editionDates: editionDates,
                                listTime: Date.now(),
                                filledAmount: 0,
                                claimedAmount: 0
                            };

                            globalData.itemData[itemData.type][itemData.id].sellers.push(order);
                            fs.writeFileSync(this.config.pathConfig.globalDataFile, JSON.stringify(globalData));
                            this.getPricingData();
                            this.imageGen.updateInfo(
                                this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                            );
                        } catch (err: unknown) {
                            await LogDebug.handleError(err, inter);
                        }
                    }, inter.id + 'global');

                    if (itemData.type === 'boars') {
                        this.boarUser.itemCollection.boars[itemData.id].num -= this.modalData[0];
                        this.boarUser.stats.general.totalBoars -= this.modalData[0];
                    } else {
                        this.boarUser.itemCollection.powerups[itemData.id].numTotal -= this.modalData[0];
                    }

                    this.boarUser.updateUserData();

                    await Replies.handleReply(
                        inter, strConfig.marketOrderComplete, this.config.colorConfig.green,
                        undefined, undefined, true
                    );
                } else if (this.modalData[2] > 0) {
                    await Replies.handleReply(
                        inter, 'You don\'t have edition #' + this.modalData[2] + ' of this item so you cannot sell it!',
                        this.config.colorConfig.error, undefined, undefined, true
                    );
                } else {
                    await Replies.handleReply(
                        inter, 'You don\'t have enough of this item!',
                        this.config.colorConfig.error, undefined, undefined, true
                    );
                }
            }

            this.undoRedButtons();

            if (!showModal) {
                this.showMarket();
            }

            return showModal;
        } catch (err: unknown) {
            await LogDebug.handleError(err, inter);
            return false;
        }
    }

    private async canUpdateModal(inter: MessageComponentInteraction): Promise<boolean> {
        this.boarUser.refreshUserData();

        let showModal = true;
        let orderInfo: {data: BuySellData, id: string, type: string};
        let isSell = false;

        if (this.curPage < this.userBuyOrders.length) {
            orderInfo = this.userBuyOrders[this.curPage];
        } else {
            isSell = true;
            orderInfo = this.userSellOrders[this.curPage - this.userBuyOrders.length];
        }

        await Queue.addQueue(async () => {
            try {
                const globalData = DataHandlers.getGlobalData();

                const buyOrders = globalData.itemData[orderInfo.type][orderInfo.id].buyers;
                const sellOrders = globalData.itemData[orderInfo.type][orderInfo.id].sellers;

                for (let i = 0; i < buyOrders.length && !isSell; i++) {
                    const buyOrder = buyOrders[i];
                    const isSameOrder = buyOrder.userID === orderInfo.data.userID &&
                        buyOrder.listTime === orderInfo.data.listTime;
                    const canUpdate = orderInfo.data.filledAmount === buyOrder.filledAmount;

                    if (isSameOrder && canUpdate) {
                        if ((this.optionalRows[3].components[1] as ButtonBuilder).data.style === 4) {
                            await inter.deferUpdate();
                            showModal = false;

                            if (this.modalData[1] - buyOrder.price > this.boarUser.stats.general.boarScore) {
                                await Replies.handleReply(
                                    inter, 'You don\'t have enough boar bucks for this!',
                                    this.config.colorConfig.error, undefined, undefined, true
                                );
                            } else {
                                globalData.itemData[orderInfo.type][orderInfo.id].buyers[i].price = this.modalData[1];

                                await Replies.handleReply(
                                    inter, this.config.stringConfig.marketUpdateComplete,
                                    this.config.colorConfig.green, undefined, undefined, true
                                );
                            }
                        }

                        break;
                    } else if (isSameOrder) {
                        await inter.deferUpdate();
                        showModal = false;

                        await Replies.handleReply(
                            inter, 'You have items/bucks to claim! Claim them if you want to update the price!',
                            this.config.colorConfig.error, undefined, undefined, true
                        );

                        break;
                    }
                }

                for (let i = 0; i < sellOrders.length && isSell; i++) {
                    const sellOrder = sellOrders[i];
                    const isSameOrder = sellOrder.userID === orderInfo.data.userID &&
                        sellOrder.listTime === orderInfo.data.listTime;
                    const canUpdate = orderInfo.data.filledAmount === sellOrder.filledAmount;

                    if (isSameOrder && canUpdate) {
                        if ((this.optionalRows[3].components[1] as ButtonBuilder).data.style === 4) {
                            await inter.deferUpdate();
                            showModal = false;

                            globalData.itemData[orderInfo.type][orderInfo.id].sellers[i].price = this.modalData[1];

                            await Replies.handleReply(
                                inter, this.config.stringConfig.marketUpdateComplete,
                                this.config.colorConfig.green, undefined, undefined, true
                            );
                        }

                        break;
                    } else if (isSameOrder) {
                        await inter.deferUpdate();
                        showModal = false;

                        await Replies.handleReply(
                            inter, 'You have items/bucks to claim! Claim them if you want to update the price!',
                            this.config.colorConfig.error, undefined, undefined, true
                        );

                        break;
                    }
                }

                fs.writeFileSync(this.config.pathConfig.globalDataFile, JSON.stringify(globalData));
                this.getPricingData();
                this.imageGen.updateInfo(
                    this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                );
            } catch (err: unknown) {
                await LogDebug.handleError(err, this.compInter);
            }
        }, this.compInter.id + 'global');

        this.undoRedButtons();

        if (!showModal) {
            this.showMarket();
        }

        return showModal;
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

            this.endModalListener(this.compInter.client);
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
        this.userBuyOrders = [];
        this.userSellOrders = [];

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
                    data: buyData,
                    id: priceData.id,
                    type: priceData.type
                });
            }
            for (const sellData of priceData.instaSells) {
                if (sellData.userID !== this.firstInter.user.id) continue;
                this.userBuyOrders.push({
                    data: sellData,
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
        const isUpdate = inter.customId.startsWith(marketRowConfig[1][3].components[1].customId);

        const itemType = !isUpdate
            ? this.pricingData[this.curPage].type
            : this.userBuyOrders.concat(this.userSellOrders)[this.curPage].type;
        const itemID = !isUpdate
            ? this.pricingData[this.curPage].id
            : this.userBuyOrders.concat(this.userSellOrders)[this.curPage].id;
        const itemData = this.config.itemConfigs[itemType][itemID];
        const itemRarity = BoarUtils.findRarity(itemID, this.config);
        const isSpecial = itemRarity[1].name === 'Special' && itemRarity[0] !== 0;

        let updateEdition = 0;

        if (isUpdate && isSpecial) {
            updateEdition = this.userBuyOrders.concat(this.userSellOrders)[this.curPage].data.editions[0];
        }

        if ((isInstaBuy || isInstaSell) && !isSpecial) {
            modalNum = 1;
            modalTitle = (isInstaBuy
                ? marketRowConfig[1][0].components[0].label
                : marketRowConfig[1][0].components[1].label) + ': ' + itemData.pluralName;
        }

        if ((isInstaBuy || isInstaSell) && isSpecial) {
            modalNum = 2;
            modalTitle = (isInstaBuy
                ? marketRowConfig[1][0].components[0].label
                : marketRowConfig[1][0].components[1].label) + ': ' + itemData.name + ' #' + this.curEdition;
        }

        if ((isBuyOrder || isSellOrder) && !isSpecial) {
            modalNum = 3;
            modalTitle = (isBuyOrder
                ? marketRowConfig[1][1].components[0].label
                : marketRowConfig[1][1].components[1].label) + ': ' + itemData.pluralName;
        }

        if ((isBuyOrder || isSellOrder) && isSpecial) {
            modalNum = 4;
            modalTitle = (isBuyOrder
                ? marketRowConfig[1][1].components[0].label
                : marketRowConfig[1][1].components[1].label) + ': ' + itemData.name;
        }

        if (isUpdate) {
            modalNum = 5;
            modalTitle = modals[modalNum].title + itemData.name + (isSpecial
                ? ' #' + updateEdition
                : '')
        }

        this.modalShowing = new ModalBuilder(modals[modalNum]);
        this.modalShowing.setCustomId(modals[modalNum].customId + '|' + inter.id);
        this.modalShowing.setTitle(modalTitle);
        await inter.showModal(this.modalShowing);

        if (modalNum === 0) {
            this.curModalListener = this.modalListenerPage;
        } else if (modalNum === 1) {
            this.curModalListener = this.modalListenerInsta;
        } else if (modalNum === 2) {
            this.curModalListener = this.modalListenerInstaSpecial;
        } else if (modalNum === 3) {
            this.curModalListener = this.modalListenerOrder;
        } else if (modalNum === 4) {
            this.curModalListener = this.modalListenerOrderSpecial;
        } else {
            this.curModalListener = this.modalListenerUpdate;
        }

        inter.client.on(Events.InteractionCreate, this.curModalListener);
    }

    /**
     * Handles page input that was input in modal
     *
     * @param submittedModal - The interaction to respond to
     * @private
     */
    private modalListenerPage = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
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
                pageVal = BoarUtils.getClosestName(submittedPage, this.pricingDataTree.root)
            }

            this.setPage(pageVal);

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            CollectorUtils.marketCollectors[submittedModal.user.id].stop(CollectorUtils.Reasons.Error);
        }

        this.endModalListener(submittedModal.client);
    };

    private modalListenerInsta = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
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

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);

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

                this.endModalListener(submittedModal.client);
                return;
            }

            let numGrabbed = 0;
            let curPrice = 0;
            let curIndex = 0;
            while (numGrabbed < numVal) {
                let numToAdd = 0;
                if (isInstaBuy && curIndex < itemData.instaBuys.length) {
                    numToAdd = Math.min(
                        numVal - numGrabbed,
                        itemData.instaBuys[curIndex].num - itemData.instaBuys[curIndex].filledAmount
                    );
                    curPrice += itemData.instaBuys[curIndex].price * numToAdd;
                } else if (curIndex < itemData.instaSells.length) {
                    numToAdd = Math.min(
                        numVal - numGrabbed,
                        itemData.instaSells[curIndex].num - itemData.instaSells[curIndex].filledAmount
                    );
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

                this.endModalListener(submittedModal.client);
                return;
            }

            const itemName = numVal + ' ' + (numVal > 1
                ? this.config.itemConfigs[itemData.type][itemData.id].pluralName
                : this.config.itemConfigs[itemData.type][itemData.id].name);

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', curPrice.toLocaleString()),
                this.config.colorConfig.font, undefined, undefined, true
            );

            if (isInstaBuy) {
                (this.optionalRows[0].components[0] as ButtonBuilder).setStyle(4);
            } else {
                (this.optionalRows[0].components[1] as ButtonBuilder).setStyle(4);
            }

            this.modalData = [numVal, curPrice, 0];

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            CollectorUtils.marketCollectors[submittedModal.user.id].stop(CollectorUtils.Reasons.Error);
        }

        this.endModalListener(submittedModal.client);
    };

    private modalListenerInstaSpecial = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;
            const nums = this.config.numberConfig;

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

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);

            const itemData = this.pricingData[this.curPage];

            if (!isInstaBuy && !this.boarUser.itemCollection.boars[itemData.id].editions.includes(this.curEdition)) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have edition #' + this.curEdition + ' of this item so you cannot sell it!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (editionVal !== this.curEdition) {
                await Replies.handleReply(
                    submittedModal, 'The edition number you input didn\'t match the edition you were trying to buy/sell!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            let curPrice = 0;

            if (isInstaBuy) {
                for (const instaBuy of itemData.instaBuys) {
                    const noEditionExists = instaBuy.num === instaBuy.filledAmount ||
                        instaBuy.listTime + nums.orderExpire < Date.now() ||
                        instaBuy.editions[0] !== this.curEdition;

                    if (noEditionExists) continue;

                    curPrice = instaBuy.price;
                    break;
                }
            } else {
                for (const instaSell of itemData.instaSells) {
                    const noEditionExists = instaSell.num === instaSell.filledAmount ||
                        instaSell.listTime + nums.orderExpire < Date.now() ||
                        instaSell.editions[0] !== this.curEdition;

                    if (noEditionExists) continue;

                    curPrice = instaSell.price;
                    break;
                }
            }

            if (curPrice === 0) {
                await Replies.handleReply(
                    submittedModal, 'Not enough orders of this item edition to complete this transaction!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
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

            this.modalData = [1, curPrice, this.curEdition];

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            CollectorUtils.marketCollectors[submittedModal.user.id].stop(CollectorUtils.Reasons.Error);
        }

        this.endModalListener(submittedModal.client);
    };

    private modalListenerOrder = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
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

                this.endModalListener(submittedModal.client);
                return;
            }

            if (isBuyOrder && numVal > 1000) {
                await Replies.handleReply(
                    submittedModal, 'You may only set up an order for 1000 items or less at a time!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            if (this.userBuyOrders.length + this.userSellOrders.length >= 8) {
                await Replies.handleReply(
                    submittedModal,
                    'You reached the maximum number of orders you can place! Cancel or claim one of your orders to ' +
                    ' create another order!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);

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

                this.endModalListener(submittedModal.client);
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

                this.endModalListener(submittedModal.client);
                return;
            }

            if (isBuyOrder && price > this.boarUser.stats.general.boarScore) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have enough boar bucks to create this order!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
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

            this.modalData = [numVal, priceVal, 0];

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            CollectorUtils.marketCollectors[submittedModal.user.id].stop(CollectorUtils.Reasons.Error);
        }

        this.endModalListener(submittedModal.client);
    };

    private modalListenerOrderSpecial = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
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

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            if (this.userBuyOrders.length + this.userSellOrders.length >= 8) {
                await Replies.handleReply(
                    submittedModal,
                    'You reached the maximum number of orders you can place! Cancel or claim one of your orders to ' +
                    ' create another order!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);

            const itemData = this.pricingData[this.curPage];

            const curEdition = DataHandlers.getGlobalData().itemData[itemData.type][itemData.id].curEdition as number;

            if (editionVal > curEdition) {
                await Replies.handleReply(
                    submittedModal, 'Edition #' + editionVal + ' of this item doesn\'t exist!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (!isBuyOrder && !this.boarUser.itemCollection.boars[itemData.id].editions.includes(editionVal)) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have edition #' + editionVal + ' of this item so you cannot sell it!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            let isSellingEdition = false;
            for (const instaBuy of itemData.instaBuys) {
                if (instaBuy.userID === this.compInter.user.id && instaBuy.editions[0] === editionVal) {
                    isSellingEdition = true;
                    break;
                }
            }

            if (
                isBuyOrder &&
                (this.boarUser.itemCollection.boars[itemData.id].editions.includes(editionVal) || isSellingEdition)
            ) {
                await Replies.handleReply(
                    submittedModal, 'You already have or currently have a sell offer for #' +
                    editionVal + ' of this item!', this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
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

                this.endModalListener(submittedModal.client);
                return;
            }

            if (isBuyOrder && priceVal > this.boarUser.stats.general.boarScore) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have enough boar bucks to create this order!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
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

            this.modalData = [1, priceVal, editionVal];

            await this.showMarket();
            LogDebug.sendDebug('Showing market', this.config);
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            CollectorUtils.marketCollectors[submittedModal.user.id].stop(CollectorUtils.Reasons.Error);
        }

        this.endModalListener(submittedModal.client);
    };

    private modalListenerUpdate = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;

            const submittedPrice: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedPrice, this.config, this.firstInter
            );

            let priceVal: number = 0;
            if (!Number.isNaN(parseInt(submittedPrice))) {
                priceVal = parseInt(submittedPrice);
            }

            if (priceVal <= 0) {
                await Replies.handleReply(
                    submittedModal, 'Invalid input! Input(s) must be greater than zero.',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);

            const itemData = this.userBuyOrders.concat(this.userSellOrders)[this.curPage];
            const itemRarity = BoarUtils.findRarity(itemData.id, this.config);
            const isSpecial = itemRarity[1].name === 'Special' && itemRarity[0] !== 0;
            const oldPrice = itemData.data.price * (itemData.data.num - itemData.data.filledAmount);
            const newPrice = priceVal * (itemData.data.num - itemData.data.filledAmount);
            const isBuyOrder = this.curPage < this.userBuyOrders.length;
            const responseStr = newPrice > oldPrice
                ? strConfig.marketConfirmUpdateIncrease
                : strConfig.marketConfirmUpdateDecrease;

            if (isBuyOrder && newPrice - oldPrice > this.boarUser.stats.general.boarScore) {
                await Replies.handleReply(
                    submittedModal, 'You don\'t have enough boar bucks for this!',
                    this.config.colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            const itemName = this.config.itemConfigs[itemData.type][itemData.id].name + (isSpecial
                ? ' #' + itemData.data.editions[0]
                : '');

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', oldPrice.toLocaleString())
                    .replace('%@', newPrice.toLocaleString()),
                this.config.colorConfig.font, undefined, undefined, true
            );

            (this.optionalRows[3].components[1] as ButtonBuilder).setStyle(4);

            this.modalData = [0, priceVal, 0];

            await this.showMarket();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            CollectorUtils.marketCollectors[submittedModal.user.id].stop(CollectorUtils.Reasons.Error);
        }

        this.endModalListener(submittedModal.client);
    };

    private async beginModal(submittedModal: Interaction): Promise<boolean> {
        if (
            submittedModal.isMessageComponent() &&
            submittedModal.customId.endsWith(this.firstInter.id + '|' + this.firstInter.user.id) ||
            BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(this.compInter.user.id)
        ) {
            this.endModalListener(submittedModal.client);
            return false;
        }

        // Updates the cooldown to interact again
        let canInteract = await CollectorUtils.canInteract(this.timerVars);
        if (!canInteract) return false;

        if (
            !submittedModal.isModalSubmit() || CollectorUtils.marketCollectors[submittedModal.user.id].ended ||
            !submittedModal.guild || submittedModal.customId !== this.modalShowing.data.custom_id
        ) {
            this.endModalListener(submittedModal.client);
            return false;
        }

        await submittedModal.deferUpdate();
        return true;
    }

    private endModalListener(client: Client) {
        clearInterval(this.timerVars.updateTime);
        if (this.curModalListener) {
            client.removeListener(Events.InteractionCreate, this.curModalListener);
            this.curModalListener = undefined;
        }
    }

    private async showMarket(firstRun: boolean = false) {
        if (firstRun) {
            this.initButtons();
        }

        this.disableButtons();

        const nums = this.config.numberConfig;

        let rowsToAdd: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

        if (this.userBuyOrders.concat(this.userSellOrders).length === 0 && this.curView === View.UserOrders) {
            this.curView = View.Overview;
        }

        this.baseRows[0].components[0].setDisabled(this.curPage === 0);
        this.baseRows[0].components[1].setDisabled(
            this.curView === View.Overview && this.maxPageOverview === 0 ||
            this.curView === View.BuySell && this.pricingData.length-1 === 0 ||
            this.curView === View.UserOrders && this.userBuyOrders.concat(this.userSellOrders).length-1 === 0
        );
        this.baseRows[0].components[2].setDisabled(
            this.curView === View.Overview && this.curPage === this.maxPageOverview ||
            this.curView === View.BuySell && this.curPage === this.pricingData.length-1 ||
            this.curView === View.UserOrders && this.curPage === this.userBuyOrders.concat(this.userSellOrders).length-1
        );
        this.baseRows[0].components[3].setDisabled(false);

        this.baseRows[1].components[0].setDisabled(this.curView === View.Overview);
        this.baseRows[1].components[1].setDisabled(this.curView === View.BuySell);
        this.baseRows[1].components[2].setDisabled(
            this.curView === View.UserOrders || this.userBuyOrders.concat(this.userSellOrders).length === 0
        );

        if (this.curView === View.BuySell) {
            const item = this.pricingData[this.curPage];
            const itemRarity = BoarUtils.findRarity(item.id, this.config);
            const isSpecial = itemRarity[0] !== 0
                ? itemRarity[1].name === 'Special'
                : false;

            rowsToAdd.push(this.optionalRows[0]);
            rowsToAdd.push(this.optionalRows[1]);

            let nonFilledBuys = 0;
            let nonFilledSells = 0;

            for (const instaBuy of item.instaBuys) {
                if (instaBuy.num !== instaBuy.filledAmount && instaBuy.listTime + nums.orderExpire >= Date.now()) {
                    nonFilledBuys++;
                }
            }

            for (const instaSell of item.instaSells) {
                if (instaSell.num !== instaSell.filledAmount && instaSell.listTime + nums.orderExpire >= Date.now()) {
                    nonFilledSells++;
                }
            }

            this.optionalRows[0].components[0].setDisabled(nonFilledBuys === 0);
            this.optionalRows[0].components[1].setDisabled(nonFilledSells === 0);
            this.optionalRows[1].components[0].setDisabled(false);
            this.optionalRows[1].components[1].setDisabled(false);

            if (isSpecial) {
                let selectOptions: SelectMenuComponentOptionData[] = [];
                const instaBuyEditions: number[] = [];
                const instaSellEditions: number[] = [];

                for (const instaBuy of item.instaBuys) {
                    if (instaBuy.num === instaBuy.filledAmount || instaBuy.listTime + nums.orderExpire < Date.now())
                        continue;

                    const editionNum: number = instaBuy.editions[0];

                    if (!instaBuyEditions.includes(editionNum)) {
                        selectOptions.push({
                            label: 'Edition #' + editionNum,
                            value: editionNum.toString()
                        });
                    }

                    instaBuyEditions.push(editionNum);
                }

                for (const instaSell of item.instaSells) {
                    if (instaSell.num === instaSell.filledAmount || instaSell.listTime + nums.orderExpire < Date.now())
                        continue;

                    const editionNum: number = instaSell.editions[0];

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
                    this.optionalRows[2].components[0].setDisabled(false);
                    if (this.curEdition === 0 && instaBuyEditions.length > 0) {
                        this.curEdition = instaBuyEditions[0];
                    } else if (this.curEdition === 0) {
                        this.curEdition = instaSellEditions[0];
                    }
                }

                selectOptions = selectOptions.slice(0, 25);

                (this.optionalRows[2].components[0] as StringSelectMenuBuilder).setOptions(selectOptions);
                this.optionalRows[0].components[0].setDisabled(!instaBuyEditions.includes(this.curEdition));
                this.optionalRows[0].components[1].setDisabled(!instaSellEditions.includes(this.curEdition));
                rowsToAdd.push(this.optionalRows[2]);
            }
        }

        if (this.curView === View.UserOrders) {
            const selectOptions: SelectMenuComponentOptionData[] = [];

            for (let i=0; i<this.userBuyOrders.length; i++) {
                const buyOrder = this.userBuyOrders[i];
                const rarity = BoarUtils.findRarity(buyOrder.id, this.config);
                const isSpecial = rarity[1].name === 'Special' && rarity[0] !== 0;

                const itemName = this.config.itemConfigs[buyOrder.type][buyOrder.id].name + (isSpecial
                    ? ' #' + buyOrder.data.editions[0]
                    : '');

                selectOptions.push({
                    label: 'BUY: ' + itemName + ' [$' + buyOrder.data.price.toLocaleString() + ']',
                    value: i.toString()
                });
            }

            for (let i=this.userBuyOrders.length; i<this.userBuyOrders.length + this.userSellOrders.length; i++) {
                const sellOrder = this.userSellOrders[i-this.userBuyOrders.length];
                const rarity = BoarUtils.findRarity(sellOrder.id, this.config);
                const isSpecial = rarity[1].name === 'Special' && rarity[0] !== 0;

                const itemName = this.config.itemConfigs[sellOrder.type][sellOrder.id].name + (isSpecial
                    ? ' #' + sellOrder.data.editions[0]
                    : '');

                selectOptions.push({
                    label: 'SELL: ' + itemName + ' [$' + sellOrder.data.price.toLocaleString() + ']',
                    value: i.toString()
                });
            }

            if (selectOptions.length === 0) {
                selectOptions.push({
                    label: this.config.stringConfig.emptySelect,
                    value: this.config.stringConfig.emptySelect
                });
            } else {
                this.optionalRows[4].components[0].setDisabled(false);
            }

            (this.optionalRows[4].components[0] as StringSelectMenuBuilder).setOptions(selectOptions);

            let orderInfo: {data: BuySellData, id: string, type: string};

            if (this.curPage < this.userBuyOrders.length) {
                orderInfo = this.userBuyOrders[this.curPage];
            } else {
                orderInfo = this.userSellOrders[this.curPage - this.userBuyOrders.length];
            }

            this.optionalRows[3].components[0].setDisabled(
                orderInfo.data.claimedAmount === orderInfo.data.filledAmount
            );
            this.optionalRows[3].components[1].setDisabled(
                orderInfo.data.filledAmount === orderInfo.data.num ||
                orderInfo.data.claimedAmount !== orderInfo.data.filledAmount
            );
            this.optionalRows[3].components[2].setDisabled(
                orderInfo.data.filledAmount === orderInfo.data.num ||
                orderInfo.data.claimedAmount !== orderInfo.data.filledAmount
            );

            rowsToAdd.push(this.optionalRows[3]);
            rowsToAdd.push(this.optionalRows[4]);
        }

        let imageToSend: AttachmentBuilder;

        if (this.curView === View.Overview) {
            imageToSend = await this.imageGen.makeOverviewImage(this.curPage);
        } else if (this.curView === View.BuySell) {
            imageToSend = await this.imageGen.makeBuySellImage(this.curPage ,this.curEdition);
        } else {
            imageToSend = await this.imageGen.makeOrdersImage(this.curPage);
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

    private undoRedButtons(): boolean {
        let fixedRed = false;

        if (
            (this.optionalRows[0].components[0] as ButtonBuilder).data.style === 4 ||
            (this.optionalRows[0].components[1] as ButtonBuilder).data.style === 4 ||
            (this.optionalRows[1].components[0] as ButtonBuilder).data.style === 4 ||
            (this.optionalRows[1].components[1] as ButtonBuilder).data.style === 4 ||
            (this.optionalRows[3].components[1] as ButtonBuilder).data.style === 4
        ) {
            fixedRed = true;
        }

        (this.optionalRows[0].components[0] as ButtonBuilder).setStyle(3);
        (this.optionalRows[0].components[1] as ButtonBuilder).setStyle(3);
        (this.optionalRows[1].components[0] as ButtonBuilder).setStyle(3);
        (this.optionalRows[1].components[1] as ButtonBuilder).setStyle(3);
        (this.optionalRows[3].components[1] as ButtonBuilder).setStyle(3);

        return fixedRed;
    }

    private initButtons() {
        const marketFieldConfigs: RowConfig[][] = this.config.commandConfigs.boar.market.componentFields;

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

    private setPage(pageVal: number): void {
        if (this.curView === View.Overview) {
            this.curPage = Math.max(Math.min(pageVal-1, this.maxPageOverview), 0);
        } else if (this.curView === View.BuySell) {
            this.curPage = Math.max(Math.min(pageVal-1, this.pricingData.length-1), 0);
        } else {
            this.curPage = Math.max(Math.min(pageVal-1, this.userBuyOrders.concat(this.userSellOrders).length-1), 0);
        }
    }
}