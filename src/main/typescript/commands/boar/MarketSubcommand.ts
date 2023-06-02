import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction,
    InteractionCollector, MessageComponentInteraction, SelectMenuComponentOptionData,
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
    private userBuyOrders: {list: BuySellData, id: string, type: string}[] = [];
    private userSellOrders: {list: BuySellData, id: string, type: string}[] = [];
    private curView: View = View.Overview;
    private curPage: number = 0;
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

        this.collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter));
        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));
    }

    private async handleCollect(inter: ButtonInteraction) {
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
                ordersView: marketRowConfig[0][1].components[2]
            };

            // User wants to input a page manually
            if (inter.customId.startsWith(marketComponents.inputPage.customId)) {
                clearInterval(this.timerVars.updateTime);
                return;
            }

            await inter.deferUpdate();

            switch (inter.customId.split('|')[0]) {
                // User wants to go to previous page
                case marketComponents.leftPage.customId:
                    this.curPage--;
                    break;

                // User wants to go to the next page
                case marketComponents.rightPage.customId:
                    this.curPage++;
                    break;

                case marketComponents.refresh.customId:
                    break;

                case marketComponents.overviewView.customId:
                    this.curView = View.Overview;
                    this.curPage = 0;
                    break;

                case marketComponents.buySellView.customId:
                    this.curView = View.BuySell;
                    this.curPage = 0;
                    break;

                case marketComponents.ordersView.customId:
                    this.curView = View.UserOrders;
                    this.curPage = 0;
                    break;
            }

            await this.showMarket();
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

    private getPricingData(): void {
        const itemData = DataHandlers.getGlobalData().itemData;

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
    }

    private async showMarket(firstRun: boolean = false) {
        if (firstRun) {
            this.initButtons();
        }

        this.disableButtons();

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

        // let replyString = '';
        // for (const data of this.pricingData) {
        //     const itemInfo = this.config.itemConfigs[data.type][data.id];
        //     const lowestBuy = data.instaBuys.length > 0 ? data.instaBuys[0].price : 'N/A';
        //     const highestSell = data.instaSells.length > 0 ? data.instaSells[0].price : 'N/A';
        //
        //     replyString += '**' + itemInfo.name + '** - B: ' + lowestBuy + ' | S: ' + highestSell + '\n';
        // }
        //
        // replyString = replyString.substring(0, replyString.length-1);

        await this.firstInter.editReply({
            files: [await this.imageGen.makeOverviewImage(this.curPage)],
            components: this.baseRows
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
        const selectOptions: SelectMenuComponentOptionData[] = [];

        for (let i=0; i<this.userBuyOrders.length; i++) {
            const buyOrder = this.userBuyOrders[i];
            selectOptions.push({
                label: 'BUY: ' + this.config.itemConfigs[buyOrder.type][buyOrder.id].name +
                    '(' + buyOrder.list.price + ')',
                value: i.toString()
            });
        }

        for (let i=0; i<this.userSellOrders.length; i++) {
            const sellOrder = this.userSellOrders[i];
            selectOptions.push({
                label: 'BUY: ' + this.config.itemConfigs[sellOrder.type][sellOrder.id].name +
                    '(' + sellOrder.list.price + ')',
                value: i.toString()
            });
        }

        if (selectOptions.length === 0) {
            selectOptions.push({
                label: this.config.stringConfig.emptySelect,
                value: this.config.stringConfig.emptySelect
            });
        }

        for (let i=0; i<marketFieldConfigs.length; i++) {
            const newRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
                ComponentUtils.makeRows(marketFieldConfigs[i]);

            ComponentUtils.addToIDs(
                marketFieldConfigs[i], newRows, this.firstInter.id, this.firstInter.user.id, selectOptions
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