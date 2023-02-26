import {BotConfig} from '../config/BotConfig';
import fs from 'fs';
import {handleError, sendDebug} from '../../logging/LogDebug';
import {Command} from '../../api/commands/Command';
import {REST} from '@discordjs/rest';
import {registerFont} from 'canvas';
import moment from 'moment/moment';

/**
 * {@link ConfigHandler ConfigHandler.ts}
 *
 * Handles setting, getting, and deploying commands
 * for a bot instance
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ConfigHandler {
    private config: BotConfig = new BotConfig;

    /**
     * Loads config data from configuration file in project root
     */
    public loadConfig(): void {
        let parsedConfig: any;

        try {
            parsedConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        } catch {
            handleError('Unable to parse config file. Is \'config.json\' in the project root?');
            process.exit(-1);
        }

        this.config = parsedConfig as BotConfig;

        sendDebug('Config successfully loaded!');
    }

    /**
     * Verifies the contents of the data in the configuration file
     * @private
     */
    private verifyConfig(): void {}

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

            registerFont(mcFont, {family: this.config.stringConfig.fontName});
        } catch {
            handleError('Unable to load font. Verify its path in \'config.json\'.');
            return;
        }

        sendDebug('Fonts successfully loaded!');
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

        sendDebug('Relative time information set!');
    }
}