import {BotConfig} from '../../bot/config/BotConfig';
import {Canvas} from 'canvas';
import {CanvasUtils} from './CanvasUtils';
import {AttachmentBuilder} from 'discord.js';

/**
 * {@link CustomEmbedGenerator CustomEmbedGenerator.ts}
 *
 * Creates an embed that dynamically shrinks and grows
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class CustomEmbedGenerator {
    public static makeEmbed(str: string, color: string, config: BotConfig, coloredText?: string, color2?: string) {
        const strConfig = config.stringConfig;
        const nums = config.numberConfig;
        const colorConfig = config.colorConfig;

        const font = `${nums.fontBig}px ${strConfig.fontName}`;

        const canvas = new Canvas(0, nums.embedMinHeight);
        const ctx = canvas.getContext('2d');

        ctx.font = font;
        canvas.width = Math.min(
            ctx.measureText(str.replace('%@', coloredText ? coloredText : '%@')).width + nums.border * 4,
            nums.embedMaxWidth
        );

        canvas.height += CanvasUtils.drawText(
            ctx, str, nums.originPos, font, 'center', colorConfig.font,
            canvas.width === nums.embedMaxWidth ? nums.embedMaxWidth - nums.border * 4 : undefined,
            true
        );
        ctx.clearRect(nums.originPos[0], nums.originPos[1], canvas.width, canvas.height);

        ctx.beginPath();
        ctx.fillStyle = colorConfig.dark;
        ctx.roundRect(0, 0, canvas.width, canvas.height, canvas.width/nums.embedMaxWidth * nums.border);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = colorConfig.mid;
        ctx.fillRect(
            canvas.width / nums.embedMaxWidth * nums.border,
            canvas.width / nums.embedMaxWidth * nums.border,
            canvas.width - canvas.width / nums.embedMaxWidth * nums.border * 2,
            canvas.height - canvas.width / nums.embedMaxWidth * nums.border * 2,
        );
        ctx.fill();

        CanvasUtils.drawText(
            ctx, str, [canvas.width / 2, canvas.height / 2 + nums.fontSmallMedium / 2 + 7], font, 'center', color,
            canvas.width === nums.embedMaxWidth ? nums.embedMaxWidth - nums.border * 4 : undefined,
            true, coloredText, color2
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${strConfig.imageName}.png` });
    }
}