import {BoarUser} from './BoarUser';
import {
    ActionRowBuilder, ButtonBuilder,
    ButtonInteraction,
    Collection,
    InteractionCollector, Message, MessageComponentInteraction, StringSelectMenuBuilder,
    StringSelectMenuInteraction
} from 'discord.js';
import {CollectorUtils} from '../discord/CollectorUtils';
import {ComponentUtils} from '../discord/ComponentUtils';
import {BotConfig} from '../../bot/config/BotConfig';
import {CollectionImageGenerator} from '../generators/CollectionImageGenerator';
import {LogDebug} from '../logging/LogDebug';
import {OutcomeConfig} from '../../bot/config/powerups/OutcomeConfig';
import {OutcomeSubConfig} from '../../bot/config/powerups/OutcomeSubConfig';
import {Queue} from '../interactions/Queue';

/**
 * {@link BoarGift BoarGift.ts}
 *
 * Handles the creation of boar gift messages and
 * interactions with those messages
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class BoarGift {
    private config: BotConfig;
    public boarUser: BoarUser;
    private imageGen: CollectionImageGenerator;
    private firstInter: MessageComponentInteraction = {} as MessageComponentInteraction;
    private compInters: ButtonInteraction[] = [];
    private giftMessage: Message = {} as Message;
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;

    /**
     * Creates a new BoarUser from data file.
     *
     * @param boarUser
     * @param config
     * @param imageGen
     */
    constructor(boarUser: BoarUser, config: BotConfig, imageGen: CollectionImageGenerator) {
        this.boarUser = boarUser;
        this.config = config;
        this.imageGen = imageGen;
    }

    public async sendMessage(interaction: MessageComponentInteraction) {
        this.collector = await CollectorUtils.createCollector(interaction, true);

        this.firstInter = interaction;

        const giftFieldConfig = this.config.commandConfigs.boar.collection.componentFields;

        const claimRow: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> = ComponentUtils.addToIDs(
            giftFieldConfig[2][0],
            new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>(giftFieldConfig[2][0]),
            interaction, true
        );

        claimRow.components[0].setDisabled(false);

        this.giftMessage = await interaction.followUp({
            files: [await this.imageGen.finalizeGift()],
            components: [claimRow]
        });

        this.collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter));
        this.collector.once('end', async (collected) => await this.handleEndCollect(collected));
    }

    private async handleCollect(inter: ButtonInteraction): Promise<void> {
        await inter.deferUpdate();
        this.compInters.push(inter);
        this.collector.stop();
    }

    private async handleEndCollect(
        collected:  Collection<string, ButtonInteraction | StringSelectMenuInteraction>
    ): Promise<void> {
        if (collected.size === 0) {
            const responseButton = new ButtonBuilder()
                .setDisabled(true)
                .setCustomId('GIFT_CLAIMED')
                .setLabel('EXPIRED')
                .setStyle(2);

            await this.giftMessage.edit({
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(responseButton)]
            });

            return;
        }

        for (const inter of this.compInters) {
            if (inter.user.id === collected.at(0)?.user.id) {
                await this.doGift(inter);
                break;
            }
        }
    }

    private async doGift(inter: ButtonInteraction): Promise<void> {
        const outcome: number = this.getOutcome();
        let subOutcome: number = this.getOutcome(outcome);

        LogDebug.sendDebug('GIFT CLAIMED:' + outcome + '|' + subOutcome, this.config);

        switch (outcome) {
            case 0:
                await this.giveSpecial(subOutcome, inter);
                break;
            case 1:
                await this.giveBucks(subOutcome, inter);
                break;
            case 2:
                //await this.givePowerup();
                break;
            case 3:
                //await this.giveBoar();
                break;
        }
    }

    private getOutcome(outcomeVal?: number): number {
        const outcomeConfig: OutcomeConfig[] = this.config.powerupConfig.gift.outcomes;
        const probabilities: number[] = [];
        const randVal: number = Math.random();
        let outcomes: OutcomeConfig[] | OutcomeSubConfig[] = outcomeConfig;
        let weightTotal: number = 0;

        if (outcomeVal !== undefined) {
            outcomes = outcomeConfig[outcomeVal].suboutcomes;
        }

        if (outcomes.length === 0) return -1;

        for (const outcome of outcomes) {
            weightTotal += outcome.weight;
        }

        for (let i=0; i<outcomes.length; i++) {
            const weight = outcomes[i].weight;

            probabilities.push(weight / weightTotal);

            if (probabilities.length === 1) continue;

            probabilities[i] += probabilities[i-1];
        }

        for (let i=0; i<probabilities.length; i++) {
            if (randVal < probabilities[i]) {
                return i;
            }
        }

        return probabilities.length-1;
    }

    private async giveSpecial(suboutcome: number, inter: ButtonInteraction): Promise<void> {
        const outcomeConfig = this.config.powerupConfig.gift.outcomes[0];

        await new BoarUser(inter.user).addBoars(this.config, ['gamebreaker'], inter);

        await inter.editReply({
            content: `**__Gift Claimed by ${inter.user.username}!__**\nCategory: *${outcomeConfig.category}*\nReward: *${outcomeConfig.suboutcomes[suboutcome].name}*`,
            files: [],
            components: []
        });
    }

    private async giveBucks(suboutcome: number, inter: ButtonInteraction): Promise<void> {
        const outcomeConfig = this.config.powerupConfig.gift.outcomes[1];
        let numBucks: number = 0;

        if (suboutcome === 0) {
            numBucks = Math.round(Math.random() * (25 - 1) + 1)
        } else if (suboutcome === 1) {
            numBucks = Math.round(Math.random() * (100 - 50) + 50)
        } else {
            numBucks = Math.round(Math.random() * (300 - 200) + 200)
        }

        await Queue.addQueue(() => {
            const giftedUser = new BoarUser(inter.user);
            giftedUser.boarScore += numBucks;
            giftedUser.updateUserData();
        }, inter.id + inter.user.id);

        await inter.editReply({
            content: `**__Gift Claimed by ${inter.user.username}!__**\nCategory: *${outcomeConfig.category}*\nReward: *${outcomeConfig.suboutcomes[suboutcome].name.replace('%@', numBucks.toLocaleString())}*`,
            files: [],
            components: []
        });
    }
}