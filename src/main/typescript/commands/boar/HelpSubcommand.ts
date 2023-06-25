import {
    ActionRowBuilder, ButtonBuilder, ButtonInteraction,
    ChatInputCommandInteraction,
    SelectMenuComponentOptionData, StringSelectMenuBuilder, StringSelectMenuInteraction,
    TextChannel
} from 'discord.js';
import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {GuildData} from '../../util/data/global/GuildData';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {RowConfig} from '../../bot/config/components/RowConfig';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import {LogDebug} from '../../util/logging/LogDebug';
import {Replies} from '../../util/interactions/Replies';

enum Area {
    General = 0,
    Powerups = 1,
    Market = 2,
    BadgeBoar = 3
}

/**
 * {@link HelpSubcommand HelpSubcommand.ts}
 *
 * Used to see information about the bot.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class HelpSubcommand implements Subcommand {
    private config = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.config.commandConfigs.boar.help;
    private firstInter: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private helpImages: string[][] = [];
    private curArea: Area = Area.General;
    private curPage: number = 0;
    private rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
        {} as ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };
    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildData: GuildData | undefined = await InteractionUtils.handleStart(interaction, this.config);
        if (!guildData) return;

        await interaction.deferReply({ ephemeral: true });

        this.firstInter = interaction;

        const pathConfig = this.config.pathConfig;
        const otherAssets = pathConfig.otherAssets;

        this.helpImages = [
            [otherAssets + pathConfig.helpGeneral1],
            [otherAssets + pathConfig.helpPowerup1, otherAssets + pathConfig.helpPowerup2],
            [otherAssets + pathConfig.helpMarket1, otherAssets + pathConfig.helpMarket2],
            [
                otherAssets + pathConfig.helpBadgeBoar1, otherAssets + pathConfig.helpBadgeBoar2,
                otherAssets + pathConfig.helpBadgeBoar3
            ]
        ];

        this.curArea = interaction.options.getInteger(this.subcommandInfo.args[0].name)
            ? interaction.options.getInteger(this.subcommandInfo.args[0].name) as Area
            : Area.General;
        this.curPage = interaction.options.getInteger(this.subcommandInfo.args[1].name)
            ? interaction.options.getInteger(this.subcommandInfo.args[1].name) as number - 1
            : 0;

        this.curPage = Math.max(0, this.curPage);
        this.curPage = Math.min(this.helpImages[this.curArea].length-1, this.curPage);

        if (CollectorUtils.helpCollectors[interaction.user.id]) {
            CollectorUtils.helpCollectors[interaction.user.id].stop('idle');
        }

        CollectorUtils.helpCollectors[interaction.user.id] = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        await this.showHelp(true);

        CollectorUtils.helpCollectors[interaction.user.id].on(
            'collect', async (inter: ButtonInteraction | StringSelectMenuInteraction) => await this.handleCollect(inter)
        );

        CollectorUtils.helpCollectors[interaction.user.id].once(
            'end', async (collected, reason) => await this.handleEndCollect(reason)
        );
    }

    private async handleCollect(inter: ButtonInteraction | StringSelectMenuInteraction) {
        try {
            const canInteract: boolean = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            if (!inter.isMessageComponent()) return;

            LogDebug.sendDebug(
                `${inter.customId.split('|')[0]} on page ${this.curPage} in area ${this.curArea}`,
                this.config, this.firstInter
            );

            const helpRowConfig: RowConfig[][] = this.config.commandConfigs.boar.help.componentFields;
            const helpComponents = {
                leftPage: helpRowConfig[0][0].components[0],
                rightPage: helpRowConfig[0][0].components[1],
                areaSelect: helpRowConfig[0][1].components[0]
            };

            await inter.deferUpdate();

            switch (inter.customId.split('|')[0]) {
                // User wants to go to previous page
                case helpComponents.leftPage.customId:
                    this.curPage--;
                    break;

                // User wants to go to the next page
                case helpComponents.rightPage.customId:
                    this.curPage++;
                    break;

                case helpComponents.areaSelect.customId:
                    this.curArea = Number.parseInt((inter as StringSelectMenuInteraction).values[0]) as Area;
                    this.curPage = 0;
                    break;
            }

            await this.showHelp();
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop && CollectorUtils.helpCollectors[inter.user.id]) {
                CollectorUtils.helpCollectors[inter.user.id].stop(CollectorUtils.Reasons.Error);
            }
        }

        clearInterval(this.timerVars.updateTime);
    }

    private async handleEndCollect(reason: string) {
        try {
            LogDebug.sendDebug('Ended collection with reason: ' + reason, this.config, this.firstInter);

            if (reason == CollectorUtils.Reasons.Error) {
                await Replies.handleReply(
                    this.firstInter, this.config.stringConfig.setupError, this.config.colorConfig.error
                );
            }

            await this.firstInter.editReply({
                components: []
            });
        } catch (err: unknown) {
            await LogDebug.handleError(err, this.firstInter);
        }
    }

    private async showHelp(firstRun: boolean = false) {
        if (firstRun) {
            this.initButtons();
        }

        for (const row of this.rows) {
            for (const component of row.components) {
                component.setDisabled(true);
            }
        }

        this.rows[0].components[0].setDisabled(this.curPage === 0);
        this.rows[0].components[1].setDisabled(this.curPage === this.helpImages[this.curArea].length - 1);
        this.rows[1].components[0].setDisabled(false);

        await this.firstInter.editReply({
            files: [fs.readFileSync(this.helpImages[this.curArea][this.curPage])],
            components: this.rows
        });
    }

    private initButtons(): void {
        const helpFieldConfigs: RowConfig[][] = this.config.commandConfigs.boar.help.componentFields;
        const selectOptions: SelectMenuComponentOptionData[] = [];

        for (const choice of this.config.commandConfigs.boar.help.args[0].choices) {
            selectOptions.push({
                label: choice.name,
                value: choice.value.toString()
            });
        }

        for (let i=0; i<helpFieldConfigs.length; i++) {
            const newRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
                ComponentUtils.makeRows(helpFieldConfigs[i]);

            ComponentUtils.addToIDs(
                helpFieldConfigs[i], newRows, this.firstInter.id, this.firstInter.user.id, selectOptions
            );
            this.rows = newRows;
        }
    }
}