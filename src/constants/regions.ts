import { AdminRegion } from '../types/event';

/**
 * 광주광역시 구 코드 (KorService2 v4.4에서 lDongRegnCd='12' 전남광주통합특별시 내 시군구 코드)
 */
export const GWANGJU_SIGUNGU_CODES = ['210', '240', '270', '300', '330'];

/**
 * 대한민국 17개 광역행정구역 메타데이터
 */
export const ADMIN_REGIONS: AdminRegion[] = [
  {
    id: 'seoul',
    name: '서울특별시',
    shortName: '서울',
    lDongRegnCd: '11',
    centerLat: 37.5665,
    centerLng: 126.978,
    zoom: 11,
    municipalPortalName: '서울문화포털 / 내손안에 서울',
    municipalPortalUrl: 'https://culture.seoul.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'incheon',
    name: '인천광역시',
    shortName: '인천',
    lDongRegnCd: '28',
    centerLat: 37.4563,
    centerLng: 126.7052,
    zoom: 11,
    municipalPortalName: '인천광역시 문화관광·행사포털',
    municipalPortalUrl: 'https://www.incheon.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'gyeonggi',
    name: '경기도',
    shortName: '경기',
    lDongRegnCd: '41',
    centerLat: 37.4138,
    centerLng: 127.5183,
    zoom: 9,
    municipalPortalName: '경기도청 문화행사 / 경기관광포털',
    municipalPortalUrl: 'https://ggtour.or.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'gangwon',
    name: '강원특별자치도',
    shortName: '강원',
    lDongRegnCd: '51',
    centerLat: 37.8228,
    centerLng: 128.1555,
    zoom: 8,
    municipalPortalName: '강원특별자치도청 문화행사·관광',
    municipalPortalUrl: 'https://www.gangwon.to',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'chungnam',
    name: '충청남도',
    shortName: '충남',
    lDongRegnCd: '44',
    centerLat: 36.5184,
    centerLng: 126.8,
    zoom: 9,
    municipalPortalName: '충남문화관광 / 도청 행사소식',
    municipalPortalUrl: 'https://tour.chungnam.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'sejong',
    name: '세종특별자치시',
    shortName: '세종',
    lDongRegnCd: '36110',
    centerLat: 36.48,
    centerLng: 127.289,
    zoom: 11,
    municipalPortalName: '세종특별자치시청 행사·축제',
    municipalPortalUrl: 'https://www.sejong.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'daejeon',
    name: '대전광역시',
    shortName: '대전',
    lDongRegnCd: '30',
    centerLat: 36.3504,
    centerLng: 127.3845,
    zoom: 11,
    municipalPortalName: '대전광역시청 문화행사·축제',
    municipalPortalUrl: 'https://www.daejeon.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'chungbuk',
    name: '충청북도',
    shortName: '충북',
    lDongRegnCd: '43',
    centerLat: 36.6357,
    centerLng: 127.4914,
    zoom: 9,
    municipalPortalName: '충북나드리 / 충북도청 문화소식',
    municipalPortalUrl: 'https://tour.chungbuk.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'gyeongbuk',
    name: '경상북도',
    shortName: '경북',
    lDongRegnCd: '47',
    centerLat: 36.4919,
    centerLng: 128.8889,
    zoom: 8,
    municipalPortalName: '경북나드리 / 경북도청 문화행사',
    municipalPortalUrl: 'https://tour.gb.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'daegu',
    name: '대구광역시',
    shortName: '대구',
    lDongRegnCd: '27',
    centerLat: 35.8714,
    centerLng: 128.6014,
    zoom: 11,
    municipalPortalName: '대구트립로드 / 대구시청 문화포털',
    municipalPortalUrl: 'https://tour.daegu.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'jeonbuk',
    name: '전북특별자치도',
    shortName: '전북',
    lDongRegnCd: '52',
    centerLat: 35.7175,
    centerLng: 127.153,
    zoom: 9,
    municipalPortalName: '전북특별자치도 문화관광·행사',
    municipalPortalUrl: 'https://tour.jb.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'gwangju',
    name: '광주광역시',
    shortName: '광주',
    lDongRegnCd: '12',
    sigunguFilterCodes: GWANGJU_SIGUNGU_CODES,
    centerLat: 35.1595,
    centerLng: 126.8526,
    zoom: 11,
    municipalPortalName: '광주문화포털 / 오매광주',
    municipalPortalUrl: 'https://tour.gwangju.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'jeonnam',
    name: '전라남도',
    shortName: '전남',
    lDongRegnCd: '12',
    centerLat: 34.8679,
    centerLng: 126.991,
    zoom: 9,
    municipalPortalName: '남도여행길잡이 / 전남도청 행사포털',
    municipalPortalUrl: 'https://www.namdokorea.com',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'gyeongnam',
    name: '경상남도',
    shortName: '경남',
    lDongRegnCd: '48',
    centerLat: 35.32,
    centerLng: 128.25,
    zoom: 9,
    municipalPortalName: '경남관광길잡이 / 경남도청 문화행사',
    municipalPortalUrl: 'https://tour.gyeongnam.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'ulsan',
    name: '울산광역시',
    shortName: '울산',
    lDongRegnCd: '31',
    centerLat: 35.5384,
    centerLng: 129.3114,
    zoom: 11,
    municipalPortalName: '울산관광 / 울산광역시청 문화행사',
    municipalPortalUrl: 'https://tour.ulsan.go.kr',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'busan',
    name: '부산광역시',
    shortName: '부산',
    lDongRegnCd: '26',
    centerLat: 35.1796,
    centerLng: 129.0756,
    zoom: 11,
    municipalPortalName: '비짓부산 / 부산문화포털 다봄',
    municipalPortalUrl: 'https://www.visitbusan.net',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
  {
    id: 'jeju',
    name: '제주특별자치도',
    shortName: '제주',
    lDongRegnCd: '50',
    centerLat: 33.4996,
    centerLng: 126.5312,
    zoom: 10,
    municipalPortalName: '비짓제주 / 제주도청 문화행사',
    municipalPortalUrl: 'https://www.visitjeju.net',
    svgPath: '',
    labelX: 0,
    labelY: 0,
  },
];

export const REGION_BY_ID: Record<string, AdminRegion> = Object.fromEntries(
  ADMIN_REGIONS.map((r) => [r.id, r])
);

/**
 * KorService2 응답의 lDongRegnCd, lDongSignguCd, addr1을 기반으로 17개 시도 regionId를 판별
 */
export function resolveRegionIdFromApi(
  lDongRegnCd?: string,
  lDongSignguCd?: string,
  addr1?: string
): string {
  const regn = (lDongRegnCd || '').trim();
  const signgu = (lDongSignguCd || '').trim();
  const address = (addr1 || '').trim();

  if (regn === '12') {
    if (GWANGJU_SIGUNGU_CODES.includes(signgu) || address.startsWith('광주')) {
      return 'gwangju';
    }
    return 'jeonnam';
  }

  const matched = ADMIN_REGIONS.find((r) => r.lDongRegnCd === regn && r.id !== 'gwangju');
  if (matched) return matched.id;

  if (address.startsWith('서울')) return 'seoul';
  if (address.startsWith('부산')) return 'busan';
  if (address.startsWith('대구')) return 'daegu';
  if (address.startsWith('인천')) return 'incheon';
  if (address.startsWith('광주')) return 'gwangju';
  if (address.startsWith('대전')) return 'daejeon';
  if (address.startsWith('울산')) return 'ulsan';
  if (address.startsWith('세종')) return 'sejong';
  if (address.startsWith('경기')) return 'gyeonggi';
  if (address.startsWith('강원')) return 'gangwon';
  if (address.startsWith('충청북') || address.startsWith('충북')) return 'chungbuk';
  if (address.startsWith('충청남') || address.startsWith('충남')) return 'chungnam';
  if (address.startsWith('전북') || address.startsWith('전라북')) return 'jeonbuk';
  if (address.startsWith('전남') || address.startsWith('전라남')) return 'jeonnam';
  if (address.startsWith('경상북') || address.startsWith('경북')) return 'gyeongbuk';
  if (address.startsWith('경상남') || address.startsWith('경남')) return 'gyeongnam';
  if (address.startsWith('제주')) return 'jeju';

  return 'seoul';
}

/**
 * 창원시(120 -> 의창구 121, 성산구 123, 마산합포구 125, 마산회원구 127, 진해구 129) 등
 * 상위 시 코드(120)로 내려온 경우에도 주소를 분석해 세부 구 코드 및 시군구명을 정밀 매핑
 */
export function resolveDetailedSigungu(
  lDongRegnCd?: string,
  lDongSignguCd?: string,
  addr1?: string
): { code: string; name: string } {
  const regn = (lDongRegnCd || '').trim();
  const code = (lDongSignguCd || '').trim();
  const addr = (addr1 || '').trim();

  // 경상남도 창원시 일반구(의창, 성산, 마산합포, 마산회원, 진해) 정밀 매핑
  if (regn === '48' && (code === '120' || addr.includes('창원시'))) {
    if (addr.includes('의창구') || code === '121') return { code: '121', name: '창원시 의창구' };
    if (addr.includes('성산구') || code === '123') return { code: '123', name: '창원시 성산구' };
    if (addr.includes('마산합포구') || code === '125')
      return { code: '125', name: '창원시 마산합포구' };
    if (addr.includes('마산회원구') || code === '127')
      return { code: '127', name: '창원시 마산회원구' };
    if (addr.includes('진해구') || code === '129') return { code: '129', name: '창원시 진해구' };
  }

  const parts = addr.split(/\s+/);
  if (parts.length >= 3 && parts[1].endsWith('시') && parts[2].endsWith('구')) {
    return { code, name: `${parts[1]} ${parts[2]}` };
  }
  if (parts.length >= 2) {
    return { code, name: parts[1] };
  }
  return { code, name: '전체' };
}

/**
 * 주소 문자열에서 시·군·구명을 추출
 */
export function extractSigunguFromAddr(addr1?: string): string {
  return resolveDetailedSigungu('', '', addr1).name;
}
