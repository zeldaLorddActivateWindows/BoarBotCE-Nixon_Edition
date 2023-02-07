/***********************************************
 * Queue.ts
 * Weslay
 *
 * Handles the queue that sensitive parts of code
 * must go through to ensure no overwriting
 * occurs
 ***********************************************/

import {handleError} from './LogDebug';
import {getConfigFile} from "./DataHandlers";

//***************************************

// [1-10] are queues for users based on last digit of ID
// [0] is a queue for changing global information like editions and powerup times
const queue: Record<string, () => void>[] = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}];
let queueRunning = [false, false, false, false, false, false, false, false, false, false];

//***************************************

// Adds a function to a queue based on its ID number
async function addQueue(func: () => void, id: string) {
    const config = getConfigFile();
    const generalStrings = config.strings.general;

    const queueIndex = id.endsWith(generalStrings.globalQueueID) ? 0 : parseInt(id[id.length-1]) + 1;
    queue[queueIndex][id] = func;

    if (!queueRunning[queueIndex]) {
        queueRunning[queueIndex] = true;
        runQueue(queueIndex);
    }

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(generalStrings.rejectQueue);
        }, 30000);

        setInterval(() => {
            if (!queue[queueIndex][id])
                resolve(generalStrings.resolve);
        }, 100);
    })
}

//***************************************

// Runs the queue while there are items in it
async function runQueue(queueIndex: number) {
    if (Object.keys(queue[queueIndex]).length === 0) {
        queueRunning[queueIndex] = false
    }
    if (Object.keys(queue[queueIndex]).length > 0) {
        queueRunning[queueIndex] = true;

        try {
            await queue[queueIndex][Object.keys(queue[queueIndex])[0]]();
        } catch (err: unknown) {
            await handleError(err);
        }

        delete queue[queueIndex][Object.keys(queue[queueIndex])[0]];

        runQueue(queueIndex);
    }
}

//***************************************

export {
    addQueue
}