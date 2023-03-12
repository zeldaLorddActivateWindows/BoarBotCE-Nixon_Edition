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
 * use frequently.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ComponentUtils {
    /**
     * Adds an addition to all custom ids in an action row
     *
     * @param rowConfig - The configuration of the row
     * @param row - The actual row
     * @param addition - What to add
     * @return row - Updated row with addition to ids
     */
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

    /**
     * Adds options to the select menu in a row
     *
     * @param row - The row to update
     * @param options - The options to add to the select menu
     */
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