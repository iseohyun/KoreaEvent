import { REGION_BY_ID } from './regions';

export interface SigunguPortalInfo {
  lDongRegnCd: string;
  lDongSignguCd: string;
  name: string;
  hallName: string; // 예: "진주시청", "창원시 의창구청", "하동군청"
  hallUrl: string; // 시·군·구청 공식 행정 홈페이지
  promoName: string; // 시·군·구 문화관광/축제/행사 홍보 포털명
  promoUrl: string; // 시·군·구 문화관광/행사 홍보 홈페이지 URL
}

/**
 * 시·군·구별 전용 행정 홈페이지 및 문화관광·홍보 포털 매핑 테이블
 * 키 형식: `${lDongRegnCd}-${lDongSignguCd}`
 */
export const SIGUNGU_PORTAL_MAP: Record<string, SigunguPortalInfo> = {
  // === 경상남도 (lDongRegnCd: 48) 전체 시·군·구 ===
  '48-120': {
    lDongRegnCd: '48',
    lDongSignguCd: '120',
    name: '창원시',
    hallName: '창원특례시청',
    hallUrl: 'https://www.changwon.go.kr',
    promoName: '창원특례시 문화관광·축제포털',
    promoUrl: 'https://culture.changwon.go.kr',
  },
  '48-121': {
    lDongRegnCd: '48',
    lDongSignguCd: '121',
    name: '창원시 의창구',
    hallName: '창원시 의창구청',
    hallUrl: 'https://www.changwon.go.kr/gu/uichang.do',
    promoName: '의창구 문화행사 · 창원문화관광',
    promoUrl: 'https://culture.changwon.go.kr',
  },
  '48-123': {
    lDongRegnCd: '48',
    lDongSignguCd: '123',
    name: '창원시 성산구',
    hallName: '창원시 성산구청',
    hallUrl: 'https://www.changwon.go.kr/gu/seongsan.do',
    promoName: '성산구 문화행사 · 창원문화관광',
    promoUrl: 'https://culture.changwon.go.kr',
  },
  '48-125': {
    lDongRegnCd: '48',
    lDongSignguCd: '125',
    name: '창원시 마산합포구',
    hallName: '창원시 마산합포구청',
    hallUrl: 'https://www.changwon.go.kr/gu/happo.do',
    promoName: '마산합포구 문화행사 · 창원문화관광',
    promoUrl: 'https://culture.changwon.go.kr',
  },
  '48-127': {
    lDongRegnCd: '48',
    lDongSignguCd: '127',
    name: '창원시 마산회원구',
    hallName: '창원시 마산회원구청',
    hallUrl: 'https://www.changwon.go.kr/gu/hoewon.do',
    promoName: '마산회원구 문화행사 · 창원문화관광',
    promoUrl: 'https://culture.changwon.go.kr',
  },
  '48-129': {
    lDongRegnCd: '48',
    lDongSignguCd: '129',
    name: '창원시 진해구',
    hallName: '창원시 진해구청',
    hallUrl: 'https://www.changwon.go.kr/gu/jinhae.do',
    promoName: '진해구 축제·문화행사 · 창원문화관광',
    promoUrl: 'https://culture.changwon.go.kr',
  },
  '48-170': {
    lDongRegnCd: '48',
    lDongSignguCd: '170',
    name: '진주시',
    hallName: '진주시청',
    hallUrl: 'https://www.jinju.go.kr',
    promoName: '진주시 문화관광·축제 홍보포털',
    promoUrl: 'https://www.jinju.go.kr/02793/02258.web',
  },
  '48-220': {
    lDongRegnCd: '48',
    lDongSignguCd: '220',
    name: '통영시',
    hallName: '통영시청',
    hallUrl: 'https://www.tongyeong.go.kr',
    promoName: '통영문화관광 (U-Tour 통영)',
    promoUrl: 'https://www.utour.go.kr',
  },
  '48-240': {
    lDongRegnCd: '48',
    lDongSignguCd: '240',
    name: '사천시',
    hallName: '사천시청',
    hallUrl: 'https://www.sacheon.go.kr',
    promoName: '사천문화관광 홍보포털',
    promoUrl: 'https://toursacheon.net',
  },
  '48-250': {
    lDongRegnCd: '48',
    lDongSignguCd: '250',
    name: '김해시',
    hallName: '김해시청',
    hallUrl: 'https://www.gimhae.go.kr',
    promoName: '김해문화관광 포털',
    promoUrl: 'https://www.gimhae.go.kr/tour.web',
  },
  '48-270': {
    lDongRegnCd: '48',
    lDongSignguCd: '270',
    name: '밀양시',
    hallName: '밀양시청',
    hallUrl: 'https://www.miryang.go.kr',
    promoName: '밀양문화관광 홍보포털',
    promoUrl: 'https://www.miryang.go.kr/tur/index.do',
  },
  '48-310': {
    lDongRegnCd: '48',
    lDongSignguCd: '310',
    name: '거제시',
    hallName: '거제시청',
    hallUrl: 'https://www.geoje.go.kr',
    promoName: '거제문화관광 홍보포털',
    promoUrl: 'https://tour.geoje.go.kr',
  },
  '48-330': {
    lDongRegnCd: '48',
    lDongSignguCd: '330',
    name: '양산시',
    hallName: '양산시청',
    hallUrl: 'https://www.yangsan.go.kr',
    promoName: '양산문화관광 홍보포털',
    promoUrl: 'https://www.yangsan.go.kr/tour/main.do',
  },
  '48-720': {
    lDongRegnCd: '48',
    lDongSignguCd: '720',
    name: '의령군',
    hallName: '의령군청',
    hallUrl: 'https://www.uiryeong.go.kr',
    promoName: '의령문화관광 홍보포털',
    promoUrl: 'https://www.uiryeong.go.kr/tour.web',
  },
  '48-730': {
    lDongRegnCd: '48',
    lDongSignguCd: '730',
    name: '함안군',
    hallName: '함안군청',
    hallUrl: 'https://www.haman.go.kr',
    promoName: '함안문화관광 홍보포털',
    promoUrl: 'https://www.haman.go.kr/tour.web',
  },
  '48-740': {
    lDongRegnCd: '48',
    lDongSignguCd: '740',
    name: '창녕군',
    hallName: '창녕군청',
    hallUrl: 'https://www.cng.go.kr',
    promoName: '창녕문화관광 홍보포털',
    promoUrl: 'https://www.cng.go.kr/tour.web',
  },
  '48-820': {
    lDongRegnCd: '48',
    lDongSignguCd: '820',
    name: '고성군',
    hallName: '경남 고성군청',
    hallUrl: 'https://www.goseong.go.kr',
    promoName: '소울고성 문화관광 홍보포털',
    promoUrl: 'https://visit.goseong.go.kr',
  },
  '48-840': {
    lDongRegnCd: '48',
    lDongSignguCd: '840',
    name: '남해군',
    hallName: '남해군청',
    hallUrl: 'https://www.namhae.go.kr',
    promoName: '남해문화관광 홍보포털',
    promoUrl: 'https://www.namhae.go.kr/tour/main.do',
  },
  '48-850': {
    lDongRegnCd: '48',
    lDongSignguCd: '850',
    name: '하동군',
    hallName: '하동군청',
    hallUrl: 'https://www.hadong.go.kr',
    promoName: '하동문화관광 홍보포털',
    promoUrl: 'https://www.hadong.go.kr/tour.web',
  },
  '48-860': {
    lDongRegnCd: '48',
    lDongSignguCd: '860',
    name: '산청군',
    hallName: '산청군청',
    hallUrl: 'https://www.sancheong.go.kr',
    promoName: '산청문화관광 홍보포털',
    promoUrl: 'https://www.sancheong.go.kr/tour/index.do',
  },
  '48-870': {
    lDongRegnCd: '48',
    lDongSignguCd: '870',
    name: '함양군',
    hallName: '함양군청',
    hallUrl: 'https://www.hygn.go.kr',
    promoName: '함양문화관광 홍보포털',
    promoUrl: 'https://www.hygn.go.kr/tour.web',
  },
  '48-880': {
    lDongRegnCd: '48',
    lDongSignguCd: '880',
    name: '거창군',
    hallName: '거창군청',
    hallUrl: 'https://www.geochang.go.kr',
    promoName: '거창문화관광 홍보포털',
    promoUrl: 'https://www.geochang.go.kr/tour/index.do',
  },
  '48-890': {
    lDongRegnCd: '48',
    lDongSignguCd: '890',
    name: '합천군',
    hallName: '합천군청',
    hallUrl: 'https://www.hc.go.kr',
    promoName: '합천문화관광 홍보포털',
    promoUrl: 'https://www.hc.go.kr/tour.web',
  },

  // === 서울·부산·경기 등 주요 시·군·구청 ===
  '11-110': {
    lDongRegnCd: '11',
    lDongSignguCd: '110',
    name: '종로구',
    hallName: '종로구청',
    hallUrl: 'https://www.jongno.go.kr',
    promoName: '종로문화관광 포털',
    promoUrl: 'https://www.jongno.go.kr/tourMain.do',
  },
  '11-680': {
    lDongRegnCd: '11',
    lDongSignguCd: '680',
    name: '강남구',
    hallName: '강남구청',
    hallUrl: 'https://www.gangnam.go.kr',
    promoName: '비짓강남 문화관광 포털',
    promoUrl: 'https://visitgangnam.net',
  },
  '11-710': {
    lDongRegnCd: '11',
    lDongSignguCd: '710',
    name: '송파구',
    hallName: '송파구청',
    hallUrl: 'https://www.songpa.go.kr',
    promoName: '송파문화관광 포털',
    promoUrl: 'https://www.songpa.go.kr/culture/index.do',
  },
  '26-350': {
    lDongRegnCd: '26',
    lDongSignguCd: '350',
    name: '해운대구',
    hallName: '해운대구청',
    hallUrl: 'https://www.haeundae.go.kr',
    promoName: '해운대 문화관광 포털',
    promoUrl: 'https://www.haeundae.go.kr/tour/index.do',
  },
};

/**
 * 시·도 및 시·군·구 코드로 해당 기초지자체의 공식 행정/홍보 홈페이지 정보를 반환
 */
export function resolveSigunguPortalInfo(
  regionId: string,
  lDongRegnCd: string,
  lDongSignguCd: string,
  sigunguName: string
): SigunguPortalInfo {
  const key = `${lDongRegnCd}-${lDongSignguCd}`;
  if (SIGUNGU_PORTAL_MAP[key]) {
    return SIGUNGU_PORTAL_MAP[key];
  }

  const region = REGION_BY_ID[regionId];
  const hallSuffix = sigunguName.endsWith('구')
    ? '청'
    : sigunguName.endsWith('군')
      ? '청'
      : '청';

  return {
    lDongRegnCd,
    lDongSignguCd,
    name: sigunguName,
    hallName: `${region?.shortName || ''} ${sigunguName}${hallSuffix}`.trim(),
    hallUrl: region?.municipalPortalUrl || 'https://www.gov.kr',
    promoName: `${sigunguName} 문화관광·행사 안내`,
    promoUrl: region?.municipalPortalUrl || 'https://www.gov.kr',
  };
}
