/**
 * {@link NumberConfig NumberConfig.ts}
 *
 * Stores number configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class NumberConfig {
    // First pixel of an image location
    public readonly originPos: [number, number] = [0, 0];

    // Font sizes

    public readonly fontBig: number = 0;
    public readonly fontMedium: number = 0;
    public readonly fontSmallMedium: number = 0;
    public readonly fontSmallest: number = 0;

    // Maximum values

    public readonly maxUsernameLength: number = 0;
    public readonly maxTrackedEditions: number = 0;
    public readonly maxScore: number = 0;
    public readonly maxBoars: number = 0;
    public readonly maxDailies: number = 0;
    public readonly maxStreak: number = 0;
    public readonly maxIndivBoars: number = 0;
    public readonly maxPowBase: number = 0;
    public readonly maxMulti: number = 0;
    public readonly maxMultiBoost: number = 0;
    public readonly maxExtraChance: number = 0;
    public readonly maxEnhancers: number = 0;
    public readonly maxSmallEnhanced: number = 0;
    public readonly maxPowPages: number = 0;

    // A constant used to determine how quickly to increase rarity
    public readonly rarityIncreaseConst: number = 0;

    // Item image positions, sizes, and values

    public readonly itemImageSize: [number, number] = [0, 0];
    public readonly itemBoarPos: [number, number] = [0, 0];
    public readonly itemBoarSize: [number, number] = [0, 0];
    public readonly itemBadgePos: [number, number] = [0, 0];
    public readonly itemBadgeSize: [number, number] = [0, 0];
    public readonly itemTitlePos: [number, number] = [0, 0];
    public readonly itemNamePos: [number, number] = [0, 0];
    public readonly itemNameplatePos: [number, number] = [0, 0];
    public readonly itemNameplatePadding: number = 0;
    public readonly itemNameplateHeight: number = 0;
    public readonly itemUserTagPos: [number, number] = [0, 0];
    public readonly itemUserAvatarPos: [number, number] = [0, 0];
    public readonly itemUserAvatarWidth: number = 0;

    // Collection image positions, sizes, and values

    public readonly collBoarsPerPage: number = 0;
    public readonly collImageSize: [number, number] = [0, 0];
    public readonly collEnhanceImageSize: [number, number] = [0, 0];
    public readonly collUserAvatarPos: [number, number] = [0, 0];
    public readonly collUserAvatarSize: [number, number] = [0, 0];
    public readonly collUserTagPos: [number, number] = [0, 0];
    public readonly collClanPos: [number, number] = [0, 0];
    public readonly collClanSize: [number, number] = [0, 0];
    public readonly collDateLabelPos: [number, number] = [0, 0];
    public readonly collDatePos: [number, number] = [0, 0];
    public readonly collNoBadgePos: [number, number] = [0, 0];
    public readonly collBadgeStart: number = 0;
    public readonly collBadgeSpacing: number = 0;
    public readonly collBadgeY: number = 0;
    public readonly collBadgeSize: [number, number] = [0, 0];
    public readonly collScoreLabelPos: [number, number] = [0, 0];
    public readonly collScorePos: [number, number] = [0, 0];
    public readonly collTotalLabelPos: [number, number] = [0, 0];
    public readonly collTotalPos: [number, number] = [0, 0];
    public readonly collUniquesLabelPos: [number, number] = [0, 0];
    public readonly collUniquePos: [number, number] = [0, 0];
    public readonly collDailiesLabelPos: [number, number] = [0, 0];
    public readonly collDailiesPos: [number, number] = [0, 0];
    public readonly collStreakLabelPos: [number, number] = [0, 0];
    public readonly collStreakPos: [number, number] = [0, 0];
    public readonly collLastDailyLabelPos: [number, number] = [0, 0];
    public readonly collLastDailyPos: [number, number] = [0, 0];
    public readonly collIndivRarityPos: [number, number] = [0, 0];
    public readonly collIndivFavHeight: number = 0;
    public readonly collIndivFavSize: [number, number] = [0, 0];
    public readonly collBoarNamePos: [number, number] = [0, 0];
    public readonly collBoarNameWidth: number = 0;
    public readonly collIndivTotalLabelPos: [number, number] = [0, 0];
    public readonly collIndivTotalPos: [number, number] = [0, 0];
    public readonly collFirstObtainedLabelPos: [number, number] = [0, 0];
    public readonly collFirstObtainedPos: [number, number] = [0, 0];
    public readonly collLastObtainedLabelPos: [number, number] = [0, 0];
    public readonly collLastObtainedPos: [number, number] = [0, 0];
    public readonly collDescriptionLabelPos: [number, number] = [0, 0];
    public readonly collDescriptionPos: [number, number] = [0, 0];
    public readonly collDescriptionWidth: number = 0;
    public readonly collAttemptsLabelPos: [number, number] = [0, 0];
    public readonly collAttemptsPos: [number, number] = [0, 0];
    public readonly collAttempts1LabelPos: [number, number] = [0, 0];
    public readonly collAttempts1Pos: [number, number] = [0, 0];
    public readonly collAttempts10LabelPos: [number, number] = [0, 0];
    public readonly collAttempts10Pos: [number, number] = [0, 0];
    public readonly collAttempts50LabelPos: [number, number] = [0, 0];
    public readonly collAttempts50Pos: [number, number] = [0, 0];
    public readonly collMostClaimedLabelPos: [number, number] = [0, 0];
    public readonly collMostClaimedPos: [number, number] = [0, 0];
    public readonly collBestPromptLabelPos: [number, number] = [0, 0];
    public readonly collBestPromptPos: [number, number] = [0, 0];
    public readonly collMultiLabelPos: [number, number] = [0, 0];
    public readonly collMultiPos: [number, number] = [0, 0];
    public readonly collGiftsLabelPos: [number, number] = [0, 0];
    public readonly collGiftsPos: [number, number] = [0, 0];
    public readonly collExtraChanceLabelPos: [number, number] = [0, 0];
    public readonly collExtraChancePos: [number, number] = [0, 0];
    public readonly collEnhancerLabelPos: [number, number] = [0, 0];
    public readonly collBoostClaimedLabelPos: [number, number] = [0, 0];
    public readonly collBoostClaimedPos: [number, number] = [0, 0];
    public readonly collBoostUsedLabelPos: [number, number] = [0, 0];
    public readonly collBoostUsedPos: [number, number] = [0, 0];
    public readonly collHighestMultiLabelPos: [number, number] = [0, 0];
    public readonly collHighestMultiPos: [number, number] = [0, 0];
    public readonly collHighestBoostLabelPos: [number, number] = [0, 0];
    public readonly collHighestBoostPos: [number, number] = [0, 0];
    public readonly collGiftsClaimedLabelPos: [number, number] = [0, 0];
    public readonly collGiftsClaimedPos: [number, number] = [0, 0];
    public readonly collGiftsUsedLabelPos: [number, number] = [0, 0];
    public readonly collGiftsUsedPos: [number, number] = [0, 0];
    public readonly collGiftsOpenedLabelPos: [number, number] = [0, 0];
    public readonly collGiftsOpenedPos: [number, number] = [0, 0];
    public readonly collMostGiftsLabelPos: [number, number] = [0, 0];
    public readonly collMostGiftsPos: [number, number] = [0, 0];
    public readonly collChancesClaimedLabelPos: [number, number] = [0, 0];
    public readonly collChancesClaimedPos: [number, number] = [0, 0];
    public readonly collChancesUsedLabelPos: [number, number] = [0, 0];
    public readonly collChancesUsedPos: [number, number] = [0, 0];
    public readonly collChanceHighestLabelPos: [number, number] = [0, 0];
    public readonly collChanceHighestPos: [number, number] = [0, 0];
    public readonly collEnhancersClaimedLabelPos: [number, number] = [0, 0];
    public readonly collEnhancersClaimedPos: [number, number] = [0, 0];
    public readonly collEnhancedLabelPositions: [number, number][] = [];
    public readonly collEnhancedPositions: [number, number][] = [];
    public readonly collEnhanceDetailsPos: [number, number] = [0, 0];
    public readonly collEnhanceDetailsWidth: number = 0;
    public readonly collPowDataWidth: number = 0;
    public readonly collBoarStartX: number = 0;
    public readonly collBoarStartY: number = 0;
    public readonly collBoarSpacingX: number = 0;
    public readonly collBoarSpacingY: number = 0;
    public readonly collBoarCols: number = 0;
    public readonly collBoarSize: [number, number] = [0, 0];
    public readonly collRarityStartX: number = 0;
    public readonly collRarityStartY: number = 0;
    public readonly collRarityEndDiff: number = 0;
    public readonly collRarityWidth: number = 0;
    public readonly collLastBoarPos: [number, number] = [0, 0];
    public readonly collLastBoarSize: [number, number] = [0, 0];
    public readonly collRecentLabelPos: [number, number] = [0, 0];
    public readonly collFavBoarPos: [number, number] = [0, 0];
    public readonly collFavBoarSize: [number, number] = [0, 0];
    public readonly collFavLabelPos: [number, number] = [0, 0];
    public readonly collIndivBoarPos: [number, number] = [0, 0];
    public readonly collIndivBoarSize: [number, number] = [0, 0];
    public readonly collEnhancerStartX: number = 0;
    public readonly collEnhancerStartY: number = 0;
    public readonly collEnhancerSpacingX: number = 0;
    public readonly collEnhancerSpacingY: number = 0;
    public readonly collEnhancerCols: number = 0;
    public readonly collEnhancerSize: [number, number] = [0, 0];
}