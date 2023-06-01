import {PromptTypeConfig} from '../../bot/config/prompts/PromptTypeConfig';
import {PromptConfig} from '../../bot/config/prompts/PromptConfig';
import {BotConfig} from '../../bot/config/BotConfig';
import Canvas from 'canvas';
import {CanvasUtils} from './CanvasUtils';
import {AttachmentBuilder} from 'discord.js';
import {StringConfig} from '../../bot/config/StringConfig';
import {NumberConfig} from '../../bot/config/NumberConfig';
import {PathConfig} from '../../bot/config/PathConfig';
import {ColorConfig} from '../../bot/config/ColorConfig';
import {ItemConfig} from '../../bot/config/items/ItemConfig';
import {ItemConfigs} from '../../bot/config/items/ItemConfigs';

/**
 * {@link PowerupImageGenerator PowerupImageGenerator.ts}
 *
 * Create images for powerup spawns
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class PowerupImageGenerator {
    /**
     * Creates the image for when a powerup spawns
     *
     * @param powerupType - Used to get the reward for the powerup
     * @param promptType - Used to get the prompt description
     * @param prompt - Used to get the prompt description (if the prompt has one)
     * @param config - Used for getting config info
     */
    public static async makePowerupSpawnImage(
        powerupType: ItemConfig,
        promptType: PromptTypeConfig,
        prompt: PromptConfig,
        config: BotConfig
    ) {
        const strConfig: StringConfig = config.stringConfig;
        const nums: NumberConfig = config.numberConfig;
        const pathConfig: PathConfig = config.pathConfig;
        const colorConfig: ColorConfig = config.colorConfig;

        const font: string = `${nums.fontBig}px ${strConfig.fontName}`;

        const canvas: Canvas.Canvas = Canvas.createCanvas(...nums.powSpawnSize);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(pathConfig.otherAssets + pathConfig.powerupSpawn), ...nums.originPos);

        const promptDescription: string = promptType.description ? promptType.description : prompt.description;

        CanvasUtils.drawText(
            ctx, promptDescription, nums.powSpawnDescriptionPos, font, 'center', colorConfig.font,
            nums.powSpawnDescriptionWidth, true
        );

        CanvasUtils.drawText(
            ctx, strConfig.powReward, nums.powSpawnRewardPos, font, 'center', colorConfig.font,
            nums.powSpawnDescriptionWidth, false, powerupType.pluralName, colorConfig.powerup
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${config.stringConfig.imageName}.png` });
    }

    /**
     * Used to replace the spawn image after the powerup is done
     *
     * @param topOne - The value associated with top one percent
     * @param topTen - The value associated with top ten percent
     * @param topFifty - The value associated with top fifty percent
     * @param powerupType - Used to get powerup reward name
     * @param config - Used for config info
     */
    public static async makePowerupEndImage(
        topOne: number,
        topTen: number,
        topFifty: number,
        powerupType: ItemConfig,
        config: BotConfig
    ) {
        const strConfig: StringConfig = config.stringConfig;
        const nums: NumberConfig = config.numberConfig;
        const pathConfig: PathConfig = config.pathConfig;
        const colorConfig: ColorConfig = config.colorConfig;
        const powTiers: number[] = powerupType.tiers as number[];

        const font: string = `${nums.fontBig}px ${strConfig.fontName}`;

        const canvas: Canvas.Canvas = Canvas.createCanvas(...nums.powSpawnSize);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(pathConfig.otherAssets + pathConfig.powerupEnd), ...nums.originPos);

        if (topOne !== -1) {
            const topOneStr: string = strConfig.powLessThan.replace('%@', (topOne + 1).toString());
            const topTenStr: string = topTen !== -1
                ? strConfig.powLessThan.replace('%@', (topTen + 1).toString())
                : strConfig.unavailable;
            const topFiftyStr: string = topFifty !== -1
                ? strConfig.powLessThan.replace('%@', (topFifty + 1).toString())
                : strConfig.unavailable;

            CanvasUtils.drawText(
                ctx, strConfig.powTopOne, nums.powTopOnePos, font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth, false,
                PowerupImageGenerator.getPowerupString(powerupType, powTiers[0], config), colorConfig.powerup
            );
            CanvasUtils.drawText(
                ctx, topOneStr, [nums.powTopOnePos[0], nums.powTopOnePos[1]+nums.powResultsYOffset], font, 'center',
                colorConfig.font, nums.powSpawnDescriptionWidth
            );

            CanvasUtils.drawText(
                ctx, strConfig.powTopTen, nums.powTopTenPos, font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth, false,
                PowerupImageGenerator.getPowerupString(powerupType, powTiers[1], config), colorConfig.powerup
            );
            CanvasUtils.drawText(
                ctx, topTenStr, [nums.powTopTenPos[0], nums.powTopTenPos[1]+nums.powResultsYOffset], font, 'center',
                colorConfig.font, nums.powSpawnDescriptionWidth
            );

            CanvasUtils.drawText(
                ctx, strConfig.powTopFifty, nums.powTopFiftyPos, font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth, false,
                PowerupImageGenerator.getPowerupString(powerupType, powTiers[2], config), colorConfig.powerup
            );
            CanvasUtils.drawText(
                ctx, topFiftyStr, [nums.powTopFiftyPos[0], nums.powTopFiftyPos[1]+nums.powResultsYOffset], font,
                'center', colorConfig.font, nums.powSpawnDescriptionWidth
            );
        } else {
            CanvasUtils.drawText(
                ctx, strConfig.powNoClaim, nums.powSpawnDescriptionPos, font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth, true
            );
        }

        CanvasUtils.drawText(
            ctx, strConfig.powReward, nums.powSpawnRewardPos, font, 'center', colorConfig.font,
            nums.powSpawnDescriptionWidth, false, powerupType.pluralName, colorConfig.powerup
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${config.stringConfig.imageName}.png` });
    }

    /**
     * Gets the powerup addition depending on the number gotten and powerup type
     *
     * @param powerupType - Used to get the powerup name
     * @param num - The number of the powerup gotten
     * @param config - Used to get config info
     */
    public static getPowerupString(powerupType: ItemConfig, num: number, config: BotConfig) {
        const powConfig: ItemConfigs = config.itemConfigs.powerups;

        if (num === 0) {
            return config.stringConfig.emptySelect;
        }

        let usePluralName: boolean = false;
        if (num > 1) {
            usePluralName = true;
        }

        if (powerupType.name === powConfig.multiBoost.name) {
            return '+' + num + ' ' + powerupType.name;
        }

        if (powerupType.name === powConfig.extraChance.name) {
            return '+' + num + '% ' + powerupType.name;
        }

        if (powerupType.name === powConfig.gift.name) {
            return '+' + num + ' ' + (usePluralName ? powerupType.pluralName : powerupType.name);
        }

        if (powerupType.name === powConfig.enhancer.name) {
            return '+' + num + ' ' + (usePluralName ? powerupType.pluralName : powerupType.name);
        }
    }
}