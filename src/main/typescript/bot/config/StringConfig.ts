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

    public readonly botStatus: string = ' ';
    public readonly guildAdd: string = ' ';
    public readonly dmReceived: string = ' ';

    // General interaction responses

    public readonly noPermission: string = ' ';
    public readonly noSetup: string = ' ';
    public readonly doingSetup: string = ' ';
    public readonly wrongChannel: string = ' ';
    public readonly noGuild: string = ' ';
    public readonly nullFound: string = ' ';
    public readonly invalidID: string = ' ';
    public readonly invalidPage: string = ' ';
    public readonly onCooldown: string = ' ';
    public readonly noAttachmentPerms: string = ' ';
    public readonly error: string = ' ';
    public readonly maintenance: string = ' ';

    // Setup command messages

    public readonly setupCancelled: string = ' ';
    public readonly setupError: string = ' ';
    public readonly setupFinishedAll: string = ' ';
    public readonly setupExpired: string = ' ';
    public readonly setupUnfinished1: string = ' ';
    public readonly setupUnfinished2: string = ' ';
    public readonly setupUnfinished3: string = ' ';
    public readonly setupFinished1: string = ' ';
    public readonly setupFinished2: string = ' ';
    public readonly setupFinished3: string = ' ';
    public readonly setupInfoResponse1: string = ' ';
    public readonly setupInfoResponse2: string = ' ';
    public readonly setupInfoResponse3: string = ' ';

    // Daily command messages/strings

    public readonly dailyPowUsed: string = ' ';
    public readonly dailyUsed: string = ' ';
    public readonly dailyTitle: string = ' ';
    public readonly extraTitle: string = ' ';
    public readonly dailyNoBoarFound: string = ' ';

    // Give command messages/strings (also badges)

    public readonly giveBoarChoiceTag: string = ' ';
    public readonly giveBadgeChoiceTag: string = ' ';
    public readonly giveBoar: string = ' ';
    public readonly giveBadID: string = '';
    public readonly giveTitle: string = ' ';
    public readonly giveBadge: string = ' ';
    public readonly giveBadgeTitle: string = ' ';
    public readonly giveBadgeHas: string = ' ';
    public readonly giftOpenTitle: string = ' ';

    // Collection command strings

    public readonly collNoBadges: string = ' ';
    public readonly collDateLabel: string = ' ';
    public readonly collScoreLabel: string = ' ';
    public readonly collTotalLabel: string = ' ';
    public readonly collUniquesLabel: string = ' ';
    public readonly collDailiesLabel: string = ' ';
    public readonly collStreakLabel: string = ' ';
    public readonly collLastDailyLabel: string = ' ';
    public readonly collFavLabel: string = ' ';
    public readonly collRecentLabel: string = ' ';
    public readonly collIndivTotalLabel: string = ' ';
    public readonly collFirstObtainedLabel: string = ' ';
    public readonly collLastObtainedLabel: string = ' ';
    public readonly collDescriptionLabel: string = ' ';
    public readonly collAttemptsLabel: string = ' ';
    public readonly collAttempts50Label: string = ' ';
    public readonly collAttempts10Label: string = ' ';
    public readonly collAttempts1Label: string = ' ';
    public readonly collMostClaimedLabel: string = ' ';
    public readonly collBestPromptLabel: string = ' ';
    public readonly collMultiplierLabel: string = ' ';
    public readonly collGiftsLabel: string = ' ';
    public readonly collExtraBoarLabel: string = ' ';
    public readonly collEnhancerLabel: string = ' ';
    public readonly collBoostsClaimedLabel: string = ' ';
    public readonly collBoostsUsedLabel: string = ' ';
    public readonly collHighestMultiLabel: string = ' ';
    public readonly collHighestBoostLabel: string = ' ';
    public readonly collGiftsClaimedLabel: string = ' ';
    public readonly collGiftsUsedLabel: string = ' ';
    public readonly collGiftsOpenedLabel: string = ' ';
    public readonly collMostGiftsLabel: string = ' ';
    public readonly collChancesClaimedLabel: string = ' ';
    public readonly collChancesUsedLabel: string = ' ';
    public readonly collChanceHighestLabel: string = ' ';
    public readonly collEnhancersClaimedLabel: string = ' ';
    public readonly collEnhancedLabel: string = ' ';
    public readonly collEnhanceDetails: string = ' ';
    public readonly collEnhanceBoarLose: string = ' ';
    public readonly collEnhanceBoarGain: string = ' ';
    public readonly collGiftDetails: string = ' ';
    public readonly collEditionTitle: string = ' ';
    public readonly collEditionLine: string = ' ';

    // Miscellaneous strings

    public readonly giftFail: string = ' ';
    public readonly enhanceGotten: string = ' ';
    public readonly powRightFull: string = ' ';
    public readonly powRight: string = ' ';
    public readonly powWrongFull: string = ' ';
    public readonly powWrong: string = ' ';
    public readonly powAttempted: string = ' ';
    public readonly powLessThan: string = ' ';
    public readonly powTopOne: string = ' ';
    public readonly powTopOneResponse: string = ' ';
    public readonly powTopTen: string = ' ';
    public readonly powTopTenResponse: string = ' ';
    public readonly powTopFifty: string = ' ';
    public readonly powTopFiftyResponse: string = ' ';
    public readonly powNoRewardResponse: string = ' ';
    public readonly powNoClaim: string = ' ';
    public readonly powReward: string = ' ';
    public readonly noParentChannel: string = ' ';
    public readonly notValidChannel: string = ' ';
    public readonly defaultSelectPlaceholder: string = ' ';
    public readonly emptySelect: string = ' ';
    public readonly channelOptionLabel: string = ' ';
    public readonly unavailable: string = ' ';
    public readonly imageName: string = ' ';
    public readonly fontName: string = ' ';
    public readonly commandDebugPrefix: string = ' ';
}