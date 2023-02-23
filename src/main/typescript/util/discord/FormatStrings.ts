/**
 * {@link FormatStrings FormatStrings.ts}
 *
 * Handles discord timestamp formatting
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class FormatStrings {
    public static toRelTime(timestamp: number) { return `<t:${timestamp}:R>`; }
    public static toBasicChannel(id: string) { return `<#${id}>`; }
}