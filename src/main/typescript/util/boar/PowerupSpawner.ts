/**
 * {@link PowerupSpawner PowerupSpawner.ts}
 *
 * Handles sending powerups and collecting user interactions
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
import {LogDebug} from '../logging/LogDebug';
import {BoarBotApp} from '../../BoarBotApp';
import {Queue} from '../interactions/Queue';
import {DataHandlers} from '../data/DataHandlers';
import fs from 'fs';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ChannelType, ChatInputCommandInteraction,
    StringSelectMenuBuilder,
} from 'discord.js';
import {GuildData} from '../data/GuildData';
import {ComponentUtils} from '../discord/ComponentUtils';

export class PowerupSpawner {
    private readonly intervalVal: number = 0;
    private initIntervalVal: number = 0;
    private powInterval: NodeJS.Timer = {} as NodeJS.Timer;

    constructor(intervalVal: number, initPowTime?: number) {
        this.intervalVal = intervalVal;
        this.initIntervalVal = initPowTime !== undefined ? Math.max(initPowTime - Date.now(), 5000) : intervalVal;
    }

    public startSpawning() {
        this.powInterval = setInterval(() => this.doSpawn(), this.initIntervalVal);
    }

    private async doSpawn() {
        try {
            const config = BoarBotApp.getBot().getConfig();
            const latestIntersViable: ChatInputCommandInteraction[] = [];

            if (this.initIntervalVal >= 0) {
                clearInterval(this.powInterval);
                this.initIntervalVal = -1;
                this.powInterval = setInterval(() => this.doSpawn(), this.intervalVal);
            }

            await Queue.addQueue(() => {
                const globalData = DataHandlers.getGlobalData();
                globalData.nextPowerup = Date.now() + this.intervalVal;
                fs.writeFileSync(config.pathConfig.globalDataFile, JSON.stringify(globalData));
            }, 'pow' + 'global');

            for (const guildID of Object.keys(BoarBotApp.getBot().getGuildData())) {
                const guildData: GuildData = BoarBotApp.getBot().getGuildData()[guildID];
                if (!guildData) continue;

                for (const inter of guildData.latestInters) {
                    if (inter === undefined || Date.now() - inter.createdTimestamp > 900000) continue;
                    latestIntersViable.push(inter);
                }
            }

            const curTime = Date.now();
            for (const inter of latestIntersViable) {
                const powFieldConfig = config.powerupConfig.promptTypes['fast'].rows;

                const fastClickButtons: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> = ComponentUtils.addToIDs(
                    powFieldConfig[0],
                    new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>(powFieldConfig[0]),
                    inter, curTime.toString()
                );

                inter.followUp({
                    content: "Powerup",
                    components: [
                        new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>()
                            .addComponents(fastClickButtons.components[0])
                    ]
                });
            }
        } catch (err: unknown) {
            await LogDebug.handleError((err as Error).stack);
        }
    }
}