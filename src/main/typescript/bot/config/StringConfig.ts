/**
 * {@link StringConfig StringConfig.ts}
 *
 * Stores string configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class StringConfig {
    // General interaction responses

    public readonly noPermission: string = ' ';
    public readonly noSetup: string = ' ';
    public readonly doingSetup: string = ' ';
    public readonly wrongChannel: string = ' ';
    public readonly nullFound: string = ' ';
    public readonly onCooldown: string = ' ';
    public readonly error: string = ' ';
    public readonly maintenance: string = ' ';
    public readonly bannedString: string = ' ';
    public readonly banSuccess: string = ' ';

    // Setup command messages

    public readonly setupCancelled: string = ' ';
    public readonly setupError: string = ' ';
    public readonly setupFinishedAll: string = ' ';
    public readonly setupExpired: string = ' ';
    public readonly setupUnfinished1: string = ' ';
    public readonly setupUnfinished2: string = ' ';
    public readonly setupFinished1: string = ' ';
    public readonly setupFinished2: string = ' ';
    public readonly setupInfoResponse1: string = ' ';
    public readonly setupInfoResponse2: string = ' ';

    // Daily command messages/strings

    public readonly dailyPowUsed: string = ' ';
    public readonly dailyUsed: string = ' ';
    public readonly dailyFirstTime: string = ' ';
    public readonly dailyBonus: string = ' ';
    public readonly dailyUsedNotify: string = ' ';
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
    public readonly collFastestTimeLabel: string = ' ';
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
    public readonly collDescriptionSB: string = ' ';

    // Event strings

    public readonly eventTitle: string = ' ';
    public readonly eventEndedTitle: string = ' ';
    public readonly eventParticipated: string = ' ';
    public readonly eventNobody: string = ' ';

    // Powerup strings

    public readonly powRightFull: string = ' ';
    public readonly powRight: string = ' ';
    public readonly powWrongFull: string = ' ';
    public readonly powWrong: string = ' ';
    public readonly powTop: string = ' ';
    public readonly powTopResult: string = ' ';
    public readonly powAvg: string = ' ';
    public readonly powAvgResult: string = ' ';
    public readonly powAvgResultPlural: string = ' ';
    public readonly powPrompt: string = ' ';
    public readonly powResponse: string = ' ';
    public readonly powReward: string = ' ';

    // Market Strings

    public readonly marketConfirmInstaBuy: string = ' ';
    public readonly marketUpdatedInstaBuy: string = ' ';
    public readonly marketConfirmInstaSell: string = ' ';
    public readonly marketUpdatedInstaSell: string = ' ';
    public readonly marketInstaComplete: string = ' ';
    public readonly marketConfirmBuyOrder: string = ' ';
    public readonly marketConfirmSellOrder: string = ' ';
    public readonly marketOrderComplete: string = ' ';
    public readonly marketConfirmUpdateIncrease: string = ' ';
    public readonly marketConfirmUpdateDecrease: string = ' ';
    public readonly marketUpdateComplete: string = ' ';
    public readonly marketClaimComplete: string = ' ';
    public readonly marketMaxItems: string = ' ';
    public readonly marketCancelComplete: string = ' ';
    public readonly marketNoRoom: string = ' ';
    public readonly marketMustClaim: string = ' ';
    public readonly marketNoBucks: string = ' ';
    public readonly marketNoEdition: string = ' ';
    public readonly marketNoEditionOrders: string = ' ';
    public readonly marketNoItems: string = ' ';
    public readonly marketNoOrders: string = ' ';
    public readonly marketMaxOrders: string = ' ';
    public readonly marketInvalid: string = ' ';
    public readonly marketWrongEdition: string = ' ';
    public readonly marketTooMany: string = ' ';
    public readonly marketTooHigh: string = ' ';
    public readonly marketEditionHigh: string = ' ';
    public readonly marketHasEdition: string = ' ';
    public readonly marketClosed: string = ' ';
    public readonly marketTooYoung: string = ' ';
    public readonly marketTooCheap: string = ' ';
    public readonly marketTooExpensive: string = ' ';
    public readonly marketBestOrder: string = ' ';
    public readonly marketBSBuyNowLabel: string = ' ';
    public readonly marketBSSellNowLabel: string = ' ';
    public readonly marketBSBuyOrdLabel: string = ' ';
    public readonly marketBSSellOrdLabel: string = ' ';
    public readonly marketOrdSell: string = ' ';
    public readonly marketOrdBuy: string = ' ';
    public readonly marketOrdList: string = ' ';
    public readonly marketOrdExpire: string = ' ';
    public readonly marketOrdPriceLabel: string = ' ';
    public readonly marketOrdFillLabel: string = ' ';
    public readonly marketOrdClaimLabel: string = ' ';

    // Miscellaneous strings

    public readonly giftFail: string = ' ';
    public readonly enhanceGotten: string = ' ';
    public readonly notInBoard: string = ' ';
    public readonly boardHeader: string = ' ';
    public readonly boardFooter: string = ' ';
    public readonly deletedUsername: string = ' ';
    public readonly notificationSuccess: string = ' ';
    public readonly notificationSuccessReply: string = ' ';
    public readonly notificationDailyReady: string = ' ';
    public readonly notificationStopStr: string = ' ';
    public readonly notificationExtras: string[] = [];
    public readonly noParentChannel: string = ' ';
    public readonly notValidChannel: string = ' ';
    public readonly sentReport: string = ' ';
    public readonly deletedData: string = ' ';
    public readonly cancelDelete: string = ' ';
    public readonly deleteMsgOne: string = ' ';
    public readonly deleteMsgTwo: string = ' ';
    public readonly defaultSelectPlaceholder: string = ' ';
    public readonly emptySelect: string = ' ';
    public readonly channelOptionLabel: string = ' ';
    public readonly unavailable: string = ' ';
    public readonly imageName: string = ' ';
    public readonly fontName: string = ' ';
    public readonly commandDebugPrefix: string = ' ';
}