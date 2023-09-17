import Canvas from 'canvas';
import {BotConfig} from '../../bot/config/BotConfig';
import {BoarUtils} from '../boar/BoarUtils';
import {CanvasUtils} from './CanvasUtils';
import {AttachmentBuilder} from 'discord.js';
import {BoarUser} from '../boar/BoarUser';
import moment from 'moment/moment';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import {PromptConfig} from '../../bot/config/prompts/PromptConfig';
import {StringConfig} from '../../bot/config/StringConfig';
import {NumberConfig} from '../../bot/config/NumberConfig';
import {ColorConfig} from '../../bot/config/ColorConfig';
import {PathConfig} from '../../bot/config/PathConfig';
import {ItemConfig} from '../../bot/config/items/ItemConfig';
import {PromptConfigs} from '../../bot/config/prompts/PromptConfigs';
import {ItemConfigs} from '../../bot/config/items/ItemConfigs';
import {PowerupStats} from '../../bot/data/user/stats/PowerupStats';
import {CollectedPowerup} from '../../bot/data/user/collectibles/CollectedPowerup';

/**
 * {@link CollectionImageGenerator CollectionImageGenerator.ts}
 *
 * Creates the dynamic collection image.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CollectionImageGenerator {
    private boarUser: BoarUser = {} as BoarUser;
    private config: BotConfig = {} as BotConfig;
    private allBoars: any[] = [];
    private normalBase: Buffer = {} as Buffer;
    private detailedBase: Buffer = {} as Buffer;
    private powerupsBase: Buffer = {} as Buffer;

    /**
     * Creates a new collection image generator
     *
     * @param boarUser - The user that has their collection open
     * @param boars - All boars and information about those boars that a user has
     * @param config - Used to get strings, paths, and other information
     */
    constructor(boarUser: BoarUser, boars: any[], config: BotConfig) {
        this.boarUser = boarUser;
        this.config = config;
        this.allBoars = boars;
    }

    /**
     * Used when collection information needs to be updated internally
     *
     * @param boarUser - The user that has their collection open
     * @param boars - All boars and information about those boars that a user has
     * @param config - Used to get strings, paths, and other information
     */
    public updateInfo(boarUser: BoarUser, boars: any[], config: BotConfig): void {
        this.boarUser = boarUser;
        this.config = config;
        this.allBoars = boars;
        this.normalBase = {} as Buffer;
        this.detailedBase = {} as Buffer;
        this.powerupsBase = {} as Buffer;
    }

    /**
     * Creates the base image of the Normal view
     */
    public async createNormalBase(): Promise<void> {
        // Config aliases

        const strConfig: StringConfig = this.config.stringConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        const collectionUnderlay: string = this.config.pathConfig.collAssets + this.config.pathConfig.collUnderlay;

        const maxUniques: number = Object.keys(this.config.itemConfigs.boars).length;
        let userUniques: number = Object.keys(this.boarUser.itemCollection.boars).length;

        for (const boarID of Object.keys(this.boarUser.itemCollection.boars)) {
            if (this.boarUser.itemCollection.boars[boarID].num === 0) {
                userUniques--;
            }
        }

        // Fixes stats through flooring/alternate values

        const scoreString: string = Math.min(this.boarUser.stats.general.boarScore, nums.maxScore).toLocaleString();
        const totalString: string = Math.min(this.boarUser.stats.general.totalBoars, nums.maxBoars).toLocaleString();
        const uniqueString: string = Math.min(userUniques, maxUniques).toLocaleString();
        const dailiesString: string = Math.min(this.boarUser.stats.general.numDailies, nums.maxDailies)
            .toLocaleString();
        const streakString: string = Math.min(this.boarUser.stats.general.boarStreak, nums.maxStreak).toLocaleString();
        const lastDailyString: string = this.boarUser.stats.general.lastDaily > 0
            ? moment(this.boarUser.stats.general.lastDaily).fromNow()
            : strConfig.unavailable;

        // Font info

        const bigFont = `${nums.fontBig}px ${strConfig.fontName}`;
        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallFont = `${nums.fontSmallMedium}px ${strConfig.fontName}`;

        const canvas: Canvas.Canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(collectionUnderlay), ...nums.originPos, ...nums.collImageSize);
        await this.drawTopBar(ctx);

        // Draws stats information

        await CanvasUtils.drawText(
            ctx, strConfig.collScoreLabel, nums.collScoreLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(
            ctx, '$' + scoreString, nums.collScorePos, smallFont, 'center', colorConfig.bucks
        );

        await CanvasUtils.drawText(
            ctx, strConfig.collTotalLabel, nums.collTotalLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, totalString, nums.collTotalPos, smallFont, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collUniquesLabel, nums.collUniquesLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, uniqueString, nums.collUniquePos, smallFont, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collDailiesLabel, nums.collDailiesLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, dailiesString, nums.collDailiesPos, smallFont, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collStreakLabel, nums.collStreakLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, streakString, nums.collStreakPos, smallFont, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collLastDailyLabel, nums.collLastDailyLabelPos, bigFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, lastDailyString, nums.collLastDailyPos, bigFont, 'center', colorConfig.font);

        this.normalBase = canvas.toBuffer();
    }

    /**
     * Returns whether the normal base has been made
     */
    public normalBaseMade(): boolean { return Object.keys(this.normalBase).length !== 0; }

    /**
     * Finalizes the Normal view image
     *
     * @param page - The page to finalize
     */
    public async finalizeNormalImage(page: number): Promise<AttachmentBuilder> {
        // Config aliases

        const strConfig: StringConfig = this.config.stringConfig;
        const pathConfig: PathConfig = this.config.pathConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        // Asset path info

        const boarsFolder: string = pathConfig.boars;
        const collectionOverlay: string = pathConfig.collAssets + pathConfig.collOverlay;

        const boarsPerPage: number = nums.collBoarsPerPage;

        const smallestFont = `${nums.fontSmallest}px ${strConfig.fontName}`;

        const lastBoarRarity: [number, RarityConfig] = BoarUtils
            .findRarity(this.boarUser.stats.general.lastBoar, this.config);
        const favBoarRarity: [number, RarityConfig] = BoarUtils
            .findRarity(this.boarUser.stats.general.favoriteBoar, this.config);

        const curBoars: any[] = this.allBoars.slice(page * boarsPerPage, (page+1)*boarsPerPage);

        const canvas: Canvas.Canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(this.normalBase), ...nums.originPos, ...nums.collImageSize);

        ctx.drawImage(canvas, ...nums.originPos, ...nums.collImageSize);

        // Draws boars and rarities
        for (let i=0; i<curBoars.length; i++) {
            const boarImagePos: [number, number] = [
                nums.collBoarStartX + (i % nums.collBoarCols) * nums.collBoarSpacingX,
                nums.collBoarStartY + Math.floor(i / nums.collBoarCols) * nums.collBoarSpacingY
            ];

            const lineStartPos: [number, number] = [
                nums.collRarityStartX + (i % nums.collBoarCols) * nums.collBoarSpacingX,
                nums.collRarityStartY + Math.floor(i / nums.collBoarCols) * nums.collBoarSpacingY
            ];

            const lineEndPos: [number, number] = [
                nums.collRarityStartX + nums.collRarityEndDiff + (i % nums.collBoarCols) * nums.collBoarSpacingX,
                nums.collRarityStartY - nums.collRarityEndDiff +
                Math.floor(i / nums.collBoarCols) * nums.collBoarSpacingY
            ];

            const boarFile: string = curBoars[i].staticFile
                ? boarsFolder + curBoars[i].staticFile
                : boarsFolder + curBoars[i].file;

            ctx.drawImage(await Canvas.loadImage(boarFile), ...boarImagePos, ...nums.collBoarSize);
            CanvasUtils.drawLine(
                ctx, lineStartPos, lineEndPos, nums.collRarityWidth, curBoars[i].color
            );
        }

        // Draws last boar gotten and rarity
        if (this.boarUser.stats.general.lastBoar !== '') {
            const lastBoarDetails: ItemConfig = this.config.itemConfigs.boars[this.boarUser.stats.general.lastBoar];
            const boarFile: string = lastBoarDetails.staticFile
                ? boarsFolder + lastBoarDetails.staticFile
                : boarsFolder + lastBoarDetails.file;

            ctx.drawImage(await Canvas.loadImage(boarFile), ...nums.collLastBoarPos, ...nums.collLastBoarSize);
        }

        // Draws favorite boar and rarity
        if (this.boarUser.stats.general.favoriteBoar !== '') {
            const favoriteBoarDetails: ItemConfig =
                this.config.itemConfigs.boars[this.boarUser.stats.general.favoriteBoar];
            const boarFile: string = favoriteBoarDetails.staticFile
                ? boarsFolder + favoriteBoarDetails.staticFile
                : boarsFolder + favoriteBoarDetails.file;

            ctx.drawImage(await Canvas.loadImage(boarFile), ...nums.collFavBoarPos, ...nums.collFavBoarSize);
        }

        // Draws overlay

        ctx.drawImage(await Canvas.loadImage(collectionOverlay), ...nums.originPos, ...nums.collImageSize);
        await CanvasUtils.drawText(
            ctx, strConfig.collFavLabel, nums.collFavLabelPos, smallestFont,
            'center', favBoarRarity[0] === 0 ? colorConfig.font : colorConfig['rarity' + favBoarRarity[0]]
        );
        await CanvasUtils.drawText(
            ctx, strConfig.collRecentLabel, nums.collRecentLabelPos, smallestFont,
            'center', lastBoarRarity[0] === 0 ? colorConfig.font : colorConfig['rarity' + lastBoarRarity[0]]
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name:`${strConfig.defaultImageName}.png` });
    }

    /**
     * Creates the base image of the Detailed view
     */
    public async createDetailedBase(): Promise<void> {
        // Config aliases

        const strConfig: StringConfig = this.config.stringConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        const collectionUnderlay: string = this.config.pathConfig.collAssets +
            this.config.pathConfig.collDetailUnderlay;

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;

        const canvas: Canvas.Canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(collectionUnderlay), ...nums.originPos, ...nums.collImageSize);
        await this.drawTopBar(ctx);

        // Draws labels

        await CanvasUtils.drawText(
            ctx, strConfig.collIndivTotalLabel, nums.collIndivTotalLabelPos, mediumFont, 'center', colorConfig.font
        );

        await CanvasUtils.drawText(
            ctx, strConfig.collFirstObtainedLabel, nums.collFirstObtainedLabelPos,
            mediumFont, 'center', colorConfig.font
        );

        await CanvasUtils.drawText(
            ctx, strConfig.collLastObtainedLabel, nums.collLastObtainedLabelPos, mediumFont, 'center', colorConfig.font
        );

        await CanvasUtils.drawText(
            ctx, strConfig.collDescriptionLabel, nums.collDescriptionLabelPos, mediumFont, 'center', colorConfig.font
        );

        this.detailedBase = canvas.toBuffer();
    }

    /**
     * Returns whether the detailed base has been made
     */
    public detailedBaseMade(): boolean { return Object.keys(this.detailedBase).length !== 0; }

    /**
     * Finalizes the Detailed view image
     *
     * @param page - The page to finalize
     */
    public async finalizeDetailedImage(page: number): Promise<AttachmentBuilder> {
        // Config aliases

        const strConfig: StringConfig = this.config.stringConfig;
        const pathConfig: PathConfig = this.config.pathConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        // Asset path info

        const boarsFolder: string = pathConfig.boars;
        const collectionOverlay: string = pathConfig.collAssets + pathConfig.collDetailOverlay;

        // Font info

        const bigFont = `${nums.fontBig}px ${strConfig.fontName}`;
        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallMediumFont = `${nums.fontSmallMedium}px ${strConfig.fontName}`;
        const smallestFont = `${nums.fontSmallest}px ${strConfig.fontName}`;

        const curBoar: any = this.allBoars[page];

        // Dynamic information (stats, images)

        const boarFile: string = curBoar.staticFile ? boarsFolder + curBoar.staticFile : boarsFolder + curBoar.file;
        const numCollectedString: string = Math.min(curBoar.num, nums.maxIndivBoars).toLocaleString();
        const firstObtainedDate: string = new Date(curBoar.firstObtained)
            .toLocaleString('en-US', {month:'long',day:'numeric',year:'numeric'});
        const lastObtainedDate: string = new Date(curBoar.lastObtained)
            .toLocaleString('en-US', {month:'long',day:'numeric',year:'numeric'});

        const canvas: Canvas.Canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(this.detailedBase), ...nums.originPos, ...nums.collImageSize);
        ctx.drawImage(canvas, ...nums.originPos, ...nums.collImageSize);
        ctx.drawImage(await Canvas.loadImage(boarFile), ...nums.collIndivBoarPos, ...nums.collIndivBoarSize);

        // Shows a star when on a favorite boar

        const indivRarityPos: [number, number] = [...nums.collIndivRarityPos];
        if (curBoar.id == this.boarUser.stats.general.favoriteBoar) {
            const favoriteFile: string = pathConfig.collAssets + pathConfig.favorite;
            ctx.font = mediumFont;

            indivRarityPos[0] -= nums.collIndivFavSize[0] / 2 + 10;
            const favoritePos: [number, number] = [
                ctx.measureText(curBoar.rarity[1].name.toUpperCase()).width / 2 + indivRarityPos[0] + 10,
                nums.collIndivFavHeight
            ];

            ctx.drawImage(await Canvas.loadImage(favoriteFile), ...favoritePos, ...nums.collIndivFavSize);
        }

        // Draws stats

        await CanvasUtils.drawText(
            ctx, curBoar.rarity[1].name.toUpperCase(), indivRarityPos, mediumFont, 'center', curBoar.color
        );

        await CanvasUtils.drawText(
            ctx, curBoar.name, nums.collBoarNamePos, bigFont, 'center', colorConfig.font, nums.collBoarNameWidth
        );

        await CanvasUtils.drawText(
            ctx, numCollectedString, nums.collIndivTotalPos, smallMediumFont, 'center', colorConfig.font
        );

        await CanvasUtils.drawText(
            ctx, firstObtainedDate, nums.collFirstObtainedPos, smallMediumFont, 'center', colorConfig.font
        );

        await CanvasUtils.drawText(
            ctx, lastObtainedDate, nums.collLastObtainedPos, smallMediumFont, 'center', colorConfig.font
        );

        await CanvasUtils.drawText(
            ctx, curBoar.description + ' %@', nums.collDescriptionPos, smallestFont,
            'center', colorConfig.font, nums.collDescriptionWidth, true,
            [curBoar.isSB ? strConfig.collDescriptionSB : ''], [colorConfig.silver]
        );

        ctx.drawImage(await Canvas.loadImage(collectionOverlay), ...nums.originPos, ...nums.collImageSize);

        return new AttachmentBuilder(canvas.toBuffer(), { name:`${strConfig.defaultImageName}.png` });
    }

    /**
     * Creates the base image of the Powerups view
     *
     * @param page - The page to make the base for
     */
    public async createPowerupsBase(page: number): Promise<void> {
        switch (page) {
            case 2:
                await this.createPowBaseThree();
                break;
            case 1:
                await this.createPowBaseTwo();
                break;
            default:
                await this.createPowBaseOne();
        }
    }

    /**
     * Creates the base image for the first page of Powerups view
     *
     * @private
     */
    private async createPowBaseOne(): Promise<void> {
        // Config aliases

        const strConfig: StringConfig = this.config.stringConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const pathConfig: PathConfig = this.config.pathConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;
        const promptConfig: PromptConfigs = this.config.promptConfigs;
        const rarityConfigs: RarityConfig[] = this.config.rarityConfigs;
        const powItemConfigs: ItemConfigs = this.config.itemConfigs.powerups;

        const collectionUnderlay: string = pathConfig.collAssets + pathConfig.collPowerUnderlay;

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallMedium = `${nums.fontSmallMedium}px ${strConfig.fontName}`;

        const powerupItemsData: Record<string, CollectedPowerup> = this.boarUser.itemCollection.powerups;
        const powerupData: PowerupStats = this.boarUser.stats.powerups;

        const totalAttempts: string = Math.min(powerupData.attempts, nums.maxPowBase).toLocaleString();
        const topAttempts: string = Math.min(powerupData.oneAttempts, nums.maxPowBase).toLocaleString();
        const fastestTime: string = powerupData.fastestTime
            ? powerupData.fastestTime.toLocaleString() + 'ms'
            : 'N/A';

        const promptMap: Map<string, number> = new Map<string, number>();
        for (const promptType of Object.keys(powerupData.prompts)) {
            const typeName: string = promptConfig.types[promptType].name;
            for (const prompt of Object.keys(powerupData.prompts[promptType])) {
                if (
                    typeof promptConfig.types[promptType][prompt] === 'string' ||
                    typeof promptConfig.types[promptType][prompt] === 'number'
                ) {
                    continue;
                }

                const promptName: string = (promptConfig.types[promptType][prompt] as PromptConfig).name;

                promptMap.set(typeName + ' - ' + promptName, powerupData.prompts[promptType][prompt].avg);
            }
        }

        let bestPrompt: [string, number] = [strConfig.unavailable, 100];
        for (const [key, val] of promptMap) {
            if (val <= bestPrompt[1]) {
                bestPrompt = [key, val];
            }
        }

        let multiplier: number = Math.min(this.boarUser.stats.general.multiplier, nums.maxPowBase);
        const miracles: string = Math.min(powerupItemsData.miracle.numTotal, nums.maxPowBase).toLocaleString();
        const gifts: string = Math.min(powerupItemsData.gift.numTotal, nums.maxSmallPow).toLocaleString();
        const clones: string = Math.min(powerupItemsData.clone.numTotal, nums.maxSmallPow).toLocaleString();

        const canvas: Canvas.Canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(collectionUnderlay), ...nums.originPos, ...nums.collImageSize);
        await this.drawTopBar(ctx);

        // Draws stats info

        await CanvasUtils.drawText(
            ctx, strConfig.collClaimsLabel, nums.collAttemptsLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, totalAttempts, nums.collAttemptsPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collFastestClaimsLabel, nums.collAttemptsTopLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, topAttempts, nums.collAttemptsTopPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collFastestTimeLabel, nums.collFastestTimeLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, fastestTime, nums.collFastestTimePos, smallMedium, 'center', colorConfig.font);


        await CanvasUtils.drawText(
            ctx, strConfig.collBestPromptLabel, nums.collBestPromptLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(
            ctx, bestPrompt[0], nums.collBestPromptPos, smallMedium, 'center', colorConfig.font, nums.collPowDataWidth
        );

        await CanvasUtils.drawText(
            ctx, strConfig.collBlessLabel, nums.collBlessLabelPos, mediumFont, 'center', colorConfig.font
        );

        if (powerupItemsData.miracle.numActive as number > 0) {
            for (let i=0; i<(powerupItemsData.miracle.numActive as number); i++) {
                multiplier += Math.min(
                    Math.ceil(multiplier * 0.05), this.config.numberConfig.miracleIncreaseMax
                );
            }

            await CanvasUtils.drawText(
                ctx, multiplier.toLocaleString() + '\u2738', nums.collBlessPos,
                smallMedium, 'center', colorConfig.powerup
            );
        } else {
            await CanvasUtils.drawText(
                ctx, multiplier.toLocaleString(), nums.collBlessPos, smallMedium, 'center', colorConfig.font
            );
        }

        await CanvasUtils.drawText(
            ctx, powItemConfigs.miracle.pluralName, nums.collMiraclesLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, miracles, nums.collMiraclesPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collGiftsLabel, nums.collGiftsLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, gifts, nums.collGiftsPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collClonesLabel, nums.collClonesLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, clones, nums.collClonesPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collCellLabel, nums.collCellLabelPos, mediumFont, 'center', colorConfig.font
        );

        let cellImagePath = pathConfig.collAssets + pathConfig.cellNone;
        let chargeStr = 'No';
        let chargeColor = colorConfig.rarity1;

        [...rarityConfigs].reverse().every((rarityConfig, index) => {
            if (rarityConfig.enhancersNeeded === 0 || powerupItemsData.enhancer.numTotal < rarityConfig.enhancersNeeded)
                return true;

            cellImagePath = pathConfig.collAssets + pathConfig['cell' + rarityConfig.name];
            chargeStr = rarityConfig.name;
            chargeColor = colorConfig['rarity' + (rarityConfigs.length - index)];
        });

        chargeStr += ` Charge! (${powerupItemsData.enhancer.numTotal}/${nums.maxEnhancers})`;
        ctx.drawImage(await Canvas.loadImage(cellImagePath), ...nums.collCellPos, ...nums.collCellSize);
        await await CanvasUtils.drawText(ctx, chargeStr, nums.collChargePos, mediumFont, 'center', chargeColor);

        this.powerupsBase = canvas.toBuffer();
    }

    /**
     * Creates the base image for the second page of Powerups view
     *
     * @private
     */
    private async createPowBaseTwo(): Promise<void> {
        // Config aliases

        const strConfig: StringConfig = this.config.stringConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const pathConfig: PathConfig = this.config.pathConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        const collectionUnderlay: string = pathConfig.collAssets + pathConfig.collPowerUnderlay2;

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallMedium = `${nums.fontSmallMedium}px ${strConfig.fontName}`;

        const powerupItemsData: Record<string, CollectedPowerup> = this.boarUser.itemCollection.powerups;

        const miraclesClaimed: string = Math.min(powerupItemsData.miracle.numClaimed, nums.maxPowBase)
            .toLocaleString();
        const miraclesUsed: string = Math.min(powerupItemsData.miracle.numUsed, nums.maxPowBase).toLocaleString();
        const highestBless: string = Math.min(this.boarUser.stats.general.highestMulti, nums.maxPowBase)
            .toLocaleString();
        const highestMiracles: string = Math.min(powerupItemsData.miracle.highestTotal, nums.maxPowBase)
            .toLocaleString();
        const giftsClaimed: string = Math.min(powerupItemsData.gift.numClaimed, nums.maxPowBase).toLocaleString();
        const giftsUsed: string = Math.min(powerupItemsData.gift.numUsed, nums.maxPowBase).toLocaleString();
        const giftsOpened: string = Math.min(powerupItemsData.gift.numOpened as number, nums.maxPowBase)
            .toLocaleString();
        const giftsMost: string = Math.min(powerupItemsData.gift.highestTotal, nums.maxPowBase).toLocaleString();

        const canvas: Canvas.Canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(collectionUnderlay), ...nums.originPos, ...nums.collImageSize);
        await this.drawTopBar(ctx);

        // Draws stats info

        await CanvasUtils.drawText(
            ctx, strConfig.collMiraclesClaimedLabel, nums.collLifetimeMiraclesLabelPos,
            mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(
            ctx, miraclesClaimed, nums.collLifetimeMiraclesPos, smallMedium, 'center', colorConfig.font
        );

        await CanvasUtils.drawText(
            ctx, strConfig.collMiraclesUsedLabel, nums.collMiraclesUsedLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, miraclesUsed, nums.collMiraclesUsedPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collMostMiraclesLabel, nums.collMostMiraclesLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, highestMiracles, nums.collMostMiraclesPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collHighestMultiLabel, nums.collHighestMultiLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, highestBless, nums.collHighestMultiPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collGiftsClaimedLabel, nums.collGiftsClaimedLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, giftsClaimed, nums.collGiftsClaimedPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collGiftsUsedLabel, nums.collGiftsUsedLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, giftsUsed, nums.collGiftsUsedPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collGiftsOpenedLabel, nums.collGiftsOpenedLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, giftsOpened, nums.collGiftsOpenedPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collMostGiftsLabel, nums.collMostGiftsLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, giftsMost, nums.collMostGiftsPos, smallMedium, 'center', colorConfig.font);

        this.powerupsBase = canvas.toBuffer();
    }

    /**
     * Creates the base image for the third page of Powerups view
     *
     * @private
     */
    private async createPowBaseThree(): Promise<void> {
        // Config aliases

        const strConfig: StringConfig = this.config.stringConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const pathConfig: PathConfig = this.config.pathConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;
        const rarityConfig: RarityConfig[] = this.config.rarityConfigs;

        const collectionUnderlay: string = pathConfig.collAssets + pathConfig.collPowerUnderlay3;

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallMedium = `${nums.fontSmallMedium}px ${strConfig.fontName}`;

        const powerupItemsData: Record<string, CollectedPowerup> = this.boarUser.itemCollection.powerups;

        const clonesClaimed: string = Math.min(powerupItemsData.clone.numClaimed, nums.maxPowBase).toLocaleString();
        const clonesUsed: string = Math.min(powerupItemsData.clone.numUsed, nums.maxPowBase).toLocaleString();
        const clonesSucc: string =
            Math.min(powerupItemsData.clone.numSuccess as number, nums.maxPowBase).toLocaleString();
        const clonesMost: string = Math.min(powerupItemsData.clone.highestTotal, nums.maxPowBase).toLocaleString();

        const enhancersClaimed: string = Math.min(powerupItemsData.enhancer.numClaimed, nums.maxPowBase)
            .toLocaleString();

        const enhanced: string[] = [];
        for (let i=0; i<(powerupItemsData.enhancer.raritiesUsed as number[]).length; i++) {
            if (i < 3) {
                enhanced.push(Math.min((powerupItemsData.enhancer.raritiesUsed as number[])[i], nums.maxPowBase)
                    .toLocaleString())
            } else {
                enhanced.push(Math.min((powerupItemsData.enhancer.raritiesUsed as number[])[i], nums.maxSmallPow)
                    .toLocaleString())
            }
        }

        const canvas: Canvas.Canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(collectionUnderlay), ...nums.originPos, ...nums.collImageSize);
        await this.drawTopBar(ctx);

        // Draws stats info

        await CanvasUtils.drawText(
            ctx, strConfig.collClonesClaimedLabel, nums.collClonesClaimedLabelPos,
            mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(
            ctx, clonesClaimed, nums.collClonesClaimedPos, smallMedium, 'center', colorConfig.font
        );

        await CanvasUtils.drawText(
            ctx, strConfig.collClonesUsedLabel, nums.collClonesUsedLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, clonesUsed, nums.collClonesUsedPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collClonesSuccLabel, nums.collClonesSuccLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, clonesSucc, nums.collClonesSuccPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collMostClonesLabel, nums.collMostClonesLabelPos, mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(ctx, clonesMost, nums.collMostClonesPos, smallMedium, 'center', colorConfig.font);

        await CanvasUtils.drawText(
            ctx, strConfig.collEnhancersClaimedLabel, nums.collEnhancersClaimedLabelPos,
            mediumFont, 'center', colorConfig.font
        );
        await CanvasUtils.drawText(
            ctx, enhancersClaimed, nums.collEnhancersClaimedPos, smallMedium, 'center', colorConfig.font
        );

        for (let i=0; i<7; i++) {
            if (i < 3) {
                await CanvasUtils.drawText(
                    ctx, strConfig.collEnhancedLabel, nums.collEnhancedLabelPositions[i], mediumFont, 'center',
                    colorConfig.font, undefined, false, [rarityConfig[i].pluralName], [colorConfig['rarity' + (i+1)]]
                );
            } else {
                await CanvasUtils.drawText(
                    ctx, rarityConfig[i].pluralName, nums.collEnhancedLabelPositions[i],
                    mediumFont, 'center', colorConfig['rarity' + (i+1)]
                );
            }

            await CanvasUtils.drawText(
                ctx, enhanced[i], nums.collEnhancedPositions[i], smallMedium, 'center', colorConfig.font
            );
        }

        this.powerupsBase = canvas.toBuffer();
    }

    /**
     * Returns whether a powerups base has been made
     */
    public powerupsBaseMade(): boolean { return Object.keys(this.powerupsBase).length !== 0; }

    /**
     * Finalizes the Powerups view image
     */
    public async finalizePowerupsImage(): Promise<AttachmentBuilder> {
        const nums: NumberConfig = this.config.numberConfig;
        const collectionOverlay: string = this.config.pathConfig.collAssets + this.config.pathConfig.collPowerOverlay;

        const canvas: Canvas.Canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(this.powerupsBase), ...nums.originPos, ...nums.collImageSize);
        ctx.drawImage(canvas, ...nums.originPos, ...nums.collImageSize);

        ctx.drawImage(await Canvas.loadImage(collectionOverlay), ...nums.originPos, ...nums.collImageSize);

        return new AttachmentBuilder(canvas.toBuffer(), { name:`${this.config.stringConfig.defaultImageName}.png` });
    }

    /**
     * Creates the top bar present on all views
     *
     * @param ctx - CanvasRenderingContext2D
     */
    public async drawTopBar(ctx: Canvas.CanvasRenderingContext2D): Promise<void> {
        // Config aliases

        const strConfig: StringConfig = this.config.stringConfig;
        const pathConfig: PathConfig = this.config.pathConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        const noClan: string = pathConfig.collAssets + pathConfig.clanNone;

        // Non-trivial user information

        const userTag: string = this.boarUser.user.username.substring(0, nums.maxUsernameLength);
        let userAvatar;

        try {
            userAvatar = await Canvas.loadImage(this.boarUser.user.displayAvatarURL({ extension: 'png' }));
        } catch {
            userAvatar = await Canvas.loadImage(pathConfig.otherAssets + pathConfig.noAvatar);
        }

        // Fixes stats through flooring/alternate values

        const firstDate: string = this.boarUser.stats.general.firstDaily > 0
            ? new Date(this.boarUser.stats.general.firstDaily)
                .toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric'})
            : strConfig.unavailable;

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;

        ctx.drawImage(userAvatar, ...nums.collUserAvatarPos, ...nums.collUserAvatarSize);
        await CanvasUtils.drawText(ctx, userTag, nums.collUserTagPos, mediumFont, 'left', colorConfig.font);
        await CanvasUtils.drawText(ctx, strConfig.collDateLabel, nums.collDateLabelPos, mediumFont, 'left', colorConfig.font);
        await CanvasUtils.drawText(ctx, firstDate, nums.collDatePos, mediumFont, 'left', colorConfig.font);
        ctx.drawImage(await Canvas.loadImage(noClan), ...nums.collClanPos, ...nums.collClanSize);

        // Draws badge information if the user has badges

        let numBadges = 0;
        for (let i=0; i<Object.keys(this.boarUser.itemCollection.badges).length; i++) {
            const badgeID = Object.keys(this.boarUser.itemCollection.badges)[i];

            if (!this.boarUser.itemCollection.badges[badgeID].possession) continue;

            const badgesFolder: string = pathConfig.badges;
            const badgeXY: [number, number] =
                [nums.collBadgeStart + numBadges * nums.collBadgeSpacing, nums.collBadgeY];
            const badgeFile: string = badgesFolder + this.config.itemConfigs.badges[badgeID].file;

            ctx.drawImage(await Canvas.loadImage(badgeFile), ...badgeXY, ...nums.collBadgeSize);

            numBadges++;
        }

        if (numBadges === 0) {
            await CanvasUtils.drawText(
                ctx, strConfig.collNoBadges, nums.collNoBadgePos, mediumFont, 'left', colorConfig.font
            );
        }
    }

    /**
     * Creates enhancer confirmation image
     *
     * @param page - The page of the boar that's being enhanced
     */
    public async finalizeEnhanceConfirm(page: number): Promise<AttachmentBuilder> {
        // Config aliases

        const strConfig: StringConfig = this.config.stringConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const pathConfig: PathConfig = this.config.pathConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;
        const rarityConfig: RarityConfig[] = this.config.rarityConfigs;

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;

        const confirmUnderlay: string = pathConfig.collAssets + pathConfig.collEnhanceUnderlay;
        const cellImagePath: string = pathConfig.collAssets + pathConfig['cell' + this.allBoars[page].rarity[1].name];
        const boarImagePath: string = pathConfig.boars + (this.allBoars[page].staticFile
            ? this.allBoars[page].staticFile
            : this.allBoars[page].file);

        const nextRarityIndex: number = this.allBoars[page].rarity[0];
        const nextRarityName: string = rarityConfig[nextRarityIndex].name;
        const nextRarityColor: string = colorConfig['rarity' + (nextRarityIndex + 1)];
        const scoreLost: string = (this.allBoars[page].rarity[1].enhancersNeeded * 5).toLocaleString();

        const canvas: Canvas.Canvas = Canvas.createCanvas(...nums.enhanceImageSize);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(confirmUnderlay), ...nums.originPos, ...nums.enhanceImageSize);

        ctx.drawImage(await Canvas.loadImage(cellImagePath), ...nums.enhanceCellPos, ...nums.enhanceCellSize);

        ctx.drawImage(await Canvas.loadImage(boarImagePath), ...nums.enhanceBoarPos, ...nums.enhanceBoarSize);

        await CanvasUtils.drawText(
            ctx, nextRarityName.toUpperCase(), nums.enhanceRarityPos, mediumFont, 'center', nextRarityColor
        );

        await CanvasUtils.drawText(
            ctx, strConfig.collEnhanceDetails, nums.enhanceDetailsPos, mediumFont, 'center', colorConfig.font,
            nums.enhanceDetailsWidth, true,
            [this.allBoars[page].name, nextRarityName + ' Boar', '$' + scoreLost, strConfig.collCellLabel],
            [this.allBoars[page].color, nextRarityColor, colorConfig.bucks, colorConfig.powerup]
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name:`${this.config.stringConfig.defaultImageName}.png` });
    }

    /**
     * Creates gift confirmation image
     */
    public async finalizeGift(): Promise<AttachmentBuilder> {
        // Config aliases
        const strConfig = this.config.stringConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const pathConfig: PathConfig = this.config.pathConfig;

        const giftUnderlay: string = pathConfig.collAssets + pathConfig.collGiftUnderlay;

        const fontBig = `${nums.fontBig}px ${strConfig.fontName}`;

        const canvas: Canvas.Canvas = Canvas.createCanvas(...nums.giftImageSize);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(giftUnderlay), ...nums.originPos, ...nums.giftImageSize);

        CanvasUtils.drawText(
            ctx, strConfig.giftFrom + this.boarUser.user.username.substring(0, nums.maxUsernameLength),
            nums.giftFromPos, fontBig, 'center', this.config.colorConfig.silver, nums.giftFromWidth
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name:`${this.config.stringConfig.defaultImageName}.png` });
    }
}