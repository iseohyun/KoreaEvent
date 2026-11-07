import { EventDetailInfo, UnifiedEventItem } from '../types/event';
import { resolveSigunguPortalInfo } from '../constants/municipalityPortals';
import { REGION_BY_ID } from '../constants/regions';

export interface ProvincePortalRecord {
  regionId: string;
  lDongRegnCd: string;
  name: string;
  hallName: string;
  hallUrl: string;
  promo1Name: string;
  promo1Url: string;
  promo2Name: string;
  promo2Url: string;
  organizerKeywords: string[];
}

export interface MunicipalityPortalRecord {
  kostatCode: string;
  regionId: string;
  regionName: string;
  lDongRegnCd: string;
  lDongSignguCd: string;
  name: string;
  hallName: string;
  hallUrl: string;
  promo1Name: string;
  promo1Url: string;
  promo2Name: string;
  promo2Url: string;
  organizerKeywords: string[];
}

export interface AdminPromoRegistryData {
  provinces: Record<string, ProvincePortalRecord>;
  municipalities: Record<string, MunicipalityPortalRecord>;
}

export interface DeepPromoEnrichment {
  contentId?: string;
  keywordMatch?: string;
  matchedTier: 'TIER1_PROVINCE' | 'TIER2_MUNICIPALITY';
  organizerDetected: string;
  promoPortalName: string;
  promoBaseUrl: string;
  deepArticleUrl: string;
  deepArticleTitle: string;
  summaryPoints: string[];
  scheduleOrCourseDetail?: string;
  performersOrPrograms?: string;
  trafficOrSafetyNotice?: string;
  historySummary?: string[];
}

export interface OrganizerPromoAnalysisResult {
  matchedTier: 'TIER1_PROVINCE' | 'TIER2_MUNICIPALITY';
  organizerDisplay: string;
  routingExplanation: string;
  primaryPromoName: string;
  primaryPromoUrl: string;
  secondaryPromoName: string;
  secondaryPromoUrl: string;
  tier1Province: ProvincePortalRecord;
  tier2Municipality: MunicipalityPortalRecord;
  deepEnrichment: DeepPromoEnrichment | null;
}

/**
 * 주최기관 힌트 기반으로 지자체 홍보 사이트에서 매칭·추출된 정밀 요약 데이터베이스
 */
export const DEEP_PROMO_MATCH_DB: DeepPromoEnrichment[] = [
  {
    contentId: '4124907',
    keywordMatch: '쉬엄쉬엄',
    matchedTier: 'TIER1_PROVINCE',
    organizerDetected: '서울특별시 / 서울시 체육회 (문의: 다산콜센터 02-120)',
    promoPortalName: '서울시 홍보주소1 · 서울축제포털 (FUN SEOUL)',
    promoBaseUrl: 'https://festival.seoul.go.kr',
    deepArticleUrl: 'https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=974',
    deepArticleTitle: '쉬엄쉬엄 모닝(11월) - 잠실한강공원·잠실대교 5km 코스',
    summaryPoints: [
      '이번 회차 집중 안내: 11. 8.(일) ~ 11. 22.(일) 주말 아침 07:00~09:00 잠실한강공원 개최',
      '세부 운영 코스: 잠실수중보 남단(출발·도착) ~ 잠실대교(반환) 5km 구간 (걷기·달리기·자전거·킥보드·유아차·반려견 동반 가능)',
      '현장 스페셜 출연진·부대프로그램: 개그우먼 김혜선과 함께하는 신나는 GX 프로그램, 색소폰 퍼포먼스팀 ‘색소가이즈’ 아침 연주, 찾아가는 서울체력장, 모닝옐로우 라운지 운영',
      '참여 방법: 누구나 무료 · 별도 사전 신청 없이 당일 현장 접수',
    ],
    scheduleOrCourseDetail:
      '07:00~09:00 | 잠실수중보 남단(출발·도착) ↔ 잠실대교(반환) 왕복 5km',
    performersOrPrograms:
      '김혜선 GX 프로그램 · 색소가이즈 연주 · 찾아가는 서울체력장 · 모닝옐로우 라운지',
    trafficOrSafetyNotice:
      '※ 오전 5시부터 10시까지 잠실대교 상행 방향에 한해 편도 통제되며, 반대 방향은 정상 통행이 가능합니다.',
    historySummary: [
      '쉬엄쉬엄 모닝(3월): 2026-03-14 ~ 03-29 (장소: 여의도)',
      '쉬엄쉬엄 모닝(7~8월): 2026-07-12 ~ 08-09 (장소: 여의대로~마포대교 등)',
      '쉬엄쉬엄 모닝(9월): 2026-09-06 ~ 09-13 (장소: 6일 평화의공원 별자리광장, 13일 서울식물원 코스)',
      '쉬엄쉬엄 모닝(11월): 2026-11-08 ~ 11-22 (장소: 잠실한강공원 · 잠실대교)',
    ],
  },
  {
    contentId: '4098571',
    keywordMatch: '가야테마파크',
    matchedTier: 'TIER2_MUNICIPALITY',
    organizerDetected: '김해시청 · 김해문화관광재단 (가야테마파크)',
    promoPortalName: '김해시 홍보주소1 · 김해문화관광 포털',
    promoBaseUrl: 'https://www.gimhae.go.kr/tour.web',
    deepArticleUrl: 'https://www.gimhae.go.kr/tour.web',
    deepArticleTitle: '김해가야테마파크 야간 개장 빛 축제 [빛을 향한 항해] 상세 안내',
    summaryPoints: [
      '주최기관 매칭: 김해시 산하 김해문화관광재단 가야테마파크 기획 야간 일루미네이션 축제',
      '핵심 관람 코스: 가야왕궁 태극전 미디어파사드 → 철광산 공연장 레이저쇼 → 천문대 불빛정원 포토존',
      '교통·셔틀 안내: 경전철 인제대역 1번 출구 주말 야간 시내버스(8번) 배차 연계 및 제1·2주차장 무료 개방',
    ],
    scheduleOrCourseDetail: '야간 점등 18:30 ~ 22:00 (입장 마감 21:00)',
    performersOrPrograms: '가야왕궁 미디어파사드 · 버스킹 공연 · 빛의 항해 스탬프투어',
    trafficOrSafetyNotice: '※ 우천 및 강풍 시 일부 야외 레이저 연출이 조정될 수 있습니다.',
  },
  {
    contentId: '4090201',
    keywordMatch: '가든 나이트 마켓',
    matchedTier: 'TIER1_PROVINCE',
    organizerDetected: '울산문화관광재단 · 울산광역시',
    promoPortalName: '울산시 홍보주소1 · 울산관광 & 울산문화관광재단',
    promoBaseUrl: 'https://tour.ulsan.go.kr',
    deepArticleUrl: 'https://www.uctf.or.kr',
    deepArticleTitle: '울산대공원 잔디광장 야시장 [가든 나이트 마켓] 세부 부스·프로그램',
    summaryPoints: [
      '주최기관 매칭: 울산광역시 산하 울산문화관광재단 주관 도심 야간관광 특화 프로그램',
      '세부 부스 구성: 플리마켓 판매부스 10개 + 시민 체험부스 5개 + 먹거리부스 10개 + 푸드트럭 16대 (총 41개 부스)',
      '가족 특화 운영: 메타세쿼이아 숲길 체험존, 어린이 회전목마·미니기차, 관람객 현장 신청곡 DJ 플레이',
    ],
    scheduleOrCourseDetail: '매주 금·토 18:00 ~ 22:00 | 울산대공원 동문 잔디광장 일원',
    performersOrPrograms: '어쿠스틱 버스킹 · 미니기차/회전목마 · 캠핑&피크닉존 무료 대여',
  },
  {
    contentId: '3379778',
    keywordMatch: '가락 옥토버페스트',
    matchedTier: 'TIER1_PROVINCE',
    organizerDetected: '서울시농수산식품공사 · 송파구청 후원',
    promoPortalName: '송파구 문화관광 홍보포털 & 서울축제포털',
    promoBaseUrl: 'https://www.songpa.go.kr/culture/index.do',
    deepArticleUrl: 'https://festival.seoul.go.kr',
    deepArticleTitle: '가락몰 3층 하늘공원 루프탑 [가락 옥토버페스트] 수제맥주 & 신선해산물 축제',
    summaryPoints: [
      '주최기관 매칭: 서울시 산하 서울시농수산식품공사(가락몰) 주관 도심 루프탑 미식 축제',
      '핵심 혜택: 가락몰 1층 수산·축산시장 구매 영수증 지참 시 루프탑 테이블존 이용 및 수제맥주 할인 쿠폰 제공',
      '연계 교통: 지하철 3·8호선 가락시장역 2-1번 출구 직결 통로 엘리베이터로 3층 하늘공원 바로 이동',
    ],
    scheduleOrCourseDetail: '15:00 ~ 22:00 | 가락몰 3층 하늘공원 루프탑 전 구역',
  },
];

let cachedRegistry: AdminPromoRegistryData | null = null;

export async function loadAdminPromoRegistry(): Promise<AdminPromoRegistryData> {
  if (cachedRegistry) return cachedRegistry;
  const baseUrl = import.meta.env.BASE_URL || '/';
  const res = await fetch(`${baseUrl}geo/admin-promo-registry.json`);
  const data = (await res.json()) as AdminPromoRegistryData;
  cachedRegistry = data;
  return data;
}

/**
 * 특정 이벤트가 사전에 심층 매칭된 지자체 홍보 데이터를 보유하고 있는지 빠르게 확인 (카드 배지 표시용)
 */
export function findDeepPromoMatch(
  contentId?: string,
  title?: string
): DeepPromoEnrichment | null {
  if (contentId) {
    const byId = DEEP_PROMO_MATCH_DB.find((item) => item.contentId === contentId);
    if (byId) return byId;
  }
  if (title) {
    const cleanTitle = title.replace(/\s+/g, '');
    const byKw = DEEP_PROMO_MATCH_DB.find(
      (item) =>
        item.keywordMatch && cleanTitle.includes(item.keywordMatch.replace(/\s+/g, ''))
    );
    if (byKw) return byKw;
  }
  return null;
}

/**
 * 주최기관(sponsor1, sponsor2, telName) 힌트를 분석하여
 * 1단계(광역 시·도) 홍보페이지 vs 2단계(기초 시·군·구) 홍보페이지 중 어디가 주관인지 판별하고
 * 매칭된 상세 요약 및 별도 홍보 링크를 반환
 */
export function analyzeOrganizerAndMatchPromo(
  event: UnifiedEventItem,
  detail: EventDetailInfo | null,
  registry: AdminPromoRegistryData | null
): OrganizerPromoAnalysisResult {
  const regionObj = REGION_BY_ID[event.regionId] || REGION_BY_ID['seoul'];

  const fallbackProv: ProvincePortalRecord = {
    regionId: regionObj.id,
    lDongRegnCd: regionObj.lDongRegnCd,
    name: regionObj.name,
    hallName: `${regionObj.name}청`,
    hallUrl: regionObj.municipalPortalUrl,
    promo1Name: regionObj.municipalPortalName,
    promo1Url: regionObj.municipalPortalUrl,
    promo2Name: `${regionObj.shortName} 문화관광포털`,
    promo2Url: regionObj.municipalPortalUrl,
    organizerKeywords: [regionObj.name, regionObj.shortName],
  };

  const tier1Province = registry?.provinces?.[event.regionId] || fallbackProv;

  const muniKey = `${event.lDongRegnCd}-${event.lDongSignguCd}`;
  const fallbackMuniInfo = resolveSigunguPortalInfo(
    event.regionId,
    event.lDongRegnCd,
    event.lDongSignguCd,
    event.sigunguName
  );

  const tier2Municipality: MunicipalityPortalRecord = registry?.municipalities?.[muniKey] || {
    kostatCode: muniKey,
    regionId: event.regionId,
    regionName: regionObj.name,
    lDongRegnCd: event.lDongRegnCd,
    lDongSignguCd: event.lDongSignguCd,
    name: event.sigunguName,
    hallName: fallbackMuniInfo.hallName,
    hallUrl: fallbackMuniInfo.hallUrl,
    promo1Name: fallbackMuniInfo.promoName,
    promo1Url: fallbackMuniInfo.promoUrl,
    promo2Name: tier1Province.promo1Name,
    promo2Url: tier1Province.promo1Url,
    organizerKeywords: [event.sigunguName],
  };

  const deepEnrichment = findDeepPromoMatch(event.contentId, event.title);

  // 주최/주관/문의처 텍스트 결합
  const sponsorText = [
    detail?.sponsor1,
    detail?.sponsor2,
    detail?.telName,
    event.organizer,
    event.sourceLabel,
  ]
    .filter(Boolean)
    .join(' / ');

  // 1) 심층 매칭 데이터가 있는 경우
  if (deepEnrichment) {
    const isTier1 = deepEnrichment.matchedTier === 'TIER1_PROVINCE';
    return {
      matchedTier: deepEnrichment.matchedTier,
      organizerDisplay: sponsorText || deepEnrichment.organizerDetected,
      routingExplanation: isTier1
        ? `주최기관 힌트("${deepEnrichment.organizerDetected}")가 1단계 광역지자체(${tier1Province.name}) 산하이므로 1단계 대표 홍보주소(${tier1Province.promo1Name})에서 동일 이벤트를 탐색·요약했습니다.`
        : `주최기관 힌트("${deepEnrichment.organizerDetected}")가 2단계 기초지자체(${tier2Municipality.name}) 산하이므로 2단계 전용 홍보주소(${tier2Municipality.promo1Name})에서 동일 이벤트를 탐색·요약했습니다.`,
      primaryPromoName: deepEnrichment.promoPortalName,
      primaryPromoUrl: deepEnrichment.deepArticleUrl,
      secondaryPromoName: isTier1
        ? tier2Municipality.promo1Name
        : tier1Province.promo1Name,
      secondaryPromoUrl: isTier1
        ? tier2Municipality.promo1Url
        : tier1Province.promo1Url,
      tier1Province,
      tier2Municipality,
      deepEnrichment,
    };
  }

  // 2) 일반 이벤트: 주최기관 문자열에 시·군·구명이 명시되어 있는지 vs 광역 시·도명이 명시되어 있는지 판별
  const hasTier2Keyword = tier2Municipality.organizerKeywords.some(
    (kw) => kw && kw.length >= 2 && sponsorText.includes(kw)
  );
  const hasTier1Keyword = tier1Province.organizerKeywords.some(
    (kw) => kw && kw.length >= 2 && sponsorText.includes(kw)
  );

  const matchedTier: 'TIER1_PROVINCE' | 'TIER2_MUNICIPALITY' =
    hasTier1Keyword && !hasTier2Keyword ? 'TIER1_PROVINCE' : 'TIER2_MUNICIPALITY';

  return {
    matchedTier,
    organizerDisplay:
      sponsorText || `${tier1Province.name} · ${tier2Municipality.hallName}`,
    routingExplanation:
      matchedTier === 'TIER1_PROVINCE'
        ? `주최기관 정보("${sponsorText || tier1Province.name}")에서 1단계 광역지자체 힌트가 감지되어 ${tier1Province.promo1Name}(${tier1Province.promo1Url})을 1순위 홍보 채널로 연결합니다.`
        : `개최지 및 주최기관("${sponsorText || tier2Municipality.hallName}") 기준으로 2단계 기초지자체 홍보 채널인 ${tier2Municipality.promo1Name}(${tier2Municipality.promo1Url})을 1순위 홍보 채널로 연결합니다.`,
    primaryPromoName:
      matchedTier === 'TIER1_PROVINCE'
        ? tier1Province.promo1Name
        : tier2Municipality.promo1Name,
    primaryPromoUrl:
      matchedTier === 'TIER1_PROVINCE'
        ? tier1Province.promo1Url
        : tier2Municipality.promo1Url,
    secondaryPromoName:
      matchedTier === 'TIER1_PROVINCE'
        ? tier2Municipality.promo1Name
        : tier1Province.promo1Name,
    secondaryPromoUrl:
      matchedTier === 'TIER1_PROVINCE'
        ? tier2Municipality.promo1Url
        : tier1Province.promo1Url,
    tier1Province,
    tier2Municipality,
    deepEnrichment: null,
  };
}
