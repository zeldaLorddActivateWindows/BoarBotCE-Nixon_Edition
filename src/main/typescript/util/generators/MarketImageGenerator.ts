import Canvas from 'canvas';
import {BotConfig} from '../../bot/config/BotConfig';
import {AttachmentBuilder} from 'discord.js';
import {BuySellData} from '../data/global/BuySellData';

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

        const underlay = pathConfig.otherAssets + pathConfig.marketOverviewUnderlay;
        const overlay = pathConfig.otherAssets + pathConfig.marketOverviewOverlay;

        const canvas = Canvas.createCanvas(...nums.marketSize);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(underlay), ...nums.originPos);

        const curShowing = this.itemPricing.slice(page*8, (page+1) * 8);

        const startPos = [25, 205];
        const incX = 466;
        const incY = 593;

        const cols = 4;

        for (let i=0; i<curShowing.length; i++) {
            const item = curShowing[i];
            const file = pathConfig[item.type] + (this.config.itemConfigs[item.type][item.id].staticFile
                ? this.config.itemConfigs[item.type][item.id].staticFile
                : this.config.itemConfigs[item.type][item.id].file);

            const pos: [number, number] = [
                startPos[0] + i % cols * incX,
                startPos[1] + Math.floor(i / cols) * incY
            ];

            ctx.drawImage(await Canvas.loadImage(file), ...pos, 443, 443);
        }

        ctx.drawImage(await Canvas.loadImage(overlay), ...nums.originPos);

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${strConfig.imageName}.png` });
    }
}