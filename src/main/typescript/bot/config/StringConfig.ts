/**
 * {@link StringConfig StringConfig.ts}
 *
 * Stores string configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class StringConfig {
    // Non-interaction messages
    public botStatus: string = '';
    public guildAdd: string = '';
    public dmReceived: string = '';

    // General interaction responses
    public noPermission: string = '';
    public noSetup: string = '';
    public doingSetup: string = '';
    public wrongChannel: string = '';
    public noGuild: string = '';
    public nullFound: string = '';
    public invalidID: string = '';
    public onCooldown: string = '';
    public noAttachmentPerms: string = '';
    public error: string = '';
    public maintenance: string = '';

    // Setup command messages
    public setupCancelled: string = '';
    public setupError: string = '';
    public setupFinishedAll: string = '';
    public setupExpired: string = '';
    public setupUnfinished1: string = '';
    public setupUnfinished2: string = '';
    public setupUnfinished3: string = '';
    public setupFinished1: string = '';
    public setupFinished2: string = '';
    public setupFinished3: string = '';
    public setupInfoResponse1: string = '';
    public setupInfoResponse2: string = '';
    public setupInfoResponse3: string = '';

    // Daily command messages/strings
    public dailyUsed: string = '';
    public dailyTitle: string = '';
    public dailyNoBoarFound: string = '';

    // Give command messages/strings (also badges)
    public giveBoar: string = '';
    public giveTitle: string = '';
    public giveSpecialTitle: string = '';
    public giveBadge: string = '';
    public giveBadgeTitle: string = '';
    public giveBadgeHas: string = '';
    public obtainedBadgeTitle: string = '';

    // Collection command strings
    public collNoBadges: string = '';

    // Miscellaneous strings
    public noParentChannel: string = '';
    public notValidChannel: string = '';
    public defaultSelectPlaceholder: string = '';
    public channelOptionLabel: string = '';
    public unavailable: string = '';
    public imageName: string = '';
    public fontName: string = '';
    public commandDebugPrefix: string = '';
}