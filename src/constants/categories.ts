import {
  EventDisciplineGroup,
  MajorCategoryCode,
  SpecialPromoSport,
  UnifiedEventItem,
} from '../types/event';
import { matchesSportCategory } from '../shared/promoPolicy';

export interface SubCategoryDef {
  code: string;
  name: string;
  parentCode: Exclude<MajorCategoryCode, 'ALL'>;
}

export const MAJOR_CATEGORIES: {
  code: MajorCategoryCode;
  name: string;
  description: string;
}[] = [
  { code: 'ALL', name: '전체 분류', description: '모든 축제·공연·박람회·스포츠·지자체 행사' },
  { code: 'EV01', name: '축제 (EV01)', description: '문화관광·예술·지역특산물·전통역사·생태자연 축제' },
  { code: 'EV02', name: '공연 (EV02)', description: '전통공연·연극·뮤지컬·오페라·무용·클래식·콘서트' },
  { code: 'EV03', name: '행사/전시·스포츠 (EV03)', description: '전시회·박람회·스포츠경기(수영·마라톤 등)·기타행사' },
  { code: 'MUNICIPAL', name: '행정·시민참여', description: '지자체 홈페이지 고유 시민강좌·나눔장터·생활체육행사' },
];

export const SUB_CATEGORIES: Record<string, SubCategoryDef> = {
  // EV01: 축제 (신분류체계 정의서 기준)
  EV010100: { code: 'EV010100', name: '문화관광축제', parentCode: 'EV01' },
  EV010200: { code: 'EV010200', name: '문화예술축제', parentCode: 'EV01' },
  EV010300: { code: 'EV010300', name: '지역특산물축제', parentCode: 'EV01' },
  EV010400: { code: 'EV010400', name: '전통역사축제', parentCode: 'EV01' },
  EV010500: { code: 'EV010500', name: '생태자연축제', parentCode: 'EV01' },
  EV010600: { code: 'EV010600', name: '기타축제', parentCode: 'EV01' },

  // EV02: 공연 (신분류체계 정의서 기준)
  EV020100: { code: 'EV020100', name: '전통공연', parentCode: 'EV02' },
  EV020200: { code: 'EV020200', name: '연극', parentCode: 'EV02' },
  EV020300: { code: 'EV020300', name: '뮤지컬', parentCode: 'EV02' },
  EV020400: { code: 'EV020400', name: '오페라', parentCode: 'EV02' },
  EV020500: { code: 'EV020500', name: '무용', parentCode: 'EV02' },
  EV020600: { code: 'EV020600', name: '클래식음악회', parentCode: 'EV02' },
  EV020700: { code: 'EV020700', name: '대중콘서트', parentCode: 'EV02' },
  EV020800: { code: 'EV020800', name: '영화', parentCode: 'EV02' },
  EV020900: { code: 'EV020900', name: '기타공연', parentCode: 'EV02' },
  EV021000: { code: 'EV021000', name: '넌버벌', parentCode: 'EV02' },

  // EV03: 행사 (신분류체계 정의서 기준)
  EV030100: { code: 'EV030100', name: '전시회', parentCode: 'EV03' },
  EV030200: { code: 'EV030200', name: '박람회', parentCode: 'EV03' },
  EV030300: { code: 'EV030300', name: '스포츠경기·대회', parentCode: 'EV03' },
  EV030400: { code: 'EV030400', name: '기타행사', parentCode: 'EV03' },

  // MUNICIPAL: 지자체 행정 홈페이지 고유 분류
  MU010100: { code: 'MU010100', name: '시민참여·플리마켓', parentCode: 'MUNICIPAL' },
  MU010200: { code: 'MU010200', name: '구민특강·교육강좌', parentCode: 'MUNICIPAL' },
  MU010300: { code: 'MU010300', name: '지자체 기획문화행사', parentCode: 'MUNICIPAL' },
  MU010400: { code: 'MU010400', name: '지역장터·나눔행사', parentCode: 'MUNICIPAL' },
  MU010500: { code: 'MU010500', name: '생활체육·시민대회', parentCode: 'MUNICIPAL' },
};

export function getMajorCategoryName(code: string): string {
  switch (code) {
    case 'EV01':
      return '축제';
    case 'EV02':
      return '공연';
    case 'EV03':
      return '행사·전시';
    case 'MUNICIPAL':
      return '행정·시민참여';
    default:
      return '축제·행사';
  }
}

export function getSubCategoryName(code: string): string {
  return SUB_CATEGORIES[code]?.name || '일반행사';
}

export interface SpecialPromoFormatDef {
  code: string;
  label: string;
  shortLabel: string;
}

/**
 * 특별 홍보관 4대 종목별(수영 · 러닝 · 자전거 · 철인) 전용 행사 형태 분류 체계
 */
export const SPECIAL_PROMO_EVENT_FORMATS: Record<
  SpecialPromoSport,
  SpecialPromoFormatDef[]
> = {
  SWIMMING: [
    { code: 'SWIM_MASTERS', label: '마스터즈 · 생활체육', shortLabel: '마스터즈' },
    { code: 'SWIM_OPENWATER', label: '오픈워터 · 바다수영', shortLabel: '오픈워터' },
    {
      code: 'SWIM_YOUTH',
      label: '청소년 (학생·꿈나무·소년)',
      shortLabel: '청소년(학생·꿈나무·소년)',
    },
    { code: 'SWIM_DIVING', label: '다이빙', shortLabel: '다이빙' },
    { code: 'SWIM_WATERPOLO', label: '수구', shortLabel: '수구' },
    {
      code: 'SWIM_ELITE_OTHER',
      label: '경영 선수권 · 아티스틱 · 기타',
      shortLabel: '경영·아티스틱·기타',
    },
  ],
  RUNNING: [
    { code: 'RUN_FULL', label: '풀코스 (Full · 42.195km)', shortLabel: '풀코스(Full)' },
    { code: 'RUN_HALF', label: '하프마라톤 (Half · 21.1km)', shortLabel: '하프(Half)' },
    {
      code: 'RUN_10K_SHORT',
      label: '10km · 단축 (5K/10K/건강달리기)',
      shortLabel: '10km·단축(5K/10K)',
    },
    {
      code: 'RUN_TRAIL_ULTRA',
      label: '트레일러닝 · 울트라 · 산악/임도런',
      shortLabel: '트레일러닝·울트라',
    },
    {
      code: 'RUN_RELAY_FEST',
      label: '릴레이 · 이색 · 러닝페스티벌',
      shortLabel: '릴레이·이색·페스티벌',
    },
  ],
  CYCLING: [
    {
      code: 'CYC_GRANFONDO',
      label: '그란폰도 · 메디오폰도 · 랠리',
      shortLabel: '그란폰도·메디오폰도',
    },
    {
      code: 'CYC_ROAD_CRIT',
      label: '도로사이클 · 크리테리움 · 힐클라임',
      shortLabel: '도로사이클·크리테리움',
    },
    { code: 'CYC_MTB', label: 'MTB · 산악자전거 · 그래블', shortLabel: 'MTB·산악자전거' },
    {
      code: 'CYC_PARADE_FEST',
      label: '시민 자전거 대행진 · 바이크 페스티벌',
      shortLabel: '시민 대행진·페스티벌',
    },
  ],
  TRIATHLON: [
    {
      code: 'TRI_IRONMAN_HALF',
      label: '아이언맨 · 장거리 (Full / 70.3 / 하프)',
      shortLabel: '아이언맨·장거리',
    },
    {
      code: 'TRI_STANDARD_SPRINT',
      label: '스탠다드 (올림픽) · 스프린트',
      shortLabel: '스탠다드·스프린트',
    },
    {
      code: 'TRI_AQUATHLON',
      label: '아쿠아슬론 (수영+달리기)',
      shortLabel: '아쿠아슬론',
    },
    {
      code: 'TRI_DUATHLON',
      label: '듀애슬론 (달리기+자전거)',
      shortLabel: '듀애슬론',
    },
    {
      code: 'TRI_EDUCATION',
      label: '심판 · 대회규정 교육 · 세미나',
      shortLabel: '심판·규정교육',
    },
  ],
};

/**
 * 특별 홍보관 종목별 행사의 세부 행사형태(1개 이상) 판별
 */
export function classifySpecialPromoEventFormats(
  sport: SpecialPromoSport,
  ev: Pick<UnifiedEventItem, 'title' | 'rawTitle' | 'invitation' | 'scheduleNote' | 'organizer'>
): string[] {
  const txt = [ev.rawTitle || ev.title, ev.title, ev.invitation, ev.scheduleNote, ev.organizer]
    .filter(Boolean)
    .join(' ');
  const out: string[] = [];

  if (sport === 'SWIMMING') {
    if (/마스터즈|생활체육|동호인|대축전|시민수영|구민수영|클럽대항/i.test(txt)) {
      out.push('SWIM_MASTERS');
    }
    if (
      /오픈\s*워터|바다\s*수영|해수욕장|펭귄|한강\s*건너기|횡단|OWS|Water\s*Swimming/i.test(
        txt
      )
    ) {
      out.push('SWIM_OPENWATER');
    }
    if (
      /청소년|학생|꿈나무|소년|초\s*[·.,]?\s*중|유소년|어린이|교육감|교보생명컵/i.test(
        txt
      )
    ) {
      out.push('SWIM_YOUTH');
    }
    if (/다이빙/i.test(txt)) {
      out.push('SWIM_DIVING');
    }
    if (/수구/i.test(txt)) {
      out.push('SWIM_WATERPOLO');
    }
    if (
      /아티스틱|선수권|대통령배|동아수영|회장배|국가대표|전국체육대회|등급제|심판|강습회/i.test(
        txt
      ) ||
      out.length === 0
    ) {
      out.push('SWIM_ELITE_OTHER');
    }
  } else if (sport === 'RUNNING') {
    if (/풀코스|FULL|4Full|풀\s*[,/]|마라톤\s*대회/i.test(txt)) {
      out.push('RUN_FULL');
    }
    if (/하프|HALF/i.test(txt)) {
      out.push('RUN_HALF');
    }
    if (
      /10\s*km|10\s*K|5\s*km|5\s*K|7\s*km|3\s*km|단축|건강\s*달리기|구보/i.test(
        txt
      )
    ) {
      out.push('RUN_10K_SHORT');
    }
    if (/트레일|임도런|산악|울트라|100K|50K|35K|32km/i.test(txt)) {
      out.push('RUN_TRAIL_ULTRA');
    }
    if (
      /릴레이|페스티벌|FESTA|알몸|나이트|빵빵|댕댕|어스|기부|윷놀이|팀마라톤|클럽대항|휠체어|인라인/i.test(
        txt
      ) ||
      out.length === 0
    ) {
      out.push('RUN_RELAY_FEST');
    }
  } else if (sport === 'CYCLING') {
    if (
      /그란폰도|메디오폰도|GRANFONDO|Gran\s*Fondo|Medio\s*Fondo|랠리/i.test(txt)
    ) {
      out.push('CYC_GRANFONDO');
    }
    if (
      /크리테리움|힐클라임|투르\s*드|Tour\s*de|도로\s*사이클|전국자전거대회/i.test(
        txt
      )
    ) {
      out.push('CYC_ROAD_CRIT');
    }
    if (/MTB|산악\s*자전거|왕방산/i.test(txt)) {
      out.push('CYC_MTB');
    }
    if (/대행진|페스타|페스티벌|대축전|시민|밸런스/i.test(txt) || out.length === 0) {
      out.push('CYC_PARADE_FEST');
    }
  } else if (sport === 'TRIATHLON') {
    const isEdu = /규정\s*정기교육|심판|보수교육|강습회|워크숍|세미나/i.test(txt);
    if (isEdu) {
      out.push('TRI_EDUCATION');
    } else {
      if (/아이언맨|IRONMAN|70\.3|하프코스|챌린지\s*군산/i.test(txt)) {
        out.push('TRI_IRONMAN_HALF');
      }
      if (/아쿠아슬론|AQUATHLON/i.test(txt)) {
        out.push('TRI_AQUATHLON');
      }
      if (/듀애슬론|DUATHLON/i.test(txt)) {
        out.push('TRI_DUATHLON');
      }
      if (
        /트라이애슬론|철인\s*3종|해양스포츠제전|전국체육대회|스탠다드|스프린트/i.test(
          txt
        ) ||
        out.length === 0
      ) {
        out.push('TRI_STANDARD_SPRINT');
      }
    }
  }

  return out;
}

export function isSpecialPromoFormatCode(code: string): boolean {
  return /^(?:SWIM_|RUN_|CYC_|TRI_)/.test(String(code || ''));
}

export function matchesSpecialPromoEventFormat(
  sport: SpecialPromoSport,
  ev: Pick<UnifiedEventItem, 'title' | 'invitation' | 'scheduleNote' | 'organizer'>,
  formatCode: string
): boolean {
  if (!formatCode || formatCode === 'ALL') return true;
  const codes = classifySpecialPromoEventFormats(sport, ev);
  return codes.includes(formatCode);
}

export function getSpecialPromoFormatShortLabels(
  sport: SpecialPromoSport,
  ev: Pick<UnifiedEventItem, 'title' | 'invitation' | 'scheduleNote' | 'organizer'>
): string[] {
  const defs = SPECIAL_PROMO_EVENT_FORMATS[sport] || [];
  const codes = classifySpecialPromoEventFormats(sport, ev);
  return defs.filter((d) => codes.includes(d.code)).map((d) => d.shortLabel);
}

/**
 * 특별 홍보관 4대 종목의 모든 행사 형태를 기본적으로 선택(true) 상태로 초기화
 */
export function buildDefaultSpecialPromoFormats(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  (Object.keys(SPECIAL_PROMO_EVENT_FORMATS) as SpecialPromoSport[]).forEach((sport) => {
    SPECIAL_PROMO_EVENT_FORMATS[sport].forEach((fmt) => {
      map[fmt.code] = true;
    });
  });
  return map;
}

/**
 * 복수 선택된 행사 형태 맵 기준으로 해당 대회가 1개 이상의 선택된 형태에 속하는지 검사
 */
export function matchesSpecialPromoMultiFormats(
  sport: SpecialPromoSport,
  ev: Pick<UnifiedEventItem, 'title' | 'invitation' | 'scheduleNote' | 'organizer'>,
  selectedMap?: Record<string, boolean>
): boolean {
  if (!selectedMap) return true;
  const codes = classifySpecialPromoEventFormats(sport, ev);
  return codes.some((code) => selectedMap[code] !== false);
}

/**
 * 전체 행사 레코드 전수 조사 기반 종목(Discipline) 카탈로그 DB
 * - 수영 기본 15종목(자유형, 배영, 평영, 접영, 남자계영, 남자혼계, 여자계영, 여자혼계, 혼성계영, 혼성혼계, 핀자유형, 핀접영, 남성핀계, 여성핀계, 혼성핀계)
 *   + 전수 조사 추가 5종목(개인혼영, 다이빙, 수구, 아티스틱, 오픈워터(OWS))
 * - 비수영 종목(러닝·마라톤, 자전거·사이클, 철인3종·트라이애슬론, 축제, 공연, 전시·박람회·시민참여)도 종목 카탈로그 DB로 보유
 */
export const EVENT_DISCIPLINE_CATALOG: Record<EventDisciplineGroup, string[]> = {
  SWIMMING: [
    '자유형',
    '배영',
    '평영',
    '접영',
    '개인혼영',
    '남자계영',
    '남자혼계',
    '여자계영',
    '여자혼계',
    '혼성계영',
    '혼성혼계',
    '핀자유형',
    '핀접영',
    '남성핀계',
    '여성핀계',
    '혼성핀계',
    '다이빙',
    '수구',
    '아티스틱',
    '오픈워터(OWS)',
  ],
  RUNNING: [
    '풀코스(42.195km)',
    '하프(21.0975km)',
    '32km·30km·20km',
    '10km',
    '5km·건강달리기',
    '트레일러닝·산악',
    '울트라(50K·100K)',
    '릴레이·단체전',
    '걷기·패밀리런',
  ],
  CYCLING: [
    '그란폰도(장거리)',
    '메디오폰도(중거리)',
    '개인도로·크리테리움',
    '힐클라임',
    '트랙(벨로드롬)',
    'MTB(산악자전거)',
    'BMX·펌프트랙',
    '시민대행진·투어',
  ],
  TRIATHLON: [
    '아이언맨·킹코스(Full)',
    '하프·미들코스(70.3)',
    '스탠다드(올림픽코스)',
    '스프린트·슈퍼스프린트',
    '릴레이(단체전)',
    '아쿠아슬론(수영+런)',
    '듀애슬론(런+바이크)',
    '심판·수상구조 강습',
  ],
  FESTIVAL: [
    '개막·폐막공연',
    '전통·민속경연',
    '체험·참여부스',
    '야간경관·불꽃',
    '특산물·먹거리장터',
    '시민가요제·경연',
    '퍼레이드·거리행진',
    '전시·포토존',
  ],
  PERFORMANCE: [
    '클래식·오케스트라',
    '연극·뮤지컬',
    '대중음악·콘서트',
    '전통국악·무용',
    '영화·미디어상영',
    '어린이·가족극',
  ],
  EXHIBITION_MUNICIPAL: [
    '기획·특별전시',
    '산업·취업박람회',
    '도슨트·학술강연',
    '시민체험·워크숍',
    '플리마켓·나눔장터',
    '생활체육·시민걷기',
  ],
};

export function resolveEventDisciplineGroup(
  ev: Pick<
    UnifiedEventItem,
    | 'sportDisciplineGroup'
    | 'title'
    | 'rawTitle'
    | 'invitation'
    | 'summary'
    | 'organizer'
    | 'lclsSystm2'
    | 'lclsSystm3'
  >
): EventDisciplineGroup {
  if (ev.sportDisciplineGroup && EVENT_DISCIPLINE_CATALOG[ev.sportDisciplineGroup]) {
    return ev.sportDisciplineGroup;
  }

  const hay = `${ev.rawTitle || ev.title || ''} ${ev.title || ''} ${ev.invitation || ''} ${ev.summary || ''} ${ev.organizer || ''}`;
  if (matchesSportCategory(hay, 'SWIMMING')) return 'SWIMMING';
  if (matchesSportCategory(hay, 'TRIATHLON')) return 'TRIATHLON';
  if (matchesSportCategory(hay, 'CYCLING')) return 'CYCLING';
  if (matchesSportCategory(hay, 'RUNNING')) return 'RUNNING';

  if (ev.lclsSystm2 === 'EV01') return 'FESTIVAL';
  if (ev.lclsSystm2 === 'EV02') return 'PERFORMANCE';
  return 'EXHIBITION_MUNICIPAL';
}

export function getOperatingDisciplinesForEvent(
  ev: Pick<
    UnifiedEventItem,
    | 'sportDisciplineGroup'
    | 'operatingDisciplines'
    | 'title'
    | 'rawTitle'
    | 'invitation'
    | 'summary'
    | 'scheduleNote'
    | 'organizer'
    | 'lclsSystm2'
    | 'lclsSystm3'
  >
): { group: EventDisciplineGroup; catalog: string[]; activeSet: Set<string> } {
  const group = resolveEventDisciplineGroup(ev);
  const catalog = EVENT_DISCIPLINE_CATALOG[group];

  if (Array.isArray(ev.operatingDisciplines) && ev.operatingDisciplines.length > 0) {
    return {
      group,
      catalog,
      activeSet: new Set(ev.operatingDisciplines),
    };
  }

  const txt = `${ev.rawTitle || ev.title || ''} ${ev.title || ''} ${ev.invitation || ''} ${ev.summary || ''} ${ev.scheduleNote || ''} ${ev.organizer || ''}`;
  const active: string[] = [];

  if (group === 'SWIMMING') {
    const isOpenWaterOnly =
      /오픈\s*워터|바다\s*수영|해수욕장|한강\s*건너기|횡단|OWS|핀수영\s*대회/i.test(txt) &&
      !/경영|실내수영장/.test(txt);
    const isDivingOnly = /\(다이빙\)|다이빙\s*국가대표|다이빙\s*대회/i.test(ev.title || '');
    const isWaterPoloOnly = /\(수구\)|수구\s*선수권|수구\s*국가대표/i.test(ev.title || '');
    const isArtisticOnly = /아티스틱/i.test(ev.title || '') && !/경영/.test(ev.title || '');

    if (isDivingOnly) {
      active.push('다이빙');
    } else if (isWaterPoloOnly) {
      active.push('수구');
    } else if (isArtisticOnly) {
      active.push('아티스틱');
    } else if (isOpenWaterOnly) {
      active.push('오픈워터(OWS)');
      if (/핀|오리발|장비/.test(txt)) {
        active.push('핀자유형', '핀접영');
      } else {
        active.push('자유형', '핀자유형');
      }
    } else {
      // 일반 경영·마스터즈·학생·회장배·교육감배 수영대회
      active.push(
        '자유형',
        '배영',
        '평영',
        '접영',
        '개인혼영',
        '남자계영',
        '남자혼계',
        '여자계영',
        '여자혼계'
      );
      if (/마스터즈|생활체육|동호인|대축전|시민|구민|체육회장배|시장배|구청장배/.test(txt)) {
        active.push('혼성계영', '혼성혼계', '핀자유형', '핀접영', '혼성핀계');
        if (/핀계영|핀단체|클럽대항/.test(txt)) {
          active.push('남성핀계', '여성핀계');
        }
      }
      if (/전국체육대회|전국소년체육대회|동아수영|대통령배|회장배\s*전국수영대회/.test(txt)) {
        active.push('혼성혼계', '다이빙', '수구', '아티스틱');
      }
    }
  } else if (group === 'RUNNING') {
    if (/풀코스|FULL|42\.195/i.test(txt)) active.push('풀코스(42.195km)');
    if (/하프|HALF|21\.0975|21km/i.test(txt)) active.push('하프(21.0975km)');
    if (/32\s*km|30\s*km|25\s*km|20\s*km|15\s*km/i.test(txt)) active.push('32km·30km·20km');
    if (/10\s*km|10\s*K/i.test(txt)) active.push('10km');
    if (/5\s*km|5\s*K|건강\s*달리기|단축/i.test(txt)) active.push('5km·건강달리기');
    if (/트레일|산악|임도런/i.test(txt)) active.push('트레일러닝·산악');
    if (/울트라|100\s*km|100\s*K|50\s*km|50\s*K/i.test(txt)) active.push('울트라(50K·100K)');
    if (/릴레이|단체전|팀\s*마라톤|역전\s*마라톤/i.test(txt)) active.push('릴레이·단체전');
    if (/걷기|패밀리|가족|댕댕|커플/i.test(txt)) active.push('걷기·패밀리런');
    if (active.length === 0) {
      active.push('하프(21.0975km)', '10km', '5km·건강달리기');
    }
  } else if (group === 'CYCLING') {
    if (/그란폰도|GRANFONDO/i.test(txt)) active.push('그란폰도(장거리)');
    if (/메디오폰도|MEDIOFONDO/i.test(txt)) active.push('메디오폰도(중거리)');
    if (/도로|크리테리움|투르\s*드/i.test(txt)) active.push('개인도로·크리테리움');
    if (/힐클라임|령\s*힐클라임|대관령|백두대간/i.test(txt)) active.push('힐클라임');
    if (/트랙|벨로드롬/i.test(txt)) active.push('트랙(벨로드롬)');
    if (/MTB|산악\s*자전거/i.test(txt)) active.push('MTB(산악자전거)');
    if (/BMX|펌프|밸런스/i.test(txt)) active.push('BMX·펌프트랙');
    if (/대행진|투어|페스티벌|대축전|시민/i.test(txt)) active.push('시민대행진·투어');
    if (active.length === 0) {
      active.push('그란폰도(장거리)', '메디오폰도(중거리)');
    }
  } else if (group === 'TRIATHLON') {
    if (/규정|심판|인명구조|강습회|보수교육/i.test(txt)) {
      active.push('심판·수상구조 강습');
    } else {
      if (/아이언맨|IRONMAN|킹코스|Full/i.test(txt)) active.push('아이언맨·킹코스(Full)');
      if (/70\.3|하프|미들/i.test(txt)) active.push('하프·미들코스(70.3)');
      if (/아쿠아슬론|AQUATHLON/i.test(txt)) active.push('아쿠아슬론(수영+런)');
      if (/듀애슬론|DUATHLON/i.test(txt)) active.push('듀애슬론(런+바이크)');
      if (/릴레이|단체/i.test(txt)) active.push('릴레이(단체전)');
      if (/스탠다드|올림픽|트라이애슬론|철인\s*3종/i.test(txt) || active.length === 0) {
        active.push('스탠다드(올림픽코스)', '스프린트·슈퍼스프린트', '릴레이(단체전)');
      }
    }
  } else if (group === 'FESTIVAL') {
    active.push('개막·폐막공연', '체험·참여부스', '전시·포토존');
    if (/전통|역사|민속|문화제|대제/i.test(txt)) active.push('전통·민속경연', '퍼레이드·거리행진');
    if (/불꽃|야행|빛|유등|드론|야간/i.test(txt)) active.push('야간경관·불꽃');
    if (/특산물|한우|김장|수산물|맛|미식|맥주|커피|빵|음식/i.test(txt) || ev.lclsSystm3 === 'EV010300') {
      active.push('특산물·먹거리장터');
    }
    if (/가요제|경연|콘테스트/i.test(txt)) active.push('시민가요제·경연');
  } else if (group === 'PERFORMANCE') {
    if (ev.lclsSystm3 === 'EV020600' || /교향악|오케스트라|합창|클래식|실내악|독주회/i.test(txt)) {
      active.push('클래식·오케스트라');
    }
    if (ev.lclsSystm3 === 'EV020200' || ev.lclsSystm3 === 'EV020300' || /연극|뮤지컬|오페라/i.test(txt)) {
      active.push('연극·뮤지컬');
    }
    if (ev.lclsSystm3 === 'EV020700' || /콘서트|밴드|재즈|대중음악/i.test(txt)) {
      active.push('대중음악·콘서트');
    }
    if (ev.lclsSystm3 === 'EV020100' || ev.lclsSystm3 === 'EV020500' || /국악|전통|무용|판소리/i.test(txt)) {
      active.push('전통국악·무용');
    }
    if (ev.lclsSystm3 === 'EV020800' || /영화|상영/i.test(txt)) {
      active.push('영화·미디어상영');
    }
    if (/어린이|가족|인형극/i.test(txt)) {
      active.push('어린이·가족극');
    }
    if (active.length === 0) active.push('클래식·오케스트라', '대중음악·콘서트');
  } else {
    if (ev.lclsSystm3 === 'EV030100' || /전시|미술|갤러리|비엔날레/i.test(txt)) {
      active.push('기획·특별전시', '도슨트·학술강연');
    }
    if (ev.lclsSystm3 === 'EV030200' || /박람회|엑스포|페어|채용/i.test(txt)) {
      active.push('산업·취업박람회', '시민체험·워크숍');
    }
    if (ev.lclsSystm2 === 'MUNICIPAL' || /장터|플리마켓|나눔/i.test(txt)) {
      active.push('플리마켓·나눔장터', '시민체험·워크숍');
    }
    if (/체육|걷기|한마음/i.test(txt)) {
      active.push('생활체육·시민걷기');
    }
    if (active.length === 0) {
      active.push('시민체험·워크숍', '기획·특별전시');
    }
  }

  return {
    group,
    catalog,
    activeSet: new Set(active),
  };
}
