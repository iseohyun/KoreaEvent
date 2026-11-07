export type DataSourceType = 'PUBLIC_PORTAL' | 'MUNICIPAL_WEB';

export type ResponseFormatMode = 'JSON' | 'XML';

export type MajorCategoryCode = 'ALL' | 'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL';

export type EventProgressStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | 'UNKNOWN';

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
