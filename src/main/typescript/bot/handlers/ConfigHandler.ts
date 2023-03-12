import {BotConfig} from '../config/BotConfig';
import fs from 'fs';
import {registerFont} from 'canvas';
import moment from 'moment/moment';
import {LogDebug} from '../../util/logging/LogDebug';

/**
 * {@link ConfigHandler ConfigHandler.ts}
 *
 * Handles loading, getting, and verifying config
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
            LogDebug.handleError('Unable to parse config file. Is \'config.json\' in the project root?');
            process.exit(-1);
        }

        if (!await this.verifyConfig(parsedConfig)) {
            LogDebug.sendDebug('Failed to verify config file, sticking with old/default version.', this.config);
            return;
        }

        this.config = parsedConfig;

        LogDebug.sendDebug('Config file successfully loaded!', this.config);

        this.loadFonts();
    }

    /**
     * Verifies the contents of the data in the configuration file
     *
     * @return passed - Whether the config file passed verification
     * @private
     */
    private async verifyConfig(parsedConfig: BotConfig): Promise<boolean> {
        const rarities = parsedConfig.rarityConfigs;
        const boars = parsedConfig.boarItemConfigs;
        const boarIDs = Object.keys(boars);
        const badges = parsedConfig.badgeItemConfigs;
        const badgeIDs = Object.keys(badges);
        const foundBoars: string[] = [];

        const pathConfig = parsedConfig.pathConfig;
        const boarImages = pathConfig.boarImages;
        const badgeImages = pathConfig.badgeImages;
        const itemAssets = pathConfig.itemAssets;
        const collAssets = pathConfig.collAssets;
        const otherAssets = pathConfig.otherAssets;

        const allPaths = [
            pathConfig.listeners,
            pathConfig.commands,
            pathConfig.guildDataFolder,
            pathConfig.userDataFolder,
            pathConfig.globalDataFile,
            itemAssets + pathConfig.itemOverlay,
            itemAssets + pathConfig.itemUnderlay,
            itemAssets + pathConfig.itemBackplate,
            itemAssets + pathConfig.itemNameplate,
            collAssets + pathConfig.collOverlay,
            collAssets + pathConfig.collUnderlay,
            collAssets + pathConfig.clanNone,
            collAssets + pathConfig.enhancerOn,
            collAssets + pathConfig.enhancerOff,
            otherAssets + pathConfig.thankYouImage,
            otherAssets + pathConfig.mainFont,
            otherAssets + pathConfig.helpBackground,
            otherAssets + pathConfig.circleMask,
        ];

        let passed = true;

        for (const rarity in rarities) {
            const rarityInfo = rarities[rarity];
            for (const boar of rarityInfo.boars) {
                if (boarIDs.includes(boar) && !foundBoars.includes(boar)) {
                    foundBoars.push(boar);
                    continue;
                }

                if (!boarIDs.includes(boar)) {
                    LogDebug.sendDebug(`Boar ID '${boar}' not found in rarity '${rarity}'`, this.config);
                }

                if (foundBoars.includes(boar)) {
                    LogDebug.sendDebug(`Boar ID '${boar}' used more than once`, this.config);
                }

                passed = false;
                foundBoars.push(boar);
            }
        }

        for (const boar of boarIDs) {
            allPaths.push(boarImages + boars[boar].file);

            if (foundBoars.includes(boar)) continue;

            LogDebug.sendDebug(`Boar ID '${boar}' is unused`, this.config);
            passed = false;
        }

        for (const badge of badgeIDs) {
            allPaths.push(badgeImages + badges[badge].file);
        }

        for (const path of allPaths) {
            if (fs.existsSync(path)) continue;

            LogDebug.sendDebug(`Path '${path}' is invalid`, this.config);
            passed = false;
        }

        return passed;
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
            const mcFont = this.config.pathConfig.otherAssets + this.config.pathConfig.mainFont;

            registerFont(mcFont, { family: this.config.stringConfig.fontName });
        } catch {
            LogDebug.handleError('Unable to load custom font. Verify its path in \'config.json\'.');
            return;
        }

        LogDebug.sendDebug('Fonts successfully loaded!', this.config);
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

        LogDebug.sendDebug('Relative time information set!', this.config);
    }
}