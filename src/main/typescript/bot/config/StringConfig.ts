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

    public readonly botStatus: string = '';
    public readonly guildAdd: string = '';
    public readonly dmReceived: string = '';

    // General interaction responses

    public readonly noPermission: string = '';
    public readonly noSetup: string = '';
    public readonly doingSetup: string = '';
    public readonly wrongChannel: string = '';
    public readonly noGuild: string = '';
    public readonly nullFound: string = '';
    public readonly invalidID: string = '';
    public readonly onCooldown: string = '';
    public readonly noAttachmentPerms: string = '';
    public readonly error: string = '';
    public readonly maintenance: string = '';

    // Setup command messages

    public readonly setupCancelled: string = '';
    public readonly setupError: string = '';
    public readonly setupFinishedAll: string = '';
    public readonly setupExpired: string = '';
    public readonly setupUnfinished1: string = '';
    public readonly setupUnfinished2: string = '';
    public readonly setupUnfinished3: string = '';
    public readonly setupFinished1: string = '';
    public readonly setupFinished2: string = '';
    public readonly setupFinished3: string = '';
    public readonly setupInfoResponse1: string = '';
    public readonly setupInfoResponse2: string = '';
    public readonly setupInfoResponse3: string = '';

    // Daily command messages/strings

    public readonly dailyUsed: string = '';
    public readonly dailyTitle: string = '';
    public readonly dailyNoBoarFound: string = '';

    // Give command messages/strings (also badges)

    public readonly giveBoar: string = '';
    public readonly giveTitle: string = '';
    public readonly giveSpecialTitle: string = '';
    public readonly giveBadge: string = '';
    public readonly giveBadgeTitle: string = '';
    public readonly giveBadgeHas: string = '';
    public readonly obtainedBadgeTitle: string = '';

    // Collection command strings

    public readonly collNoBadges: string = '';

    // Miscellaneous strings

    public readonly noParentChannel: string = '';
    public readonly notValidChannel: string = '';
    public readonly defaultSelectPlaceholder: string = '';
    public readonly emptySelect: string = '';
    public readonly channelOptionLabel: string = '';
    public readonly unavailable: string = '';
    public readonly imageName: string = '';
    public readonly fontName: string = '';
    public readonly commandDebugPrefix: string = '';
}