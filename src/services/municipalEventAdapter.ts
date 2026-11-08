import { UnifiedEventItem } from '../types/event';
import { getMajorCategoryName, getSubCategoryName } from '../constants/categories';
import { computeDefaultPromoLevel, REGION_BY_ID } from '../constants/regions';
import { computeEventStatus } from './korService2Api';

const STORAGE_KEY = 'korea_event_list_municipal_custom_v1';

export interface MunicipalRawFeedItem {
  id?: string;
  regionId: string;
  sigunguCode: string;
  sigunguName: string;
  title: string;
  category2: 'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL';
  category3: string;
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
  addr1: string;
  addr2?: string;
  tel?: string;
  mapX?: number;
  mapY?: number;
  organizer: string;
  sourceLabel: string;
  sourceOrgUrl: string;
  summary: string;
  feeInfo?: string;
}

/**
 * 기본 제공 지자체 행사 목록 (비어 있음)
 * - 과거에는 직접 작성한 예시 행사(39건)가 있었으나 실제 수집 데이터가 아니므로 삭제함 (2026-11-08)
 * - 실제 지자체 행사는 크롤러가 생성하는 public/data/auto-crawled-events.json 에서만 공급한다.
 */
const INITIAL_MUNICIPAL_FEEDS: MunicipalRawFeedItem[] = [];

/**
 * 지자체 홈페이지 원시 항목을 UnifiedEventItem 표준 스키마로 변환하는 어댑터
 */
export function normalizeMunicipalItem(raw: MunicipalRawFeedItem, index: number): UnifiedEventItem {
  const region = REGION_BY_ID[raw.regionId] || REGION_BY_ID['seoul'];
  return {
    id: raw.id || `muni-custom-${Date.now()}-${index}`,
    title: raw.title,
    source: 'MUNICIPAL_WEB',
    sourceLabel: raw.sourceLabel || `${region.name} 행정홈페이지`,
    sourceOrgUrl: raw.sourceOrgUrl || region.municipalPortalUrl,
    regionId: region.id,
    regionName: region.name,
    lDongRegnCd: region.lDongRegnCd,
    lDongSignguCd: raw.sigunguCode || '000',
    sigunguName: raw.sigunguName || '본청/전역',
    lclsSystm1: raw.category2 === 'MUNICIPAL' ? 'MU' : 'EV',
    lclsSystm2: raw.category2,
    lclsSystm2Name: getMajorCategoryName(raw.category2),
    lclsSystm3: raw.category3,
    lclsSystm3Name: getSubCategoryName(raw.category3),
    startDate: raw.startDate.replace(/-/g, ''),
    endDate: raw.endDate.replace(/-/g, ''),
    status: computeEventStatus(raw.startDate.replace(/-/g, ''), raw.endDate.replace(/-/g, '')),
    addr1: raw.addr1,
    addr2: raw.addr2,
    tel: raw.tel,
    mapX: raw.mapX ?? region.centerLng,
    mapY: raw.mapY ?? region.centerLat,
    organizer: raw.organizer,
    summary: raw.summary,
    feeInfo: raw.feeInfo || '무료 / 지자체 공고 참조',
    promoLevel: computeDefaultPromoLevel({
      title: raw.title,
      summary: raw.summary,
      organizer: raw.organizer,
      regionId: region.id,
      lDongRegnCd: region.lDongRegnCd,
      addr1: raw.addr1,
    }),
  };
}

/**
 * 저장된 지자체 행정 홈페이지 행사 목록 + 기본 제공 지자체 행사 목록 로드
 */
export function getMunicipalEvents(): UnifiedEventItem[] {
  let customFeeds: MunicipalRawFeedItem[] = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      customFeeds = JSON.parse(saved);
    }
  } catch {
    customFeeds = [];
  }

  const combined = [...customFeeds, ...INITIAL_MUNICIPAL_FEEDS];
  return combined.map((item, idx) => normalizeMunicipalItem(item, idx));
}

/**
 * 지자체 홈페이지에서 수집하거나 직접 입력한 신규 행정 행사를 로컬 스토리지에 추가
 */
export function addCustomMunicipalEvent(item: MunicipalRawFeedItem): UnifiedEventItem[] {
  let customFeeds: MunicipalRawFeedItem[] = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      customFeeds = JSON.parse(saved);
    }
  } catch {
    customFeeds = [];
  }

  const next = [{ ...item, id: `muni-user-${Date.now()}` }, ...customFeeds];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return getMunicipalEvents();
}
