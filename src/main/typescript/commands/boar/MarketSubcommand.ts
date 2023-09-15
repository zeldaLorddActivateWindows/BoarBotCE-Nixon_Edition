import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction, Client,
    Events,
    Interaction, InteractionCollector,
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
import {MarketImageGenerator} from '../../util/generators/MarketImageGenerator';
import {BoarUser} from '../../util/boar/BoarUser';
import {ModalConfig} from '../../bot/config/modals/ModalConfig';
import {BoarUtils} from '../../util/boar/BoarUtils';
import {Queue} from '../../util/interactions/Queue';
import {CollectedBoar} from '../../util/data/userdata/collectibles/CollectedBoar';
import {StringConfig} from '../../bot/config/StringConfig';
import {ColorConfig} from '../../bot/config/ColorConfig';
import {NumberConfig} from '../../bot/config/NumberConfig';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import {ItemData} from '../../util/data/global/ItemData';
import {ItemsData} from '../../util/data/global/ItemsData';
import {BoardData} from '../../util/data/global/BoardData';
import {QuestData} from '../../util/data/global/QuestData';

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
    private pricingData: {
        id: string,
        type: string,
        buyers: BuySellData[],
        sellers: BuySellData[],
        lastBuys: [number, number, string],
        lastSells: [number, number, string]
    }[] = [];
    private pricingDataSearchArr: [string, number][] = [];
    private boarUser: BoarUser = {} as BoarUser;
    private userBuyOrders: {
        data: BuySellData,
        id: string,
        type: string,
        lastBuys: [number, number, string],
        lastSells: [number, number, string]
    }[] = [];
    private userSellOrders: {
        data: BuySellData,
        id: string,
        type: string,
        lastBuys: [number, number, string],
        lastSells: [number, number, string]
    }[] = [];
    private curView: View = View.Overview;
    private curPage = 0;
    private curEdition = 0;
    private modalData: [number, number, number] = [0, 0, 0];
    private maxPageOverview = 0;
    private baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private optionalRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };
    private modalShowing: ModalBuilder = {} as ModalBuilder;
    private curModalListener: ((submittedModal: Interaction) => Promise<void>) | undefined;
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> = 
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
    private hasStopped = false;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildData: GuildData | undefined = await InteractionUtils.handleStart(interaction, this.config);
        if (!guildData) return;

        await interaction.deferReply({ ephemeral: true });

        const isBanned = await InteractionUtils.handleBanned(interaction, this.config);
        if (isBanned) return;

        if (!this.config.marketOpen && !this.config.devs.includes(interaction.user.id)) {
            await Replies.handleReply(
                interaction, this.config.stringConfig.marketClosed, this.config.colorConfig.error
            );
            return;
        }

        if (interaction.user.createdTimestamp > Date.now() + this.config.numberConfig.oneDay * 30) {
            await Replies.handleReply(
                interaction, this.config.stringConfig.marketTooYoung, this.config.colorConfig.error
            );
            return;
        }

        this.firstInter = interaction;

        // View to start out in
        this.curView = interaction.options.getInteger(this.subcommandInfo.args[0].name)
            ?? View.Overview;

        // Page to start out on
        const pageInput: string = interaction.options.getString(this.subcommandInfo.args[1].name)?.toLowerCase()
            .replace(/\s+/g, '') ?? '1';

        await this.getPricingData();
        this.boarUser = new BoarUser(interaction.user);

        // Only allow orders to be viewed if there's something to show
        if (this.curView === View.UserOrders && this.userBuyOrders.concat(this.userSellOrders).length === 0) {
            this.curView = View.Overview;
        }

        this.maxPageOverview = Math.ceil(this.pricingData.length / this.config.numberConfig.marketPerPage) - 1;

        let pageVal = 1;
        if (!Number.isNaN(parseInt(pageInput))) {
            pageVal = parseInt(pageInput);
        } else if (this.curView === View.Overview) {
            const overviewSearchArr = this.pricingDataSearchArr.map(val =>
                [val[0], Math.ceil(val[1] / this.config.numberConfig.marketPerPage)] as [string, number]
            );
            pageVal = BoarUtils.getClosestName(pageInput.toLowerCase().replace(/\s+/g, ''), overviewSearchArr);
        } else if (this.curView === View.BuySell) {
            pageVal = BoarUtils.getClosestName(pageInput.toLowerCase().replace(/\s+/g, ''), this.pricingDataSearchArr);
        }

        this.setPage(pageVal);

        if (CollectorUtils.marketCollectors[interaction.user.id]) {
            const oldCollector = CollectorUtils.marketCollectors[interaction.user.id];
            setTimeout(() => { oldCollector.stop(CollectorUtils.Reasons.Expired) }, 1000);
        }

        this.collector = CollectorUtils.marketCollectors[interaction.user.id] = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        this.collector.on('collect', async (inter: ButtonInteraction | StringSelectMenuInteraction) =>
            await this.handleCollect(inter)
        );
        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));

        this.imageGen = new MarketImageGenerator(
            this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
        );
        await this.showMarket(true);
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

            LogDebug.log(
                `${inter.customId.split('|')[0]} on page ${this.curPage} in view ${this.curView}`,
                this.config, this.firstInter
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

            const isPageInput: boolean = inter.customId.startsWith(marketComponents.inputPage.customId);
            const isInstaBuy: boolean = inter.customId.startsWith(marketComponents.instaBuy.customId);
            const isInstaSell: boolean = inter.customId.startsWith(marketComponents.instaSell.customId);
            const isBuyOrder: boolean = inter.customId.startsWith(marketComponents.buyOrder.customId);
            const isSellOrder: boolean = inter.customId.startsWith(marketComponents.sellOrder.customId);
            const isUpdate: boolean = inter.customId.startsWith(marketComponents.updateOrder.customId);

            // User wants to input a page manually
            if (isPageInput) {
                await this.modalHandle(inter);

                if (this.undoRedButtons()) {
                    this.showMarket();
                }

                this.curEdition = 0;

                clearInterval(this.timerVars.updateTime);
                return;
            }

            let showModal = true;

            // User wants to insta buy or sell
            if (isInstaBuy || isInstaSell) {
                await Queue.addQueue(async () => {
                    showModal = await this.canInstaModal(inter, isInstaBuy, isInstaSell);
                }, inter.id + this.boarUser.user.id).catch((err) => { throw err });

                if (showModal) {
                    await this.modalHandle(inter);
                }

                clearInterval(this.timerVars.updateTime);
                return;
            }

            // User wants to buy order or sell offer
            if (isBuyOrder || isSellOrder) {
                await Queue.addQueue(async () => {
                    showModal = await this.canOrderModal(inter, isBuyOrder, isSellOrder);
                }, inter.id + inter.user.id).catch((err) => { throw err });

                if (showModal) {
                    await this.modalHandle(inter);
                }

                clearInterval(this.timerVars.updateTime);
                return;
            }

            // User wants to update order
            if (isUpdate) {
                await Queue.addQueue(async () => {
                    showModal = await this.canUpdateModal(inter);
                }, inter.id + inter.user.id).catch((err) => { throw err });

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

                // User wants to refresh the market data
                case marketComponents.refresh.customId:
                    await this.getPricingData();
                    this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);
                    this.boarUser.refreshUserData();
                    this.curEdition = 0;
                    break;

                // User wants see an overview of prices
                case marketComponents.overviewView.customId:
                    this.curView = View.Overview;
                    this.curPage = 0;
                    this.curEdition = 0;
                    break;

                // User wants to see more specific pricing information of an item
                case marketComponents.buySellView.customId:
                    this.curView = View.BuySell;
                    this.curPage = 0;
                    this.curEdition = 0;
                    break;

                // User wants to manage or view their orders
                case marketComponents.ordersView.customId:
                    this.curView = View.UserOrders;
                    this.curPage = 0;
                    this.curEdition = 0;
                    break;

                // User wants to change what edition to look at
                case marketComponents.editionSelect.customId:
                    this.curEdition = Number.parseInt((inter as StringSelectMenuInteraction).values[0]);
                    break;

                // User wants to claim an order
                case marketComponents.claimOrder.customId:
                    await this.doClaim();
                    break;

                // User wants to cancel an order
                case marketComponents.cancelOrder.customId:
                    await this.doCancel();
                    break;

                // User wants to choose a specific order
                case marketComponents.selectOrder.customId:
                    this.curPage = Number.parseInt((inter as StringSelectMenuInteraction).values[0]);
                    break;
            }

            this.undoRedButtons();

            this.modalData = [0, 0, 0];
            await this.showMarket();
        } catch (err: unknown) {
            const canStop: boolean = await LogDebug.handleError(err, inter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        clearInterval(this.timerVars.updateTime);
    }

    /**
     * Attempts to claim the filled items in an order
     *
     * @private
     */
    private async doClaim(): Promise<void> {
        let orderInfo: {data: BuySellData, id: string, type: string};
        let isSell = false;
        let numToClaim = 0;

        const strConfig: StringConfig = this.config.stringConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        if (this.curPage < this.userBuyOrders.length) {
            orderInfo = this.userBuyOrders[this.curPage];
        } else {
            isSell = true;
            orderInfo = this.userSellOrders[this.curPage - this.userBuyOrders.length];
        }

        let foundOrder = false;

        await Queue.addQueue(async () => {
            try {
                const itemsData: ItemsData =
                    DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;

                const buyOrders: BuySellData[] = itemsData[orderInfo.type][orderInfo.id].buyers;
                const sellOrders: BuySellData[] = itemsData[orderInfo.type][orderInfo.id].sellers;

                // Tries to find order in buy orders
                for (let i=0; i<buyOrders.length && !isSell; i++) {
                    const buyOrder: BuySellData = buyOrders[i];
                    const isSameOrder: boolean = buyOrder.userID === orderInfo.data.userID &&
                        buyOrder.listTime === orderInfo.data.listTime;

                    if (isSameOrder) {
                        foundOrder = true;

                        numToClaim = await this.returnOrderToUser(orderInfo, isSell, true);

                        if (
                            orderInfo.data.num === orderInfo.data.filledAmount &&
                            orderInfo.data.filledAmount === orderInfo.data.claimedAmount + numToClaim
                        ) {
                            itemsData[orderInfo.type][orderInfo.id].buyers.splice(i, 1);
                            break;
                        }

                        itemsData[orderInfo.type][orderInfo.id].buyers[i].editions.splice(0, numToClaim);
                        itemsData[orderInfo.type][orderInfo.id].buyers[i].editionDates.splice(0, numToClaim);
                        itemsData[orderInfo.type][orderInfo.id].buyers[i].claimedAmount += numToClaim;
                        break;
                    }
                }

                // Tries to find order in sell orders
                for (let i=0; i<sellOrders.length && isSell; i++) {
                    const sellOrder: BuySellData = sellOrders[i];
                    const isSameOrder: boolean = sellOrder.userID === orderInfo.data.userID &&
                        sellOrder.listTime === orderInfo.data.listTime;

                    if (isSameOrder) {
                        foundOrder = true;

                        numToClaim = await this.returnOrderToUser(orderInfo, isSell, true);

                        if (
                            orderInfo.data.num === orderInfo.data.filledAmount &&
                            orderInfo.data.filledAmount === orderInfo.data.claimedAmount + numToClaim
                        ) {
                            itemsData[orderInfo.type][orderInfo.id].sellers.splice(i, 1);
                            break;
                        }

                        itemsData[orderInfo.type][orderInfo.id].sellers[i].claimedAmount += numToClaim;
                        break;
                    }
                }

                DataHandlers.saveGlobalData(itemsData, DataHandlers.GlobalFile.Items);
                await this.getPricingData();
                this.imageGen.updateInfo(
                    this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                );
            } catch (err: unknown) {
                await LogDebug.handleError(err, this.compInter);
            }
        }, this.compInter.id + 'global').catch((err) => { throw err });

        if (!foundOrder) return;

        if (numToClaim > 0) {
            await Queue.addQueue(
                async () => DataHandlers.updateLeaderboardData(this.boarUser, this.config, this.compInter),
                this.compInter.id + this.boarUser.user.id + 'global'
            ).catch((err) => { throw err });

            await Replies.handleReply(
                this.compInter, strConfig.marketClaimComplete, colorConfig.green, undefined, undefined, true
            );
            this.curPage = orderInfo.data.num === orderInfo.data.claimedAmount + numToClaim ? 0 : this.curPage;
        } else {
            await Replies.handleReply(
                this.compInter, strConfig.marketMaxItems, colorConfig.error, undefined, undefined, true
            );
        }
    }

    /**
     * Attempts to cancel an order and return all items back to user
     *
     * @private
     */
    private async doCancel(): Promise<void> {
        let orderInfo: {data: BuySellData, id: string, type: string};
        let isSell = false;
        let canCancel = true;

        const strConfig: StringConfig = this.config.stringConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        if (this.curPage < this.userBuyOrders.length) {
            orderInfo = this.userBuyOrders[this.curPage];
        } else {
            isSell = true;
            orderInfo = this.userSellOrders[this.curPage - this.userBuyOrders.length];
        }

        const itemRarity = BoarUtils.findRarity(orderInfo.id, this.config);
        const isSpecial = itemRarity[1].name === 'Special' && itemRarity[0] !== 0;

        await Queue.addQueue(async () => {
            try {
                const itemsData: ItemsData =
                    DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;

                const buyOrders: BuySellData[] = itemsData[orderInfo.type][orderInfo.id].buyers;
                const sellOrders: BuySellData[] = itemsData[orderInfo.type][orderInfo.id].sellers;

                for (let i=0; i<buyOrders.length && !isSell; i++) {
                    const buyOrder: BuySellData = buyOrders[i];
                    const orderPrice = itemsData[orderInfo.type][orderInfo.id].buyers[i].price;
                    const itemLastBuy = itemsData[orderInfo.type][orderInfo.id].lastBuys[0];
                    const isSameOrder: boolean = buyOrder.userID === orderInfo.data.userID &&
                        buyOrder.listTime === orderInfo.data.listTime;
                    canCancel = orderInfo.data.filledAmount === buyOrder.filledAmount;

                    if (isSameOrder && canCancel) {
                        const hasEnoughRoom: boolean =
                            (await this.returnOrderToUser(orderInfo, isSell, false)) > 0;

                        if (hasEnoughRoom) {
                            await Replies.handleReply(
                                this.compInter, strConfig.marketCancelComplete, colorConfig.green,
                                undefined, undefined, true
                            );

                            itemsData[orderInfo.type][orderInfo.id].buyers.splice(i, 1);

                            if (!isSpecial && orderPrice === itemLastBuy) {
                                itemsData[orderInfo.type][orderInfo.id].lastBuys[0] = 0;
                                itemsData[orderInfo.type][orderInfo.id].lastBuys[2] = '';
                                for (const possibleOrder of itemsData[orderInfo.type][orderInfo.id].buyers) {
                                    const isFilled = possibleOrder.num === possibleOrder.filledAmount;
                                    const isExpired = possibleOrder.listTime +
                                        this.config.numberConfig.orderExpire < Date.now();

                                    if (!isFilled && !isExpired) {
                                        itemsData[orderInfo.type][orderInfo.id].lastBuys[0] = possibleOrder.price;
                                        itemsData[orderInfo.type][orderInfo.id].lastBuys[2] = possibleOrder.userID;
                                        break;
                                    }
                                }
                            }

                            this.curPage = 0;
                        } else {
                            await Replies.handleReply(
                                this.compInter, strConfig.marketNoRoom, colorConfig.error, undefined, undefined, true
                            );
                        }

                        break;
                    } else if (isSameOrder) {
                        await Replies.handleReply(
                            this.compInter, strConfig.marketMustClaim, colorConfig.green, undefined, undefined, true
                        );
                        break;
                    }
                }

                for (let i=0; i<sellOrders.length && isSell; i++) {
                    const sellOrder: BuySellData = sellOrders[i];
                    const isSameOrder: boolean = sellOrder.userID === orderInfo.data.userID &&
                        sellOrder.listTime === orderInfo.data.listTime;
                    const orderPrice = itemsData[orderInfo.type][orderInfo.id].sellers[i].price;
                    const itemLastSell = itemsData[orderInfo.type][orderInfo.id].lastSells[0];
                    canCancel = orderInfo.data.filledAmount === sellOrder.filledAmount;

                    if (isSameOrder && canCancel) {
                        const hasEnoughRoom: boolean =
                            (await this.returnOrderToUser(orderInfo, isSell, false)) > 0;

                        if (hasEnoughRoom) {
                            await Replies.handleReply(
                                this.compInter, strConfig.marketCancelComplete,
                                colorConfig.green, undefined, undefined, true
                            );

                            itemsData[orderInfo.type][orderInfo.id].sellers.splice(i, 1);

                            if (!isSpecial && orderPrice === itemLastSell) {
                                itemsData[orderInfo.type][orderInfo.id].lastSells[0] = 0;
                                itemsData[orderInfo.type][orderInfo.id].lastSells[2] = '';
                                for (const possibleOrder of itemsData[orderInfo.type][orderInfo.id].sellers) {
                                    const isFilled = possibleOrder.num === possibleOrder.filledAmount;
                                    const isExpired = possibleOrder.listTime +
                                        this.config.numberConfig.orderExpire < Date.now();

                                    if (!isFilled && !isExpired) {
                                        itemsData[orderInfo.type][orderInfo.id].lastSells[0] = possibleOrder.price;
                                        itemsData[orderInfo.type][orderInfo.id].lastSells[2] = possibleOrder.userID;
                                        break;
                                    }
                                }
                            }

                            this.curPage = 0;
                        } else {
                            await Replies.handleReply(
                                this.compInter, strConfig.marketNoRoom, colorConfig.error, undefined, undefined, true
                            );
                        }

                        break;
                    } else if (isSameOrder) {
                        await Replies.handleReply(
                            this.compInter, strConfig.marketMustClaim, colorConfig.green, undefined, undefined, true
                        );
                        break;
                    }
                }

                DataHandlers.saveGlobalData(itemsData, DataHandlers.GlobalFile.Items);
                await this.getPricingData();
                this.imageGen.updateInfo(
                    this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                );
            } catch (err: unknown) {
                await LogDebug.handleError(err, this.compInter);
            }
        }, this.compInter.id + 'global').catch((err) => { throw err });

        await Queue.addQueue(
            async () => DataHandlers.updateLeaderboardData(this.boarUser, this.config, this.compInter),
            this.compInter.id + this.boarUser.user.id + 'global'
        ).catch((err) => { throw err });
    }

    /**
     * Gets the amount of an item/bucks to return to a user
     *
     * @param orderInfo - The order to examine for returns
     * @param isSell - Whether the order is for selling
     * @param isClaim - Whether the order is being claimed
     * @private
     */
    private async returnOrderToUser(
        orderInfo: {data: BuySellData, id: string, type: string}, isSell: boolean, isClaim: boolean
    ): Promise<number> {
        let numToReturn = 0;
        let hasEnoughRoom = true;

        const questData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Quest) as QuestData;

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

                if (!isSell && isClaim) {
                    const spendBucksIndex = questData.curQuestIDs.indexOf('spendBucks');
                    this.boarUser.stats.quests.progress[spendBucksIndex] += numToReturn * orderInfo.data.price;
                }

                if (!isSell && orderInfo.type === 'boars') {
                    const collectBoarIndex = questData.curQuestIDs.indexOf('collectBoar');

                    if (!this.boarUser.itemCollection.boars[orderInfo.id]) {
                        this.boarUser.itemCollection.boars[orderInfo.id] = new CollectedBoar;
                        this.boarUser.itemCollection.boars[orderInfo.id].firstObtained = Date.now();
                    }

                    if (isClaim) {
                        this.boarUser.itemCollection.boars[orderInfo.id].lastObtained = Date.now();
                        this.boarUser.stats.general.lastBoar = orderInfo.id;
                    }

                    this.boarUser.itemCollection.boars[orderInfo.id].editions =
                        this.boarUser.itemCollection.boars[orderInfo.id].editions.concat(
                            orderInfo.data.editions.slice(0, numToReturn)
                        ).sort((a, b) => a - b);
                    this.boarUser.itemCollection.boars[orderInfo.id].editionDates =
                        this.boarUser.itemCollection.boars[orderInfo.id].editionDates.concat(
                            orderInfo.data.editionDates.slice(0, numToReturn)
                        ).sort((a, b) => a - b);

                    this.boarUser.stats.general.totalBoars += numToReturn;
                    this.boarUser.itemCollection.boars[orderInfo.id].num += numToReturn;

                    if (
                        collectBoarIndex >= 0 && isClaim &&
                        Math.floor(collectBoarIndex / 2) === BoarUtils.findRarity(orderInfo.id, this.config)[0]
                    ) {
                        this.boarUser.stats.quests.progress[collectBoarIndex] += numToReturn;
                    }
                } else if (!isSell && orderInfo.type === 'powerups') {
                    const maxValue = orderInfo.id === 'enhancer'
                        ? this.config.numberConfig.maxEnhancers
                        : this.config.numberConfig.maxPowBase;

                    hasEnoughRoom = this.boarUser.itemCollection.powerups[orderInfo.id].numTotal + numToReturn <=
                        maxValue;

                    if (isClaim) {
                        numToReturn = Math.min(
                            numToReturn, maxValue - this.boarUser.itemCollection.powerups[orderInfo.id].numTotal
                        );
                    }

                    if (hasEnoughRoom || isClaim) {
                        this.boarUser.itemCollection.powerups[orderInfo.id].numTotal += numToReturn;
                    }
                } else if (isClaim) {
                    const collectBucksIndex = questData.curQuestIDs.indexOf('collectBucks');

                    this.boarUser.stats.quests.progress[collectBucksIndex] += numToReturn * orderInfo.data.price;
                    this.boarUser.stats.general.boarScore += numToReturn * orderInfo.data.price;
                }

                await this.boarUser.orderBoars(this.compInter, this.config);
                this.boarUser.updateUserData();
            } catch (err: unknown) {
                await LogDebug.handleError(err, this.compInter);
            }
        }, this.compInter.id + this.compInter.user.id).catch((err) => { throw err });

        return !hasEnoughRoom && !isClaim ? 0 : numToReturn;
    }

    /**
     * Handles all logic for Buy Now and Sell Now button pressing.
     * Returns whether to show a modal
     *
     * @param inter - The interaction to reply to
     * @param isInstaBuy - If buying now
     * @param isInstaSell - If selling now
     * @private
     */
    private async canInstaModal(
        inter: MessageComponentInteraction, isInstaBuy: boolean, isInstaSell: boolean
    ): Promise<boolean> {
        try {
            this.boarUser.refreshUserData();
            let itemData: {
                id: string,
                type: string,
                buyers: BuySellData[],
                sellers: BuySellData[],
                lastBuys: [number, number, string],
                lastSells: [number, number, string]
            } = this.pricingData[this.curPage];
            let showModal = true;
            let undoRed = true;

            const strConfig: StringConfig = this.config.stringConfig;
            const nums: NumberConfig = this.config.numberConfig;
            const colorConfig: ColorConfig = this.config.colorConfig;

            const questData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Quest) as QuestData;

            let specialSellOrder: BuySellData | undefined;
            const itemRarity: [number, RarityConfig] = BoarUtils.findRarity(itemData.id, this.config);
            const isSpecial: boolean = itemRarity[1].name === 'Special' && itemRarity[0] !== 0;

            if (isInstaBuy && isSpecial) {
                for (const sellOrder of itemData.sellers) {
                    const noEditionExists: boolean = sellOrder.num === sellOrder.filledAmount ||
                        sellOrder.listTime + nums.orderExpire < Date.now() ||
                        sellOrder.editions[0] !== this.curEdition;

                    if (noEditionExists) continue;

                    specialSellOrder = sellOrder;
                    break;
                }
            }

            const noEditionBucks: boolean | undefined = isInstaBuy && this.curEdition > 0 && specialSellOrder &&
                this.boarUser.stats.general.boarScore < specialSellOrder.price;
            const noItemBucks: boolean =
                isInstaBuy && this.boarUser.stats.general.boarScore < itemData.sellers[0].price;

            const noHaveEdition: boolean = isInstaSell && this.curEdition > 0 &&
                this.boarUser.itemCollection.boars[itemData.id] &&
                !this.boarUser.itemCollection.boars[itemData.id].editions.includes(this.curEdition);

            const noHaveItems: boolean = isInstaSell && (itemData.type === 'boars' &&
                !this.boarUser.itemCollection.boars[itemData.id] ||
                itemData.type === 'powerups' && !this.boarUser.itemCollection.powerups[itemData.id]);

            const completeBuy: boolean =
                isInstaBuy && (this.optionalRows[0].components[0] as ButtonBuilder).data.style === 4;
            const completeSell: boolean =
                isInstaSell && (this.optionalRows[0].components[1] as ButtonBuilder).data.style === 4;

            if (noEditionBucks || noItemBucks) {
                await inter.deferUpdate();
                showModal = false;
                await Replies.handleReply(
                    inter, strConfig.marketNoBucks, colorConfig.error, undefined, undefined, true
                );
            } else if (noHaveEdition) {
                await inter.deferUpdate();
                showModal = false;
                await Replies.handleReply(
                    inter, strConfig.marketNoEdition, colorConfig.error, undefined, undefined, true
                );
            } else if (noHaveItems) {
                await inter.deferUpdate();
                showModal = false;
                await Replies.handleReply(
                    inter, strConfig.marketNoItems, colorConfig.error, undefined, undefined, true
                );
            } else if (completeBuy) {
                await inter.deferUpdate();
                showModal = false;

                let prices = '';
                let userIDs = '';

                if (
                    itemData.id === 'enhancer' &&
                    this.modalData[0] + this.boarUser.itemCollection.powerups.enhancer.numTotal > nums.maxEnhancers
                ) {
                    await Replies.handleReply(
                        inter, strConfig.marketNoRoom, colorConfig.error, undefined, undefined, true
                    );
                } else if (this.boarUser.stats.general.boarScore >= this.modalData[1]) {
                    let failedBuy = false;
                    const orderFillAmounts: number[] = [];
                    let editionOrderIndex = -1;

                    await Queue.addQueue(async () => {
                        try {
                            const itemsData: ItemsData = 
                                DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;
                            const newItemData: ItemData = itemsData[itemData.type][itemData.id];

                            let curPrice = 0;

                            if (this.curEdition === 0) {
                                let numGrabbed = 0;
                                let curIndex = 0;
                                while (numGrabbed < this.modalData[0]) {
                                    if (curIndex >= newItemData.sellers.length) break;

                                    let numToAdd = 0;
                                    numToAdd = Math.min(
                                        this.modalData[0] - numGrabbed,
                                        newItemData.sellers[curIndex].listTime + nums.orderExpire < Date.now()
                                            ? 0
                                            : newItemData.sellers[curIndex].num -
                                                newItemData.sellers[curIndex].filledAmount
                                    );
                                    curPrice += newItemData.sellers[curIndex].price * numToAdd;

                                    if (
                                        newItemData.sellers[curIndex].filledAmount !== newItemData.sellers[curIndex].num
                                    ) {
                                        prices += '$' + newItemData.sellers[curIndex].price + ' ';
                                        userIDs += newItemData.sellers[curIndex].userID + ' ';
                                    }

                                    numGrabbed += numToAdd;
                                    orderFillAmounts.push(numToAdd);
                                    curIndex++;
                                }

                                if (this.modalData[0] !== numGrabbed) {
                                    await Replies.handleReply(
                                        inter, strConfig.marketNoOrders, colorConfig.error, undefined, undefined, true
                                    );

                                    failedBuy = true;
                                    return;
                                }
                            } else {
                                for (const instaBuy of newItemData.sellers) {
                                    const noEditionExists: boolean = instaBuy.num === instaBuy.filledAmount ||
                                        instaBuy.listTime + nums.orderExpire < Date.now() ||
                                        instaBuy.editions[0] !== this.curEdition;

                                    editionOrderIndex++;

                                    if (noEditionExists) continue;

                                    curPrice = instaBuy.price;
                                    break;
                                }

                                if (curPrice === 0) {
                                    await Replies.handleReply(
                                        inter, strConfig.marketNoEditionOrders,
                                        colorConfig.error, undefined, undefined, true
                                    );

                                    failedBuy = true;
                                    return;
                                }
                            }

                            if (this.modalData[1] < curPrice) {
                                await Replies.handleReply(
                                    inter, strConfig.marketUpdatedInstaBuy.replace('%@', curPrice.toLocaleString()),
                                    colorConfig.error, undefined, undefined, true
                                );

                                this.modalData[1] = curPrice;
                                undoRed = false;
                                failedBuy = true;
                                return;
                            }

                            for (let i=0; i<orderFillAmounts.length; i++) {
                                newItemData.sellers[i].filledAmount += orderFillAmounts[i];
                                if (i === orderFillAmounts.length-1) {
                                    newItemData.lastSells[1] = newItemData.sellers[i].price;
                                }
                            }

                            if (editionOrderIndex >= 0) {
                                newItemData.sellers[editionOrderIndex].filledAmount = 1;
                            }

                            if (!isSpecial) {
                                itemsData[itemData.type][itemData.id].lastSells[0] = 0;
                                itemsData[itemData.type][itemData.id].lastSells[2] = '';
                                for (const possibleOrder of itemsData[itemData.type][itemData.id].sellers) {
                                    const isFilled = possibleOrder.num === possibleOrder.filledAmount;
                                    const isExpired = possibleOrder.listTime +
                                        this.config.numberConfig.orderExpire < Date.now();

                                    if (!isFilled && !isExpired) {
                                        itemsData[itemData.type][itemData.id].lastSells[0] =
                                            possibleOrder.price;
                                        itemsData[itemData.type][itemData.id].lastSells[2] =
                                            possibleOrder.userID;
                                        break;
                                    }
                                }
                            }

                            DataHandlers.saveGlobalData(itemsData, DataHandlers.GlobalFile.Items);
                            await this.getPricingData();
                            this.imageGen.updateInfo(
                                this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                            );
                        } catch (err: unknown) {
                            failedBuy = true;
                            await LogDebug.handleError(err, inter);
                        }
                    }, inter.id + 'global').catch((err) => { throw err });

                    if (!failedBuy && itemData.type === 'boars') {
                        const collectBoarIndex = questData.curQuestIDs.indexOf('collectBoar');

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
                                if (itemData.sellers[i].editions.length === 0) continue;

                                this.boarUser.itemCollection.boars[itemData.id].editions =
                                    this.boarUser.itemCollection.boars[itemData.id].editions.concat(
                                        itemData.sellers[i].editions.slice(0, orderFillAmounts[i])
                                    ).sort((a,b) => a - b);

                                this.boarUser.itemCollection.boars[itemData.id].editionDates =
                                    this.boarUser.itemCollection.boars[itemData.id].editionDates.concat(
                                        itemData.sellers[i].editionDates.slice(0, orderFillAmounts[i])
                                    ).sort((a,b) => a - b);
                            }
                        } else {
                            let specialSellOrder: BuySellData | undefined;

                            for (const sellOrder of itemData.sellers) {
                                if (sellOrder.editions[0] !== this.curEdition) continue;
                                specialSellOrder = sellOrder;
                            }

                            this.boarUser.itemCollection.boars[itemData.id].editions =
                                this.boarUser.itemCollection.boars[itemData.id].editions.concat([this.curEdition])
                                    .sort((a,b) => a - b);

                            if (specialSellOrder) {
                                this.boarUser.itemCollection.boars[itemData.id].editionDates =
                                    this.boarUser.itemCollection.boars[itemData.id].editionDates.concat(
                                        specialSellOrder.editionDates
                                    ).sort((a,b) => a - b);
                            }

                            this.curEdition = 0;
                        }

                        if (
                            collectBoarIndex >= 0 &&
                            Math.floor(collectBoarIndex / 2) === BoarUtils.findRarity(itemData.id, this.config)[0]
                        ) {
                            this.boarUser.stats.quests.progress[collectBoarIndex] += this.modalData[0];
                        }
                    } else if (!failedBuy && itemData.type === 'powerups') {
                        this.boarUser.itemCollection.powerups[itemData.id].numTotal += this.modalData[0];
                    }

                    if (!failedBuy) {
                        const spendBucksIndex = questData.curQuestIDs.indexOf('spendBucks');

                        LogDebug.log(
                            `Bought ${this.modalData[0]} of ${itemData.id} for ${prices.trim()} from ${userIDs.trim()}`,
                            this.config, inter, true
                        );

                        this.boarUser.stats.general.boarScore -= this.modalData[1];

                        this.boarUser.stats.quests.progress[spendBucksIndex] += this.modalData[1];

                        await this.boarUser.orderBoars(this.compInter, this.config);
                        this.boarUser.updateUserData();

                        await Queue.addQueue(
                            async () => DataHandlers.updateLeaderboardData(this.boarUser, this.config, inter),
                            inter.id + this.boarUser.user.id + 'global'
                        ).catch((err) => { throw err });

                        await Replies.handleReply(
                            inter, strConfig.marketInstaComplete, colorConfig.green, undefined, undefined, true
                        );
                    }
                } else {
                    await Replies.handleReply(
                        inter, strConfig.marketNoBucks, colorConfig.error, undefined, undefined, true
                    );
                }
            } else if (completeSell) {
                await inter.deferUpdate();
                showModal = false;

                let prices = '';
                let userIDs = '';

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
                    let editionOrderIndex = -1;

                    await Queue.addQueue(async () => {
                        try {
                            const itemsData: ItemsData =
                                DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;
                            const newItemData: ItemData = itemsData[itemData.type][itemData.id];

                            let curPrice = 0;

                            if (this.curEdition === 0) {
                                let numGrabbed = 0;
                                let curIndex = 0;
                                while (numGrabbed < this.modalData[0]) {
                                    if (curIndex >= newItemData.buyers.length) break;

                                    let numToAdd = 0;
                                    numToAdd = Math.min(
                                        this.modalData[0] - numGrabbed,
                                        newItemData.buyers[curIndex].listTime + nums.orderExpire < Date.now()
                                            ? 0
                                            : newItemData.buyers[curIndex].num -
                                                newItemData.buyers[curIndex].filledAmount
                                    );
                                    curPrice += newItemData.buyers[curIndex].price * numToAdd;

                                    if (
                                        newItemData.buyers[curIndex].filledAmount !== newItemData.buyers[curIndex].num
                                    ) {
                                        prices += '$' + newItemData.buyers[curIndex].price + ' ';
                                        userIDs += newItemData.buyers[curIndex].userID + ' ';
                                    }

                                    numGrabbed += numToAdd;
                                    orderFillAmounts.push(numToAdd);
                                    curIndex++;
                                }

                                if (this.modalData[0] !== numGrabbed) {
                                    await Replies.handleReply(
                                        inter, strConfig.marketNoOrders, colorConfig.error, undefined, undefined, true
                                    );

                                    failedSale = true;
                                    return;
                                }
                            } else {
                                for (const instaSell of newItemData.buyers) {
                                    const noEditionExists: boolean = instaSell.num === instaSell.filledAmount ||
                                        instaSell.listTime + nums.orderExpire < Date.now() ||
                                        instaSell.editions[0] !== this.curEdition;

                                    editionOrderIndex++;

                                    if (noEditionExists) continue;

                                    prices += '$' + instaSell.price;
                                    userIDs += instaSell.userID;

                                    curPrice = instaSell.price;
                                    break;
                                }

                                if (curPrice === 0) {
                                    await Replies.handleReply(
                                        inter, strConfig.marketNoEditionOrders,
                                        colorConfig.error, undefined, undefined, true
                                    );

                                    failedSale = true;
                                    return;
                                }
                            }

                            if (this.modalData[1] > curPrice) {
                                await Replies.handleReply(
                                    inter, strConfig.marketUpdatedInstaSell.replace('%@', curPrice.toLocaleString()),
                                    colorConfig.error, undefined, undefined, true
                                );

                                this.modalData[1] = curPrice;
                                undoRed = false;
                                failedSale = true;
                                return;
                            }

                            for (let i=0; i<orderFillAmounts.length; i++) {
                                if (itemData.type === 'boars') {
                                    const editionIndex: number = this.boarUser.itemCollection.boars[itemData.id]
                                        .editions.length - orderFillAmounts[i];
                                    const editionLength: number = this.boarUser.itemCollection.boars[itemData.id]
                                        .editions.length;

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
                                }

                                newItemData.buyers[i].filledAmount += orderFillAmounts[i];

                                if (i === orderFillAmounts.length-1) {
                                    newItemData.lastBuys[1] = newItemData.buyers[i].price;
                                }
                            }

                            if (editionOrderIndex >= 0) {
                                const editionIndex: number = this.boarUser.itemCollection.boars[itemData.id].editions
                                    .indexOf(this.curEdition);

                                this.boarUser.itemCollection.boars[itemData.id].editions.splice(editionIndex, 1);

                                newItemData.buyers[editionOrderIndex].editionDates =
                                    newItemData.buyers[editionOrderIndex].editionDates.concat(
                                        this.boarUser.itemCollection.boars[itemData.id].editionDates.splice(
                                            editionIndex, 1
                                        )
                                    ).sort((a, b) => a - b);

                                newItemData.buyers[editionOrderIndex].filledAmount = 1;

                                this.curEdition = 0;
                            }

                            if (!isSpecial) {
                                itemsData[itemData.type][itemData.id].lastBuys[0] = 0;
                                itemsData[itemData.type][itemData.id].lastBuys[2] = '';
                                for (const possibleOrder of itemsData[itemData.type][itemData.id].buyers) {
                                    const isFilled = possibleOrder.num === possibleOrder.filledAmount;
                                    const isExpired = possibleOrder.listTime +
                                        this.config.numberConfig.orderExpire < Date.now();

                                    if (!isFilled && !isExpired) {
                                        itemsData[itemData.type][itemData.id].lastBuys[0] =
                                            possibleOrder.price;
                                        itemsData[itemData.type][itemData.id].lastBuys[2] =
                                            possibleOrder.userID;
                                        break;
                                    }
                                }
                            }

                            DataHandlers.saveGlobalData(itemsData, DataHandlers.GlobalFile.Items);
                            await this.getPricingData();
                            this.imageGen.updateInfo(
                                this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                            );
                        } catch (err: unknown) {
                            failedSale = true;
                            await LogDebug.handleError(err, inter);
                        }
                    }, inter.id + 'global').catch((err) => { throw err });

                    if (!failedSale) {
                        const collectBucksIndex = questData.curQuestIDs.indexOf('collectBucks');

                        LogDebug.log(
                            `Sold ${this.modalData[0]} of ${itemData.id} for ${prices} to ${userIDs}`,
                            this.config, inter, true
                        );

                        if (itemData.type === 'boars') {
                            this.boarUser.itemCollection.boars[itemData.id].num -= this.modalData[0];
                            this.boarUser.stats.general.totalBoars -= this.modalData[0];
                        } else {
                            this.boarUser.itemCollection.powerups[itemData.id].numTotal -= this.modalData[0];
                        }

                        this.boarUser.stats.quests.progress[collectBucksIndex] += this.modalData[1];
                        this.boarUser.stats.general.boarScore += this.modalData[1];
                        await this.boarUser.orderBoars(this.compInter, this.config);
                        this.boarUser.updateUserData();

                        await Queue.addQueue(async () =>
                            DataHandlers.updateLeaderboardData(this.boarUser, this.config, inter),
                            inter.id + this.boarUser.user.id + 'global'
                        ).catch((err) => { throw err });

                        await Replies.handleReply(
                            inter, strConfig.marketInstaComplete, colorConfig.green, undefined, undefined, true
                        );
                    }
                } else if (this.curEdition > 0) {
                    await Replies.handleReply(
                        inter, strConfig.marketNoEdition, colorConfig.error, undefined, undefined, true
                    );
                } else {
                    await Replies.handleReply(
                        inter, strConfig.marketNoItems, colorConfig.error, undefined, undefined, true
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

    /**
     * Handles all logic for Buy Order and Sell Offer button pressing.
     * Returns whether to show a modal
     *
     * @param inter - The interaction to reply to
     * @param isBuyOrder - If setting up buy order
     * @param isSellOrder - If setting up sell order
     * @private
     */
    private async canOrderModal(
        inter: MessageComponentInteraction, isBuyOrder: boolean, isSellOrder: boolean
    ): Promise<boolean> {
        try {
            this.boarUser.refreshUserData();
            const itemData: {
                id: string,
                type: string,
                buyers: BuySellData[],
                sellers: BuySellData[],
                lastBuys: [number, number, string],
                lastSells: [number, number, string]
            } = this.pricingData[this.curPage];
            let showModal = true;

            const strConfig: StringConfig = this.config.stringConfig;
            const colorConfig: ColorConfig = this.config.colorConfig;

            const itemRarity = BoarUtils.findRarity(itemData.id, this.config);
            const isSpecial = itemRarity[1].name === 'Special' && itemRarity[0] !== 0;

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
                    inter, strConfig.marketNoItems, colorConfig.error,
                    undefined, undefined, true
                );
            } else if (
                this.userBuyOrders.length + this.userSellOrders.length >= this.config.numberConfig.marketMaxOrders
            ) {
                await inter.deferUpdate();
                showModal = false;

                await Replies.handleReply(
                    inter, strConfig.marketMaxOrders, colorConfig.error, undefined, undefined, true
                );
            } else if (isBuyOrder && (this.optionalRows[1].components[0] as ButtonBuilder).data.style === 4) {
                await inter.deferUpdate();
                showModal = false;

                if (this.boarUser.stats.general.boarScore >= this.modalData[0] * this.modalData[1]) {
                    await Queue.addQueue(async () => {
                        try {
                            const itemsData: ItemsData =
                                DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;
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

                            itemsData[itemData.type][itemData.id].buyers.push(order);
                            itemsData[itemData.type][itemData.id].buyers.sort((a, b) => b.price - a.price);

                            if (!isSpecial) {
                                let highestBuyOrder: BuySellData = new BuySellData;

                                for (
                                    let i=0;
                                    i<itemsData[itemData.type][itemData.id].buyers.length;
                                    i++
                                ) {
                                    const buyData = itemsData[itemData.type][itemData.id].buyers[i];
                                    const isExpired = buyData.listTime +
                                        this.config.numberConfig.orderExpire < Date.now();
                                    const isFilled = buyData.num === buyData.filledAmount;

                                    if (!isExpired && !isFilled) {
                                        highestBuyOrder = buyData;
                                        break;
                                    }
                                }

                                itemsData[itemData.type][itemData.id].lastBuys[0] = highestBuyOrder.price;
                                itemsData[itemData.type][itemData.id].lastBuys[2] = highestBuyOrder.userID;
                            }

                            DataHandlers.saveGlobalData(itemsData, DataHandlers.GlobalFile.Items);
                            await this.getPricingData();
                            this.imageGen.updateInfo(
                                this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                            );
                        } catch (err: unknown) {
                            await LogDebug.handleError(err, inter);
                        }
                    }, inter.id + 'global').catch((err) => { throw err });

                    this.boarUser.stats.general.boarScore -= this.modalData[0] * this.modalData[1];
                    await this.boarUser.orderBoars(this.compInter, this.config);
                    this.boarUser.updateUserData();

                    await Queue.addQueue(
                        async () => DataHandlers.updateLeaderboardData(this.boarUser, this.config, inter),
                        inter.id + this.boarUser.user.id + 'global'
                    ).catch((err) => { throw err });

                    await Replies.handleReply(
                        inter, strConfig.marketOrderComplete, colorConfig.green,
                        undefined, undefined, true
                    );
                } else {
                    await Replies.handleReply(
                        inter, strConfig.marketNoBucks, colorConfig.error, undefined, undefined, true
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
                    let editionIndex = 1000;

                    if (itemData.type === 'boars') {
                        editionIndex = this.modalData[2] > 0
                            ? this.boarUser.itemCollection.boars[itemData.id].editions.indexOf(this.modalData[2])
                            : this.boarUser.itemCollection.boars[itemData.id].num - this.modalData[0];
                    }

                    await Queue.addQueue(async () => {
                        try {
                            const itemsData: ItemsData =
                                DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;

                            const editions: number[] = itemData.type === 'boars'
                                ? this.boarUser.itemCollection.boars[itemData.id]
                                    .editions.splice(editionIndex, this.modalData[2] > 0 ? 1 : 100)
                                : [];
                            const editionDates: number[] = itemData.type === 'boars'
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

                            itemsData[itemData.type][itemData.id].sellers.push(order);
                            itemsData[itemData.type][itemData.id].sellers.sort((a, b) => a.price - b.price);

                            if (!isSpecial) {
                                let lowestSellOrder: BuySellData = new BuySellData;

                                for (let i=0; i<itemsData[itemData.type][itemData.id].sellers.length; i++) {
                                    const sellData = itemsData[itemData.type][itemData.id].sellers[i];
                                    const isExpired = sellData.listTime +
                                        this.config.numberConfig.orderExpire < Date.now();
                                    const isFilled = sellData.num === sellData.filledAmount;

                                    if (!isExpired && !isFilled) {
                                        lowestSellOrder = sellData;
                                        break;
                                    }
                                }

                                itemsData[itemData.type][itemData.id].lastSells[0] = lowestSellOrder.price;
                                itemsData[itemData.type][itemData.id].lastSells[2] = lowestSellOrder.userID;
                            }

                            DataHandlers.saveGlobalData(itemsData, DataHandlers.GlobalFile.Items);
                            await this.getPricingData();
                            this.imageGen.updateInfo(
                                this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                            );
                        } catch (err: unknown) {
                            await LogDebug.handleError(err, inter);
                        }
                    }, inter.id + 'global').catch((err) => { throw err });

                    if (itemData.type === 'boars') {
                        this.boarUser.itemCollection.boars[itemData.id].num -= this.modalData[0];
                        this.boarUser.stats.general.totalBoars -= this.modalData[0];
                    } else {
                        this.boarUser.itemCollection.powerups[itemData.id].numTotal -= this.modalData[0];
                    }

                    await this.boarUser.orderBoars(this.compInter, this.config);
                    this.boarUser.updateUserData();

                    await Queue.addQueue(
                        async () => DataHandlers.updateLeaderboardData(this.boarUser, this.config, inter),
                        inter.id + this.boarUser.user.id + 'global'
                    ).catch((err) => { throw err });

                    await Replies.handleReply(
                        inter, strConfig.marketOrderComplete, colorConfig.green,
                        undefined, undefined, true
                    );
                } else if (this.modalData[2] > 0) {
                    await Replies.handleReply(
                        inter, strConfig.marketNoEdition, colorConfig.error, undefined, undefined, true
                    );
                } else {
                    await Replies.handleReply(
                        inter, strConfig.marketNoItems, colorConfig.error, undefined, undefined, true
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

    /**
     * Handles all logic for Update button press.
     * Returns whether to show modal
     *
     * @param inter - The interaction to reply to
     * @private
     */
    private async canUpdateModal(inter: MessageComponentInteraction): Promise<boolean> {
        try {
            this.boarUser.refreshUserData();

            let showModal = true;
            let orderInfo: {data: BuySellData, id: string, type: string};
            let isSell = false;

            const strConfig: StringConfig = this.config.stringConfig;
            const colorConfig: ColorConfig = this.config.colorConfig;

            if (this.curPage < this.userBuyOrders.length) {
                orderInfo = this.userBuyOrders[this.curPage];
            } else {
                isSell = true;
                orderInfo = this.userSellOrders[this.curPage - this.userBuyOrders.length];
            }

            const itemRarity = BoarUtils.findRarity(orderInfo.id, this.config);
            const isSpecial = itemRarity[1].name === 'Special' && itemRarity[0] !== 0;
            let foundOrder = false;

            await Queue.addQueue(async () => {
                try {
                    const itemsData: ItemsData =
                        DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;

                    const buyOrders = itemsData[orderInfo.type][orderInfo.id].buyers;
                    const sellOrders = itemsData[orderInfo.type][orderInfo.id].sellers;

                    for (let i=0; i<buyOrders.length && !isSell; i++) {
                        const buyOrder = buyOrders[i];
                        const isSameOrder = buyOrder.userID === orderInfo.data.userID &&
                            buyOrder.listTime === orderInfo.data.listTime;
                        const canUpdate = orderInfo.data.filledAmount === buyOrder.filledAmount;

                        if (isSameOrder && canUpdate) {
                            if ((this.optionalRows[3].components[1] as ButtonBuilder).data.style === 4) {
                                await inter.deferUpdate();
                                showModal = false;
                                foundOrder = true;

                                if (
                                    (this.modalData[1] - buyOrder.price) * (buyOrder.num - buyOrder.filledAmount) >
                                    this.boarUser.stats.general.boarScore
                                ) {
                                    await Replies.handleReply(
                                        inter, strConfig.marketNoBucks, colorConfig.error, undefined, undefined, true
                                    );
                                } else {
                                    this.boarUser.stats.general.boarScore -= (this.modalData[1] - buyOrder.price) *
                                        (buyOrder.num - buyOrder.filledAmount);
                                    await this.boarUser.orderBoars(this.compInter, this.config);
                                    this.boarUser.updateUserData();

                                    itemsData[orderInfo.type][orderInfo.id].buyers[i].price =
                                        this.modalData[1];
                                    itemsData[orderInfo.type][orderInfo.id].buyers[i].listTime = Date.now();

                                    const newOrderData: BuySellData =
                                        itemsData[orderInfo.type][orderInfo.id].buyers.splice(i, 1)[0];
                                    itemsData[orderInfo.type][orderInfo.id].buyers.push(newOrderData);

                                    itemsData[orderInfo.type][orderInfo.id].buyers
                                        .sort((a, b) => b.price - a.price);

                                    if (!isSpecial) {
                                        let highestBuyOrder: BuySellData = new BuySellData;

                                        for (
                                            let i=0;
                                            i<itemsData[orderInfo.type][orderInfo.id].buyers.length;
                                            i++
                                        ) {
                                            const buyData = itemsData[orderInfo.type][orderInfo.id].buyers[i];
                                            const isExpired = buyData.listTime +
                                                this.config.numberConfig.orderExpire < Date.now();
                                            const isFilled = buyData.num === buyData.filledAmount;

                                            if (!isExpired && !isFilled) {
                                                highestBuyOrder = buyData;
                                                break;
                                            }
                                        }

                                        itemsData[orderInfo.type][orderInfo.id].lastBuys[0] =
                                            highestBuyOrder.price;
                                        itemsData[orderInfo.type][orderInfo.id].lastBuys[2] =
                                            highestBuyOrder.userID;
                                    }

                                    await Replies.handleReply(
                                        inter, strConfig.marketUpdateComplete,
                                        colorConfig.green, undefined, undefined, true
                                    );
                                }
                            } else {
                                foundOrder = true;
                            }

                            break;
                        } else if (isSameOrder) {
                            await inter.deferUpdate();
                            showModal = false;
                            foundOrder = true;

                            await Replies.handleReply(
                                inter, strConfig.marketMustClaim, colorConfig.error, undefined, undefined, true
                            );

                            break;
                        }
                    }

                    for (let i=0; i<sellOrders.length && isSell; i++) {
                        const sellOrder = sellOrders[i];
                        const isSameOrder = sellOrder.userID === orderInfo.data.userID &&
                            sellOrder.listTime === orderInfo.data.listTime;
                        const canUpdate = orderInfo.data.filledAmount === sellOrder.filledAmount;

                        if (isSameOrder && canUpdate) {
                            if ((this.optionalRows[3].components[1] as ButtonBuilder).data.style === 4) {
                                await inter.deferUpdate();
                                showModal = false;
                                foundOrder = true;

                                itemsData[orderInfo.type][orderInfo.id].sellers[i].price = this.modalData[1];
                                itemsData[orderInfo.type][orderInfo.id].sellers[i].listTime = Date.now();

                                const newOrderData: BuySellData =
                                    itemsData[orderInfo.type][orderInfo.id].sellers.splice(i, 1)[0];
                                itemsData[orderInfo.type][orderInfo.id].sellers.push(newOrderData);

                                itemsData[orderInfo.type][orderInfo.id].sellers
                                    .sort((a, b) => a.price - b.price);

                                if (!isSpecial) {
                                    let lowestSellOrder: BuySellData = new BuySellData;

                                    for (
                                        let i=0;
                                        i<itemsData[orderInfo.type][orderInfo.id].sellers.length;
                                        i++
                                    ) {
                                        const sellData = itemsData[orderInfo.type][orderInfo.id].sellers[i];
                                        const isExpired = sellData.listTime +
                                            this.config.numberConfig.orderExpire < Date.now();
                                        const isFilled = sellData.num === sellData.filledAmount;

                                        if (!isExpired && !isFilled) {
                                            lowestSellOrder = sellData;
                                            break;
                                        }
                                    }

                                    itemsData[orderInfo.type][orderInfo.id].lastSells[0] =
                                        lowestSellOrder.price;
                                    itemsData[orderInfo.type][orderInfo.id].lastSells[2] =
                                        lowestSellOrder.userID;
                                }

                                await Replies.handleReply(
                                    inter, strConfig.marketUpdateComplete, colorConfig.green, undefined, undefined, true
                                );
                            } else {
                                foundOrder = true;
                            }

                            break;
                        } else if (isSameOrder) {
                            await inter.deferUpdate();
                            showModal = false;
                            foundOrder = true;

                            await Replies.handleReply(
                                inter, strConfig.marketMustClaim, colorConfig.error, undefined, undefined, true
                            );

                            break;
                        }
                    }

                    DataHandlers.saveGlobalData(itemsData, DataHandlers.GlobalFile.Items);
                    await this.getPricingData();
                    this.imageGen.updateInfo(
                        this.pricingData, this.userBuyOrders, this.userSellOrders, this.config
                    );
                } catch (err: unknown) {
                    await LogDebug.handleError(err, this.compInter);
                }
            }, this.compInter.id + 'global').catch((err) => { throw err });

            this.undoRedButtons();

            showModal = showModal && foundOrder;

            if (!showModal) {
                await this.showMarket();
            }

            return showModal;
        } catch (err: unknown) {
            await LogDebug.handleError(err, inter);
            return false;
        }
    }

    private async handleEndCollect(reason: string) {
        try {
            this.hasStopped = true;

            LogDebug.log('Ended collection with reason: ' + reason, this.config, this.firstInter);

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

    private async getPricingData(): Promise<void> {
        const itemsData: ItemsData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;
        const curItem = this.pricingData.length > 0
            ? this.pricingData[this.curPage]
            : undefined;

        this.pricingData = [];
        this.pricingDataSearchArr = [];
        this.userBuyOrders = [];
        this.userSellOrders = [];

        for (const itemType of Object.keys(itemsData)) {
            for (const itemID of Object.keys(itemsData[itemType])) {
                this.pricingData.push({
                    id: itemID,
                    type: itemType,
                    buyers: itemsData[itemType][itemID].buyers,
                    sellers: itemsData[itemType][itemID].sellers,
                    lastBuys: itemsData[itemType][itemID].lastBuys,
                    lastSells: itemsData[itemType][itemID].lastSells
                });

                this.pricingDataSearchArr.push([
                    this.config.itemConfigs[itemType][itemID].name.toLowerCase().replace(/\s+/g, ''),
                    this.pricingData.length
                ]);
            }
        }

        for (const priceData of this.pricingData) {
            for (const sellData of priceData.sellers) {
                if (sellData.userID !== this.firstInter.user.id) continue;
                this.userSellOrders.push({
                    data: sellData,
                    id: priceData.id,
                    type: priceData.type,
                    lastBuys: priceData.lastBuys,
                    lastSells: priceData.lastSells
                });
            }
            for (const buyData of priceData.buyers) {
                if (buyData.userID !== this.firstInter.user.id) continue;
                this.userBuyOrders.push({
                    data: buyData,
                    id: priceData.id,
                    type: priceData.type,
                    lastBuys: priceData.lastBuys,
                    lastSells: priceData.lastSells
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

            LogDebug.log(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedPage, this.config, this.firstInter
            );

            let pageVal = 1;
            if (!Number.isNaN(parseInt(submittedPage))) {
                pageVal = parseInt(submittedPage);
            } else if (this.curView === View.Overview) {
                const overviewSearchArr = this.pricingDataSearchArr.map(val =>
                    [val[0], Math.ceil(val[1] / this.config.numberConfig.marketPerPage)] as [string, number]
                );
                pageVal = BoarUtils.getClosestName(submittedPage.toLowerCase().replace(/\s+/g, ''), overviewSearchArr);
            } else if (this.curView === View.BuySell) {
                pageVal = BoarUtils.getClosestName(
                    submittedPage.toLowerCase().replace(/\s+/g, ''), this.pricingDataSearchArr
                )
            }

            this.setPage(pageVal);

            await this.showMarket();
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        this.endModalListener(submittedModal.client);
    };

    /**
     * Handles input for a buy now or sell now
     *
     * @param submittedModal - The interaction to respond to
     */
    private modalListenerInsta = async (submittedModal: Interaction): Promise<void> => {
        try {
            if (!await this.beginModal(submittedModal)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;
            const colorConfig = this.config.colorConfig;

            const isInstaBuy = this.modalShowing.data.title?.startsWith(
                this.config.commandConfigs.boar.market.componentFields[1][0].components[0].label
            );
            const responseStr = isInstaBuy ? strConfig.marketConfirmInstaBuy : strConfig.marketConfirmInstaSell;

            const submittedNum: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.log(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedNum, this.config, this.firstInter
            );

            let numVal = 0;
            if (!Number.isNaN(parseInt(submittedNum))) {
                numVal = parseInt(submittedNum);
            }

            if (numVal <= 0) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketInvalid, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            await this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);

            const itemData = this.pricingData[this.curPage];

            if (
                !isInstaBuy &&
                (itemData.type === 'boars' && this.boarUser.itemCollection.boars[itemData.id].num < numVal ||
                itemData.type === 'powerups' && this.boarUser.itemCollection.powerups[itemData.id].numTotal < numVal)
            ) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketNoItems, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            let numGrabbed = 0;
            let curPrice = 0;
            let curIndex = 0;
            while (numGrabbed < numVal) {
                let numToAdd = 0;
                if (isInstaBuy && curIndex < itemData.sellers.length) {
                    numToAdd = Math.min(
                        numVal - numGrabbed,
                        itemData.sellers[curIndex].listTime + this.config.numberConfig.orderExpire < Date.now()
                            ? 0
                            : itemData.sellers[curIndex].num - itemData.sellers[curIndex].filledAmount
                    );
                    curPrice += itemData.sellers[curIndex].price * numToAdd;
                } else if (curIndex < itemData.buyers.length) {
                    numToAdd = Math.min(
                        numVal - numGrabbed,
                        itemData.buyers[curIndex].listTime + this.config.numberConfig.orderExpire < Date.now()
                            ? 0
                            : itemData.buyers[curIndex].num - itemData.buyers[curIndex].filledAmount
                    );
                    curPrice += itemData.buyers[curIndex].price * numToAdd;
                } else {
                    break;
                }

                numGrabbed += numToAdd;
                curIndex++;
            }

            if (numVal !== numGrabbed) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketNoOrders, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            const itemName = numVal + 'x ' + (numVal > 1
                ? this.config.itemConfigs[itemData.type][itemData.id].pluralName
                : this.config.itemConfigs[itemData.type][itemData.id].name);

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', curPrice.toLocaleString()),
                colorConfig.font, undefined, undefined, true
            );

            if (isInstaBuy) {
                (this.optionalRows[0].components[0] as ButtonBuilder).setStyle(4);
            } else {
                (this.optionalRows[0].components[1] as ButtonBuilder).setStyle(4);
            }

            this.modalData = [numVal, curPrice, 0];

            await this.showMarket();
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        this.endModalListener(submittedModal.client);
    };

    /**
     * Handles input for a buy now or sell now for specials
     *
     * @param submittedModal - The interaction to respond to
     */
    private modalListenerInstaSpecial = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;
            const nums = this.config.numberConfig;
            const colorConfig = this.config.colorConfig;

            const isInstaBuy = this.modalShowing.data.title?.startsWith(
                this.config.commandConfigs.boar.market.componentFields[1][0].components[0].label
            );
            const responseStr = isInstaBuy ? strConfig.marketConfirmInstaBuy : strConfig.marketConfirmInstaSell;

            const submittedNum: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.log(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedNum, this.config, this.firstInter
            );

            let editionVal = 0;
            if (!Number.isNaN(parseInt(submittedNum))) {
                editionVal = parseInt(submittedNum);
            }

            if (editionVal <= 0) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketInvalid, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            await this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);

            const itemData = this.pricingData[this.curPage];

            if (!isInstaBuy && !this.boarUser.itemCollection.boars[itemData.id].editions.includes(this.curEdition)) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketNoEdition, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (editionVal !== this.curEdition) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketWrongEdition, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            let curPrice = 0;

            if (isInstaBuy) {
                for (const sellOrder of itemData.sellers) {
                    const noEditionExists = sellOrder.num === sellOrder.filledAmount ||
                        sellOrder.listTime + nums.orderExpire < Date.now() ||
                        sellOrder.editions[0] !== this.curEdition;

                    if (noEditionExists) continue;

                    curPrice = sellOrder.price;
                    break;
                }
            } else {
                for (const buyOrder of itemData.buyers) {
                    const noEditionExists = buyOrder.num === buyOrder.filledAmount ||
                        buyOrder.listTime + nums.orderExpire < Date.now() ||
                        buyOrder.editions[0] !== this.curEdition;

                    if (noEditionExists) continue;

                    curPrice = buyOrder.price;
                    break;
                }
            }

            if (curPrice === 0) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketNoEditionOrders, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            const itemName = this.config.itemConfigs[itemData.type][itemData.id].name + ' #' + this.curEdition;

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', curPrice.toLocaleString()),
                colorConfig.font, undefined, undefined, true
            );

            if (isInstaBuy) {
                (this.optionalRows[0].components[0] as ButtonBuilder).setStyle(4);
            } else {
                (this.optionalRows[0].components[1] as ButtonBuilder).setStyle(4);
            }

            this.modalData = [1, curPrice, this.curEdition];

            await this.showMarket();
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        this.endModalListener(submittedModal.client);
    };

    /**
     * Handles input for a buy order or sell offer
     *
     * @param submittedModal - The interaction to respond to
     */
    private modalListenerOrder = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;
            const colorConfig = this.config.colorConfig;

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

            LogDebug.log(
                `${submittedModal.customId.split('|')[0]} input values: ${submittedNum}, ${submittedPrice}`,
                this.config, this.firstInter
            );

            let numVal = 0;
            let priceVal = 0;
            if (!Number.isNaN(parseInt(submittedNum))) {
                numVal = parseInt(submittedNum);
            }
            if (!Number.isNaN(parseInt(submittedPrice))) {
                priceVal = parseInt(submittedPrice);
            }

            if (numVal <= 0 || priceVal <= 0) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketInvalid, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (isBuyOrder && numVal > 1000) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketTooMany, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            if (this.userBuyOrders.length + this.userSellOrders.length >= this.config.numberConfig.marketMaxOrders) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketMaxOrders, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            await this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);

            const itemData = this.pricingData[this.curPage];

            let minBuyVal: number;
            let maxBuyVal: number;
            let minSellVal: number;
            let maxSellVal: number;

            if (
                isBuyOrder && itemData.lastBuys[2] === this.firstInter.user.id ||
                !isBuyOrder && itemData.lastSells[2] === this.firstInter.user.id
            ) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketBestOrder,
                    colorConfig.error, undefined, undefined, true
                );
                this.endModalListener(submittedModal.client);
                return;
            }

            if (itemData.lastBuys[0] === 0) {
                minBuyVal = itemData.lastBuys[1] / this.config.numberConfig.marketRange;
                maxBuyVal = itemData.lastBuys[1] * this.config.numberConfig.marketRange;
            } else {
                minBuyVal = itemData.lastBuys[0] / this.config.numberConfig.marketRange;
                maxBuyVal = itemData.lastBuys[0] * this.config.numberConfig.marketRange;
            }

            if (itemData.lastSells[0] === 0) {
                minSellVal = itemData.lastSells[1] / this.config.numberConfig.marketRange;
                maxSellVal = itemData.lastSells[1] * this.config.numberConfig.marketRange;
            } else {
                minSellVal = itemData.lastSells[0] / this.config.numberConfig.marketRange;
                maxSellVal = itemData.lastSells[0] * this.config.numberConfig.marketRange;
            }

            minSellVal = Math.ceil(minSellVal);
            minBuyVal = Math.ceil(minBuyVal);

            if (
                isBuyOrder && minBuyVal > 0 && priceVal < minBuyVal ||
                !isBuyOrder && minSellVal > 0 && priceVal < minSellVal
            ) {
                await Replies.handleReply(
                    submittedModal, isBuyOrder
                        ? strConfig.marketTooCheap.replace('%@', minBuyVal.toLocaleString())
                        : strConfig.marketTooCheap.replace('%@', minSellVal.toLocaleString()),
                    colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (
                isBuyOrder && maxBuyVal > 0 && priceVal > maxBuyVal ||
                !isBuyOrder && maxSellVal > 0 && priceVal > maxSellVal
            ) {
                await Replies.handleReply(
                    submittedModal, isBuyOrder
                        ? strConfig.marketTooExpensive.replace('%@', maxBuyVal.toLocaleString())
                        : strConfig.marketTooExpensive.replace('%@', maxSellVal.toLocaleString()),
                    colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (
                !isBuyOrder &&
                (itemData.type === 'boars' && this.boarUser.itemCollection.boars[itemData.id].num < numVal ||
                itemData.type === 'powerups' && this.boarUser.itemCollection.powerups[itemData.id].numTotal < numVal)
            ) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketNoItems, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            const price = priceVal * numVal;

            const leaderboardsData: Record<string, BoardData> =
                DataHandlers.getGlobalData(DataHandlers.GlobalFile.Leaderboards) as Record<string, BoardData>;
            const bucksBoardData = leaderboardsData['bucks'];
            let maxBucks = this.config.numberConfig.marketMaxBucks;
            for (const userID of Object.keys(bucksBoardData.userData)) {
                maxBucks = Math.max(maxBucks, (bucksBoardData.userData[userID] as [string, number])[1] * 10);
            }

            if (!isBuyOrder && (priceVal === null || priceVal > maxBucks)) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketTooHigh.replace('%@', maxBucks.toLocaleString()),
                    colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (isBuyOrder && price > this.boarUser.stats.general.boarScore) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketNoBucks, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            const itemName = numVal + 'x ' + (numVal > 1
                ? this.config.itemConfigs[itemData.type][itemData.id].pluralName
                : this.config.itemConfigs[itemData.type][itemData.id].name);

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', price.toLocaleString()),
                colorConfig.font, undefined, undefined, true
            );

            if (isBuyOrder) {
                (this.optionalRows[1].components[0] as ButtonBuilder).setStyle(4);
            } else {
                (this.optionalRows[1].components[1] as ButtonBuilder).setStyle(4);
            }

            this.modalData = [numVal, priceVal, 0];

            await this.showMarket();
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        this.endModalListener(submittedModal.client);
    };

    /**
     * Handles input for a buy order or sell offer for specials
     *
     * @param submittedModal - The interaction to respond to
     */
    private modalListenerOrderSpecial = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;
            const colorConfig = this.config.colorConfig;

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

            LogDebug.log(
                `${submittedModal.customId.split('|')[0]} input values: ${submittedEdition}, ${submittedPrice}`,
                this.config, this.firstInter
            );

            let editionVal = 0;
            let priceVal = 0;
            if (!Number.isNaN(parseInt(submittedEdition))) {
                editionVal = parseInt(submittedEdition);
            }
            if (!Number.isNaN(parseInt(submittedPrice))) {
                priceVal = parseInt(submittedPrice);
            }

            if (editionVal <= 0 || priceVal <= 0) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketInvalid, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            if (this.userBuyOrders.length + this.userSellOrders.length >= this.config.numberConfig.marketMaxOrders) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketMaxOrders, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            await this.getPricingData();
            this.imageGen.updateInfo(this.pricingData, this.userBuyOrders, this.userSellOrders, this.config);

            const itemData = this.pricingData[this.curPage];

            const itemsData: ItemsData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Items) as ItemsData;
            const curEdition = itemsData[itemData.type][itemData.id].curEdition as number;

            if (editionVal > curEdition) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketEditionHigh, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            const hasEdition = this.boarUser.itemCollection.boars[itemData.id] &&
                this.boarUser.itemCollection.boars[itemData.id].editions.includes(editionVal);

            if (!isBuyOrder && !hasEdition) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketNoEdition, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            let isSellingEdition = false;
            for (const sellOrder of itemData.sellers) {
                if (sellOrder.userID === this.compInter.user.id && sellOrder.editions[0] === editionVal) {
                    isSellingEdition = true;
                    break;
                }
            }

            if (isBuyOrder && (hasEdition || isSellingEdition)) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketHasEdition, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            const leaderboardsData: Record<string, BoardData> =
                DataHandlers.getGlobalData(DataHandlers.GlobalFile.Leaderboards) as Record<string, BoardData>;
            const bucksBoardData = leaderboardsData['bucks'];
            let maxBucks = this.config.numberConfig.marketMaxBucks;
            for (const userID of Object.keys(bucksBoardData.userData)) {
                maxBucks = Math.max(maxBucks, (bucksBoardData.userData[userID] as [string, number])[1] * 10);
            }

            if (!isBuyOrder && priceVal > maxBucks) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketTooHigh.replace('%@', maxBucks.toLocaleString()),
                    colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (isBuyOrder && priceVal > this.boarUser.stats.general.boarScore) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketNoBucks, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            const itemName = this.config.itemConfigs[itemData.type][itemData.id].name + ' #' + editionVal;

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', priceVal.toLocaleString()),
                colorConfig.font, undefined, undefined, true
            );

            if (isBuyOrder) {
                (this.optionalRows[1].components[0] as ButtonBuilder).setStyle(4);
            } else {
                (this.optionalRows[1].components[1] as ButtonBuilder).setStyle(4);
            }

            this.modalData = [1, priceVal, editionVal];

            await this.showMarket();
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        this.endModalListener(submittedModal.client);
    };

    /**
     * Handles input for an order price update
     *
     * @param submittedModal - The interaction to respond to
     */
    private modalListenerUpdate = async (submittedModal: Interaction): Promise<void> => {
        try  {
            if (!await this.beginModal(submittedModal)) return;
            submittedModal = submittedModal as ModalSubmitInteraction;

            const strConfig = this.config.stringConfig;
            const colorConfig = this.config.colorConfig;

            const submittedPrice: string = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.log(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedPrice, this.config, this.firstInter
            );

            let priceVal = 0;
            if (!Number.isNaN(parseInt(submittedPrice))) {
                priceVal = parseInt(submittedPrice);
            }

            if (priceVal <= 0) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketInvalid, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            this.boarUser.refreshUserData();

            await this.getPricingData();
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

            const leaderboardsData: Record<string, BoardData> =
                DataHandlers.getGlobalData(DataHandlers.GlobalFile.Leaderboards) as Record<string, BoardData>;
            const bucksBoardData = leaderboardsData['bucks'];
            let maxBucks = this.config.numberConfig.marketMaxBucks;
            for (const userID of Object.keys(bucksBoardData.userData)) {
                maxBucks = Math.max(maxBucks, (bucksBoardData.userData[userID] as [string, number])[1] * 10);
            }

            let minBuyVal: number;
            let maxBuyVal: number;
            let minSellVal: number;
            let maxSellVal: number;

            if (
                (isBuyOrder && itemData.lastBuys[2] === this.firstInter.user.id ||
                !isBuyOrder && itemData.lastSells[2] === this.firstInter.user.id) &&
                itemData.data.listTime + this.config.numberConfig.orderExpire >= Date.now()
            ) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketBestOrder, colorConfig.error, undefined, undefined, true
                );
                this.endModalListener(submittedModal.client);
                return;
            }

            if (itemData.lastBuys[0] === 0) {
                minBuyVal = itemData.lastBuys[1] / this.config.numberConfig.marketRange;
                maxBuyVal = itemData.lastBuys[1] * this.config.numberConfig.marketRange;
            } else {
                minBuyVal = itemData.lastBuys[0] / this.config.numberConfig.marketRange;
                maxBuyVal = itemData.lastBuys[0] * this.config.numberConfig.marketRange;
            }

            if (itemData.lastSells[0] === 0) {
                minSellVal = itemData.lastSells[1] / this.config.numberConfig.marketRange;
                maxSellVal = itemData.lastSells[1] * this.config.numberConfig.marketRange;
            } else {
                minSellVal = itemData.lastSells[0] / this.config.numberConfig.marketRange;
                maxSellVal = itemData.lastSells[0] * this.config.numberConfig.marketRange;
            }

            minSellVal = Math.ceil(minSellVal);
            minBuyVal = Math.ceil(minBuyVal);

            if (
                isBuyOrder && minBuyVal > 0 && priceVal < minBuyVal ||
                !isBuyOrder && minSellVal > 0 && priceVal < minSellVal
            ) {
                await Replies.handleReply(
                    submittedModal, isBuyOrder
                        ? strConfig.marketTooCheap.replace('%@', minBuyVal.toLocaleString())
                        : strConfig.marketTooCheap.replace('%@', minSellVal.toLocaleString()),
                    colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (
                isBuyOrder && maxBuyVal > 0 && priceVal > maxBuyVal ||
                !isBuyOrder && maxSellVal > 0 && priceVal > maxSellVal
            ) {
                await Replies.handleReply(
                    submittedModal, isBuyOrder
                        ? strConfig.marketTooExpensive.replace('%@', maxBuyVal.toLocaleString())
                        : strConfig.marketTooExpensive.replace('%@', maxSellVal.toLocaleString()),
                    colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (!isBuyOrder && (priceVal === null || priceVal > maxBucks)) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketTooHigh.replace('%@', maxBucks.toLocaleString()),
                    colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (isBuyOrder && newPrice - oldPrice > this.boarUser.stats.general.boarScore) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketNoBucks, colorConfig.error, undefined, undefined, true
                );

                this.endModalListener(submittedModal.client);
                return;
            }

            if (itemData.data.filledAmount !== itemData.data.claimedAmount) {
                await Replies.handleReply(
                    submittedModal, strConfig.marketMustClaim, colorConfig.error, undefined, undefined, true
                );
            }

            const itemName = this.config.itemConfigs[itemData.type][itemData.id].name + (isSpecial
                ? ' #' + itemData.data.editions[0]
                : '');

            await Replies.handleReply(
                submittedModal, responseStr.replace('%@', itemName).replace('%@', oldPrice.toLocaleString())
                    .replace('%@', newPrice.toLocaleString()),
                colorConfig.font, undefined, undefined, true
            );

            (this.optionalRows[3].components[1] as ButtonBuilder).setStyle(4);

            this.modalData = [0, priceVal, 0];

            await this.showMarket();
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        this.endModalListener(submittedModal.client);
    };

    /**
     * Performs the beginning actions of a modal input
     *
     * @param submittedModal - The interaction to respond to
     * @private
     */
    private async beginModal(submittedModal: Interaction): Promise<boolean> {
        if (submittedModal.user.id !== this.firstInter.user.id) return false;

        if (
            submittedModal.isMessageComponent() &&
            submittedModal.customId.endsWith(this.firstInter.id + '|' + this.firstInter.user.id) ||
            BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(this.compInter.user.id)
        ) {
            this.endModalListener(submittedModal.client);
            return false;
        }

        // Updates the cooldown to interact again
        const canInteract = await CollectorUtils.canInteract(this.timerVars);
        if (!canInteract) {
            this.endModalListener(submittedModal.client);
            return false;
        }

        if (
            !submittedModal.isModalSubmit() || this.collector.ended ||
            !submittedModal.guild || submittedModal.customId !== this.modalShowing.data.custom_id
        ) {
            this.endModalListener(submittedModal.client);
            return false;
        }

        await submittedModal.deferUpdate();
        return true;
    }

    /**
     * Ends the current modal being shown
     *
     * @param client - Used to end the modal
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
     * Shows the market image that meets user's inputs
     *
     * @param firstRun - Whether this is the first time this function is being run
     * @private
     */
    private async showMarket(firstRun = false): Promise<void> {
        try {
            if (firstRun) {
                this.initButtons();
            }

            this.disableButtons();

            const nums = this.config.numberConfig;

            const rowsToAdd: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

            if (this.userBuyOrders.concat(this.userSellOrders).length === 0 && this.curView === View.UserOrders) {
                this.curView = View.Overview;
            }

            this.baseRows[0].components[0].setDisabled(this.curPage === 0);
            this.baseRows[0].components[1].setDisabled(
                this.curView === View.Overview && this.maxPageOverview === 0 ||
                this.curView === View.BuySell && this.pricingData.length - 1 === 0 ||
                this.curView === View.UserOrders && this.userBuyOrders.concat(this.userSellOrders).length - 1 === 0
            );
            this.baseRows[0].components[2].setDisabled(
                this.curView === View.Overview && this.curPage === this.maxPageOverview ||
                this.curView === View.BuySell && this.curPage === this.pricingData.length - 1 ||
                this.curView === View.UserOrders &&
                this.curPage === this.userBuyOrders.concat(this.userSellOrders).length - 1
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

                for (const sellOrder of item.sellers) {
                    if (sellOrder.num !== sellOrder.filledAmount &&
                        sellOrder.listTime + nums.orderExpire >= Date.now()
                    ) {
                        nonFilledBuys++;
                    }
                }

                for (const buyOrder of item.buyers) {
                    if (
                        buyOrder.num !== buyOrder.filledAmount && buyOrder.listTime + nums.orderExpire >= Date.now()
                    ) {
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

                    for (const sellOrder of item.sellers) {
                        if (
                            sellOrder.num === sellOrder.filledAmount ||
                            sellOrder.listTime + nums.orderExpire < Date.now()
                        ) {
                            continue;
                        }

                        const editionNum: number = sellOrder.editions[0];

                        if (!instaBuyEditions.includes(editionNum)) {
                            selectOptions.push({
                                label: 'Edition #' + editionNum,
                                value: editionNum.toString()
                            });
                        }

                        instaBuyEditions.push(editionNum);
                    }

                    for (const buyOrder of item.buyers) {
                        if (
                            buyOrder.num === buyOrder.filledAmount || buyOrder.listTime + nums.orderExpire < Date.now()
                        ) {
                            continue;
                        }

                        const editionNum: number = buyOrder.editions[0];

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

                for (let i=this.userBuyOrders.length; i<this.userBuyOrders.length+this.userSellOrders.length; i++) {
                    const sellOrder = this.userSellOrders[i - this.userBuyOrders.length];
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

                let orderInfo: { data: BuySellData, id: string, type: string };

                if (this.curPage < this.userBuyOrders.length) {
                    orderInfo = this.userBuyOrders[this.curPage];
                } else {
                    orderInfo = this.userSellOrders[this.curPage - this.userBuyOrders.length];
                }

                this.optionalRows[3].components[0].setDisabled(
                    orderInfo.data.claimedAmount === orderInfo.data.filledAmount
                );

                if (
                    orderInfo.data.filledAmount === orderInfo.data.num ||
                    orderInfo.data.claimedAmount !== orderInfo.data.filledAmount
                ) {
                    this.optionalRows[3].components[1].setDisabled(true);
                    this.optionalRows[3].components[2].setDisabled(true);
                    this.undoRedButtons();
                } else {
                    this.optionalRows[3].components[1].setDisabled(false);
                    this.optionalRows[3].components[2].setDisabled(false);
                }

                rowsToAdd.push(this.optionalRows[3]);
                rowsToAdd.push(this.optionalRows[4]);
            }

            let imageToSend: AttachmentBuilder;

            if (this.curView === View.Overview) {
                imageToSend = await this.imageGen.makeOverviewImage(this.curPage);
            } else if (this.curView === View.BuySell) {
                imageToSend = await this.imageGen.makeBuySellImage(this.curPage, this.curEdition);
            } else {
                imageToSend = await this.imageGen.makeOrdersImage(this.curPage);
            }

            if (this.hasStopped) return;

            await this.firstInter.editReply({
                files: [imageToSend],
                components: this.baseRows.concat(rowsToAdd)
            });
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }
    }

    /**
     * Disables all buttons
     *
     * @private
     */
    private disableButtons(): void {
        for (const row of this.baseRows.concat(this.optionalRows)) {
            for (const component of row.components) {
                component.setDisabled(true);
            }
        }
    }

    /**
     * Undoes all red confirmation buttons and returns if one has been undone
     *
     * @private
     */
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

    /**
     * Initializes all buttons/menus with appropriate IDs
     *
     * @private
     */
    private initButtons(): void {
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

    /**
     * Sets the current page based on the view
     *
     * @param pageVal - The page to attempt to go to
     * @private
     */
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