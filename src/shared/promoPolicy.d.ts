/**
 * promoPolicy.js 타입 선언 (특별 홍보관 스포츠 4종 범위 및 링크 정책)
 */
import type { PromoLevel, SpecialPromoSport, UnifiedEventItem } from '../types/event';

export declare const ACTIVE_PROMO_LEVELS: PromoLevel[];
export declare const PROMO_LEVEL_SHORT_LABELS: Record<PromoLevel, string>;
export declare const PROMO_LEVEL_LABELS: Record<PromoLevel, string>;
export declare const SPORT_LABELS: Record<SpecialPromoSport, string>;
export declare const METRO_REGION_IDS: string[];

export declare function getPromoLevelLabel(
  level: PromoLevel,
  sport?: SpecialPromoSport
): string;

export declare function isSwimEvent(text: string): boolean;
export declare function isRunningEvent(text: string): boolean;
export declare function isCyclingEvent(text: string): boolean;
export declare function isTriathlonEvent(text: string): boolean;
export declare function matchesSportCategory(
  text: string,
  sport?: SpecialPromoSport
): boolean;
export declare function detectSportCategory(
  text: string
): SpecialPromoSport | null;
export declare function isSportsEvent(text: string): boolean;

export declare function isAttachmentLink(url?: string, label?: string): boolean;
export declare function isSpecificEventLink(url?: string, label?: string): boolean;

export interface TitleMunicipalityMatch {
  level: PromoLevel;
  lDongRegnCd: string;
  lDongSignguCd: string;
  sigunguName: string;
  metroShort?: string;
}

export declare function matchTitleMunicipalityByCode(
  title?: string
): TitleMunicipalityMatch | null;

export interface PromoLevelParams {
  explicitLevel?: PromoLevel | number | null;
  title?: string;
  invitation?: string;
  summary?: string;
  organizer?: string;
  regionId?: string;
  lDongRegnCd?: string;
  addr1?: string;
}

export declare function computePromoLevel(params?: PromoLevelParams): PromoLevel;
export declare function getEventCityShortName(ev: Partial<UnifiedEventItem>): string;
export declare function isPlaceholderFullYearRange(startDate?: string, endDate?: string): boolean;
export declare function isNoticeOnlyPost(title?: string, sports?: boolean): boolean;
export declare function normalizeEventDoc<T extends { id: string; title: string }>(doc: T): T | null;
