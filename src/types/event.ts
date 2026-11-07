export type DataSourceType = 'PUBLIC_PORTAL' | 'MUNICIPAL_WEB';

export type ResponseFormatMode = 'JSON' | 'XML';

export type MajorCategoryCode = 'ALL' | 'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL';

export type EventProgressStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | 'UNKNOWN';

export type PromoLinkType =
  | 'TIER1_PROMO'
  | 'TIER2_PROMO'
  | 'OFFICIAL'
  | 'SNS'
  | 'TICKET';

export interface FirestorePromoLink {
  type: PromoLinkType;
  label: string; // 예: "서울축제포털 상세(festacode=974)"
  url: string;
}

/**
 * Firebase Firestore `events` 컬렉션 표준 문서 스키마
 * - 필수 연결 키 2종:
 *   1) portalContentId (공공데이터포털 KorService2 contentid - 실시간 조회 정보와 1:1 결합용)
 *   2) lDongRegnCd + lDongSignguCd (법정동 시·도 및 시·군·구 코드 - 정식 행정지도 폴리곤 매핑용)
 * - 핵심 저장 필드 7종:
 *   1) title (행사명)
 *   2) eventDate (행사일: startDate, endDate, scheduleNote)
 *   3) eventTime (행사시각)
 *   4) organizer (주최/주관/문의처 - 홍보사이트 매칭 힌트 겸용)
 *   5) category (행사분류: lclsSystm2, lclsSystm3, label)
 *   6) links (1:N 다중 홍보·공식·예매 링크 배열)
 *   7) invitation (초댓말: 지자체 홍보페이지 기반 핵심 요약·초대글·교통통제 안내)
 */
export interface FirestoreEventDoc {
  id: string; // 문서 고유 ID (예: "portal-4124907" 또는 "muni-48-170-01")

  // [필수 연결 키 1 & 2: 실시간 조회 정보 조합 및 행정지도 매핑 키]
  portalContentId?: string; // KorService2 contentid (있을 경우 포털 좌표·이미지·주소와 실시간 조합)
  lDongRegnCd: string; // 법정동 시도 코드 (예: "11" 서울, "48" 경남)
  lDongSignguCd: string; // 법정동 시군구 코드 (예: "740" 강동구, "170" 진주시)
  sigunguName: string; // 시군구명 (예: "강동구", "진주시")

  // [7대 핵심 저장 필드]
  title: string; // 1. 행사명
  eventDate: {
    // 2. 행사일
    startDate: string; // 시작일 ("20261018")
    endDate: string; // 종료일 ("20261122")
    scheduleNote?: string; // 회차/요일 안내 ("11.8 ~ 11.22 매주 일요일")
  };
  eventTime: string; // 3. 행사시각 (예: "07:00 ~ 09:00")
  organizer: {
    // 4. 주최 (홍보사이트 매칭 힌트 겸용)
    host: string; // 주최기관 (예: "서울특별시")
    supervise?: string; // 주관기관 (예: "서울시 체육회")
    contact?: string; // 문의처 (예: "다산콜센터 02-120")
  };
  category: {
    // 5. 행사분류
    lclsSystm2: 'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL';
    lclsSystm3: string; // 소분류 코드 (예: "EV030400")
    label: string; // 표시명 (예: "행사·전시 > 기타행사")
  };
  links: FirestorePromoLink[]; // 6. 링크 (1:N 배열)
  invitation: string; // 7. 초댓말 (지자체 홍보페이지 핵심 요약·초대글)

  // [포털 미등록 순수 지자체 행사용 보조 위치/이미지 정보 (선택)]
  addr1?: string;
  mapX?: number;
  mapY?: number;
  imageUrl?: string;
  updatedAt: string;
}

export interface SigunguItem {
  code: string; // lDongSignguCd (예: "110", "710")
  name: string; // 시군구명 (예: "종로구", "송파구")
  rnum?: number;
}

export interface AdminRegion {
  id: string; // 내부 고유 키 (예: 'seoul', 'gwangju', 'jeonnam' 등 17개 시도)
  name: string; // 정식 명칭 (예: '서울특별시')
  shortName: string; // 약칭 (예: '서울')
  lDongRegnCd: string; // KorService2 법정동 시도 코드 (예: '11', '26', '36110', 광주/전남은 '12')
  sigunguFilterCodes?: string[]; // 광주('210','240','270','300','330')와 전남 분리 필터용
  centerLat: number;
  centerLng: number;
  zoom: number;
  municipalPortalName: string; // 해당 지자체 대표 행사/문화 포털명
  municipalPortalUrl: string; // 해당 지자체 대표 홈페이지 URL
  svgPath: string; // 대한민국 행정구역 SVG 폴리곤 경로
  labelX: number;
  labelY: number;
}

export interface UnifiedEventItem {
  id: string;
  contentId?: string;
  contentTypeId?: string;
  title: string;
  source: DataSourceType;
  sourceLabel: string; // 예: "공공데이터포털 (KorService2)" 또는 "서울특별시청 문화포털"
  sourceOrgUrl?: string;

  // 행정구역 매핑
  regionId: string; // 17개 시도 id ('seoul', 'busan' 등)
  regionName: string; // 시도명
  lDongRegnCd: string;
  lDongSignguCd: string;
  sigunguName: string; // 시군구명 (예: '송파구', '해운대구')

  // 분류 체계 (KorService2 신분류체계 + 행정 고유 분류)
  lclsSystm1: string; // 'EV' | 'MU'
  lclsSystm2: 'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL';
  lclsSystm2Name: string; // '축제' | '공연' | '행사/전시' | '지자체 행정행사'
  lclsSystm3: string; // 예: 'EV010200'
  lclsSystm3Name: string; // 예: '문화예술축제'

  // 일정 및 상태
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
  scheduleNote?: string;
  eventTime?: string;
  status: EventProgressStatus;

  // 위치 및 연락처
  addr1: string;
  addr2?: string;
  zipcode?: string;
  tel?: string;
  mapX?: number; // 경도 (Longitude)
  mapY?: number; // 위도 (Latitude)

  // 이미지 및 부가정보
  imageUrl?: string;
  thumbnailUrl?: string;
  modifiedTime?: string;
  summary?: string;
  feeInfo?: string;
  organizer?: string;

  // Firebase Firestore 실시간 조합 필드
  invitation?: string;
  links?: FirestorePromoLink[];
  firestoreDoc?: FirestoreEventDoc;
}

export interface EventDetailInfo {
  contentId: string;
  title: string;
  overview: string;
  homepageHtml?: string;
  tel?: string;
  telName?: string;
  sponsor1?: string;
  sponsor2?: string;
  playtime?: string;
  eventPlace?: string;
  useTimeFestival?: string;
  discountInfoFestival?: string;
  ageLimit?: string;
  program?: string;
  subEvent?: string;
}

export interface EventFilterState {
  regionId: string; // 'ALL' or 17개 시도 id
  sigunguCode: string; // 'ALL' or lDongSignguCd
  source: 'ALL' | DataSourceType;
  majorCategory: MajorCategoryCode;
  subCategory: string; // 'ALL' or lclsSystm3
  status: 'ALL' | EventProgressStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  keyword: string;
  arrange: 'C' | 'A' | 'D' | 'Q' | 'O';
  formatMode: ResponseFormatMode;
}
