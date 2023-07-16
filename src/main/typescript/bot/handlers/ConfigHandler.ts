import {BotConfig} from '../config/BotConfig';
import fs from 'fs';
import {registerFont} from 'canvas';
import moment from 'moment/moment';
import {LogDebug} from '../../util/logging/LogDebug';
import {RarityConfig} from '../config/items/RarityConfig';
import {PathConfig} from '../config/PathConfig';
import {ItemConfigs} from '../config/items/ItemConfigs';

/**
 * {@link ConfigHandler ConfigHandler.ts}
 *
 * Handles loading, getting, and validating config
 * information for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ConfigHandler {
    private config: BotConfig = new BotConfig;

    /**
     * Loads config data from configuration file in project root
     */
    public async loadConfig(): Promise<void> {
        let parsedConfig: BotConfig;

        this.setRelativeTime();

        try {
            parsedConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        } catch {
            await LogDebug.handleError('Unable to parse config file. Is \'config.json\' in the project root?');
            process.exit(-1);
        }

        if (!await this.validateConfig(parsedConfig)) {
            LogDebug.log('Failed to validate config file, sticking with old/default version.', this.config);
            return;
        }

        this.config = parsedConfig;

        LogDebug.log('Config file successfully loaded!', this.config);

        this.removeTempFiles();
        this.loadFonts();
    }


    /**
     * Validates the contents of the data in the configuration file
     *
     * @param parsedConfig - The newly parsed config file to validate
     * @return passed - Whether the config file passed validation
     * @private
     */
    private async validateConfig(parsedConfig: BotConfig): Promise<boolean> {
        const rarities: RarityConfig[] = parsedConfig.rarityConfigs;
        const boars: ItemConfigs = parsedConfig.itemConfigs.boars;
        const boarIDs: string[] = Object.keys(boars);
        const badges: ItemConfigs = parsedConfig.itemConfigs.badges;
        const badgeIDs: string[] = Object.keys(badges);
        const powerups: ItemConfigs = parsedConfig.itemConfigs.powerups;
        const powerupIDs: string[] = Object.keys(powerups);
        const foundBoars: string[] = [];

        const pathConfig: PathConfig = parsedConfig.pathConfig;
        const boarImages: string = pathConfig.boars;
        const badgeImages: string = pathConfig.badges;
        const powerupImages: string = pathConfig.powerups;
        const itemAssets: string = pathConfig.itemAssets;
        const collAssets: string = pathConfig.collAssets;
        const otherAssets: string = pathConfig.otherAssets;

        const allPaths: string[] = [
            pathConfig.listeners,
            pathConfig.commands,
            pathConfig.guildDataFolder,
            pathConfig.userDataFolder,
            pathConfig.globalDataFile,
            itemAssets + pathConfig.itemOverlay,
            itemAssets + pathConfig.itemUnderlay,
            itemAssets + pathConfig.itemBackplate,
            collAssets + pathConfig.collOverlay,
            collAssets + pathConfig.collUnderlay,
            collAssets + pathConfig.clanNone,
            collAssets + pathConfig.enhancerOff,
            otherAssets + pathConfig.thankYouImage,
            otherAssets + pathConfig.mainFont,
            otherAssets + pathConfig.helpGeneral1,
            otherAssets + pathConfig.helpPowerup1,
            otherAssets + pathConfig.helpPowerup2,
            otherAssets + pathConfig.helpMarket1,
            otherAssets + pathConfig.helpMarket2,
            otherAssets + pathConfig.helpBadgeBoar1,
            otherAssets + pathConfig.helpBadgeBoar2,
            otherAssets + pathConfig.helpBadgeBoar3,
            otherAssets + pathConfig.circleMask,
            pathConfig.dynamicImageScript,
            pathConfig.userOverlayScript
        ];

        let passed = true;

        for (const rarity in rarities) {
            const rarityInfo: RarityConfig = rarities[rarity];
            for (const boar of rarityInfo.boars) {
                if (boarIDs.includes(boar) && !foundBoars.includes(boar)) {
                    foundBoars.push(boar);
                    continue;
                }

                if (!boarIDs.includes(boar)) {
                    LogDebug.log(`Boar ID '${boar}' not found in rarity '${rarity}'`, this.config);
                }

                if (foundBoars.includes(boar)) {
                    LogDebug.log(`Boar ID '${boar}' used more than once`, this.config);
                }

                passed = false;
                foundBoars.push(boar);
            }
        }

        for (const boar of boarIDs) {
            allPaths.push(boarImages + boars[boar].file);

            if (foundBoars.includes(boar)) continue;

            LogDebug.log(`Boar ID '${boar}' is unused`, this.config);
            passed = false;
        }

        for (const badge of badgeIDs) {
            allPaths.push(badgeImages + badges[badge].file);
        }

        for (const powerup of powerupIDs) {
            allPaths.push(powerupImages + powerups[powerup].file);
        }

        for (const path of allPaths) {
            if (fs.existsSync(path)) continue;

            LogDebug.log(`Path '${path}' is invalid`, this.config);
            passed = false;
        }

        return passed;
    }

    /**
     * Removes temp files to allow config changes to show
     *
     * @private
     */
    private removeTempFiles(): void {
        const tempItemFolder: string = this.config.pathConfig.tempItemAssets;
        const tempItemFiles: string[] = fs.readdirSync(tempItemFolder);

        for (const file of tempItemFiles) {
            fs.rmSync(tempItemFolder + file);
        }

        LogDebug.log('Deleted all temp files!', this.config);
    }

    /**
     * Grabs {@link BotConfig config} data the bot uses
     */
    public getConfig(): BotConfig { return this.config; }

    /**
     * Grabs the font file and loads it for Canvas if it exists
     */
    public loadFonts(): void {
        try {
            const mcFont: string = this.config.pathConfig.otherAssets + this.config.pathConfig.mainFont;

            registerFont(mcFont, { family: this.config.stringConfig.fontName });
        } catch {
            LogDebug.handleError('Unable to load custom font. Verify its path in \'config.json\'.');
            return;
        }

        LogDebug.log('Fonts successfully loaded!', this.config);
    }

    /**
     * Sets relative time information like cutoffs and locales
     */
    public setRelativeTime(): void {
        moment.relativeTimeThreshold('s', 60);
        moment.relativeTimeThreshold('ss', 1);
        moment.relativeTimeThreshold('m', 60);
        moment.relativeTimeThreshold('h', 24);
        moment.relativeTimeThreshold('d', 30.437);
        moment.relativeTimeThreshold('M', 12);

        moment.updateLocale('en', {
            relativeTime : {
                future: 'in %s',
                past:   '%s ago',
                s  : '%d second',
                ss : '%d seconds',
                m:  '%d minute',
                mm: '%d minutes',
                h:  '%d hour',
                hh: '%d hours',
                d:  '%d day',
                dd: '%d days',
                M:  '%d month',
                MM: '%d months',
                y:  '%d year',
                yy: '%d years'
            }
        });

        LogDebug.log('Relative time information set!', this.config);
    }
}