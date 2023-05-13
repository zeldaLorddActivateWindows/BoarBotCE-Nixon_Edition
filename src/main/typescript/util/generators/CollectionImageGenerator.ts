import Canvas from 'canvas';
import {BotConfig} from '../../bot/config/BotConfig';
import {BoarUtils} from '../boar/BoarUtils';
import {CanvasUtils} from './CanvasUtils';
import {AttachmentBuilder} from 'discord.js';
import {BoarUser} from '../boar/BoarUser';
import moment from 'moment/moment';
import {RarityConfig} from '../../bot/config/items/RarityConfig';

/**
 * {@link CollectionImageGenerator CollectionImageGenerator.ts}
 *
 * Creates the dynamic collection image.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CollectionImageGenerator {
    private readonly boarUser: BoarUser = {} as BoarUser;
    private readonly config: BotConfig = {} as BotConfig;
    private readonly allBoars: any[] = [];
    private normalBase: Buffer = {} as Buffer;
    private detailedBase: Buffer = {} as Buffer;
    private powerupsBase: Buffer = {} as Buffer;

    constructor(boarUser: BoarUser, config: BotConfig, boars: any[]) {
        this.boarUser = boarUser;
        this.config = config;
        this.allBoars = boars;
    }

    /**
     * Creates the base image of the Normal view
     *
     * @private
     */
    public async createNormalBase(): Promise<void> {
        // Config aliases

        const strConfig = this.config.stringConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        const collectionUnderlay = this.config.pathConfig.collAssets + this.config.pathConfig.collUnderlay;

        const maxUniques = Object.keys(this.config.boarItemConfigs).length;
        const userUniques = Object.keys(this.boarUser.boarCollection).length;

        // Fixes stats through flooring/alternate values

        const scoreString = Math.min(this.boarUser.boarScore, nums.maxScore).toLocaleString();
        const totalString = Math.min(this.boarUser.totalBoars, nums.maxBoars).toLocaleString();
        const uniqueString = Math.min(userUniques, maxUniques).toLocaleString();
        const dailiesString = Math.min(this.boarUser.numDailies, nums.maxDailies).toLocaleString();
        const streakString = Math.min(this.boarUser.boarStreak, nums.maxStreak).toLocaleString();
        const lastDailyString = this.boarUser.lastDaily > 0
            ? moment(this.boarUser.lastDaily).fromNow()
            : strConfig.unavailable;

        // Font info

        const bigFont = `${nums.fontBig}px ${strConfig.fontName}`;
        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallFont = `${nums.fontSmallMedium}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(collectionUnderlay), ...nums.originPos, ...nums.collImageSize);
        await this.drawTopBar(ctx);

        // Draws stats information

        CanvasUtils.drawText(
            ctx, strConfig.collScoreLabel, nums.collScoreLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, scoreString, nums.collScorePos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collTotalLabel, nums.collTotalLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, totalString, nums.collTotalPos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collUniquesLabel, nums.collUniquesLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, uniqueString, nums.collUniquePos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collDailiesLabel, nums.collDailiesLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, dailiesString, nums.collDailiesPos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collStreakLabel, nums.collStreakLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, streakString, nums.collStreakPos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collLastDailyLabel, nums.collLastDailyLabelPos, bigFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, lastDailyString, nums.collLastDailyPos, bigFont, 'center', colorConfig.font);

        this.normalBase = canvas.toBuffer();
    }

    public normalBaseMade(): boolean {
        return Object.keys(this.normalBase).length !== 0;
    }

    /**
     * Finalizes the Normal view image
     *
     * @private
     */
    public async finalizeNormalImage(page: number): Promise<AttachmentBuilder> {
        // Config aliases

        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        // Asset path info

        const boarsFolder = pathConfig.boarImages;
        const collectionOverlay = pathConfig.collAssets + pathConfig.collOverlay;

        const boarsPerPage = nums.collBoarsPerPage;

        const smallestFont = `${nums.fontSmallest}px ${strConfig.fontName}`;

        const lastBoarRarity: [number, RarityConfig] = BoarUtils.findRarity(this.boarUser.lastBoar);
        const favBoarRarity: [number, RarityConfig] = BoarUtils.findRarity(this.boarUser.favoriteBoar);

        const curBoars = this.allBoars.slice(page * boarsPerPage, (page+1)*boarsPerPage);

        const canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(this.normalBase), ...nums.originPos, ...nums.collImageSize);

        ctx.drawImage(canvas, ...nums.originPos, ...nums.collImageSize);

        // Draws boars and rarities
        for (let i=0; i<curBoars.length; i++) {
            const boarImagePos: [number, number] = [
                nums.collBoarStartX + (i % nums.collBoarCols) * nums.collBoarSpacingX,
                nums.collBoarStartY + Math.floor(i / nums.collBoarRows) * nums.collBoarSpacingY
            ];

            const lineStartPos = [
                nums.collRarityStartX + (i % nums.collBoarCols) * nums.collBoarSpacingX,
                nums.collRarityStartY + Math.floor(i / nums.collBoarRows) * nums.collBoarSpacingY
            ];

            const lineEndPos = [
                nums.collRarityStartX + nums.collRarityEndDiff + (i % nums.collBoarCols) * nums.collBoarSpacingX,
                nums.collRarityStartY - nums.collRarityEndDiff +
                Math.floor(i / nums.collBoarRows) * nums.collBoarSpacingY
            ];

            const boarFile = curBoars[i].staticFile
                ? boarsFolder + curBoars[i].staticFile
                : boarsFolder + curBoars[i].file;

            ctx.drawImage(await Canvas.loadImage(boarFile), ...boarImagePos, ...nums.collBoarSize);
            CanvasUtils.drawLine(
                ctx, lineStartPos, lineEndPos, nums.collRarityWidth, curBoars[i].color
            );
        }

        // Draws last boar gotten and rarity
        if (this.boarUser.lastBoar !== '') {
            const lastBoarDetails = this.config.boarItemConfigs[this.boarUser.lastBoar];
            const boarFile = lastBoarDetails.staticFile
                ? boarsFolder + lastBoarDetails.staticFile
                : boarsFolder + lastBoarDetails.file;

            ctx.drawImage(await Canvas.loadImage(boarFile), ...nums.collLastBoarPos, ...nums.collLastBoarSize);
        }

        // Draws favorite boar and rarity
        if (this.boarUser.favoriteBoar !== '') {
            const favoriteBoarDetails = this.config.boarItemConfigs[this.boarUser.favoriteBoar];
            const boarFile = favoriteBoarDetails.staticFile
                ? boarsFolder + favoriteBoarDetails.staticFile
                : boarsFolder + favoriteBoarDetails.file;

            ctx.drawImage(await Canvas.loadImage(boarFile), ...nums.collFavBoarPos, ...nums.collFavBoarSize);
        }

        // Draws overlay

        ctx.drawImage(await Canvas.loadImage(collectionOverlay), ...nums.originPos, ...nums.collImageSize);
        CanvasUtils.drawText(
            ctx, strConfig.collFavLabel, nums.collFavLabelPos, smallestFont,
            'center', favBoarRarity[0] === 0 ? colorConfig.font : colorConfig['rarity' + favBoarRarity[0]]
        );
        CanvasUtils.drawText(
            ctx, strConfig.collRecentLabel, nums.collRecentLabelPos, smallestFont,
            'center', lastBoarRarity[0] === 0 ? colorConfig.font : colorConfig['rarity' + lastBoarRarity[0]]
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name:`${strConfig.imageName}.png` });
    }

    /**
     * Creates the base image of the Detailed view
     *
     * @private
     */
    public async createDetailedBase(): Promise<void> {
        // Config aliases

        const strConfig = this.config.stringConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        const collectionUnderlay = this.config.pathConfig.collAssets + this.config.pathConfig.collDetailUnderlay;

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(collectionUnderlay), ...nums.originPos, ...nums.collImageSize);
        await this.drawTopBar(ctx);

        // Draws labels

        CanvasUtils.drawText(
            ctx, strConfig.collIndivTotalLabel, nums.collIndivTotalLabelPos, mediumFont, 'center', colorConfig.font
        );

        CanvasUtils.drawText(
            ctx, strConfig.collFirstObtainedLabel, nums.collFirstObtainedLabelPos,
            mediumFont, 'center', colorConfig.font
        );

        CanvasUtils.drawText(
            ctx, strConfig.collLastObtainedLabel, nums.collLastObtainedLabelPos, mediumFont, 'center', colorConfig.font
        );

        CanvasUtils.drawText(
            ctx, strConfig.collDescriptionLabel, nums.collDescriptionLabelPos, mediumFont, 'center', colorConfig.font
        );

        this.detailedBase = canvas.toBuffer();
    }

    public detailedBaseMade(): boolean {
        return Object.keys(this.detailedBase).length !== 0;
    }

    /**
     * Finalizes the Detailed view image
     *
     * @private
     */
    public async finalizeDetailedImage(page: number): Promise<AttachmentBuilder> {
        // Config aliases

        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        // Asset path info

        const boarsFolder = pathConfig.boarImages;
        const collectionOverlay = pathConfig.collAssets + pathConfig.collDetailOverlay;

        // Font info

        const bigFont = `${nums.fontBig}px ${strConfig.fontName}`;
        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;
        const smallMediumFont = `${nums.fontSmallMedium}px ${strConfig.fontName}`;
        const smallestFont = `${nums.fontSmallest}px ${strConfig.fontName}`;

        const curBoar = this.allBoars[page];

        // Dynamic information (stats, images)

        const boarFile = curBoar.staticFile ? boarsFolder + curBoar.staticFile : boarsFolder + curBoar.file;
        const numCollectedString = Math.min(curBoar.num, nums.maxIndivBoars).toLocaleString();
        const firstObtainedDate = new Date(curBoar.firstObtained)
            .toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric'});
        const lastObtainedDate = new Date(curBoar.lastObtained)
            .toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric'});

        const canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(this.detailedBase), ...nums.originPos, ...nums.collImageSize);
        ctx.drawImage(canvas, ...nums.originPos, ...nums.collImageSize);
        ctx.drawImage(await Canvas.loadImage(boarFile), ...nums.collIndivBoarPos, ...nums.collIndivBoarSize);

        // Shows a star when on a favorite boar

        let indivRarityPos: [number, number] = [...nums.collIndivRarityPos];
        if (curBoar.id == this.boarUser.favoriteBoar) {
            const favoriteFile = pathConfig.collAssets + pathConfig.favorite;
            let favoritePos: [number, number];

            indivRarityPos[0] -= nums.collIndivFavSize[0] / 2 + 10;
            ctx.font = mediumFont;
            favoritePos = [
                ctx.measureText(curBoar.rarity.name.toUpperCase()).width / 2 + indivRarityPos[0] + 10,
                nums.collIndivFavHeight
            ];

            ctx.drawImage(await Canvas.loadImage(favoriteFile), ...favoritePos, ...nums.collIndivFavSize);
        }

        // Draws stats

        CanvasUtils.drawText(
            ctx, curBoar.rarity.name.toUpperCase(), indivRarityPos,
            mediumFont, 'center', curBoar.color
        );

        CanvasUtils.drawText(
            ctx, curBoar.name, nums.collBoarNamePos, bigFont,
            'center', colorConfig.font, nums.collBoarNameWidth
        );

        CanvasUtils.drawText(
            ctx, numCollectedString, nums.collIndivTotalPos, smallMediumFont, 'center', colorConfig.font
        );

        CanvasUtils.drawText(
            ctx, firstObtainedDate, nums.collFirstObtainedPos, smallMediumFont, 'center', colorConfig.font
        );

        CanvasUtils.drawText(
            ctx, lastObtainedDate, nums.collLastObtainedPos, smallMediumFont, 'center', colorConfig.font
        );

        CanvasUtils.drawText(
            ctx, curBoar.description, nums.collDescriptionPos, smallestFont,
            'center', colorConfig.font, nums.collDescriptionWidth, true
        );

        ctx.drawImage(await Canvas.loadImage(collectionOverlay), ...nums.originPos, ...nums.collImageSize);

        return new AttachmentBuilder(canvas.toBuffer(), { name:`${strConfig.imageName}.png` });
    }

    /**
     * Creates the base image of the Powerups view
     *
     * @private
     */
    public async createPowerupsBase(): Promise<void> {
        // Config aliases

        const strConfig = this.config.stringConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        const collectionUnderlay = this.config.pathConfig.collAssets + this.config.pathConfig.collPowerUnderlay;

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(collectionUnderlay), ...nums.originPos, ...nums.collImageSize);
        await this.drawTopBar(ctx);

        this.powerupsBase = canvas.toBuffer();
    }

    public powerupsBaseMade(): boolean {
        return Object.keys(this.powerupsBase).length !== 0;
    }

    public async finalizePowerupsImage(): Promise<AttachmentBuilder> {
        const nums = this.config.numberConfig;
        const collectionOverlay = this.config.pathConfig.collAssets + this.config.pathConfig.collPowerOverlay;

        const canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(this.powerupsBase), ...nums.originPos, ...nums.collImageSize);
        ctx.drawImage(canvas, ...nums.originPos, ...nums.collImageSize);

        ctx.drawImage(await Canvas.loadImage(collectionOverlay), ...nums.originPos, ...nums.collImageSize);

        return new AttachmentBuilder(canvas.toBuffer(), { name:`${this.config.stringConfig.imageName}.png` });
    }

    public async drawTopBar(ctx: Canvas.CanvasRenderingContext2D,): Promise<void> {
        // Config aliases

        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        const noClan = pathConfig.collAssets + pathConfig.clanNone;

        // Non-trivial user information

        const userTag = this.boarUser.user.username.substring(0, nums.maxUsernameLength) + '#' +
            this.boarUser.user.discriminator;
        const userAvatar = this.boarUser.user.displayAvatarURL({ extension: 'png' });

        // Fixes stats through flooring/alternate values

        const firstDate = this.boarUser.firstDaily > 0
            ? new Date(this.boarUser.firstDaily).toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric'})
            : strConfig.unavailable;

        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;

        ctx.drawImage(await Canvas.loadImage(userAvatar), ...nums.collUserAvatarPos, ...nums.collUserAvatarSize);
        CanvasUtils.drawText(ctx, userTag, nums.collUserTagPos, mediumFont, 'left', colorConfig.font);
        CanvasUtils.drawText(ctx, strConfig.collDateLabel, nums.collDateLabelPos, mediumFont, 'left', colorConfig.font);
        CanvasUtils.drawText(ctx, firstDate, nums.collDatePos, mediumFont, 'left', colorConfig.font);
        ctx.drawImage(await Canvas.loadImage(noClan), ...nums.collClanPos, ...nums.collClanSize);

        if (this.boarUser.badges.length === 0) {
            CanvasUtils.drawText(
                ctx, strConfig.collNoBadges, nums.collNoBadgePos, mediumFont, 'left', colorConfig.font
            );
        }

        // Draws badge information if the user has badges

        for (let i=0; i<this.boarUser.badges.length; i++) {
            const badgesFolder = pathConfig.badgeImages;
            const badgeXY: [number, number] = [nums.collBadgeStart + i * nums.collBadgeSpacing, nums.collBadgeY];
            const badgeFile = badgesFolder + this.config.badgeItemConfigs[this.boarUser.badges[i]].file;

            ctx.drawImage(await Canvas.loadImage(badgeFile), ...badgeXY, ...nums.collBadgeSize);
        }
    }
}