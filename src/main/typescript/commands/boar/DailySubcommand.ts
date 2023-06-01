import {AttachmentBuilder, ChatInputCommandInteraction} from 'discord.js';
import {BoarUser} from '../../util/boar/BoarUser';
import {BoarBotApp} from '../../BoarBotApp';
import moment from 'moment/moment';
import {Subcommand} from '../../api/commands/Subcommand';
import {Queue} from '../../util/interactions/Queue';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {LogDebug} from '../../util/logging/LogDebug';
import {BotConfig} from '../../bot/config/BotConfig';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {Replies} from '../../util/interactions/Replies';
import {BoarUtils} from '../../util/boar/BoarUtils';
import {ItemImageGenerator} from '../../util/generators/ItemImageGenerator';
import {GuildData} from '../../util/data/global/GuildData';
import {StringConfig} from '../../bot/config/StringConfig';
import {ColorConfig} from '../../bot/config/ColorConfig';
import {ItemConfigs} from '../../bot/config/items/ItemConfigs';

/**
 * {@link DailySubcommand DailySubcommand.ts}
 *
 * Used to give users their daily boar.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class DailySubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boar.daily;
    private guildData: GuildData | undefined;
    private interaction: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.config = BoarBotApp.getBot().getConfig();

        this.guildData = await InteractionUtils.handleStart(interaction, this.config);
        if(!this.guildData) return;

        await interaction.deferReply();
        this.interaction = interaction;

        await this.doDaily();
    }

    /**
     * Checks if user can use their daily boar, and if they can,
     * get it, display it, and place it in user data
     *
     * @private
     */
    private async doDaily(): Promise<void> {
        if (!this.interaction.guild || !this.interaction.channel) return;

        const strConfig: StringConfig = this.config.stringConfig;
        const colorConfig: ColorConfig = this.config.colorConfig;
        const powItemConfigs: ItemConfigs = this.config.itemConfigs.powerups;

        let boarUser: BoarUser = {} as BoarUser;
        let boarIDs: string[] = [''];

        let usedBoost: boolean = false;
        let usedExtra: boolean = false;

        await Queue.addQueue(async () => {
            // New boar user object used for easier manipulation of data
            boarUser = new BoarUser(this.interaction.user, true);

            const canUseDaily: boolean = await this.canUseDaily(boarUser);
            if (!canUseDaily) return;

            // Gets whether to use boost
            const boostInput: boolean = this.interaction.options.getBoolean(this.subcommandInfo.args[0].name)
                ? this.interaction.options.getBoolean(this.subcommandInfo.args[0].name) as boolean
                : false;
            const extraInput: boolean = this.interaction.options.getBoolean(this.subcommandInfo.args[1].name)
                ? this.interaction.options.getBoolean(this.subcommandInfo.args[1].name) as boolean
                : false;

            // Map of rarity index keys and weight values
            let rarityWeights: Map<number, number> = BoarUtils.getBaseRarityWeights(this.config);
            let userMultiplier: number = boarUser.stats.general.multiplier;

            if (boostInput) {
                userMultiplier += boarUser.itemCollection.powerups.multiBoost.numTotal;
            }

            usedBoost = boostInput && boarUser.itemCollection.powerups.multiBoost.numTotal > 0;
            usedExtra = extraInput && boarUser.itemCollection.powerups.extraChance.numTotal > 0;

            rarityWeights = this.applyMultiplier(userMultiplier, rarityWeights);

            boarIDs = BoarUtils.getRandBoars(
                this.guildData, this.interaction, rarityWeights,
                extraInput, boarUser.itemCollection.powerups.extraChance.numTotal, this.config
            );

            if (boarIDs.includes('')) {
                await LogDebug.handleError(this.config.stringConfig.dailyNoBoarFound, this.interaction);
                return;
            }

            if (boostInput && boarUser.itemCollection.powerups.multiBoost.numTotal > 0) {
                boarUser.itemCollection.powerups.multiBoost.numTotal = 0;
                boarUser.itemCollection.powerups.multiBoost.numUsed++;
            }

            if (boarUser.itemCollection.powerups.extraChance.numTotal > 0) {
                boarUser.itemCollection.powerups.extraChance.numTotal = 0;
                boarUser.itemCollection.powerups.extraChance.numUsed++;
            }

            boarUser.stats.general.boarStreak++;
            boarUser.stats.general.multiplier++;

            boarUser.stats.general.highestMulti =
                Math.max(boarUser.stats.general.multiplier, boarUser.stats.general.highestMulti);

            boarUser.stats.general.lastDaily = Date.now();
            boarUser.stats.general.numDailies++;

            if (boarUser.stats.general.firstDaily === 0) {
                boarUser.stats.general.firstDaily = Date.now();
            }

            boarUser.updateUserData();
        }, this.interaction.id + this.interaction.user.id);

        if (boarIDs.includes('')) return;

        const randScores: number[] = [];
        const attachments: AttachmentBuilder[] = [];

        // Gets slightly deviated scores for each boar
        for (let i=0; i<boarIDs.length; i++) {
            randScores.push(
                Math.round(
                    this.config.rarityConfigs[BoarUtils.findRarity(boarIDs[i], this.config)[0]-1].baseScore *
                    (Math.random() * (1.1 - .9) + .9)
                )
            );
        }

        const editions: number[] = await boarUser.addBoars(boarIDs, this.interaction, this.config, randScores);

        // Gets item images for each boar
        for (let i=0; i<boarIDs.length; i++) {
            attachments.push(
                await new ItemImageGenerator(
                    boarUser.user, boarIDs[i], i === 0 ? strConfig.dailyTitle : strConfig.extraTitle, this.config
                ).handleImageCreate(
                    false, undefined, undefined, undefined, randScores[i]
                )
            );
        }

        for (let i=0; i<attachments.length; i++) {
            if (i === 0) {
                await this.interaction.editReply({ files: [attachments[i]] })
            } else {
                await this.interaction.followUp({ files: [attachments[i]] })
            }
        }

        for (const edition of editions) {
            if (edition !== 1) continue;
            await this.interaction.followUp({
                files: [
                    await new ItemImageGenerator(
                        this.interaction.user, 'racer', this.config.stringConfig.giveTitle, this.config
                    ).handleImageCreate()
                ]
            });
        }

        let coloredText: string = '';

        if (usedBoost) {
            coloredText += powItemConfigs.multiBoost.name;
        }

        if (usedExtra) {
            coloredText += coloredText === ''
                ? powItemConfigs.extraChance.name
                : ' and ' + powItemConfigs.extraChance.name
        }

        if (coloredText !== '') {
            await Replies.handleReply(
                this.interaction, strConfig.dailyPowUsed, colorConfig.font, coloredText, colorConfig.powerup, true
            );
        }

    }

    /**
     * Returns whether the user can use their daily boar
     *
     * @param boarUser - User's boar information
     * @private
     */
    private async canUseDaily(
        boarUser: BoarUser
    ): Promise<boolean> {
        // Midnight of next day (UTC)
        const nextBoarTime: number = Math.floor(new Date().setUTCHours(24,0,0,0));

        // Returns if user has already used their daily boar
        if (boarUser.stats.general.lastDaily >= nextBoarTime - (1000 * 60 * 60 * 24) && !this.config.unlimitedBoars) {
            await Replies.handleReply(
                this.interaction,
                this.config.stringConfig.dailyUsed + moment(nextBoarTime).fromNow()
            );
            return false;
        }

        return true
    }

    /**
     * Applies the user multiplier to rarity weights using an arctan function
     *
     * @param userMultiplier - Used to increase weight
     * @param rarityWeights - Map of weights and their indexes
     * @private
     */
    private applyMultiplier(userMultiplier: number, rarityWeights: Map<number, number>): Map<number, number> {
        // Sorts from the highest weight to the lowest weight
        const newWeights: Map<number, number> = new Map([...rarityWeights.entries()]
            .sort((a,b) => { return b[1] - a[1]; })
        );

        const highestWeight: number = newWeights.values().next().value;
        const rarityIncreaseConst: number = this.config.numberConfig.rarityIncreaseConst;

        // Increases probability by increasing weight
        // https://www.desmos.com/calculator/74inrkixxa | x = multiplier, o = weight
        for (const weightInfo of newWeights) {
            const rarityIndex: number = weightInfo[0];
            const oldWeight: number = weightInfo[1];

            if (oldWeight == 0) continue;

            newWeights.set(
                rarityIndex,
                oldWeight * (Math.atan(((userMultiplier - 1) * oldWeight) / rarityIncreaseConst) *
                    (highestWeight - oldWeight) / oldWeight + 1)
            );
        }

        // Restores the original order of the Map
        return new Map([...newWeights.entries()].sort((a,b) => { return a[0] - b[0]; }));
    }
}