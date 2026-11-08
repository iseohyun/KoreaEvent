/**
 * 특별 홍보관 스포츠(수영·러닝·자전거·철인) 범위(세계/대한연맹 · 광역시도 · 시군구 · 동네) 및 링크 정책
 * (프런트엔드 + 크롤러 공용 단일 출처)
 *
 * - UI에서는 lv/Lv. 표기를 사용하지 않으며 다음 4개 범위로 구분한다:
 *   - 3: "세계/대한연맹" (세계연맹 / 대한민국 중앙연맹 주최·주관 전국 공인 선수권·메이저 대회)
 *   - 2: "광역시도" (17개 광역시·특별시·특별자치시·도 단위 대회: 광역시장배, 도지사배, 시도체육회장배, 교육감배 등)
 *   - 1: "시군구" (2단계 기초지자체 시·군·구 단위 대회: 기초시장배, 군수배, 구청장배, 시군구 지명 대회 등)
 *   - 0: "동네" (개별 수영장·체육센터·공원·크루·동호회 단위 소규모 행사 및 강습회)
 * - 핵심 원칙:
 *   어느 홈페이지에서 홍보·수집되었는지(organizer/source)가 아니라,
 *   대회 자체의 명칭에 포함된 지자체 이름이 지자체 코드(1단계 광역시도 vs 2단계 시군구) 중 어디에 속하는지를 기준으로
 *   범위(level)와 지자체 정보를 일관되게 조정한다.
 */

/** 특별 홍보관에 노출하는 범위 순서 (세계/대한연맹 → 광역시도 → 시군구 → 동네) */
export const ACTIVE_PROMO_LEVELS = [3, 2, 1, 0];

/** 필터 '범위' 및 리스트 섹션에 표시하는 공식 명칭 (lv 표기 없음) */
export const PROMO_LEVEL_SHORT_LABELS = {
  3: '세계/대한연맹',
  2: '광역시도',
  1: '시군구',
  0: '동네',
};

export const PROMO_LEVEL_LABELS = {
  3: '세계/대한연맹',
  2: '광역시도',
  1: '시군구',
  0: '동네',
};

export const SPORT_LABELS = {
  SWIMMING: '수영',
  RUNNING: '러닝',
  CYCLING: '자전거',
  TRIATHLON: '철인',
};

export function getPromoLevelLabel(level) {
  return PROMO_LEVEL_SHORT_LABELS[level] || '동네';
}

export const METRO_REGION_IDS = [
  'seoul',
  'busan',
  'daegu',
  'incheon',
  'gwangju',
  'daejeon',
  'ulsan',
  'sejong',
];

const SWIM_FALSE_POSITIVE_RE =
  /수영구|수영강변대로|수영로|수영동|수영만|수영교|수영천|수영역|수영고가|수영교차로|특수영상|특수영화|수영장\s*휴관|수영장\s*정기휴무/g;

const SWIM_EVENT_RE =
  /수영\s*대회|수영\s*축제|수영\s*경기|수영\s*선수권|수영\s*챔피언십|수영\s*페스티벌|바다\s*수영|핀\s*수영|마스터즈\s*수영|오픈\s*워터|오픈워터\s*스위밍|수영\s*연맹|한강\s*건너기|횡단\s*수영|펭귄\s*수영|수구\s*대회|수구\s*선수권|다이빙\s*대회|다이빙\s*선수권|아티스틱\s*스위밍|수영\s*국가대표|수영\s*등급제|Swim\s*Fest|SWIMMER|World\s*Aquatics|코리아\s*스위밍|코리아\s*마스터즈|KOREA\s*MASTERS/i;

const TRIATHLON_EVENT_RE =
  /철인\s*3종|트라이애슬론|Triathlon|아이언맨|IRONMAN|아쿠아슬론|Aquathlon|듀애슬론|Duathlon|장관배\s*전국\s*트라이애슬론|철인\s*대회/i;

const CYCLING_EVENT_RE =
  /자전거\s*대회|자전거\s*대행진|자전거\s*축전|자전거\s*페스티벌|사이클\s*대회|사이클\s*선수권|사이클\s*연맹|그란폰도|메디오폰도|Gran\s*Fondo|Medio\s*Fondo|MTB\s*대회|산악\s*자전거|벨로드롬|투르\s*드|Tour\s*de|크리테리움|힐클라임|마스터즈\s*사이클|바이크\s*페스티벌|밸런스\s*바이크|RIDE\s*AROUND|브롬톤\s*월드|자전거\s*레이스|DMZ\s*랠리/i;

const RUNNING_FALSE_POSITIVE_RE =
  /북\s*마라톤|독서\s*마라톤|영화\s*마라톤|코딩\s*마라톤|해커톤|아이디어\s*마라톤|토론\s*마라톤/g;

const RUNNING_EVENT_RE =
  /마라톤|하프\s*마라톤|달리기\s*대회|러닝\s*대회|러닝\s*페스티벌|러닝\s*크루|트레일\s*런|트레일\s*러닝|Trail\s*Run|울트라\s*마라톤|10K\s*런|5K\s*런|나이트\s*런|컬러\s*런|임도런|가민\s*런|서울\s*레이스|육상\s*경기|육상\s*선수권|단축\s*마라톤|역전\s*경주|건강\s*달리기|레이스\s*대회|RUN\s*FEST|RUNNING\s*CREW|모두런|빵빵런|댕댕런|어스런|기부런|마라톤\s*협회/i;

const OTHER_SPORT_EVENT_RE =
  /체육\s*대회|걷기\s*대회|배드민턴\s*대회|테니스\s*대회|축구\s*대회/;

/** 동네 (0): 개별 수영장·청소년센터·스포츠센터·공원·크루·동호회 자체 소규모 행사/강습회 */
const LV0_LOCAL_INDIVIDUAL_RE =
  /청소년\s*센터|복지\s*체육\s*센터|스포츠\s*센터|구민\s*체육\s*센터|심판\s*강습회|심판\s*보수\s*교육|지도자\s*강습회|수상\s*안전\s*요원|스타트\s*연습|워밍업|물\s*만난\s*SWIMMER|Swim\s*Fest|KTA\s*YOUTH|러닝\s*크루|CREW\s*CHALLENGE|모두런|밸런스\s*바이크|두발로|번개\s*런|정기\s*런|동호회\s*자체|클럽\s*대항|초보\s*강습/i;

/**
 * 일반 명사와 겹치는 지명(영광=glory, 예산=budget, 음성=voice, 달성=achievement 등)용 정규식 생성기
 * - 행정 접미사(시/군/구)가 붙거나, 바로 뒤에 대회 수식어(시장배·마라톤·수영·대회 등)가 올 때만 지명으로 인정한다.
 * @param {string} name 지명 (예: '영광')
 * @param {string} [notBefore] 지명 바로 앞에 오면 안 되는 문자 (예: 양주 ← 남양주의 '남')
 */
function ambiguousPlaceRe(name, notBefore = '') {
  const lookbehind = notBefore ? `(?<![${notBefore}])` : '';
  return new RegExp(
    `${lookbehind}${name}(?:시|군|구(?!간|매|조|성|역)|(?=\\s*(?:시장|군수|구청장|국제|전국|오픈|마라톤|하프|수영|바다|트레일|울트라|트라이|철인|아쿠아|자전거|사이클|그란폰도|메디오폰도|MTB|힐클라임|투어|대회|배|기|컵|런|\\d{1,2}\\s*[kK])))`
  );
}

/**
 * 2단계 시·군·구(기초지자체) 지자체 코드 매핑 테이블
 * - 대회 제목에 이 지자체명(또는 지명배)이 등장하면 어느 홈페이지에서 홍보되었든 무조건 '시군구'(1)로 판정하고
 *   해당 지자체 코드(lDongRegnCd, lDongSignguCd, sigunguName)로 동기화한다.
 */
export const TITLE_SIGUNGU_CODE_RULES = [
  // 서울 자치구 (2단계 시군구)
  { re: /종로구/, lDongRegnCd: '11', lDongSignguCd: '110', sigunguName: '종로구' },
  { re: /서울\s*중구|중구청장배/, lDongRegnCd: '11', lDongSignguCd: '140', sigunguName: '중구' },
  { re: /용산구/, lDongRegnCd: '11', lDongSignguCd: '170', sigunguName: '용산구' },
  { re: /성동구/, lDongRegnCd: '11', lDongSignguCd: '200', sigunguName: '성동구' },
  { re: /광진구/, lDongRegnCd: '11', lDongSignguCd: '215', sigunguName: '광진구' },
  { re: /동대문구/, lDongRegnCd: '11', lDongSignguCd: '230', sigunguName: '동대문구' },
  { re: /중랑구/, lDongRegnCd: '11', lDongSignguCd: '260', sigunguName: '중랑구' },
  { re: /성북구/, lDongRegnCd: '11', lDongSignguCd: '290', sigunguName: '성북구' },
  { re: /강북구/, lDongRegnCd: '11', lDongSignguCd: '305', sigunguName: '강북구' },
  { re: /도봉구/, lDongRegnCd: '11', lDongSignguCd: '320', sigunguName: '도봉구' },
  { re: /노원구/, lDongRegnCd: '11', lDongSignguCd: '350', sigunguName: '노원구' },
  { re: /은평구/, lDongRegnCd: '11', lDongSignguCd: '380', sigunguName: '은평구' },
  { re: /서대문구/, lDongRegnCd: '11', lDongSignguCd: '410', sigunguName: '서대문구' },
  { re: /마포구/, lDongRegnCd: '11', lDongSignguCd: '440', sigunguName: '마포구' },
  { re: /양천구/, lDongRegnCd: '11', lDongSignguCd: '470', sigunguName: '양천구' },
  { re: /강서구/, lDongRegnCd: '11', lDongSignguCd: '500', sigunguName: '강서구' },
  { re: /구로구/, lDongRegnCd: '11', lDongSignguCd: '530', sigunguName: '구로구' },
  { re: /금천구/, lDongRegnCd: '11', lDongSignguCd: '545', sigunguName: '금천구' },
  { re: /영등포구/, lDongRegnCd: '11', lDongSignguCd: '560', sigunguName: '영등포구' },
  { re: /동작구/, lDongRegnCd: '11', lDongSignguCd: '590', sigunguName: '동작구' },
  { re: /관악구/, lDongRegnCd: '11', lDongSignguCd: '620', sigunguName: '관악구' },
  { re: /서초구/, lDongRegnCd: '11', lDongSignguCd: '650', sigunguName: '서초구' },
  { re: /강남구/, lDongRegnCd: '11', lDongSignguCd: '680', sigunguName: '강남구' },
  { re: /송파구/, lDongRegnCd: '11', lDongSignguCd: '710', sigunguName: '송파구' },
  { re: /강동구/, lDongRegnCd: '11', lDongSignguCd: '740', sigunguName: '강동구' },
  // 부산/대구/인천/광주/대전/울산 기초구·군
  { re: /해운대구|해운대/, lDongRegnCd: '26', lDongSignguCd: '350', sigunguName: '해운대구' },
  { re: /기장군|기장읍/, lDongRegnCd: '26', lDongSignguCd: '710', sigunguName: '기장군' },
  { re: /영도구|영도/, lDongRegnCd: '26', lDongSignguCd: '200', sigunguName: '영도구' },
  { re: /사하구|다대포|을숙도/, lDongRegnCd: '26', lDongSignguCd: '380', sigunguName: '사하구' },
  { re: /북구\s*구포|삼락/, lDongRegnCd: '26', lDongSignguCd: '320', sigunguName: '북구' },
  { re: /수성구|수성못/, lDongRegnCd: '27', lDongSignguCd: '260', sigunguName: '수성구' },
  { re: /달성군|달성(?=\s*(?:마라톤|수영|대회|군수배|전국|하프|100리))/, lDongRegnCd: '27', lDongSignguCd: '710', sigunguName: '달성군' },
  { re: /강화군|강화도/, lDongRegnCd: '28', lDongSignguCd: '710', sigunguName: '강화군' },
  { re: /옹진군|옹진/, lDongRegnCd: '28', lDongSignguCd: '720', sigunguName: '옹진군' },
  { re: /정서진|청라/, lDongRegnCd: '28', lDongSignguCd: '260', sigunguName: '서구' },
  { re: /송도|연수구/, lDongRegnCd: '28', lDongSignguCd: '185', sigunguName: '연수구' },
  { re: /영종/, lDongRegnCd: '28', lDongSignguCd: '110', sigunguName: '중구' },
  { re: /울주군|울주|간절곶|진하/, lDongRegnCd: '31', lDongSignguCd: '710', sigunguName: '울주군' },
  // 경기도 시·군
  { re: /수원/, lDongRegnCd: '41', lDongSignguCd: '110', sigunguName: '수원시' },
  { re: /성남|분당/, lDongRegnCd: '41', lDongSignguCd: '130', sigunguName: '성남시' },
  { re: /의정부/, lDongRegnCd: '41', lDongSignguCd: '150', sigunguName: '의정부시' },
  { re: /안양/, lDongRegnCd: '41', lDongSignguCd: '170', sigunguName: '안양시' },
  { re: /부천/, lDongRegnCd: '41', lDongSignguCd: '190', sigunguName: '부천시' },
  { re: ambiguousPlaceRe('광명'), lDongRegnCd: '41', lDongSignguCd: '210', sigunguName: '광명시' },
  { re: /평택/, lDongRegnCd: '41', sigunguName: '평택시', lDongSignguCd: '220' },
  { re: /동두천|왕방산/, lDongRegnCd: '41', lDongSignguCd: '250', sigunguName: '동두천시' },
  { re: /안산|대부도/, lDongRegnCd: '41', lDongSignguCd: '270', sigunguName: '안산시' },
  { re: /고양|일산/, lDongRegnCd: '41', lDongSignguCd: '280', sigunguName: '고양시' },
  { re: /과천/, lDongRegnCd: '41', lDongSignguCd: '290', sigunguName: '과천시' },
  { re: ambiguousPlaceRe('구리'), lDongRegnCd: '41', lDongSignguCd: '310', sigunguName: '구리시' },
  { re: /남양주/, lDongRegnCd: '41', lDongSignguCd: '360', sigunguName: '남양주시' },
  { re: ambiguousPlaceRe('오산'), lDongRegnCd: '41', lDongSignguCd: '370', sigunguName: '오산시' },
  { re: /시흥/, lDongRegnCd: '41', lDongSignguCd: '390', sigunguName: '시흥시' },
  { re: /군포/, lDongRegnCd: '41', lDongSignguCd: '410', sigunguName: '군포시' },
  { re: /의왕/, lDongRegnCd: '41', lDongSignguCd: '430', sigunguName: '의왕시' },
  { re: /하남|미사리/, lDongRegnCd: '41', lDongSignguCd: '450', sigunguName: '하남시' },
  { re: /용인/, lDongRegnCd: '41', lDongSignguCd: '460', sigunguName: '용인시' },
  { re: /파주|임진각/, lDongRegnCd: '41', lDongSignguCd: '480', sigunguName: '파주시' },
  { re: ambiguousPlaceRe('이천'), lDongRegnCd: '41', lDongSignguCd: '500', sigunguName: '이천시' },
  { re: ambiguousPlaceRe('안성'), lDongRegnCd: '41', lDongSignguCd: '550', sigunguName: '안성시' },
  { re: /김포/, lDongRegnCd: '41', lDongSignguCd: '570', sigunguName: '김포시' },
  { re: /화성시|동탄|화성(?=\s*(?:마라톤|수영|대회|시장배|국제|전국|하프))/, lDongRegnCd: '41', lDongSignguCd: '590', sigunguName: '화성시' },
  { re: /(?<!남)양주(?:시|(?=\s*(?:마라톤|수영|대회|시장배|전국|하프|국제)))/, lDongRegnCd: '41', lDongSignguCd: '630', sigunguName: '양주시' },
  { re: /포천/, lDongRegnCd: '41', lDongSignguCd: '650', sigunguName: '포천시' },
  { re: /여주/, lDongRegnCd: '41', lDongSignguCd: '670', sigunguName: '여주시' },
  { re: /연천/, lDongRegnCd: '41', lDongSignguCd: '800', sigunguName: '연천군' },
  { re: /가평/, lDongRegnCd: '41', lDongSignguCd: '820', sigunguName: '가평군' },
  { re: /양평/, lDongRegnCd: '41', lDongSignguCd: '830', sigunguName: '양평군' },
  // 강원 시·군
  { re: /춘천/, lDongRegnCd: '51', lDongSignguCd: '110', sigunguName: '춘천시' },
  { re: /원주/, lDongRegnCd: '51', lDongSignguCd: '130', sigunguName: '원주시' },
  { re: /강릉|경포/, lDongRegnCd: '51', lDongSignguCd: '150', sigunguName: '강릉시' },
  { re: /동해시|동해(?!안|바다|선|대로)/, lDongRegnCd: '51', lDongSignguCd: '170', sigunguName: '동해시' },
  { re: /태백/, lDongRegnCd: '51', lDongSignguCd: '190', sigunguName: '태백시' },
  { re: /속초/, lDongRegnCd: '51', lDongSignguCd: '210', sigunguName: '속초시' },
  { re: /삼척/, lDongRegnCd: '51', lDongSignguCd: '230', sigunguName: '삼척시' },
  { re: /홍천/, lDongRegnCd: '51', lDongSignguCd: '720', sigunguName: '홍천군' },
  { re: /횡성/, lDongRegnCd: '51', lDongSignguCd: '730', sigunguName: '횡성군' },
  { re: /영월/, lDongRegnCd: '51', lDongSignguCd: '750', sigunguName: '영월군' },
  { re: /평창|대관령/, lDongRegnCd: '51', lDongSignguCd: '760', sigunguName: '평창군' },
  { re: /정선|JEONGSEON/i, lDongRegnCd: '51', lDongSignguCd: '770', sigunguName: '정선군' },
  { re: /철원/, lDongRegnCd: '51', lDongSignguCd: '780', sigunguName: '철원군' },
  { re: /화천/, lDongRegnCd: '51', lDongSignguCd: '790', sigunguName: '화천군' },
  { re: /양구/, lDongRegnCd: '51', lDongSignguCd: '800', sigunguName: '양구군' },
  { re: /인제|설악/, lDongRegnCd: '51', lDongSignguCd: '810', sigunguName: '인제군' },
  { re: /강원\s*고성|고성\s*그란폰도/, lDongRegnCd: '51', lDongSignguCd: '820', sigunguName: '고성군' },
  { re: /양양/, lDongRegnCd: '51', lDongSignguCd: '830', sigunguName: '양양군' },
  // 충북 시·군
  { re: /청주/, lDongRegnCd: '43', lDongSignguCd: '110', sigunguName: '청주시' },
  { re: /충주/, lDongRegnCd: '43', lDongSignguCd: '130', sigunguName: '충주시' },
  { re: /제천/, lDongRegnCd: '43', lDongSignguCd: '150', sigunguName: '제천시' },
  { re: /보은/, lDongRegnCd: '43', lDongSignguCd: '720', sigunguName: '보은군' },
  { re: /옥천/, lDongRegnCd: '43', lDongSignguCd: '730', sigunguName: '옥천군' },
  { re: ambiguousPlaceRe('영동'), lDongRegnCd: '43', lDongSignguCd: '740', sigunguName: '영동군' },
  { re: /증평/, lDongRegnCd: '43', lDongSignguCd: '745', sigunguName: '증평군' },
  { re: /진천/, lDongRegnCd: '43', lDongSignguCd: '750', sigunguName: '진천군' },
  { re: /괴산/, lDongRegnCd: '43', lDongSignguCd: '760', sigunguName: '괴산군' },
  { re: ambiguousPlaceRe('음성'), lDongRegnCd: '43', lDongSignguCd: '770', sigunguName: '음성군' },
  { re: /단양/, lDongRegnCd: '43', lDongSignguCd: '800', sigunguName: '단양군' },
  // 충남 시·군
  { re: /천안/, lDongRegnCd: '44', lDongSignguCd: '130', sigunguName: '천안시' },
  { re: ambiguousPlaceRe('공주'), lDongRegnCd: '44', lDongSignguCd: '150', sigunguName: '공주시' },
  { re: /보령|대천/, lDongRegnCd: '44', lDongSignguCd: '180', sigunguName: '보령시' },
  { re: /아산/, lDongRegnCd: '44', lDongSignguCd: '200', sigunguName: '아산시' },
  { re: /서산/, lDongRegnCd: '44', lDongSignguCd: '210', sigunguName: '서산시' },
  { re: /논산/, lDongRegnCd: '44', lDongSignguCd: '230', sigunguName: '논산시' },
  { re: /계룡/, lDongRegnCd: '44', lDongSignguCd: '250', sigunguName: '계룡시' },
  { re: /당진/, lDongRegnCd: '44', lDongSignguCd: '270', sigunguName: '당진시' },
  { re: ambiguousPlaceRe('금산'), lDongRegnCd: '44', lDongSignguCd: '710', sigunguName: '금산군' },
  { re: /부여군|백마강|부여(?=\s*(?:마라톤|수영|대회|굿뜨래))/, lDongRegnCd: '44', lDongSignguCd: '760', sigunguName: '부여군' },
  { re: /서천/, lDongRegnCd: '44', lDongSignguCd: '770', sigunguName: '서천군' },
  { re: /청양/, lDongRegnCd: '44', lDongSignguCd: '790', sigunguName: '청양군' },
  { re: /홍성/, lDongRegnCd: '44', lDongSignguCd: '800', sigunguName: '홍성군' },
  { re: ambiguousPlaceRe('예산'), lDongRegnCd: '44', lDongSignguCd: '810', sigunguName: '예산군' },
  { re: /태안/, lDongRegnCd: '44', lDongSignguCd: '825', sigunguName: '태안군' },
  // 전북 시·군
  { re: /전주/, lDongRegnCd: '52', lDongSignguCd: '110', sigunguName: '전주시' },
  { re: /군산|새만금/, lDongRegnCd: '52', lDongSignguCd: '130', sigunguName: '군산시' },
  { re: /익산|웅포/, lDongRegnCd: '52', lDongSignguCd: '140', sigunguName: '익산시' },
  { re: /정읍/, lDongRegnCd: '52', lDongSignguCd: '180', sigunguName: '정읍시' },
  { re: /남원/, lDongRegnCd: '52', lDongSignguCd: '190', sigunguName: '남원시' },
  { re: /김제/, lDongRegnCd: '52', lDongSignguCd: '210', sigunguName: '김제시' },
  { re: /완주/, lDongRegnCd: '52', lDongSignguCd: '710', sigunguName: '완주군' },
  { re: /진안|마이산/, lDongRegnCd: '52', lDongSignguCd: '720', sigunguName: '진안군' },
  { re: /무주/, lDongRegnCd: '52', lDongSignguCd: '730', sigunguName: '무주군' },
  { re: ambiguousPlaceRe('장수'), lDongRegnCd: '52', lDongSignguCd: '740', sigunguName: '장수군' },
  { re: /임실/, lDongRegnCd: '52', lDongSignguCd: '750', sigunguName: '임실군' },
  { re: /순창/, lDongRegnCd: '52', lDongSignguCd: '770', sigunguName: '순창군' },
  { re: /고창/, lDongRegnCd: '52', lDongSignguCd: '790', sigunguName: '고창군' },
  { re: /부안|적벽강|변산/, lDongRegnCd: '52', lDongSignguCd: '800', sigunguName: '부안군' },
  // 전남 시·군
  { re: /목포|유달산/, lDongRegnCd: '46', lDongSignguCd: '110', sigunguName: '목포시' },
  { re: /여수|오동도/, lDongRegnCd: '46', lDongSignguCd: '130', sigunguName: '여수시' },
  { re: /순천/, lDongRegnCd: '46', lDongSignguCd: '150', sigunguName: '순천시' },
  { re: /나주|영산강/, lDongRegnCd: '46', lDongSignguCd: '170', sigunguName: '나주시' },
  { re: /광양|광양만|백운산/, lDongRegnCd: '46', lDongSignguCd: '230', sigunguName: '광양시' },
  { re: /담양/, lDongRegnCd: '46', lDongSignguCd: '710', sigunguName: '담양군' },
  { re: /곡성|섬진강/, lDongRegnCd: '46', lDongSignguCd: '720', sigunguName: '곡성군' },
  { re: /구례|지리산/, lDongRegnCd: '46', lDongSignguCd: '730', sigunguName: '구례군' },
  { re: /고흥/, lDongRegnCd: '46', lDongSignguCd: '770', sigunguName: '고흥군' },
  { re: ambiguousPlaceRe('보성'), lDongRegnCd: '46', lDongSignguCd: '780', sigunguName: '보성군' },
  { re: /화순|화순\s*적벽/, lDongRegnCd: '46', lDongSignguCd: '790', sigunguName: '화순군' },
  { re: /장흥/, lDongRegnCd: '46', lDongSignguCd: '800', sigunguName: '장흥군' },
  { re: ambiguousPlaceRe('강진'), lDongRegnCd: '46', lDongSignguCd: '810', sigunguName: '강진군' },
  { re: /해남|땅끝/, lDongRegnCd: '46', lDongSignguCd: '820', sigunguName: '해남군' },
  { re: /영암/, lDongRegnCd: '46', lDongSignguCd: '830', sigunguName: '영암군' },
  { re: /무안/, lDongRegnCd: '46', lDongSignguCd: '840', sigunguName: '무안군' },
  { re: /함평/, lDongRegnCd: '46', lDongSignguCd: '860', sigunguName: '함평군' },
  { re: ambiguousPlaceRe('영광'), lDongRegnCd: '46', lDongSignguCd: '870', sigunguName: '영광군' },
  { re: /장성/, lDongRegnCd: '46', lDongSignguCd: '880', sigunguName: '장성군' },
  { re: /완도/, lDongRegnCd: '46', lDongSignguCd: '890', sigunguName: '완도군' },
  { re: ambiguousPlaceRe('진도'), lDongRegnCd: '46', lDongSignguCd: '900', sigunguName: '진도군' },
  { re: /신안/, lDongRegnCd: '46', lDongSignguCd: '910', sigunguName: '신안군' },
  // 경북 시·군 (김천시 47-150 포함)
  { re: /포항/, lDongRegnCd: '47', lDongSignguCd: '110', sigunguName: '포항시' },
  { re: /경주/, lDongRegnCd: '47', lDongSignguCd: '130', sigunguName: '경주시' },
  { re: /김천/, lDongRegnCd: '47', lDongSignguCd: '150', sigunguName: '김천시' },
  { re: /안동/, lDongRegnCd: '47', lDongSignguCd: '170', sigunguName: '안동시' },
  { re: /구미/, lDongRegnCd: '47', lDongSignguCd: '190', sigunguName: '구미시' },
  { re: /영주/, lDongRegnCd: '47', lDongSignguCd: '210', sigunguName: '영주시' },
  { re: /영천/, lDongRegnCd: '47', lDongSignguCd: '230', sigunguName: '영천시' },
  { re: ambiguousPlaceRe('상주'), lDongRegnCd: '47', lDongSignguCd: '250', sigunguName: '상주시' },
  { re: /문경/, lDongRegnCd: '47', lDongSignguCd: '280', sigunguName: '문경시' },
  { re: /경산/, lDongRegnCd: '47', lDongSignguCd: '290', sigunguName: '경산시' },
  { re: /의성/, lDongRegnCd: '47', lDongSignguCd: '730', sigunguName: '의성군' },
  { re: /청송/, lDongRegnCd: '47', lDongSignguCd: '750', sigunguName: '청송군' },
  { re: ambiguousPlaceRe('영양'), lDongRegnCd: '47', lDongSignguCd: '760', sigunguName: '영양군' },
  { re: /영덕/, lDongRegnCd: '47', lDongSignguCd: '770', sigunguName: '영덕군' },
  { re: /청도/, lDongRegnCd: '47', lDongSignguCd: '820', sigunguName: '청도군' },
  { re: ambiguousPlaceRe('고령'), lDongRegnCd: '47', lDongSignguCd: '830', sigunguName: '고령군' },
  { re: ambiguousPlaceRe('성주'), lDongRegnCd: '47', lDongSignguCd: '840', sigunguName: '성주군' },
  { re: /칠곡/, lDongRegnCd: '47', lDongSignguCd: '850', sigunguName: '칠곡군' },
  { re: /예천/, lDongRegnCd: '47', lDongSignguCd: '900', sigunguName: '예천군' },
  { re: ambiguousPlaceRe('봉화'), lDongRegnCd: '47', lDongSignguCd: '920', sigunguName: '봉화군' },
  { re: /울진/, lDongRegnCd: '47', lDongSignguCd: '930', sigunguName: '울진군' },
  { re: /울릉|독도/, lDongRegnCd: '47', lDongSignguCd: '940', sigunguName: '울릉군' },
  // 경남 시·군 (거제시 48-310, 창원시 48-120 포함)
  { re: /창원|마산|진해/, lDongRegnCd: '48', lDongSignguCd: '120', sigunguName: '창원시' },
  { re: /진주|남강유등/, lDongRegnCd: '48', lDongSignguCd: '170', sigunguName: '진주시' },
  { re: /통영|한산대첩|이순신\s*장군배/, lDongRegnCd: '48', lDongSignguCd: '220', sigunguName: '통영시' },
  { re: /사천|삼천포/, lDongRegnCd: '48', lDongSignguCd: '240', sigunguName: '사천시' },
  { re: /김해/, lDongRegnCd: '48', lDongSignguCd: '250', sigunguName: '김해시' },
  { re: /밀양/, lDongRegnCd: '48', lDongSignguCd: '270', sigunguName: '밀양시' },
  { re: /거제|산방산|지세포|구조라|와현해수욕장|와현모래숲|예구\s*해변|펭귄\s*수영/, lDongRegnCd: '48', lDongSignguCd: '310', sigunguName: '거제시' },
  { re: /양산/, lDongRegnCd: '48', lDongSignguCd: '330', sigunguName: '양산시' },
  { re: /의령/, lDongRegnCd: '48', lDongSignguCd: '720', sigunguName: '의령군' },
  { re: /함안/, lDongRegnCd: '48', lDongSignguCd: '730', sigunguName: '함안군' },
  { re: /창녕|부곡/, lDongRegnCd: '48', lDongSignguCd: '740', sigunguName: '창녕군' },
  { re: / 고성|경남\s*고성|당항포/, lDongRegnCd: '48', lDongSignguCd: '820', sigunguName: '고성군' },
  { re: /남해|보물섬/, lDongRegnCd: '48', lDongSignguCd: '840', sigunguName: '남해군' },
  { re: /하동|섬진강/, lDongRegnCd: '48', lDongSignguCd: '850', sigunguName: '하동군' },
  { re: /산청/, lDongRegnCd: '48', lDongSignguCd: '860', sigunguName: '산청군' },
  { re: /함양/, lDongRegnCd: '48', lDongSignguCd: '870', sigunguName: '함양군' },
  { re: /거창/, lDongRegnCd: '48', lDongSignguCd: '880', sigunguName: '거창군' },
  { re: /합천|황강/, lDongRegnCd: '48', lDongSignguCd: '890', sigunguName: '합천군' },
  // 제주 행정시
  { re: /서귀포/, lDongRegnCd: '50', lDongSignguCd: '130', sigunguName: '서귀포시' },
];

/**
 * 1단계 광역시·도(광역지자체) 지자체 코드 매핑 테이블
 * - 대회 제목에 1단계 광역시·도 명칭(또는 광역시장배/도지사배/교육감배/도민체전)이 등장하면
 *   어느 홈페이지에서 홍보되었든 '광역시도'(2)로 판정하고 해당 광역시·도로 동기화한다.
 */
export const TITLE_PROVINCE_CODE_RULES = [
  { re: /서울(?:특별시)?|서울시장/, lDongRegnCd: '11', lDongSignguCd: '710', sigunguName: '송파구', metroShort: '서울' },
  { re: /부산(?:광역시)?|부산시장|부산체육회장|부[\s·.]*울[\s·.]*경/, lDongRegnCd: '26', lDongSignguCd: '260', sigunguName: '동래구', metroShort: '부산' },
  { re: /대구(?:광역시)?|대구시장/, lDongRegnCd: '27', lDongSignguCd: '260', sigunguName: '수성구', metroShort: '대구' },
  { re: /인천(?:광역시)?|인천시장/, lDongRegnCd: '28', lDongSignguCd: '185', sigunguName: '연수구', metroShort: '인천' },
  { re: /광주(?:광역시)?|광주시장|광주MBC|전남광주통합특별시/, lDongRegnCd: '12', lDongSignguCd: '270', sigunguName: '서구', metroShort: '광주' },
  { re: /대전광역시|대전시장|대전(?!쟁|투|\s*결과)/, lDongRegnCd: '30', lDongSignguCd: '200', sigunguName: '유성구', metroShort: '대전' },
  { re: /울산(?:광역시)?|울산시장|태화강/, lDongRegnCd: '31', lDongSignguCd: '140', sigunguName: '남구', metroShort: '울산' },
  { re: /세종특별자치시|세종시|세종(?!대왕|문화회관|대로|로|학당|대학)/, lDongRegnCd: '36110', lDongSignguCd: '110', sigunguName: '세종시', metroShort: '세종' },
  { re: /경기도|경기(?=\s*(?:도민|도지사|수영연맹|육상연맹|사이클연맹|철인|트라이|생활체육|체육회|교육감|국제|오픈|마라톤|하프))/, lDongRegnCd: '41', lDongSignguCd: '110', sigunguName: '수원시', metroShort: '경기' },
  { re: /강원(?:특별자치도|도)?/, lDongRegnCd: '51', lDongSignguCd: '110', sigunguName: '춘천시', metroShort: '강원' },
  { re: /충청북도|충북/, lDongRegnCd: '43', lDongSignguCd: '110', sigunguName: '청주시', metroShort: '충북' },
  { re: /충청남도|충남/, lDongRegnCd: '44', lDongSignguCd: '200', sigunguName: '아산시', metroShort: '충남' },
  { re: /전북(?:특별자치도)?|전라북도/, lDongRegnCd: '52', lDongSignguCd: '110', sigunguName: '전주시', metroShort: '전북' },
  { re: /전라남도|전남/, lDongRegnCd: '46', lDongSignguCd: '110', sigunguName: '목포시', metroShort: '전남' },
  { re: /경상북도|경북/, lDongRegnCd: '47', lDongSignguCd: '190', sigunguName: '구미시', metroShort: '경북' },
  { re: /경상남도|경남/, lDongRegnCd: '48', lDongSignguCd: '120', sigunguName: '창원시', metroShort: '경남' },
  { re: /제주(?:특별자치도|도)?|한라배|전도\s*(?:학생\s*)?수영/, lDongRegnCd: '50', lDongSignguCd: '110', sigunguName: '제주시', metroShort: '제주' },
];

/** 세계/대한연맹 (3): 지자체명이 붙지 않은 순수 중앙연맹/국제연맹 공인 선수권·국가대표 선발전·전국체전 */
const LV3_WORLD_NATIONAL_RE =
  /세계\s*수영|World\s*Aquatics|FINA|대한\s*수영\s*연맹|대한\s*육상\s*연맹|대한\s*사이클\s*연맹|대한\s*철인\s*3종\s*협회|World\s*Triathlon|UCI\s*|국가대표\s*선발|대통령배|대통령기|국무총리배|문체부\s*장관기|문화체육관광부\s*장관기|장관배\s*전국|대한체육회장배|회장배\s*전국|동아\s*수영|동아\s*마라톤|MBC배\s*전국|교보생명컵|꿈나무\s*전국|전국\s*체육\s*대회|전국\s*소년\s*체육\s*대회|전국\s*생활\s*체육\s*대축전|코리아\s*스위밍\s*챔피언십|Korea\s*Swimming\s*Championships|코리아\s*마스터즈|KOREA\s*MASTERS|수영\s*등급제\s*인증\s*대회|주니어\s*전국|오픈워터스위밍\s*전국|유소년\s*전국\s*마스터즈|유소년\s*꿈나무|월드\s*트라이애슬론|아이언맨\s*70\.3|IRONMAN|투르\s*드\s*코리아|마스터즈\s*사이클\s*투어|백두대간\s*그란폰도/i;

const LV2_GENERIC_TITLE_RE =
  /광역시장배|광역시장기|특별시장배|특별시장기|도지사배|도지사기|도의장배|교육감배|교육감기|도민체육대회|도민생활체육대회|시[\s·.]*군대항/;

const LV1_GENERIC_TITLE_RE = /구청장배|구청장기|군수배|군수기|기초시장배/;

/**
 * 개최지와 무관하게 항상 '세계/대한연맹'(3)인 전국 대회 브랜드
 * - 지역명 규칙보다 먼저 검사한다. (예: '교보생명컵 꿈나무체육대회(수영경기)', '제105회 전국체육대회(경남)')
 * - '김천 꿈나무 전국수영대회'처럼 지자체가 주최하는 전국 단위 대회는 여기에 포함하지 않는다(지자체 코드 기준 유지).
 */
const NATIONAL_BRAND_FIRST_RE =
  /World\s*Aquatics|FINA|세계\s*수영\s*선수권|국가대표\s*선발|대통령배|대통령기|국무총리배|문체부\s*장관기|문화체육관광부\s*장관기|대한체육회장배|교보생명컵|동아\s*수영|동아\s*마라톤|전국\s*체육\s*대회|전국\s*소년\s*체육\s*대회|전국\s*생활\s*체육\s*대축전|코리아\s*스위밍\s*챔피언십|Korea\s*Swimming\s*Championships|IRONMAN|아이언맨\s*70\.3|투르\s*드\s*코리아/i;

function stripSwimFalsePositives(text) {
  return String(text || '').replace(SWIM_FALSE_POSITIVE_RE, ' ');
}

function stripRunningFalsePositives(text) {
  return String(text || '').replace(RUNNING_FALSE_POSITIVE_RE, ' ');
}

/** 실제 수영 행사인지 판별 */
export function isSwimEvent(text) {
  return SWIM_EVENT_RE.test(stripSwimFalsePositives(text));
}

/** 실제 러닝/마라톤 행사인지 판별 */
export function isRunningEvent(text) {
  const cleaned = stripRunningFalsePositives(text);
  if (TRIATHLON_EVENT_RE.test(cleaned) && !/마라톤\s*대회/.test(cleaned)) {
    return false;
  }
  return RUNNING_EVENT_RE.test(cleaned);
}

/** 실제 자전거/사이클/그란폰도 행사인지 판별 */
export function isCyclingEvent(text) {
  const raw = String(text || '');
  if (TRIATHLON_EVENT_RE.test(raw) && !/자전거\s*대회|그란폰도|사이클\s*대회/.test(raw)) {
    return false;
  }
  return CYCLING_EVENT_RE.test(raw);
}

/** 실제 철인3종/트라이애슬론/듀애슬론/아쿠아슬론 행사인지 판별 */
export function isTriathlonEvent(text) {
  return TRIATHLON_EVENT_RE.test(String(text || ''));
}

/** 특정 스포츠 종목('SWIMMING' | 'RUNNING' | 'CYCLING' | 'TRIATHLON') 해당 여부 판별 */
export function matchesSportCategory(text, sport = 'SWIMMING') {
  switch (sport) {
    case 'SWIMMING':
      return isSwimEvent(text);
    case 'RUNNING':
      return isRunningEvent(text);
    case 'CYCLING':
      return isCyclingEvent(text);
    case 'TRIATHLON':
      return isTriathlonEvent(text);
    default:
      return isSwimEvent(text);
  }
}

/** 텍스트에서 스포츠 종목 카테고리 자동 감지 */
export function detectSportCategory(text) {
  if (isTriathlonEvent(text)) return 'TRIATHLON';
  if (isSwimEvent(text)) return 'SWIMMING';
  if (isCyclingEvent(text)) return 'CYCLING';
  if (isRunningEvent(text)) return 'RUNNING';
  return null;
}

/** 스포츠 경기·대회 성격인지 판별 (수영·러닝·자전거·철인 포함) */
export function isSportsEvent(text) {
  const raw = String(text || '');
  return (
    isSwimEvent(raw) ||
    isRunningEvent(raw) ||
    isCyclingEvent(raw) ||
    isTriathlonEvent(raw) ||
    OTHER_SPORT_EVENT_RE.test(raw)
  );
}

/**
 * 대회 제목에서 지자체 코드 기준(2단계 시군구 vs 1단계 광역시도) 매칭 정보 추출
 * - 어느 홈페이지에서 홍보되었는지와 무관하게 대회 제목의 지자체명을 지자체 코드와 매칭한다.
 */
export function matchTitleMunicipalityByCode(title = '') {
  const cleanTitle = stripSwimFalsePositives(String(title || ''));

  // 1) 제목에 2단계 시군구명이 명시된 경우 -> 무조건 시군구(level: 1)
  for (const rule of TITLE_SIGUNGU_CODE_RULES) {
    if (rule.re.test(cleanTitle)) {
      return {
        level: 1,
        lDongRegnCd: rule.lDongRegnCd,
        lDongSignguCd: rule.lDongSignguCd,
        sigunguName: rule.sigunguName,
      };
    }
  }

  // 2) 제목에 1단계 광역시·도명이 명시된 경우 -> 광역시도(level: 2)
  for (const rule of TITLE_PROVINCE_CODE_RULES) {
    if (rule.re.test(cleanTitle)) {
      return {
        level: 2,
        lDongRegnCd: rule.lDongRegnCd,
        lDongSignguCd: rule.lDongSignguCd,
        sigunguName: rule.sigunguName,
        metroShort: rule.metroShort,
      };
    }
  }

  return null;
}

/**
 * 스포츠 행사 범위(0~3: 동네 / 시군구 / 광역시도 / 세계·대한연맹) 산정
 * - 핵심: 어느 홈페이지(organizer/source)에서 홍보되었는지가 아니라,
 *   대회 제목에 나타난 지자체 코드(2단계 시군구=1 vs 1단계 광역시도=2)를 최우선 기준으로 삼는다.
 */
export function computePromoLevel(params = {}) {
  const { explicitLevel, title, invitation, summary, organizer } = params;

  const rawText = [title, invitation, summary, organizer].filter(Boolean).join(' ');
  const sport = detectSportCategory(rawText);

  if (!sport) {
    return 0;
  }

  const cleanTitle = stripSwimFalsePositives(stripRunningFalsePositives(String(title || '')));

  // 1) 개별 수영장/센터/크루/강습회는 '동네'(0) 우선 판별
  if (LV0_LOCAL_INDIVIDUAL_RE.test(cleanTitle)) {
    return 0;
  }

  // 1-1) 개최지와 무관한 전국 대회 브랜드는 지역명 규칙보다 먼저 '세계/대한연맹'(3)
  if (NATIONAL_BRAND_FIRST_RE.test(cleanTitle)) {
    return 3;
  }

  // 2) 대회 제목에 지자체명이 있으면 지자체 코드 테이블(2단계 시군구=1, 1단계 광역시도=2)에 맞춰 고정!
  //    (예: '김천 전국수영대회', '김천 꿈나무 전국수영대회', '김천 전국 마스터즈' -> 김천시는 2단계 시군구 코드이므로 1)
  //    (예: '경상북도 학생 체육대회', '경상북도수영연맹회장배' -> 경상북도는 1단계 광역시도 코드이므로 2)
  const titleMuniMatch = matchTitleMunicipalityByCode(cleanTitle);
  if (titleMuniMatch) {
    return titleMuniMatch.level;
  }

  // 3) 구청장배/군수배 일반 키워드 -> '시군구'(1)
  if (LV1_GENERIC_TITLE_RE.test(cleanTitle)) {
    return 1;
  }

  // 4) 교육감배/도지사배/광역시장배/도민체전 일반 키워드 -> '광역시도'(2)
  if (LV2_GENERIC_TITLE_RE.test(cleanTitle)) {
    return 2;
  }

  // 5) 지자체명이 붙지 않은 세계연맹/대한연맹 전국 공인 선수권·선발전 -> '세계/대한연맹'(3)
  if (LV3_WORLD_NATIONAL_RE.test(cleanTitle)) {
    return 3;
  }

  // 6) 명시적 지정값이 있으면 존중
  if (explicitLevel !== undefined && explicitLevel !== null) {
    const lv = Number(explicitLevel);
    if ([0, 1, 2, 3].includes(lv)) return lv;
  }

  // 7) 기본 대회는 '시군구'(1)로 분류
  return 1;
}

/**
 * 모집공고 / 개최요강 / 참가신청서 등 PDF·HWP 첨부파일 링크인지 판별 (붉은색 아이콘 출력 대상)
 */
export function isAttachmentLink(url = '', label = '') {
  const u = String(url || '').trim();
  const l = String(label || '').trim();
  if (!u) return false;

  if (/\.(pdf|hwp|hwpx|doc|docx)(\?|#|$)/i.test(u)) return true;
  if (/\/common\/download\/|\/bbs\/download\.php|\/DataFile\/|\/Data\/.*\.(pdf|hwp)/i.test(u)) {
    return true;
  }
  if (/\.(pdf|hwp|hwpx)/i.test(l) || /개최요강|모집공고|참가요강|참가신청서|대회요강|요강\s*다운/i.test(l)) {
    return true;
  }
  return false;
}

/**
 * 구체적인 해당 이벤트 공지/홍보 페이지(또는 첨부공고)가 수집된 링크인지 판별
 */
export function isSpecificEventLink(url = '', label = '') {
  const u = String(url || '').trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;

  if (isAttachmentLink(u, label)) return true;

  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname || '/';
    const search = parsed.search || '';

    if (
      /\/schedule\/list\.php$/i.test(path) ||
      /\/schedule_index\.html$/i.test(path) ||
      /\/contest\/contest_list(\/|$)/i.test(path) ||
      (/^\/events\/tour\/?$/i.test(path) && !search) ||
      (/^\/news\/schedule\/?$/i.test(path) && !search) ||
      (/^\/11\/?$/i.test(path) && !search)
    ) {
      return false;
    }

    if (
      /[?&](idx|no|wr_id|uid|seq|boardId|nttId|dataSid|tourcd|r_idx|festacode|cid|eventId|id|b_idx|code|num|p_idx)=/i.test(
        search
      )
    ) {
      return true;
    }

    if (
      /\/11\/\d+/i.test(path) ||
      /\/contest_view\/\d+/i.test(path) ||
      /BoardView|view\.do|detail\.do|View\.asp|view\.php|overview\/|info\//i.test(path + search)
    ) {
      return true;
    }

    if (host.endsWith('.go.kr')) {
      if (
        path === '/' ||
        /^\/(main|index|tour|culture|kor|portal|web)(\/main)?(\.(do|web|jsp|html|php))?\/?$/i.test(
          path
        )
      ) {
        return false;
      }
    }

    const genericFederationHosts = [
      'www.korswim.co.kr',
      'korswim.co.kr',
      'www.worldaquatics.com',
      'worldaquatics.com',
      'www.triathlon.or.kr',
      'triathlon.or.kr',
      'www.cycling.or.kr',
      'cycling.or.kr',
      'bikelife.cycling.or.kr',
      'www.kaaf.or.kr',
      'kaaf.or.kr',
      'www.roadrun.co.kr',
      'roadrun.co.kr',
      'www.marathon.pe.kr',
      'marathon.pe.kr',
      'www.sfinder.co.kr',
      'sfinder.co.kr',
      'www.seoulsports.or.kr',
      'www.uctf.or.kr',
      'gtp.ghct.or.kr',
    ];
    if (genericFederationHosts.includes(host) && (path === '/' || path === '')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

const REGN_CODE_TO_SHORT_NAME = {
  '11': '서울',
  '26': '부산',
  '27': '대구',
  '28': '인천',
  '12': '광주',
  '29': '광주',
  '30': '대전',
  '31': '울산',
  '36110': '세종',
  '36': '세종',
  '41': '경기',
  '51': '강원',
  '42': '강원',
  '43': '충북',
  '44': '충남',
  '52': '전북',
  '45': '전북',
  '46': '전남',
  '47': '경북',
  '48': '경남',
  '50': '제주',
};

/**
 * 대회 카드 및 달력·지도 표기용 지자체 단축명 추출
 * - 지자체 코드에서 검색되는 범위(광역시도=2 vs 시군구=1)에 맞추어 지자체 이름을 일관되게 반환한다.
 */
export function getEventCityShortName(ev = {}) {
  const lv = ev.promoLevel;
  const regCd = String(ev.lDongRegnCd || '').trim();
  const sigunguName = String(ev.sigunguName || '').trim();
  const regionName = String(ev.regionName || '').trim();

  // 1) '광역시도'(level 2)인 경우: 지자체 코드의 1단계 광역시·도 단축명 반환
  if (lv === 2) {
    const titleMatch = matchTitleMunicipalityByCode(ev.title || '');
    if (titleMatch && titleMatch.level === 2 && titleMatch.metroShort) {
      return titleMatch.metroShort;
    }
    if (REGN_CODE_TO_SHORT_NAME[regCd]) {
      return REGN_CODE_TO_SHORT_NAME[regCd];
    }
    if (regionName) {
      return regionName.replace(/특별시|광역시|특별자치시|특별자치도|도$/g, '').trim();
    }
  }

  // 2) '시군구'(level 1)인 경우: 지자체 코드의 2단계 시·군·구 단축명 반환
  if (lv === 1) {
    const titleMatch = matchTitleMunicipalityByCode(ev.title || '');
    if (titleMatch && titleMatch.level === 1 && titleMatch.sigunguName) {
      return titleMatch.sigunguName.replace(/(?:특례)?[시군]$/g, '').trim() || titleMatch.sigunguName;
    }
    if (sigunguName && !/전체|본청/.test(sigunguName)) {
      const firstToken = sigunguName.split(/\s+/)[0];
      return firstToken.replace(/(?:특례)?[시군]$/g, '').trim() || firstToken;
    }
  }

  // 3) 그 외('세계/대한연맹' level 3, '동네' level 0): 실제 개최지 시군구 또는 광역시도 표시
  if (sigunguName && !/전체|본청/.test(sigunguName)) {
    const firstToken = sigunguName.split(/\s+/)[0];
    return firstToken.replace(/(?:특례)?[시군]$/g, '').trim() || firstToken;
  }

  if (REGN_CODE_TO_SHORT_NAME[regCd]) {
    return REGN_CODE_TO_SHORT_NAME[regCd];
  }

  return regionName.replace(/특별시|광역시|특별자치시|특별자치도|도$/g, '').trim() || '전국';
}

/**
 * 행사가 아니라 대회 운영 공지(결과·대진표·일정 변경·취소/연기 알림 등)인 게시글 제목
 * - 같은 대회의 본 행사 게시글과 중복되거나, 대회 자체가 아니므로 스포츠 행사 목록에서 제외한다.
 */
const SPORTS_NOTICE_TITLE_RE =
  /경기\s*결과|대회\s*결과|결과\s*(?:및|공지|안내|발표|보고|알림)|결과지|종합\s*성적|일정\s*변경|변경\s*(?:통보|안내|공지|알림)|경기\s*순서|대진표|조\s*편성|기록\s*(?:공지|발표|결과)|순위\s*발표|시상\s*(?:결과|내역)|(?:취소|연기|순연)\s*(?:안내|공지|알림|통보)|무기한\s*연기|심판\s*배정|참가\s*(?:신청\s*)?현황|참가\s*신청(?:서)?\s*(?:열람|명단)|명단\s*(?:공지|발표|안내)|입상자|수상자\s*발표|레인\s*배정|엔트리\s*(?:공지|발표)|선착순\s*마감|접수\s*마감|마감되었습니다|\s마감(?:\s*수영대회)?$|(?:상장|사장|메달)\s*(?:,\s*메달\s*|및\s*메달\s*)?(?:배부|수령)|자리\s*순서|입장\s*순서|대표자\s*회의|감독자\s*회의|비등록선수\s*연습|적응\s*훈련|대비\s*훈련|광고\s*신청|최종\s*알림글/;

/** 일반 행사 중 결과 발표성 게시글 (예: '경연대회 결과') */
const GENERAL_RESULT_NOTICE_RE = /결과$|결과\s*(?:공지|발표|알림)$/;

/**
 * 행사가 아닌 공지성 게시글인지 판별
 * @param {string} title
 * @param {boolean} sports 스포츠 행사 여부
 */
export function isNoticeOnlyPost(title = '', sports = false) {
  const t = String(title || '').trim();
  if (GENERAL_RESULT_NOTICE_RE.test(t)) return true;
  return sports && SPORTS_NOTICE_TITLE_RE.test(t);
}

/**
 * 날짜를 알 수 없어 크롤러가 연중(YYYY0101~YYYY1231)으로 채운 일정인지 판별
 */
export function isPlaceholderFullYearRange(startDate = '', endDate = '') {
  const s = String(startDate || '');
  const e = String(endDate || '');
  return s.length >= 8 && e.length >= 8 && s.endsWith('0101') && e.endsWith('1231') && s.slice(0, 4) === e.slice(0, 4);
}

/**
 * 부산수영연맹 게시판에서 기존 크롤러가 '경기순서/대진표/종합성적표/개최예정' 접미어를 잘라내어
 * 일반 대회처럼 남았던 후속 운영 공지 ID 목록 (실제 대회 개최 공지 본문은 별도 ID로 존재)
 */
const BUSAN_SWIM_NOTICE_ONLY_IDS = new Set([
  'swim-busan-idx-864', // 선착순 마감
  'swim-busan-idx-850', // 5대 인기종목 경기순서 및 대진표(최종)
  'swim-busan-idx-844', // 제48회 회장배 종합성적표
  'swim-busan-idx-843', // 제48회 회장배 비등록선수 연습x
  'swim-busan-idx-839', // 제48회 회장배 경기순서, 대진표(최종본)
  'swim-busan-idx-831', // 제5회 부산시장배 경기순서, 대진표(최종본)
  'swim-busan-idx-830', // 제5회 부산시장배 선착순 마감
  'swim-busan-idx-810', // 제3회 체육회장배 상장 및 메달 배부 안내
  'swim-busan-idx-808', // 제3회 체육회장배 팀 자리 순서 명단
  'swim-busan-idx-806', // 제3회 체육회장배 경기순서 및 대진표(최종본)
  'swim-busan-idx-789', // 제4회 부산시장배 상장 및 메달 배부안내
  'swim-busan-idx-787', // 제43회 교육감배 경기순서 및 대진표(최종본)
  'swim-busan-idx-782', // 제4회 부산시장배 상장 및 메달 수령 안내
  'swim-busan-idx-781', // 제4회 부산시장배 자리순서(수정) 명단
  'swim-busan-idx-778', // 제4회 부산시장배 경기순서, 대진표(최종본)
  'swim-busan-idx-774', // 제4회 부산시장배 선착순 마감
  'swim-busan-idx-742', // 제2회 체육회장배 상장,메달 배부안내
  'swim-busan-idx-737', // 제2회 체육회장배 상장 및 메달 배부시기 안내
  'swim-busan-idx-732', // 제2회 체육회장배 대진표(최종본)
  'swim-busan-idx-730', // 제2회 체육회장배 마감
  'swim-busan-idx-729', // 제2회 체육회장배 광고 신청
  'swim-busan-idx-726', // 제2회 체육회장배 개최예정 (728 본 공지와 중복)
  'swim-busan-idx-717', // 제42회 교육감배 경기순서, 대진표(최종본)
  'swim-busan-idx-704', // 제3회 부산시장배 상장 및 메달 배부
  'swim-busan-idx-698', // 제3회 부산시장배 대표자 회의 자료 배부
  'swim-busan-idx-697', // 2024 부산초중학교 수영대회 대진표
  'swim-busan-idx-695', // 제3회 부산시장배 경기순서, 대진표(최종본)
  'swim-busan-idx-694', // 제3회 부산시장배 경기순서, 대진표
  'swim-busan-idx-693', // 시장배 접수 마감
]);

/**
 * 부산수영연맹 주요 대회 공지(idx)별 본문 내 실제 대회 개최일 및 정식 명칭 보정 맵
 * (목록의 '공지 등록일'로 잘못 저장된 항목을 본문 '날짜/일시' 기준 실제 대회일로 보정)
 */
const BUSAN_SWIM_VERIFIED_FIXES = {
  'swim-busan-idx-862': {
    title: '제44회 부산광역시교육감배 초·중학교 수영대회',
    startDate: '20261121',
    endDate: '20261121',
    scheduleNote: '2026년 11월 21일(토) 오전 9시 · 부산 사직실내수영장',
  },
  'swim-busan-idx-860': {
    title: '제4회 부산광역시체육회장배 생활체육 수영대회',
    startDate: '20261129',
    endDate: '20261129',
    scheduleNote: '2026년 11월 29일(일) 사직실내수영장 (선착순 1,000명)',
  },
  'swim-busan-idx-845': {
    title: '부산광역시 5대 인기종목 수영대회',
    startDate: '20260919',
    endDate: '20260919',
    scheduleNote: '2026년 9월 19일(토) 08:30 · 부산 사직실내수영장',
  },
  'swim-busan-idx-838': {
    title: '제48회 부산광역시수영연맹회장배 수영대회 겸 제107회 전국체육대회 부산예선대회',
    startDate: '20260704',
    endDate: '20260704',
    scheduleNote: '2026년 7월 4일(토) 09:30 · 부산 사직실내수영장',
  },
  'swim-busan-idx-825': {
    title: '제5회 부산광역시장배 생활체육 수영대회',
    startDate: '20260503',
    endDate: '20260503',
    scheduleNote: '2026년 5월 3일(일) 사직실내수영장 (선착순 1,000명)',
  },
  'swim-busan-idx-812': {
    title: '2026년 부산초·중학생 체육대회 수영대회 (제55회 전국소년체육대회 선발전)',
    startDate: '20260321',
    endDate: '20260321',
    scheduleNote: '2026년 3월 21일(토) · 부산 사직실내수영장',
  },
  'swim-busan-idx-797': {
    title: '제3회 부산광역시체육회장배 전국 생활체육 수영대회',
    startDate: '20251130',
    endDate: '20251130',
    scheduleNote: '2025년 11월 30일(일) · 부산 사직실내수영장 (선착순 1,000명)',
  },
  'swim-busan-idx-783': {
    title: '제43회 부산광역시교육감배 초·중학교 수영대회',
    startDate: '20250816',
    endDate: '20250816',
    scheduleNote: '2025년 8월 16일(토) · 부산 사직실내수영장',
  },
  'swim-busan-idx-770': {
    title: '제4회 부산광역시장배 전국 생활체육 수영대회',
    startDate: '20250713',
    endDate: '20250713',
    scheduleNote: '2025년 7월 13일(일) · 부산 사직실내수영장',
  },
  'swim-busan-idx-751': {
    title: '2025년 부산초·중학생 체육대회 수영대회 (전국소년체육대회 부산대표선발전)',
    startDate: '20250406',
    endDate: '20250406',
    scheduleNote: '2025년 4월 6일(일) · 창원실내수영장',
  },
  'swim-busan-idx-728': {
    title: '제2회 부산광역시체육회장배 생활체육 수영대회',
    startDate: '20240901',
    endDate: '20240901',
    scheduleNote: '2024년 9월 1일(일) · 부산 사직실내수영장',
  },
  'swim-busan-idx-712': {
    title: '제42회 부산광역시교육감기 초·중학교 수영대회',
    startDate: '20240713',
    endDate: '20240713',
    scheduleNote: '2024년 7월 13일(토) · 부산 사직실내수영장',
  },
  'swim-busan-idx-710': {
    title: '제46회 부산광역시수영연맹회장배 및 제105회 전국체육대회 부산선발전 수영대회',
    startDate: '20240622',
    endDate: '20240622',
    scheduleNote: '2024년 6월 22일(토) 오전 9시 30분 · 부산 사직실내수영장',
  },
  'swim-busan-idx-687': {
    title: '제3회 부산광역시장배 생활체육 수영대회',
    startDate: '20240331',
    endDate: '20240331',
    scheduleNote: '2024년 3월 31일(일) · 부산 사직실내수영장 (선착순 1,000명)',
  },
};

/**
 * [단일 정규화 지점] 모든 크롤러 결과와 프런트엔드 로드 시 공통으로 적용하는 행사 문서 정규화
 * - 스포츠 행사:
 *   - 연중 더미 일정(0101~1231)이면 null 반환(제외) → '매일 김천·거제 표시' 버그 재발 방지
 *   - 대회 제목의 지자체명을 지자체 코드(1단계 광역시도 / 2단계 시군구)로 동기화하고 범위(promoLevel) 재계산
 *     → 어느 홈페이지에서 홍보되었는지와 무관 ('김천이 두 범위에 동시 노출' 버그 재발 방지)
 * - 일반 행사:
 *   - 연중 더미 일정이면 eventDate.dateUnknown = true 로 표시 (달력·주차 지도에서 매일 표시되지 않도록)
 *
 * @param {any} doc FirestoreEventDoc 형태의 행사 문서
 * @returns {any | null} 정규화된 문서 (제외 대상이면 null)
 */
export function normalizeEventDoc(doc) {
  if (!doc || !doc.id || !doc.title) return null;

  if (!doc.manualEdited && BUSAN_SWIM_NOTICE_ONLY_IDS.has(doc.id)) {
    return null;
  }

  let workingDoc = doc;
  const busanFix = !doc.manualEdited ? BUSAN_SWIM_VERIFIED_FIXES[doc.id] : null;
  if (busanFix) {
    workingDoc = {
      ...doc,
      title: busanFix.title,
      eventDate: {
        ...doc.eventDate,
        startDate: busanFix.startDate,
        endDate: busanFix.endDate,
        scheduleNote: busanFix.scheduleNote,
      },
      invitation: `[부산광역시수영연맹] ${busanFix.title} 개최 안내 (${busanFix.scheduleNote})`,
    };
  }

  const startDate = workingDoc.eventDate?.startDate || '';
  const endDate = workingDoc.eventDate?.endDate || '';
  const fullText = `${workingDoc.title || ''} ${workingDoc.invitation || ''} ${workingDoc.organizer?.host || ''}`;
  const placeholderDate = isPlaceholderFullYearRange(startDate, endDate);
  const sports = isSportsEvent(fullText);

  // 대회 결과·대진표·일정 변경 같은 운영 공지는 행사가 아니므로 제외 (직접 편집한 문서는 유지)
  if (!workingDoc.manualEdited && isNoticeOnlyPost(workingDoc.title, sports)) {
    return null;
  }

  if (!sports) {
    if (!placeholderDate) return workingDoc;
    return {
      ...workingDoc,
      eventDate: { ...workingDoc.eventDate, dateUnknown: true },
    };
  }

  if (placeholderDate) {
    return null;
  }

  // 사용자가 상세 화면에서 직접 편집한 문서는 지자체·범위를 자동으로 덮어쓰지 않는다
  if (workingDoc.manualEdited) {
    return workingDoc;
  }

  const titleMatch = matchTitleMunicipalityByCode(workingDoc.title);
  const synced = titleMatch
    ? {
        ...workingDoc,
        lDongRegnCd: titleMatch.lDongRegnCd,
        lDongSignguCd: titleMatch.lDongSignguCd,
        sigunguName: titleMatch.sigunguName,
      }
    : workingDoc;

  return {
    ...synced,
    promoLevel: computePromoLevel({
      title: synced.title,
      invitation: synced.invitation,
      organizer: synced.organizer?.host,
      lDongRegnCd: synced.lDongRegnCd,
      addr1: synced.addr1,
    }),
  };
}
