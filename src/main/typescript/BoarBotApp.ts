import {BoarBot} from './bot/BoarBot';
import {Bot} from './api/bot/Bot';
import {LogDebug} from './util/logging/LogDebug';
import fs from 'fs';
import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import {exec} from 'child_process'

dotenv.config();

/**
 * {@link BoarBotApp BoarBotApp.ts}
 *
 * Creates the bot instance using
 * CLI args.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarBotApp {
    private static bot: Bot;

    public static async main(): Promise<void> {
        const boarBot: BoarBot = new BoarBot();
        this.bot = boarBot;

        process.title = 'BoarBot - Process';
        process.on('uncaughtException', async (e) => {
            LogDebug.handleError(e);
            process.exit();
        });

        if (process.argv[2] === 'deploy-prod') {
            await this.deployProd();
            return;
        }

        await boarBot.create();

        if (process.argv[2] === 'deploy-commands') {
            await boarBot.deployCommands();
        }
    }

    public static getBot(): Bot {
        return this.bot;
    }

    private static async deployProd(): Promise<void> {
        this.bot.loadConfig(true);

        const configData = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        const origConfig = JSON.parse(JSON.stringify(configData));

        configData.logChannel = process.env.LOG_CHANNEL as string;
        configData.reportsChannel = process.env.REPORTS_CHANNEL as string;
        configData.updatesChannel = process.env.UPDATES_CHANNEL as string;
        configData.unlimitedBoars = false;
        configData.maintenanceMode = true;

        fs.writeFileSync('config.json', JSON.stringify(configData));

        const client = new ftp.Client();

        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASS
        });

        await client.cd(this.bot.getConfig().pathConfig.prodRemotePath);
        await client.uploadFrom('config.json', 'config.json');

        client.close();

        fs.writeFileSync('config.json', JSON.stringify(origConfig));

        await this.doFilePush();
    }

    private static async doFilePush() {
        const config = this.bot.getConfig();
        const pathConfig = config.pathConfig;

        const waitTime = 1000 * 60 * 5;
        const endTime = Date.now() + waitTime;

        let minsLeft = Math.floor((endTime - Date.now()) / 1000 / 60);
        let secsLeft = Math.floor((endTime - Date.now() - minsLeft * 60 * 1000) / 1000);

        setTimeout(async () => {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(`${LogDebug.Colors.Yellow}Pushing...${LogDebug.Colors.White}`);

            const client = new ftp.Client();

            await client.access({
                host: process.env.FTP_HOST,
                user: process.env.FTP_USER,
                password: process.env.FTP_PASS
            });

            await client.cd(this.bot.getConfig().pathConfig.prodRemotePath);

            await this.pushToDir(client, 'src/main/typescript');
            await this.pushToDir(client, 'src/main/python');
            await this.pushToDir(client, pathConfig.otherAssets);
            await this.pushToDir(client, pathConfig.collAssets);
            await this.pushToDir(client, pathConfig.itemAssets);

            client.close();

            exec(pathConfig.prodStartScript);

            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(
                 `${LogDebug.Colors.Green}Successfully pushed changes to production.${LogDebug.Colors.White}`
            );
        }, waitTime);

        process.stdout.write(
            `Pushing to production in ${LogDebug.Colors.Red}${minsLeft}m${secsLeft.toString().padStart(2, '0')}s` +
            `${LogDebug.Colors.White} (Ctrl+C to abort)`
        );

        const showTimeInterval = setInterval(() => {
            minsLeft = Math.floor((endTime - Date.now()) / 1000 / 60);
            secsLeft = Math.floor((endTime - Date.now() - minsLeft * 60 * 1000) / 1000);

            if (Date.now() >= endTime) {
                clearInterval(showTimeInterval);
                return;
            }

            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(
                `Pushing to production in ${LogDebug.Colors.Red}${minsLeft}m${secsLeft.toString().padStart(2, '0')}s` +
                `${LogDebug.Colors.White} (Ctrl+C to abort)`
            );
        }, 1000);
    }

    private static async pushToDir(client: ftp.Client, from: string, to?: string) {
        await client.ensureDir(to ? to : from);
        await client.clearWorkingDir();
        await client.uploadFromDir(from);
        await client.cd(this.bot.getConfig().pathConfig.prodRemotePath);
    }
}

try {
    BoarBotApp.main();
} catch (err: unknown) {
    LogDebug.handleError(err);
}