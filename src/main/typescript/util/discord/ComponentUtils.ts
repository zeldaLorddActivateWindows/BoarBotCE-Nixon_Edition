import {
    ActionRowBuilder, APISelectMenuOption,
    ButtonBuilder,
    ButtonInteraction,
    ComponentType,
    SelectMenuBuilder,
    SelectMenuInteraction
} from 'discord.js';
import {RowConfig} from '../../bot/config/components/RowConfig';

/**
 * {@link ComponentUtils ComponentUtils.ts}
 *
 * A collection of functions that collectors
 * use frequently
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ComponentUtils {
    public static addToIDs(
        rowConfig: RowConfig,
        row: ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>,
        addition: string
    ): ActionRowBuilder<SelectMenuBuilder | ButtonBuilder> {
        for (const component in row.components) {
            const componentConfig = rowConfig.components[component];
            row.components[component].setCustomId(componentConfig.customId + '|' + addition);
        }

        return row;
    }

    public static addOptionsToSelectRow(
        row: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>,
        options: APISelectMenuOption[]
    ): ActionRowBuilder<ButtonBuilder | SelectMenuBuilder> {
        if (row.components[0].data.type === ComponentType.SelectMenu) {
            (row.components[0] as SelectMenuBuilder).setOptions(...options);
        }

        return row;
    }
}