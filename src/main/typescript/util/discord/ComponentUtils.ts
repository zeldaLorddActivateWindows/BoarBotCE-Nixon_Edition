import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction,
    SelectMenuBuilder,
    SelectMenuInteraction
} from 'discord.js';
import {ComponentConfig} from '../../bot/config/components/ComponentConfig';

/**
 * {@link ComponentUtils ComponentUtils.ts}
 *
 * A collection of functions that components
 * use frequently
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ComponentUtils {
    public static createRows(
        rowGroup: ComponentConfig[][],
        interaction: ChatInputCommandInteraction
    ): ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>[] {
        const newRows: ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>[] = [];

        for (const row of rowGroup) {
            const newRow = new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>();

            for (const componentInfo of row) {
                let component: ButtonBuilder | SelectMenuBuilder = new ButtonBuilder(componentInfo);

                if (componentInfo.customId.toLowerCase().includes('select')) {
                    component = new SelectMenuBuilder(componentInfo);
                }

                newRow.addComponents(component.setCustomId(componentInfo.customId + '|' + interaction.id));
            }

            newRows.push(newRow);
        }

        return newRows;
    }
}