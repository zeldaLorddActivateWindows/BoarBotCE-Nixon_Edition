import {Events} from 'discord.js';

/**
 * {@link Listener Listener.ts}
 *
 * An interface used to create new listeners.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export interface Listener {
    eventName: Events;
    execute(...args: any[]): void;
}