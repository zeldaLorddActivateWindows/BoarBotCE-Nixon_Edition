import Canvas from 'canvas';
import {BotConfig} from '../../bot/config/BotConfig';
import {AttachmentBuilder} from 'discord.js';
import {BuySellData} from '../data/global/BuySellData';
import {CanvasUtils} from './CanvasUtils';
import {BoarUtils} from '../boar/BoarUtils';
import moment from 'moment';

/**
 * {@link MarketImageGenerator MarketImageGenerator.ts}
 *
 * Creates the boar market image.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class MarketImageGenerator {
    private config: BotConfig = {} as BotConfig;
    private itemPricing: {
        id: string,
        type: string,
        buyers: BuySellData[],
        sellers: BuySellData[],
        lastBuys: [number, number, string, string],
        lastSells: [number, number, string, string]
    }[] = [];
    private userBuyOrders: {
        data: BuySellData,
        id: string,
        type: string,
        lastBuys: [number, number, string, string],
        lastSells: [number, number, string, string]
    }[] = [];
    private userSellOrders: {
        data: BuySellData,
        id: string,
        type: string,
        lastBuys: [number, number, string, string],
        lastSells: [number, number, string, string]
    }[] = [];

    /**
     * Creates a new leaderboard image generator
     *
     * @param itemPricing
     * @param userBuyOrders
     * @param userSellOrders
     * @param config - Used to get strings, paths, and other information
     */
    constructor(
        itemPricing: {
            id: string,
            type: string,
            buyers: BuySellData[],
            sellers: BuySellData[],
            lastBuys: [number, number, string, string],
            lastSells: [number, number, string, string]
        }[],
        userBuyOrders: {
            data: BuySellData,
            id: string,
            type: string,
            lastBuys: [number, number, string, string],
            lastSells: [number, number, string, string]
        }[],
        userSellOrders: {
            data: BuySellData,
            id: string,
            type: string,
            lastBuys: [number, number, string, string],
            lastSells: [number, number, string, string]
        }[],
        config: BotConfig
    ) {
        this.itemPricing = itemPricing;
        this.userBuyOrders = userBuyOrders;
        this.userSellOrders = userSellOrders;
        this.config = config;
    }

    /**
     * Used when leaderboard boar type has changed
     *
     * @param itemPricing
     * @param userBuyOrders
     * @param userSellOrders
     * @param config - Used to get strings, paths, and other information
     */
    public updateInfo(
        itemPricing: {
            id: string,
            type: string,
            buyers: BuySellData[],
            sellers: BuySellData[],
            lastBuys: [number, number, string, string],
            lastSells: [number, number, string, string]
        }[],
        userBuyOrders: {
            data: BuySellData,
            id: string,
            type: string,
            lastBuys: [number, number, string, string],
            lastSells: [number, number, string, string]
        }[],
        userSellOrders: {
            data: BuySellData,
            id: string,
            type: string,
            lastBuys: [number, number, string, string],
            lastSells: [number, number, string, string]
        }[],
        config: BotConfig
    ): void {
        this.itemPricing = itemPricing;
        this.userBuyOrders = userBuyOrders;
        this.userSellOrders = userSellOrders;
        this.config = config;
    }

    public async makeOverviewImage(page: number) {
        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        const underlay = pathConfig.otherAssets + pathConfig.marketOverviewUnderlay;
        const overlay = pathConfig.otherAssets + pathConfig.marketOverviewOverlay;

        const font = `${nums.fontMedium}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(...nums.marketSize);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(underlay), ...nums.originPos);

        const curShowing = this.itemPricing.slice(page*nums.marketPerPage, (page+1) * nums.marketPerPage);

        for (let i=0; i<curShowing.length; i++) {
            const item = curShowing[i];
            const file = pathConfig[item.type] + (this.config.itemConfigs[item.type][item.id].staticFile
                ? this.config.itemConfigs[item.type][item.id].staticFile
                : this.config.itemConfigs[item.type][item.id].file);

            const imagePos: [number, number] = [
                nums.marketOverImgStart[0] + i % nums.marketOverCols * nums.marketOverIncX,
                nums.marketOverImgStart[1] + Math.floor(i / nums.marketOverCols) * nums.marketOverIncY
            ];

            ctx.drawImage(await Canvas.loadImage(file), ...imagePos, ...nums.marketOverImgSize);
        }

        ctx.drawImage(await Canvas.loadImage(overlay), ...nums.originPos);

        for (let i=0; i<curShowing.length; i++) {
            const item = curShowing[i];

            const buyPos: [number, number] = [
                nums.marketOverBuyStart[0] + i % nums.marketOverCols * nums.marketOverIncX,
                nums.marketOverBuyStart[1] + Math.floor(i / nums.marketOverCols) * nums.marketOverIncY
            ];
            const sellPos: [number, number] = [
                nums.marketOverSellStart[0] + i % nums.marketOverCols * nums.marketOverIncX,
                nums.marketOverSellStart[1] + Math.floor(i / nums.marketOverCols) * nums.marketOverIncY
            ];

            let buyNowVal = strConfig.unavailable;
            let sellNowVal = strConfig.unavailable;

            for (const sellOrder of item.sellers) {
                if (sellOrder.num === sellOrder.filledAmount || sellOrder.listTime + nums.orderExpire < Date.now())
                    continue;
                buyNowVal = sellOrder.price.toLocaleString();
                break;
            }

            for (const buyOrder of item.buyers) {
                if (buyOrder.num === buyOrder.filledAmount || buyOrder.listTime + nums.orderExpire < Date.now())
                    continue;
                sellNowVal = buyOrder.price.toLocaleString();
                break;
            }

            CanvasUtils.drawText(
                ctx, 'B: %@' + buyNowVal, buyPos, font, 'center', colorConfig.font, nums.marketOverTextWidth, false,
                buyNowVal !== 'N/A' ? '$' : '', colorConfig.bucks
            );
            CanvasUtils.drawText(
                ctx, 'S: %@' + sellNowVal, sellPos, font, 'center', colorConfig.font, nums.marketOverTextWidth, false,
                sellNowVal !== 'N/A' ? '$' : '', colorConfig.bucks
            );
        }

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${strConfig.imageName}.png` });
    }

    public async makeBuySellImage(page: number, edition: number) {
        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        const item = this.itemPricing[page];

        const underlay = pathConfig.otherAssets + pathConfig.marketBuySellUnderlay;
        const overlay = pathConfig.otherAssets + pathConfig.marketBuySellOverlay;
        const file = pathConfig[item.type] + (this.config.itemConfigs[item.type][item.id].staticFile
            ? this.config.itemConfigs[item.type][item.id].staticFile
            : this.config.itemConfigs[item.type][item.id].file);

        let rarityName = 'Powerup';
        let rarityColor = colorConfig.powerup;
        let itemName = this.config.itemConfigs[item.type][item.id].name;
        let buyNowVal = strConfig.unavailable;
        let sellNowVal = strConfig.unavailable;
        let buyOrderVolume = 0;
        let sellOrderVolume = 0;

        if (item.type === 'boars') {
            const rarity = BoarUtils.findRarity(item.id, this.config);
            rarityName = rarity[1].name;
            rarityColor = colorConfig['rarity' + rarity[0]];
        }

        if (edition > 0) {
            for (const sellOrder of item.sellers) {
                const noEditionExists = sellOrder.num === sellOrder.filledAmount ||
                    sellOrder.listTime + nums.orderExpire < Date.now() ||
                    sellOrder.editions[0] !== edition;

                if (noEditionExists) continue;

                if (buyNowVal === strConfig.unavailable) {
                    buyNowVal = '%@' + sellOrder.price.toLocaleString();
                }

                sellOrderVolume++;
            }

            for (const buyOrder of item.buyers) {
                const noEditionExists = buyOrder.num === buyOrder.filledAmount ||
                    buyOrder.listTime + nums.orderExpire < Date.now() ||
                    buyOrder.editions[0] !== edition;

                if (noEditionExists) continue;

                if (sellNowVal === strConfig.unavailable) {
                    sellNowVal = '%@' + buyOrder.price.toLocaleString();
                }

                buyOrderVolume++;
            }

            itemName += ' #' + edition;
        } else {
            for (const sellOrder of item.sellers) {
                const lowBuyUnset = buyNowVal === strConfig.unavailable;
                const validOrder = sellOrder.num !== sellOrder.filledAmount &&
                    sellOrder.listTime + nums.orderExpire >= Date.now();

                if (!validOrder) continue;

                sellOrderVolume += sellOrder.num - sellOrder.filledAmount;

                if (lowBuyUnset) {
                    buyNowVal = '%@' + sellOrder.price.toLocaleString();
                }
            }

            for (const buyOrder of item.buyers) {
                const highSellUnset = sellNowVal === strConfig.unavailable;
                const validOrder = buyOrder.num !== buyOrder.filledAmount &&
                    buyOrder.listTime + nums.orderExpire >= Date.now();

                if (!validOrder) continue;

                buyOrderVolume += buyOrder.num - buyOrder.filledAmount;

                if (highSellUnset) {
                    sellNowVal = '%@' + buyOrder.price.toLocaleString();
                }
            }
        }

        const bigFont = `${nums.fontBig}px ${strConfig.fontName}`;
        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallMediumFont = `${nums.fontSmallMedium}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(...nums.marketSize);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(underlay), ...nums.originPos);

        ctx.drawImage(await Canvas.loadImage(file), ...nums.marketBSImgPos, ...nums.marketBSImgSize);

        CanvasUtils.drawText(ctx, rarityName.toUpperCase(), nums.marketBSRarityPos, mediumFont, 'center', rarityColor);
        CanvasUtils.drawText(
            ctx, itemName, nums.marketBSNamePos, bigFont, 'center', colorConfig.font, nums.marketBSNameWidth
        );

        CanvasUtils.drawText(
            ctx, strConfig.marketBSBuyNowLabel, nums.marketBSBuyNowLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(
            ctx, buyNowVal, nums.marketBSBuyNowPos, smallMediumFont, 'center', colorConfig.font,
            undefined, false, '$', colorConfig.bucks
        );

        CanvasUtils.drawText(
            ctx, strConfig.marketBSSellNowLabel, nums.marketBSSellNowLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(
            ctx, sellNowVal, nums.marketBSSellNowPos, smallMediumFont, 'center', colorConfig.font,
            undefined, false, '$', colorConfig.bucks
        );

        CanvasUtils.drawText(
            ctx, strConfig.marketBSBuyOrdLabel, nums.marketBSBuyOrdLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(
            ctx, buyOrderVolume.toLocaleString(), nums.marketBSBuyOrdPos, smallMediumFont, 'center', colorConfig.font
        );

        CanvasUtils.drawText(
            ctx, strConfig.marketBSSellOrdLabel, nums.marketBSSellOrdLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(
            ctx, sellOrderVolume.toLocaleString(), nums.marketBSSellOrdPos, smallMediumFont, 'center', colorConfig.font
        );

        ctx.drawImage(await Canvas.loadImage(overlay), ...nums.originPos);

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${strConfig.imageName}.png` });
    }

    public async makeOrdersImage(page: number) {
        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        let orderInfo: {data: BuySellData, id: string, type: string};
        let claimText = strConfig.emptySelect;
        let coloredClaimText = '';

        if (page < this.userBuyOrders.length) {
            orderInfo = this.userBuyOrders[page];
            const numToClaim = orderInfo.data.filledAmount - orderInfo.data.claimedAmount;

            if (orderInfo.data.claimedAmount < orderInfo.data.filledAmount && numToClaim === 1) {
                claimText = numToClaim.toLocaleString() + ' %@';
                coloredClaimText = this.config.itemConfigs[orderInfo.type][orderInfo.id].name;
            } else if (orderInfo.data.claimedAmount < orderInfo.data.filledAmount) {
                claimText = numToClaim.toLocaleString() + ' %@';
                coloredClaimText = this.config.itemConfigs[orderInfo.type][orderInfo.id].pluralName;
            }
        } else {
            orderInfo = this.userSellOrders[page - this.userBuyOrders.length];
            const numToClaim = orderInfo.data.filledAmount - orderInfo.data.claimedAmount;

            if (orderInfo.data.claimedAmount < orderInfo.data.filledAmount) {
                claimText = '%@' + (numToClaim * orderInfo.data.price).toLocaleString();
                coloredClaimText = '$';
            }
        }

        let rarityColor = colorConfig.powerup;
        let isSpecial = false;
        const isSell = page >= this.userBuyOrders.length;

        if (orderInfo.type === 'boars') {
            const rarity = BoarUtils.findRarity(orderInfo.id, this.config);
            rarityColor = colorConfig['rarity' + rarity[0]];
            isSpecial = rarity[1].name === 'Special' && rarity[0] !== 0;
        }

        const underlay = pathConfig.otherAssets + pathConfig.marketOrdersUnderlay;
        const file = pathConfig[orderInfo.type] + (this.config.itemConfigs[orderInfo.type][orderInfo.id].staticFile
            ? this.config.itemConfigs[orderInfo.type][orderInfo.id].staticFile
            : this.config.itemConfigs[orderInfo.type][orderInfo.id].file);

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallMediumFont = `${nums.fontSmallMedium}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(...nums.marketSize);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(underlay), ...nums.originPos);

        ctx.drawImage(await Canvas.loadImage(file), ...nums.marketOrdImgPos, ...nums.marketOrdImgSize);

        CanvasUtils.drawText(
            ctx, isSell ? strConfig.marketOrdSell : strConfig.marketOrdBuy, nums.marketOrdNamePos, mediumFont, 'center',
            colorConfig.font, nums.marketOrdNameWidth, true,
            this.config.itemConfigs[orderInfo.type][orderInfo.id].name + (isSpecial
                ? ' #' + orderInfo.data.editions[0]
                : ''),
            rarityColor
        );

        CanvasUtils.drawText(
            ctx, strConfig.marketOrdList.replace('%@',moment(orderInfo.data.listTime).fromNow()), nums.marketOrdListPos,
            mediumFont, 'center', colorConfig.font, nums.marketOrdNameWidth, true,
            (Date.now() > orderInfo.data.listTime + nums.oneDay * 7)
                ? strConfig.marketOrdExpire
                : '',
            colorConfig.error
        );

        CanvasUtils.drawText(
            ctx, strConfig.marketOrdPriceLabel, nums.marketOrdPriceLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(
            ctx, '%@' + orderInfo.data.price.toLocaleString(), nums.marketOrdPricePos, smallMediumFont, 'center',
            colorConfig.font, undefined, false, '$', colorConfig.bucks
        );

        CanvasUtils.drawText(
            ctx, strConfig.marketOrdFillLabel, nums.marketOrdFillLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(
            ctx, orderInfo.data.filledAmount.toLocaleString() + '/' + orderInfo.data.num.toLocaleString(),
            nums.marketOrdFillPos, smallMediumFont, 'center', colorConfig.font
        );

        CanvasUtils.drawText(
            ctx, strConfig.marketOrdClaimLabel, nums.marketOrdClaimLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(
            ctx, claimText, nums.marketOrdClaimPos, smallMediumFont, 'center', colorConfig.font,
            nums.marketOrdClaimWidth, false, coloredClaimText, coloredClaimText === '$'
                ? colorConfig.bucks
                : rarityColor
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${strConfig.imageName}.png` });
    }
}