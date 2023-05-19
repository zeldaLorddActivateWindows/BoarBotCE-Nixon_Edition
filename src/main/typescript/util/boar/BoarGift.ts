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
        this.collector = await CollectorUtils.createCollector(
            interaction, interaction.id
        );

        this.firstInter = interaction;

        const giftFieldConfig = this.config.commandConfigs.boar.collection.componentFields;

        const claimRow: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> = ComponentUtils.addToIDs(
            giftFieldConfig[2][0],
            new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>(giftFieldConfig[2][0]),
            interaction.id + interaction.user.id
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
                await this.giveGift(inter);
                break;
            }
        }
    }

    private async giveGift(inter: ButtonInteraction): Promise<void> {

    }
}