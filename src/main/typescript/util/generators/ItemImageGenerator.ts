import Canvas from 'canvas';
import {BotConfig} from '../../bot/config/BotConfig';
import {BoarUtils} from '../boar/BoarUtils';
import {Options, PythonShell} from 'python-shell';
import {LogDebug} from '../logging/LogDebug';
import {CanvasUtils} from './CanvasUtils';
import {AttachmentBuilder, User} from 'discord.js';
import fs from 'fs';
import {StringConfig} from '../../bot/config/StringConfig';
import {PathConfig} from '../../bot/config/PathConfig';
import {NumberConfig} from '../../bot/config/NumberConfig';
import {ColorConfig} from '../../bot/config/ColorConfig';
import {ItemConfig} from '../../bot/config/items/ItemConfig';

/**
 * {@link ItemImageGenerator ItemImageGenerator.ts}
 *
 * Creates the dynamic item image.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ItemImageGenerator {
    private readonly user: User = {} as User;
    private readonly config: BotConfig = {} as BotConfig;
    private readonly id: string = '';
    private readonly title: string = '';
    private buffer: Buffer = {} as Buffer;
    private tempPath: string = '';
    private colorKey: string = '';
    private imageFilePath: string = '';
    private userAvatar: string = '';
    private userTag: string = '';
    private giftingUserAvatar: string | undefined;
    private giftingUserTag: string | undefined;
    private itemName: string = '';
    private itemNameColored: string = '';
    private itemFile: string = '';

    /**
     * Creates a new item image generator
     *
     * @param user - The user that got the item
     * @param id - The ID of the item
     * @param title - The title to put on the item attachment
     * @param config - Used to get path, string, and other information
     */
    constructor(user: User, id: string, title: string, config: BotConfig) {
        this.user = user;
        this.config = config;
        this.id = id;
        this.title = title;
    }

    /**
     * Creates the image to be sent on boar/badge add
     *
     * @param isBadge - Whether the item is a badge
     * @param giftingUser - The user that's gifting the item (if there is one)
     * @param coloredText - The portion of text that's colored (if there is one)
     * @param manualInput - A way to input name, file, and color information outside of ID
     * @param score - Score gained from the item
     * @return attachment - AttachmentBuilder object containing image
     * @private
     */
    public async handleImageCreate(
        isBadge: boolean = false,
        giftingUser?: User,
        coloredText?: string,
        manualInput?: {name: string, file: string, colorKey: string},
        score?: number
    ): Promise<AttachmentBuilder> {
        const strConfig: StringConfig = this.config.stringConfig;
        const pathConfig: PathConfig = this.config.pathConfig;

        let folderPath: string;

        if (isBadge && manualInput === undefined) {
            const badgeInfo: ItemConfig = this.config.itemConfigs.badges[this.id];
            this.itemName = badgeInfo.name;
            this.itemFile = badgeInfo.file;
            folderPath = pathConfig.badges;
            this.colorKey = 'badge';
        } else if (manualInput === undefined) {
            const boarInfo: ItemConfig = this.config.itemConfigs.boars[this.id];
            this.itemName = boarInfo.name;
            this.itemFile = boarInfo.file;
            folderPath = pathConfig.boars;
            this.colorKey = 'rarity' + BoarUtils.findRarity(this.id, this.config)[0];
        } else {
            this.itemName = manualInput.name;
            this.itemFile = manualInput.file;
            folderPath = pathConfig.otherAssets;
            this.colorKey = manualInput.colorKey;
        }

        this.itemNameColored = coloredText ? coloredText : this.itemName;
        this.itemName = this.itemName.replace(this.itemNameColored, '%@');

        this.imageFilePath = folderPath + this.itemFile;
        const imageExtension: string = this.imageFilePath.split('.')[1];
        const isAnimated: boolean = imageExtension === 'gif';

        const usernameLength: number = this.config.numberConfig.maxUsernameLength;

        this.tempPath = pathConfig.tempItemAssets + this.id + this.colorKey +
            this.title.toLowerCase().substring(0, 4) + '.' + imageExtension;

        this.userAvatar = this.user.displayAvatarURL({ extension: 'png' });
        this.userTag = this.user.username.substring(0, usernameLength);

        this.giftingUserTag = giftingUser?.username.substring(0, usernameLength);
        this.giftingUserAvatar = giftingUser?.displayAvatarURL({ extension: 'png' });

        // Creates base response attachment depending on the boar's image type
        if (!fs.existsSync(this.tempPath)) {
            if (isAnimated) {
                await this.makeAnimated();
            } else {
                await this.makeStatic();
            }
            fs.writeFileSync(this.tempPath, this.buffer);
        } else {
            this.buffer = fs.readFileSync(this.tempPath);
        }

        if (isAnimated) {
            await this.addAnimatedProfile(score);
        } else {
            await this.addStaticProfile(score);
        }

        return new AttachmentBuilder(this.buffer, { name:`${strConfig.imageName}.${imageExtension}` });
    }

    /**
     * Creates the base of an item image if it's animated
     *
     * @private
     */
    private async makeAnimated(): Promise<void> {
        const script: string = this.config.pathConfig.dynamicImageScript;

        // Waits for python code to execute before continuing
        await new Promise((resolve) => {
            const scriptOptions: Options = {
                args: [
                    JSON.stringify(this.config.pathConfig),
                    JSON.stringify(this.config.colorConfig),
                    JSON.stringify(this.config.numberConfig),
                    this.colorKey,
                    this.imageFilePath,
                    this.title,
                    this.itemName.replace('%@', this.itemNameColored)
                ]
            };

            // Sends python all dynamic image data and receives final animated image
            PythonShell.run(script, scriptOptions, (err, data) => {
                if (!data) {
                    LogDebug.handleError(err);
                    return;
                }

                this.buffer = Buffer.from(data[0], 'base64');
                resolve('Success');
            });
        });
    }

    /**
     * Creates the base of an item image if it's static
     *
     * @private
     */
    private async makeStatic(): Promise<void> {
        const strConfig: StringConfig = this.config.stringConfig;
        const nums: NumberConfig = this.config.numberConfig;
        const pathConfig: PathConfig = this.config.pathConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        const itemAssetsFolder: string = pathConfig.itemAssets;
        const underlayPath: string = itemAssetsFolder + pathConfig.itemUnderlay;
        const backplatePath: string = itemAssetsFolder + pathConfig.itemBackplate;
        const overlay: string = itemAssetsFolder + pathConfig.itemOverlay;

        // Positioning and dimension info

        const origin: [number, number] = nums.originPos;
        const imageSize: [number, number] = nums.itemImageSize;

        let mainPos: [number, number] = nums.itemPos;
        let mainSize: [number, number] = nums.itemSize;

        // Font info

        const fontName: string = strConfig.fontName;
        const mediumFont: string = `${nums.fontMedium}px ${fontName}`;

        const canvas: Canvas.Canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        // Draws edge/background rarity color

        CanvasUtils.drawRect(ctx, origin, imageSize, colorConfig[this.colorKey]);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(await Canvas.loadImage(underlayPath), ...origin, ...imageSize);
        ctx.globalCompositeOperation = 'normal';

        // Draws item and overlay

        ctx.drawImage(await Canvas.loadImage(backplatePath), ...origin);
        ctx.drawImage(await Canvas.loadImage(this.imageFilePath), ...mainPos, ...mainSize);
        ctx.drawImage(await Canvas.loadImage(overlay), ...origin);

        // Draws method of delivery and name of item

        CanvasUtils.drawText(ctx, this.title, nums.itemTitlePos, mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(
            ctx, this.itemName, nums.itemNamePos, mediumFont, 'center', colorConfig.font,
            undefined, false, this.itemNameColored, colorConfig[this.colorKey]
        );

        this.buffer = canvas.toBuffer();
    }

    /**
     * Adds user and other information on top of animated image
     *
     * @param score - The score that was gained
     * @private
     */
    private async addAnimatedProfile(score?: number): Promise<void> {
        const script: string = this.config.pathConfig.userOverlayScript;

        // Waits for python code to execute before continuing
        await new Promise((resolve, reject) => {
            const scriptOptions: Options = {
                args: [
                    JSON.stringify(this.config.pathConfig),
                    JSON.stringify(this.config.colorConfig),
                    JSON.stringify(this.config.numberConfig),
                    this.tempPath,
                    this.userAvatar,
                    this.userTag,
                    score === undefined ? '' : score.toLocaleString(),
                    this.giftingUserAvatar === undefined ? '' : this.giftingUserAvatar,
                    this.giftingUserTag === undefined ? '' : this.giftingUserTag
                ]
            };

            // Sends python all dynamic image data and receives final animated image
            PythonShell.run(script, scriptOptions, (err, data) => {
                if (!data) {
                    reject(err);
                    return;
                }

                this.buffer = Buffer.from(data[0], 'base64');
                resolve('Script ran successfully!');
            });
        }).catch((err) => { LogDebug.handleError(err); });
    }

    /**
     * Adds user and other information on top of static image
     *
     * @param score - The score that was gained
     * @private
     */
    private async addStaticProfile(score?: number): Promise<void> {
        const nums: NumberConfig = this.config.numberConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;

        const smallMediumFont: string = `${nums.fontSmallMedium}px ${this.config.stringConfig.fontName}`;

        const origin: [number, number] = nums.originPos;
        const imageSize: [number, number] = nums.itemImageSize;

        let userBoxY: number = nums.itemBoxOneY;

        const canvas: Canvas.Canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(this.tempPath), ...origin, ...imageSize);

        ctx.font = smallMediumFont;

        if (this.giftingUserTag !== undefined && this.giftingUserAvatar !== undefined) {
            userBoxY = nums.itemBoxTwoY;

            ctx.beginPath();
            ctx.roundRect(
                nums.itemBoxX, nums.itemBoxOneY,
                ctx.measureText('To').width + nums.itemTextBoxExtra, nums.itemBoxHeight, nums.border
            );
            ctx.fillStyle = this.config.colorConfig.dark;
            ctx.fill();

            CanvasUtils.drawText(
                ctx, 'To', [nums.itemTextX, nums.itemBoxOneY + nums.itemTextYOffset],
                smallMediumFont, 'left', colorConfig.font
            );

            ctx.beginPath();
            ctx.roundRect(
                nums.itemBoxX, nums.itemBoxThreeY,
                ctx.measureText('From').width + nums.itemTextBoxExtra, nums.itemBoxHeight, nums.border
            );
            ctx.fillStyle = this.config.colorConfig.dark;
            ctx.fill();

            CanvasUtils.drawText(
                ctx, 'From', [nums.itemTextX, nums.itemBoxThreeY + nums.itemTextYOffset],
                smallMediumFont, 'left', colorConfig.font
            );

            ctx.beginPath();
            ctx.roundRect(
                nums.itemBoxX, nums.itemBoxFourY,
                ctx.measureText(this.giftingUserTag).width + nums.itemUserBoxExtra,
                nums.itemBoxHeight, nums.border
            );
            ctx.fillStyle = this.config.colorConfig.dark;
            ctx.fill();

            CanvasUtils.drawText(
                ctx, this.giftingUserTag, [nums.itemUserTagX, nums.itemBoxFourY + nums.itemTextYOffset],
                smallMediumFont, 'left', colorConfig.font
            );

            CanvasUtils.drawCircleImage(
                ctx, await Canvas.loadImage(this.giftingUserAvatar),
                [nums.itemUserAvatarX, nums.itemBoxFourY + nums.itemUserAvatarYOffset], nums.itemUserAvatarWidth
            );
        }

        ctx.beginPath();
        ctx.roundRect(
            nums.itemBoxX, userBoxY,
            ctx.measureText(this.userTag).width + nums.itemUserBoxExtra, nums.itemBoxHeight, nums.border
        );
        ctx.fillStyle = this.config.colorConfig.dark;
        ctx.fill();

        CanvasUtils.drawText(
            ctx, this.userTag, [nums.itemUserTagX, userBoxY + nums.itemTextYOffset],
            smallMediumFont, 'left', colorConfig.font
        );

        CanvasUtils.drawCircleImage(
            ctx, await Canvas.loadImage(this.userAvatar),
            [nums.itemUserAvatarX, userBoxY + nums.itemUserAvatarYOffset], nums.itemUserAvatarWidth
        );

        if (score && this.giftingUserTag === undefined) {
            ctx.beginPath();
            ctx.roundRect(
                nums.itemBoxX, nums.itemBoxTwoY, ctx.measureText('+$' + score).width + nums.itemTextBoxExtra,
                nums.itemBoxHeight, nums.border
            );
            ctx.fillStyle = this.config.colorConfig.dark;
            ctx.fill();

            CanvasUtils.drawText(
                ctx, '+%@' + score.toLocaleString(), [nums.itemTextX, nums.itemBoxTwoY + nums.itemTextYOffset],
                smallMediumFont, 'left', colorConfig.font, undefined, false, '$', colorConfig.bucks
            );
        }

        this.buffer = canvas.toBuffer();
    }
}