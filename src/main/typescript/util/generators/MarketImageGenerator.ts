import Canvas from 'canvas';
import {BotConfig} from '../../bot/config/BotConfig';
import {AttachmentBuilder} from 'discord.js';
import {BuySellData} from '../data/global/BuySellData';
import {CanvasUtils} from './CanvasUtils';
import {BoarUtils} from '../boar/BoarUtils';

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
    private itemPricing: {id: string, type: string, instaSells: BuySellData[], instaBuys: BuySellData[]}[] = [];

    /**
     * Creates a new leaderboard image generator
     *
     * @param itemPricing
     * @param config - Used to get strings, paths, and other information
     */
    constructor(
        itemPricing: {id: string, type: string, instaSells: BuySellData[], instaBuys: BuySellData[]}[],
        config: BotConfig
    ) {
        this.itemPricing = itemPricing;
        this.config = config;
    }

    /**
     * Used when leaderboard boar type has changed
     *
     * @param itemPricing
     * @param config - Used to get strings, paths, and other information
     */
    public updateInfo(
        itemPricing: {id: string, type: string, instaSells: BuySellData[], instaBuys: BuySellData[]}[],
        config: BotConfig
    ): void {
        this.itemPricing = itemPricing;
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

        const curShowing = this.itemPricing.slice(page*8, (page+1) * 8);

        const imgStartPos = [25, 205];
        const buyStartPos = [248, 698];
        const sellStartPos = [248, 753];
        const incX = 466;
        const incY = 593;

        const cols = 4;

        for (let i=0; i<curShowing.length; i++) {
            const item = curShowing[i];
            const file = pathConfig[item.type] + (this.config.itemConfigs[item.type][item.id].staticFile
                ? this.config.itemConfigs[item.type][item.id].staticFile
                : this.config.itemConfigs[item.type][item.id].file);

            const imagePos: [number, number] = [
                imgStartPos[0] + i % cols * incX,
                imgStartPos[1] + Math.floor(i / cols) * incY
            ];

            ctx.drawImage(await Canvas.loadImage(file), ...imagePos, 443, 443);
        }

        ctx.drawImage(await Canvas.loadImage(overlay), ...nums.originPos);

        for (let i=0; i<curShowing.length; i++) {
            const item = curShowing[i];

            const buyPos: [number, number] = [
                buyStartPos[0] + i % cols * incX,
                buyStartPos[1] + Math.floor(i / cols) * incY
            ];
            const sellPos: [number, number] = [
                sellStartPos[0] + i % cols * incX,
                sellStartPos[1] + Math.floor(i / cols) * incY
            ];

            const buyVal = item.instaBuys.length > 0 ? item.instaBuys[0].price.toLocaleString() : 'N/A';
            const sellVal = item.instaSells.length > 0 ? item.instaSells[0].price.toLocaleString() : 'N/A';

            CanvasUtils.drawText(
                ctx, 'B: %@' + buyVal, buyPos, font, 'center', colorConfig.font, 420, false,
                buyVal !== 'N/A' ? '$' : '', colorConfig.bucks
            );
            CanvasUtils.drawText(
                ctx, 'S: %@' + sellVal, sellPos, font, 'center', colorConfig.font, 420, false,
                sellVal !== 'N/A' ? '$' : '', colorConfig.bucks
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
        let lowBuy: string = item.instaBuys.length > 0
            ? '%@' + item.instaBuys[0].price.toLocaleString()
            : 'N/A';
        let highSell: string = item.instaSells.length > 0
            ? '%@' + item.instaSells[0].price.toLocaleString()
            : 'N/A';
        let buyOrderVolume: number = 0;
        let sellOrderVolume: number = 0;

        if (item.type === 'boars') {
            const rarity = BoarUtils.findRarity(item.id, this.config);
            rarityName = rarity[1].name;
            rarityColor = colorConfig['rarity' + rarity[0]];
        }

        if (edition > 0) {
            let sellOrder: BuySellData | undefined;
            let buyOrder: BuySellData | undefined;

            for (const instaBuy of item.instaBuys) {
                if ((instaBuy.editions as number[])[0] !== edition) continue;
                if (!sellOrder) {
                    sellOrder = instaBuy;
                }
                sellOrderVolume++;
            }

            for (const instaSell of item.instaSells) {
                if ((instaSell.editions as number[])[0] !== edition) continue;
                if (!buyOrder) {
                    buyOrder = instaSell;
                }
                buyOrderVolume++;
            }

            itemName += ' #' + edition;
            lowBuy = sellOrder ? '%@' + sellOrder.price.toLocaleString() : 'N/A';
            highSell = buyOrder ? '%@' + buyOrder.price.toLocaleString() : 'N/A';
        } else {
            for (const instaBuy of item.instaBuys) {
                sellOrderVolume += instaBuy.num;
            }

            for (const instaSell of item.instaSells) {
                buyOrderVolume += instaSell.num;
            }
        }

        const bigFont: string = `${nums.fontBig}px ${strConfig.fontName}`;
        const mediumFont: string = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallMediumFont: string = `${nums.fontSmallMedium}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(...nums.marketSize);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(underlay), ...nums.originPos);

        ctx.drawImage(await Canvas.loadImage(file), 710, 205, 1159, 1159);

        CanvasUtils.drawText(ctx, rarityName.toUpperCase(), [358, 334], mediumFont, 'center', rarityColor);
        CanvasUtils.drawText(
            ctx, itemName, [358, 400], bigFont, 'center', colorConfig.font, 620
        );

        CanvasUtils.drawText(ctx, 'Buy Now Price', [358, 568], mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(
            ctx, lowBuy, [358, 639], smallMediumFont, 'center', colorConfig.font,
            undefined, false, '$', colorConfig.bucks
        );

        CanvasUtils.drawText(ctx, 'Sell Now Price', [358, 764], mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(
            ctx, highSell, [358, 835], smallMediumFont, 'center', colorConfig.font,
            undefined, false, '$', colorConfig.bucks
        );

        CanvasUtils.drawText(ctx, 'Buy Order Volume', [358, 960], mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(
            ctx, buyOrderVolume.toLocaleString(), [358, 1031], smallMediumFont, 'center', colorConfig.font
        );

        CanvasUtils.drawText(ctx, 'Sell Offer Volume', [358, 1156], mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(
            ctx, sellOrderVolume.toLocaleString(), [358, 1227], smallMediumFont, 'center', colorConfig.font
        );

        ctx.drawImage(await Canvas.loadImage(overlay), ...nums.originPos);

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${strConfig.imageName}.png` });
    }
}