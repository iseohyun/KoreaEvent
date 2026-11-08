export type DataSourceType = 'PUBLIC_PORTAL' | 'MUNICIPAL_WEB';

export type ResponseFormatMode = 'JSON' | 'XML';

export type MajorCategoryCode = 'ALL' | 'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL';

export type EventProgressStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | 'UNKNOWN';

export type MainMenuView =
  | 'MAP'
  | 'CALENDAR'
  | 'LIST'
  | 'EVENT_REGISTER'
  | 'PROMO_DIRECTORY'
  | 'SPECIAL_PROMO'
  | 'ABOUT';

/**
 * 특별 홍보관 하위 스포츠 종목 카테고리
 */
export type SpecialPromoSport = 'SWIMMING' | 'RUNNING' | 'CYCLING' | 'TRIATHLON';

/**
 * DB(크롤링 사이트 디렉토리) 상단 탭 및 필터 종목 카테고리
 */
export type DbCrawlTabCategory =
  | 'ALL'
  | 'MUNICIPAL'
  | 'SWIMMING'
  | 'RUNNING'
  | 'CYCLING'
  | 'TRIATHLON';

/**
 * 상단 메뉴바 보기 방식 (목록보기 / 달력보기 / 지도보기)
 */
export type ViewMode = 'LIST' | 'CALENDAR' | 'MAP';

/**
 * 행사 범위 구분 코드 (3: 세계/대한연맹, 2: 광역시도, 1: 시군구, 0: 동네)
 */
export type PromoLevel = 0 | 1 | 2 | 3;

export type ScopeFilterState = Record<PromoLevel, boolean>;

export type PromoLinkType =
  | 'TIER1_PROMO'
  | 'TIER2_PROMO'
  | 'OFFICIAL'
  | 'SNS'
  | 'TICKET'
  | 'ATTACHMENT';

export interface FirestorePromoLink {
  type: PromoLinkType;
  label: string;
  url: string;
}

export interface SeriesHistoryItem {
  id: string;
  title: string;
  edition?: number;
  year?: number;
  startDate: string;
  endDate: string;
  primaryUrl?: string;
}

export interface EventSeriesRecord {
  seriesId: string;
  seriesName: string;
  lDongRegnCd: string;
  lDongSignguCd: string;
  sigunguName: string;
  editions: SeriesHistoryItem[];
}

export interface FirestoreEventDoc {
  id: string;
  portalContentId?: string;
  lDongRegnCd: string;
  lDongSignguCd: string;
  sigunguName: string;
  title: string;
  eventDate: {
    startDate: string;
    endDate: string;
    scheduleNote?: string;
    /** 크롤러가 실제 일정을 찾지 못한 경우 true (달력·주차 지도에 표시하지 않음) */
    dateUnknown?: boolean;
  };
  eventTime: string;
  organizer: {
    host: string;
    supervise?: string;
    contact?: string;
  };
  category: {
    lclsSystm2: 'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL';
    lclsSystm3: string;
    label: string;
  };
  links: FirestorePromoLink[];
  invitation: string;
  promoLevel?: PromoLevel;
  addr1?: string;
  mapX?: number;
  mapY?: number;
  imageUrl?: string;
  updatedAt: string;
  manualEdited?: boolean;
  registrationMeta?: {
    isPastEvent: boolean;
    twoChannelVerified?: boolean;
    contactPhone?: string;
    contactEmail?: string;
    pressVerifyUrl?: string;
    pressOutletName?: string;
    municipalDomainSiteUrl?: string;
    municipalDomainEmail?: string;
    municipalDomainVerified?: boolean;
    agreedPreNoticeAt: string;
  };

  // 회차별·연도별 대회/행사 시리즈 연결 메타데이터
  seriesId?: string;
  seriesName?: string;
  edition?: number;
  eventYear?: number;
  prevEventId?: string;
  nextEventId?: string;
  seriesHistory?: SeriesHistoryItem[];
}

export interface SigunguItem {
  code: string;
  name: string;
  rnum?: number;
}

export interface AdminRegion {
  id: string;
  name: string;
  shortName: string;
  lDongRegnCd: string;
  sigunguFilterCodes?: string[];
  centerLat: number;
  centerLng: number;
  zoom: number;
  municipalPortalName: string;
  municipalPortalUrl: string;
  svgPath: string;
  labelX: number;
  labelY: number;
}

export interface UnifiedEventItem {
  id: string;
  contentId?: string;
  contentTypeId?: string;
  title: string;
  source: DataSourceType;
  sourceLabel: string;
  sourceOrgUrl?: string;

  // 행정구역 매핑
  regionId: string;
  regionName: string;
  lDongRegnCd: string;
  lDongSignguCd: string;
  sigunguName: string;

  // 분류 체계
  lclsSystm1: string;
  lclsSystm2: 'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL';
  lclsSystm2Name: string;
  lclsSystm3: string;
  lclsSystm3Name: string;

  // 일정 및 상태
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
  /** 실제 일정 미확인 (연도만 알고 있음) — 달력·주차 지도에서 제외 */
  dateUnknown?: boolean;
  scheduleNote?: string;
  eventTime?: string;
  status: EventProgressStatus;

  // 위치 및 연락처
  addr1: string;
  addr2?: string;
  zipcode?: string;
  tel?: string;
  mapX?: number;
  mapY?: number;

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
  promoLevel: PromoLevel;
  firestoreDoc?: FirestoreEventDoc;

  // 회차별·연도별 시리즈 연결 메타데이터
  seriesId?: string;
  seriesName?: string;
  edition?: number;
  eventYear?: number;
  prevEventId?: string;
  nextEventId?: string;
  seriesHistory?: SeriesHistoryItem[];
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

export type QuickPeriodPreset = 'CUSTOM' | 'TODAY' | '1M' | '3M' | '6M' | '1Y' | 'ALL_YEARS';

export type MonthPeriodFilter =
  | 'ALL'
  | 'H1'
  | 'H2'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'Q4'
  | 'M01'
  | 'M02'
  | 'M03'
  | 'M04'
  | 'M05'
  | 'M06'
  | 'M07'
  | 'M08'
  | 'M09'
  | 'M10'
  | 'M11'
  | 'M12';

export interface DetailSearchTargets {
  organizer: boolean; // 주최기관
  content: boolean; // 초댓말/내용
  title: boolean; // 행사명
  place: boolean; // 장소/주소
}

export interface EventFilterState {
  regionId: string; // 'ALL' or 17개 시도 id
  sigunguCode: string; // 'ALL' or lDongSignguCd
  source: 'ALL' | DataSourceType;
  majorCategory: MajorCategoryCode;
  subCategory: string; // 'ALL' or lclsSystm3
  specialPromoFormats?: Record<string, boolean>; // 특별 홍보관 종목별 행사 형태 복수 선택 (기본: 모두 true)
  status: 'ALL' | EventProgressStatus;
  scopeLevels: ScopeFilterState; // 범위 on/off ("세계/대한연맹", "광역시도", "시군구", "동네")
  selectedYear: string; // 'ALL' or '2026', '2025', ...
  selectedMonthPeriod: MonthPeriodFilter; // 'ALL', 'H1', 'H2', 'Q1'~'Q4', 'M01'~'M12'
  startDate: string; // YYYY-MM-DD (API 호환용)
  endDate: string; // YYYY-MM-DD (API 호환용)
  quickPeriod: QuickPeriodPreset;
  keyword: string; // 상단 통합 검색어 (세부검색과 통합)
  detailKeyword: string; // 세부검색 통합 키워드 (주최기관/초댓말/행사명/장소)
  detailSearchTargets: DetailSearchTargets; // 세부검색 검색위치 체크박스
  organizerKeyword: string; // 레거시 호환
  contentKeyword: string; // 레거시 호환
  arrange: 'C' | 'A' | 'D' | 'Q' | 'O';
  formatMode: ResponseFormatMode;
}

/**
 * 달력으로 행사보기: 표시 방식 아이콘 체크 옵션
 */
export interface CalendarDisplayOptions {
  showRegion: boolean; // 행정구역명(시군구)
  showCategoryBadge: boolean; // 행사분류 배지
  showEventTime: boolean; // 행사시각
  showOrganizer: boolean; // 주최기관
  showInvitation: boolean; // 초댓말 한줄요약
  showStatusBadge: boolean; // 진행상태 배지
}

/**
 * 행사 리스트(테이블): 표시할 열(Column) 체크 옵션
 */
export type ListColumnKey =
  | 'region'
  | 'category'
  | 'title'
  | 'eventDate'
  | 'eventTime'
  | 'organizer'
  | 'invitation'
  | 'links'
  | 'addr'
  | 'status';

export type ListColumnVisibility = Record<ListColumnKey, boolean>;
