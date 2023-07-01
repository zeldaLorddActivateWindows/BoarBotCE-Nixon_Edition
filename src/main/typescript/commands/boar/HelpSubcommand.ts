import {
    ActionRowBuilder, ButtonBuilder, ButtonInteraction,
    ChatInputCommandInteraction, InteractionCollector,
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
import {PathConfig} from '../../bot/config/PathConfig';

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
    private curPage = 0;
    private rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
        {} as ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

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

        const pathConfig: PathConfig = this.config.pathConfig;
        const otherAssets: string = pathConfig.otherAssets;

        this.helpImages = [
            [otherAssets + pathConfig.helpGeneral1],
            [otherAssets + pathConfig.helpPowerup1, otherAssets + pathConfig.helpPowerup2],
            [otherAssets + pathConfig.helpMarket1, otherAssets + pathConfig.helpMarket2],
            [
                otherAssets + pathConfig.helpBadgeBoar1, otherAssets + pathConfig.helpBadgeBoar2,
                otherAssets + pathConfig.helpBadgeBoar3
            ]
        ];

        // The help area to start out in
        this.curArea = interaction.options.getInteger(this.subcommandInfo.args[0].name)
            ? interaction.options.getInteger(this.subcommandInfo.args[0].name) as Area
            : Area.General;

        // The page to start out on
        this.curPage = interaction.options.getInteger(this.subcommandInfo.args[1].name)
            ? interaction.options.getInteger(this.subcommandInfo.args[1].name) as number - 1
            : 0;

        this.curPage = Math.max(0, this.curPage);
        this.curPage = Math.min(this.helpImages[this.curArea].length-1, this.curPage);

        if (CollectorUtils.helpCollectors[interaction.user.id]) {
            const oldCollector = CollectorUtils.helpCollectors[interaction.user.id];
            setTimeout(() => { oldCollector.stop(CollectorUtils.Reasons.Expired) }, 1000);
        }

        this.collector = CollectorUtils.helpCollectors[interaction.user.id] = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        this.showHelp(true);

        this.collector.on(
            'collect', async (inter: ButtonInteraction | StringSelectMenuInteraction) => await this.handleCollect(inter)
        );

        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));
    }

    /**
     * Handles collecting button and select menu interactions
     *
     * @param inter - The button interaction
     * @private
     */
    private async handleCollect(inter: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
        try {
            const canInteract: boolean = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            if (!inter.isMessageComponent()) return;

            if (!inter.customId.includes(this.firstInter.id)) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }

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

                // User wants to change what area of help to view
                case helpComponents.areaSelect.customId:
                    this.curArea = Number.parseInt((inter as StringSelectMenuInteraction).values[0]) as Area;
                    this.curPage = 0;
                    break;
            }

            await this.showHelp();
        } catch (err: unknown) {
            const canStop: boolean = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }

        clearInterval(this.timerVars.updateTime);
    }

    /**
     * Handles when the collection for navigating through help menu is finished
     *
     * @param reason - Why the collection ended
     * @private
     */
    private async handleEndCollect(reason: string): Promise<void> {
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

    /**
     * Displays the help image and modifies button states
     *
     * @param firstRun - Whether the running of the function is the first
     * @private
     */
    private async showHelp(firstRun = false): Promise<void> {
        try {
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
        } catch (err: unknown) {
            const canStop: boolean = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }
    }

    /**
     * Creates the buttons and rows used for collection by adding information to IDs
     *
     * @private
     */
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