import { UnifiedEventItem } from '../types/event';
import publicSwimmingPoolsJson from './publicSwimmingPools.json';

export type PoolCourseLength = '50m' | '25m';

export type PoolDatasetStatus =
  | 'BOTH'
  | 'NEW_2025'
  | 'ONLY_2021'
  | 'COMPETITION_EXTRA';

export interface SwimmingPoolSpec {
  id: string;
  name: string;
  rawName?: string;
  name2021?: string;
  datasetStatus?: PoolDatasetStatus;
  courseLength: PoolCourseLength;
  lanes: string;
  hasDivingPool?: boolean;
  indoorOutdoor?: string;
  certification: string;
  regionName: string;
  sigunguName: string;
  lDongRegnCd: string;
  lDongSignguCd: string;
  address: string;
  mapX: number;
  mapY: number;
  owner?: string;
  operator?: string;
  manager?: string;
  homepage?: string;
  totAreaSqm?: number;
  seats?: number;
  builtYear?: string;
  renovYear?: string;
  notes?: string;
  /** 이벤트의 addr1, title, invitation, scheduleNote에서 해당 수영장을 식별하는 정규식 */
  matchRe: RegExp;
}

export interface SwimmingPoolWithStats extends SwimmingPoolSpec {
  totalEventCount: number;
  filteredEventCount: number;
  events: UnifiedEventItem[];
}

export const MCST_POOL_COMPARISON_SUMMARY = {
  total2021: 492,
  count50m2021: 55,
  count25m2021: 412,
  other2021: 25,
  total2025: 579,
  count50m2025: 62,
  count25m2025: 484,
  other2025: 33,
  netDiff: 87,
  fixedShiftedRows2025: 49,
  dedupedRows2025: 202,
} as const;

export const SWIMMING_POOLS_CATALOG: SwimmingPoolSpec[] = [
  {
    id: 'pool-busan-sajik',
    name: '부산 사직실내수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀 25m×25m, 25m 보조풀)',
    certification: '대한수영연맹 1급 공인',
    regionName: '부산광역시',
    sigunguName: '동래구',
    lDongRegnCd: '26',
    lDongSignguCd: '260',
    address: '부산광역시 동래구 종합운동장로 29 부산 사직실내수영장',
    mapX: 129.0604,
    mapY: 35.1928,
    homepage: 'https://www.busan.go.kr/stadium/index',
    notes: '부산광역시수영연맹 정기 대회·시장배·교육감배·체육회장배 주 경기장',
    matchRe: /사직\s*실내\s*수영장|사직수영장|종합운동장로\s*29/,
  },
  {
    id: 'pool-gimcheon-indoor',
    name: '김천실내수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀 33m×25m, 25m×6레인 보조풀)',
    certification: '대한수영연맹 1급 공인 · 국제규격',
    regionName: '경상북도',
    sigunguName: '김천시',
    lDongRegnCd: '47',
    lDongSignguCd: '150',
    address: '경상북도 김천시 운동장길 1 김천실내수영장',
    mapX: 128.0865,
    mapY: 36.1398,
    homepage: 'https://www.gc.go.kr/',
    notes: '국가대표 선발전, 전국수영선수권대회, 김천전국수영대회·마스터즈 주 경기장',
    matchRe: /김천\s*실내\s*수영장|운동장길\s*1\s*김천/,
  },
  {
    id: 'pool-ulsan-munsu',
    name: '울산 문수실내수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀, 25m 보조풀)',
    certification: '대한수영연맹 1급 공인',
    regionName: '울산광역시',
    sigunguName: '남구',
    lDongRegnCd: '31',
    lDongSignguCd: '140',
    address: '울산광역시 남구 문수로 44 울산 문수실내수영장',
    mapX: 129.2638,
    mapY: 35.5342,
    homepage: 'https://www.ulsan.go.kr/',
    notes: '울산광역시장배·교육감배·MBC전국수영대회·전국체전 주 경기장',
    matchRe: /문수\s*실내\s*수영장|문수로\s*44/,
  },
  {
    id: 'pool-seoul-olympic',
    name: '서울 올림픽수영장 (잠실수영장)',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀, 50m×25m 연습풀)',
    certification: '국제수영연맹(World Aquatics) · 대한수영연맹 공인',
    regionName: '서울특별시',
    sigunguName: '송파구',
    lDongRegnCd: '11',
    lDongSignguCd: '710',
    address: '서울특별시 송파구 올림픽로 424 올림픽수영장 / 잠실제1수영장',
    mapX: 127.1219,
    mapY: 37.5178,
    homepage: 'https://www.ksponco.or.kr/sports/olparkswim',
    notes: '서울특별시장기, 서울시연맹회장배, 서울오픈, 송파구청장기 등 개최',
    matchRe: /올림픽\s*수영장|잠실\s*제?1?\s*수영장|올림픽로\s*424/,
  },
  {
    id: 'pool-suwon-worldcup',
    name: '수원월드컵경기장 스포츠센터 수영장 (유윤스포츠)',
    courseLength: '50m',
    lanes: '50m × 8레인 (수심 1.3m~1.8m)',
    certification: '경기도 주요 공인/생활체육 대회 경기장',
    regionName: '경기도',
    sigunguName: '수원시 팔달구',
    lDongRegnCd: '41',
    lDongSignguCd: '110',
    address: '경기도 수원시 팔달구 월드컵로 310 수원월드컵경기장 스포츠센터 수영장',
    mapX: 127.0368,
    mapY: 37.2865,
    homepage: 'https://www.suwon.go.kr/',
    notes: '경기도수영연맹 회장배·교육감배·전국소년체전 경기도 선발전 주 경기장 (다이빙풀 보유)',
    matchRe: /수원\s*월드컵\s*(?:경기장|다이빙풀|스포츠센터)|월드컵로\s*310|창룡대로\s*210번길\s*41/,
  },
  {
    id: 'pool-jeju-complex',
    name: '제주종합경기장 실내수영장',
    courseLength: '50m',
    lanes: '50m × 8레인 (다이빙풀 보유)',
    certification: '대한수영연맹 공인',
    regionName: '제주특별자치도',
    sigunguName: '제주시',
    lDongRegnCd: '50',
    lDongSignguCd: '110',
    address: '제주특별자치도 제주시 서광로2길 24 제주종합경기장 실내수영장',
    mapX: 126.5152,
    mapY: 33.4979,
    homepage: 'https://www.jejusi.go.kr/',
    notes: '제주한라배 전국수영대회, 제주도연맹회장배, 수애기배 마스터즈 주 경기장',
    matchRe: /제주\s*종합\s*경기장\s*실내\s*수영장|서광로2길\s*24/,
  },
  {
    id: 'pool-changwon-indoor',
    name: '창원실내수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀 보유)',
    certification: '대한수영연맹 1급 공인',
    regionName: '경상남도',
    sigunguName: '창원시 성산구',
    lDongRegnCd: '48',
    lDongSignguCd: '120',
    address: '경상남도 창원시 성산구 원이대로 450 창원실내수영장',
    mapX: 128.6644,
    mapY: 35.2325,
    homepage: 'https://www.cwsisul.or.kr/',
    notes: '창원특례시장배 전국 마스터즈, 경상남도지사배, 창원시연맹회장배 주 경기장',
    matchRe: /창원\s*실내\s*수영장|원이대로\s*450/,
  },
  {
    id: 'pool-gwangju-nambu',
    name: '광주 남부대시립국제수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (경영풀 2면 + 다이빙풀)',
    certification: 'World Aquatics 국제공인 1급 (2019 세계수영선수권 주경기장)',
    regionName: '광주광역시',
    sigunguName: '광산구',
    lDongRegnCd: '12',
    lDongSignguCd: '200',
    address: '광주광역시 광산구 첨단중앙로 23 남부대시립국제수영장',
    mapX: 126.8435,
    mapY: 35.2179,
    homepage: 'https://www.nambu.ac.kr/',
    notes: '광주 전국수영선수권대회, 대통령배, 마스터즈 전국대회 주 경기장',
    matchRe: /남부대\s*시립\s*국제\s*수영장|남부대|첨단중앙로\s*23/,
  },
  {
    id: 'pool-incheon-munhak',
    name: '인천 문학박태환수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀, 50m×6레인 보조풀)',
    certification: 'World Aquatics 국제공인 1급 (아시안게임·경영월드컵 경기장)',
    regionName: '인천광역시',
    sigunguName: '미추홀구',
    lDongRegnCd: '28',
    lDongSignguCd: '177',
    address: '인천광역시 미추홀구 매소홀로 618 문학박태환수영장',
    mapX: 126.6908,
    mapY: 37.4351,
    homepage: 'https://www.insiseol.or.kr/',
    notes: 'World Aquatics 경영 월드컵 인천, 아레나 코리아 마스터즈, 인천시연맹회장배 개최',
    matchRe: /문학\s*박태환\s*수영장|박태환\s*수영장|매소홀로\s*618/,
  },
  {
    id: 'pool-gwangyang-seonghwang',
    name: '광양 성황스포츠센터 수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (관람석 800석)',
    certification: '대한수영연맹 공인',
    regionName: '전라남도',
    sigunguName: '광양시',
    lDongRegnCd: '46',
    lDongSignguCd: '230',
    address: '전라남도 광양시 성황길 46 광양성황스포츠센터 수영장',
    mapX: 127.6958,
    mapY: 34.9407,
    homepage: 'https://gwangyang.go.kr/',
    notes: '광양만배 전국수영대회, 전라남도 수영대회 주요 경기장',
    matchRe: /광양\s*성황\s*스포츠\s*센터|광양수영장|성황길\s*46/,
  },
  {
    id: 'pool-mokpo-indoor',
    name: '목포실내수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀, 보조풀 보유)',
    certification: '대한수영연맹 1급 공인 (제104회 전국체전 경기장)',
    regionName: '전라남도',
    sigunguName: '목포시',
    lDongRegnCd: '46',
    lDongSignguCd: '110',
    address: '전라남도 목포시 대양로 286 목포실내수영장',
    mapX: 126.4161,
    mapY: 34.8118,
    homepage: 'https://www.mokpo.go.kr/',
    notes: '목포유달산배 전국마스터즈, 전라남도지사배, 전남학생종합체육대회 주 경기장',
    matchRe: /목포\s*실내\s*수영장|대양로\s*286/,
  },
  {
    id: 'pool-jeonju-wansan',
    name: '전주완산수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀 보유)',
    certification: '대한수영연맹 1급 공인',
    regionName: '전북특별자치도',
    sigunguName: '전주시 완산구',
    lDongRegnCd: '52',
    lDongSignguCd: '110',
    address: '전북특별자치도 전주시 완산구 백제대로 310 전주완산수영장',
    mapX: 127.1197,
    mapY: 35.8124,
    homepage: 'https://www.jjss.or.kr/',
    notes: '동아수영대회, 대통령배, 전북 수영대회 주 경기장',
    matchRe: /전주\s*완산\s*수영장|백제대로\s*310/,
  },
  {
    id: 'pool-daejeon-yongun',
    name: '대전 용운국제수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀 보유)',
    certification: '대한수영연맹 1급 공인',
    regionName: '대전광역시',
    sigunguName: '동구',
    lDongRegnCd: '30',
    lDongSignguCd: '110',
    address: '대전광역시 동구 동부로 138 용운국제수영장',
    mapX: 127.4631,
    mapY: 36.3275,
    homepage: 'https://www.djsiseol.or.kr/',
    notes: '전국마스터즈수영대회, 대전시장배 및 중부권 전국대회 경기장',
    matchRe: /용운\s*국제\s*수영장|동부로\s*138/,
  },
  {
    id: 'pool-asan-baemi',
    name: '아산 배미수영장 (이순신수영장)',
    courseLength: '50m',
    lanes: '50m × 10레인',
    certification: '대한수영연맹 공인',
    regionName: '충청남도',
    sigunguName: '아산시',
    lDongRegnCd: '44',
    lDongSignguCd: '200',
    address: '충청남도 아산시 배미로 34 아산배미수영장',
    mapX: 126.9882,
    mapY: 36.7836,
    homepage: 'https://www.asanfmc.or.kr/',
    notes: '전국수영대회 및 충남 권역 수영대회 개최지',
    matchRe: /아산\s*배미\s*수영장|배미로\s*34/,
  },
  {
    id: 'pool-cheongju-indoor',
    name: '청주실내수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀 보유)',
    certification: '대한수영연맹 공인',
    regionName: '충청북도',
    sigunguName: '청주시 흥덕구',
    lDongRegnCd: '43',
    lDongSignguCd: '110',
    address: '충청북도 청주시 흥덕구 직지대로 755 청주실내수영장',
    mapX: 127.4701,
    mapY: 36.6424,
    homepage: 'https://www.cjuc.or.kr/',
    notes: 'MBC배 전국수영대회 및 충북 수영연맹 대회 경기장',
    matchRe: /청주\s*실내\s*수영장|직지대로\s*755/,
  },
  {
    id: 'pool-daegu-duryu',
    name: '대구 두류수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀 보유)',
    certification: '대한수영연맹 1급 공인',
    regionName: '대구광역시',
    sigunguName: '달서구',
    lDongRegnCd: '27',
    lDongSignguCd: '290',
    address: '대구광역시 달서구 공원순환로 36 대구 두류수영장',
    mapX: 128.5579,
    mapY: 35.8482,
    homepage: 'https://www.dpfc.or.kr/',
    notes: '한라배·대구시장배 및 대구광역시 수영연맹 대회 경기장',
    matchRe: /두류\s*수영장|공원순환로\s*36/,
  },
  {
    id: 'pool-pohang-indoor',
    name: '포항실내수영장',
    courseLength: '50m',
    lanes: '50m × 8레인',
    certification: '대한수영연맹 공인',
    regionName: '경상북도',
    sigunguName: '포항시 남구',
    lDongRegnCd: '47',
    lDongSignguCd: '110',
    address: '경상북도 포항시 남구 희망대로 810 포항실내수영장',
    mapX: 129.3591,
    mapY: 36.0052,
    homepage: 'https://www.phsisul.org/',
    notes: '경북도민체전 및 포항시 수영대회 개최지',
    matchRe: /포항\s*실내\s*수영장|희망대로\s*810/,
  },
  // ==================== 25m 단수로 수영장 ====================
  {
    id: 'pool-chuncheon-national',
    name: '춘천 국민체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '강원권 시·도 대회 및 생활체육 경기장',
    regionName: '강원특별자치도',
    sigunguName: '춘천시',
    lDongRegnCd: '51',
    lDongSignguCd: '110',
    address: '강원특별자치도 춘천시 우석로 102-3 춘천 국민체육센터 수영장',
    mapX: 127.7458,
    mapY: 37.8643,
    notes: '강원특별자치도지사배·교육감기·회장기 수영대회 개최지',
    matchRe: /춘천\s*국민\s*체육\s*센터|우석로\s*102/,
  },
  {
    id: 'pool-gyeongsan-indoor',
    name: '경산실내수영장 (경북 권역 수영장)',
    courseLength: '25m',
    lanes: '25m × 8레인',
    certification: '경상북도 시·도 대회 경기장',
    regionName: '경상북도',
    sigunguName: '경산시',
    lDongRegnCd: '47',
    lDongSignguCd: '290',
    address: '경상북도 경산시 서상길 83 / 경북 권역 수영장',
    mapX: 128.7414,
    mapY: 35.8251,
    notes: '경상북도 교육감기 초등 수영대회·학생체육대회·연맹회장배 개최지',
    matchRe: /경산시\s*서상길\s*83|경북\s*권역\s*수영장/,
  },
  {
    id: 'pool-ansan-olympic',
    name: '안산올림픽기념관 수영장 / 대부동 복지체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '시·군 생활체육 및 마스터즈 대회 경기장',
    regionName: '경기도',
    sigunguName: '안산시 단원구',
    lDongRegnCd: '41',
    lDongSignguCd: '270',
    address: '경기도 안산시 단원구 적금로 202 안산올림픽기념관 수영장',
    mapX: 126.8219,
    mapY: 37.3219,
    notes: '안산시장배 수영대회, SOOP Swim Fest 마스터즈 대회 개최지',
    matchRe: /안산\s*올림픽\s*기념관|대부동\s*복지\s*체육\s*센터|적금로\s*202/,
  },
  {
    id: 'pool-seoul-seongdong',
    name: '서울 성동구민종합체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 공인 생활체육 경기장',
    regionName: '서울특별시',
    sigunguName: '성동구',
    lDongRegnCd: '11',
    lDongSignguCd: '200',
    address: '서울특별시 성동구 왕십리로 89 성동구민종합체육센터 수영장',
    mapX: 127.0369,
    mapY: 37.5634,
    notes: '성동구청장배 및 성동구수영연맹회장배 수영대회 주 경기장',
    matchRe: /성동\s*구민\s*종합\s*체육\s*센터|왕십리로\s*89/,
  },
  {
    id: 'pool-seoul-nowon',
    name: '서울 시립노원청소년센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구·청소년 수영대회 경기장',
    regionName: '서울특별시',
    sigunguName: '노원구',
    lDongRegnCd: '11',
    lDongSignguCd: '350',
    address: '서울특별시 노원구 덕릉로 70가길 87 시립노원청소년센터 수영장',
    mapX: 127.0605,
    mapY: 37.6542,
    notes: '노원구청장배 및 연맹회장배, KTA YOUTH Swim Festival, 연합 청소년센터 수영대회 개최',
    matchRe: /노원\s*청소년\s*센터|덕릉로\s*70/,
  },
  {
    id: 'pool-seoul-seodaemun',
    name: '서울 서대문문화체육회관 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '서대문구',
    lDongRegnCd: '11',
    lDongSignguCd: '410',
    address: '서울특별시 서대문구 백련사길 39 서대문문화체육회관 수영장',
    mapX: 126.9352,
    mapY: 37.5831,
    notes: '서대문구청장배 및 서대문구연맹회장배 수영대회 개최지',
    matchRe: /서대문\s*문화\s*체육\s*회관|백련사길\s*39/,
  },
  {
    id: 'pool-seoul-gangdong',
    name: '서울 온조대왕문화체육관 수영장 (강동구)',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '강동구',
    lDongRegnCd: '11',
    lDongSignguCd: '740',
    address: '서울특별시 강동구 고덕로 285 온조대왕문화체육관 수영장',
    mapX: 127.1578,
    mapY: 37.5567,
    notes: '강동구청장배, 강동구의회 의장배, 강동구협회장배 핀수영대회 개최지',
    matchRe: /온조대왕\s*문화\s*체육관|고덕로\s*285/,
  },
  {
    id: 'pool-seoul-seongbuk',
    name: '서울 성북종합레포츠타운 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '성북구',
    lDongRegnCd: '11',
    lDongSignguCd: '290',
    address: '서울특별시 성북구 한천로 58길 307 성북종합레포츠타운 수영장',
    mapX: 127.0167,
    mapY: 37.5894,
    notes: '성북구청장배 및 성북구체육회장배 수영대회 개최지',
    matchRe: /성북\s*종합\s*레포츠\s*타운|한천로\s*58길/,
  },
  {
    id: 'pool-seoul-yeongdeungpo',
    name: '서울 영등포구민체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '영등포구',
    lDongRegnCd: '11',
    lDongSignguCd: '560',
    address: '서울특별시 영등포구 신길로 42길 15 영등포구민체육센터 수영장',
    mapX: 126.8962,
    mapY: 37.5264,
    homepage: 'https://www.y-sisul.or.kr/',
    notes: '영등포구청장배 및 영등포구수영연맹회장배 수영대회 개최지',
    matchRe: /영등포\s*구민\s*체육\s*센터|신길로\s*42길/,
  },
  {
    id: 'pool-seoul-yangcheon',
    name: '서울 양천구민체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '양천구',
    lDongRegnCd: '11',
    lDongSignguCd: '470',
    address: '서울특별시 양천구 목동동로 130 양천구민체육센터 수영장',
    mapX: 126.8665,
    mapY: 37.5171,
    notes: '양천구청장배 및 양천구연맹회장배 수영대회 개최지',
    matchRe: /양천\s*구민\s*체육\s*센터|목동동로\s*130/,
  },
  {
    id: 'pool-seoul-jongno',
    name: '서울 종로구민회관 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '종로구',
    lDongRegnCd: '11',
    lDongSignguCd: '110',
    address: '서울특별시 종로구 인왕산로1길 21 종로구민회관 수영장',
    mapX: 126.9794,
    mapY: 37.5729,
    notes: '종로구청장배 수영대회 개최지',
    matchRe: /종로\s*구민\s*회관|인왕산로1길\s*21/,
  },
  {
    id: 'pool-seoul-jungnang',
    name: '서울 중랑구민체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '중랑구',
    lDongRegnCd: '11',
    lDongSignguCd: '260',
    address: '서울특별시 중랑구 신내로15길 189 중랑구민체육센터 수영장',
    mapX: 127.0931,
    mapY: 37.6065,
    notes: '중랑구청장배 및 연맹회장배 수영대회 개최지',
    matchRe: /중랑\s*구민\s*체육\s*센터|신내로15길\s*189/,
  },
  {
    id: 'pool-seoul-gangbuk',
    name: '서울 강북웰빙스포츠센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '강북구',
    lDongRegnCd: '11',
    lDongSignguCd: '305',
    address: '서울특별시 강북구 오현로31길 51 강북웰빙스포츠센터 수영장',
    mapX: 127.0385,
    mapY: 37.6248,
    notes: '강북구청장기 겸 연맹회장기 수영대회 개최지',
    matchRe: /강북\s*웰빙\s*스포츠\s*센터|오현로31길\s*51/,
  },
  {
    id: 'pool-seoul-eunpyeong',
    name: '서울 은평구민체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '은평구',
    lDongRegnCd: '11',
    lDongSignguCd: '380',
    address: '서울특별시 은평구 진관1로 40 은평구민체육센터 수영장',
    mapX: 126.9204,
    mapY: 37.6382,
    notes: '은평구연맹회장배 수영대회 개최지',
    matchRe: /은평\s*구민\s*체육\s*센터|진관1로\s*40/,
  },
  {
    id: 'pool-seoul-dongjak',
    name: '서울 동작구민체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '동작구',
    lDongRegnCd: '11',
    lDongSignguCd: '590',
    address: '서울특별시 동작구 여의대방로16길 53 동작구민체육센터 수영장',
    mapX: 126.9393,
    mapY: 37.5124,
    notes: '동작구청장배 및 동작구연맹회장배 수영대회 개최지',
    matchRe: /동작\s*구민\s*체육\s*센터|여의대방로16길\s*53/,
  },
  {
    id: 'pool-seoul-gwangjin',
    name: '서울 광진구민체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 5레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '광진구',
    lDongRegnCd: '11',
    lDongSignguCd: '215',
    address: '서울특별시 광진구 능동로 76 광진구민체육센터 수영장',
    mapX: 127.0823,
    mapY: 37.5385,
    notes: '광진구청장배 및 광진구연맹회장배 수영대회 개최지',
    matchRe: /광진\s*구민\s*체육\s*센터|능동로\s*76/,
  },
  {
    id: 'pool-seoul-gangseo',
    name: '서울 강서구민올림픽체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '강서구',
    lDongRegnCd: '11',
    lDongSignguCd: '500',
    address: '서울특별시 강서구 화곡로65길 62 강서구민올림픽체육센터 수영장',
    mapX: 126.8511,
    mapY: 37.5542,
    notes: '강서구청장배 수영대회 개최지',
    matchRe: /강서\s*구민\s*올림픽\s*체육\s*센터|화곡로65길\s*62/,
  },
  {
    id: 'pool-seoul-gangnam',
    name: '서울 강남스포츠문화센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '자치구 수영연맹 대회 경기장',
    regionName: '서울특별시',
    sigunguName: '강남구',
    lDongRegnCd: '11',
    lDongSignguCd: '680',
    address: '서울특별시 강남구 개포로 110길 15 강남스포츠문화센터 수영장',
    mapX: 127.0473,
    mapY: 37.5172,
    notes: '강남구청장배 수영대회 개최지',
    matchRe: /강남\s*스포츠\s*문화\s*센터|개포로\s*110길/,
  },
  {
    id: 'pool-hwasun-hanium',
    name: '화순 하니움실내수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '군 단위 생활체육 대회 경기장',
    regionName: '전라남도',
    sigunguName: '화순군',
    lDongRegnCd: '46',
    lDongSignguCd: '790',
    address: '전라남도 화순군 화순읍 학포로 2698 하니움실내수영장',
    mapX: 126.9865,
    mapY: 35.0645,
    homepage: 'https://www.hwasun.go.kr/',
    notes: '화순적벽배 생활체육 수영대회 개최지',
    matchRe: /하니움\s*실내\s*수영장|학포로\s*2698/,
  },
  {
    id: 'pool-gumi-olympic',
    name: '구미올림픽기념관 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '시·군 대회 및 마스터즈 경기장',
    regionName: '경상북도',
    sigunguName: '구미시',
    lDongRegnCd: '47',
    lDongSignguCd: '190',
    address: '경상북도 구미시 낙동강변로 680 구미올림픽기념관 수영장',
    mapX: 128.3541,
    mapY: 36.1195,
    homepage: 'https://www.gmuc.or.kr/',
    notes: '경상북도수영연맹 회장배 마스터즈 및 구미시 수영대회 개최지',
    matchRe: /구미\s*올림픽\s*기념관|낙동강변로\s*680/,
  },
  {
    id: 'pool-geoje-dongbu',
    name: '거제 동부학생수영장(동부초등학교 수영장)',
    courseLength: '50m',
    lanes: '50m × 5레인',
    certification: '교육청·학교 50m 학생수영장',
    regionName: '경상남도',
    sigunguName: '거제시',
    lDongRegnCd: '48',
    lDongSignguCd: '310',
    address: '경상남도 거제시 동부면 거제중앙로 350 (거제 동부초등학교 내 동부학생수영장)',
    mapX: 128.5992,
    mapY: 34.8032,
    homepage: 'https://www.geoje.go.kr/',
    notes: '거제시장배 및 거제 학생·생활체육 수영대회 개최 경기장 (50m×5레인)',
    matchRe: /동부\s*학생\s*수영장|동부\s*초등학교\s*수영장/,
  },
  {
    id: 'pool-geoje-national',
    name: '거제국민체육센터 수영장',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '거제해양관광개발공사 공공체육시설',
    regionName: '경상남도',
    sigunguName: '거제시',
    lDongRegnCd: '48',
    lDongSignguCd: '310',
    address: '경상남도 거제시 거제중앙로 1849 (고현동) 거제국민체육센터',
    mapX: 128.6251,
    mapY: 34.8805,
    homepage: 'https://www.gmdc.co.kr/',
    notes: '거제해양관광개발공사 운영 공공수영장 (문체부 통계상 다목적 국민체육센터로 분류된 시설)',
    matchRe: /거제\s*국민\s*체육\s*센터/,
  },
  {
    id: 'pool-geoje-samsung',
    name: '거제 삼성문화관 수영장(한화오션 오션플라자 수영장)',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '사내·지역 복지 실내수영장',
    regionName: '경상남도',
    sigunguName: '거제시',
    lDongRegnCd: '48',
    lDongSignguCd: '310',
    address: '경상남도 거제시 장평3로 80 (장평동, 구 삼성중공업 문화관 / 현 한화오션 오션플라자 해피니스홀)',
    mapX: 128.6062,
    mapY: 34.8924,
    notes: '구 삼성중공업 문화관 수영장(현 한화오션 오션플라자) · 민간 기업 복지체육시설로 문체부 공공체육시설 통계 제외 시설',
    matchRe: /삼성\s*문화관|오션\s*플라자|해피니스\s*홀/,
  },
  {
    id: 'pool-geoje-chancei',
    name: '거제 찬스아이수영장',
    courseLength: '25m',
    lanes: '25m × 4레인 (어린이·유아 전용 해수풀)',
    certification: '민간 어린이 전용 수영장',
    regionName: '경상남도',
    sigunguName: '거제시',
    lDongRegnCd: '48',
    lDongSignguCd: '310',
    address: '경상남도 거제시 아주로 73 (아주동)',
    mapX: 128.6895,
    mapY: 34.8648,
    notes: '거제 아주동 소재 민간 체육시설업(어린이 전용 수영장) · 민간 신고체육시설로 문체부 공공체육시설 통계 제외 시설',
    matchRe: /찬스\s*아이\s*수영장/,
  },
  {
    id: 'pool-seogwipo-national',
    name: '서귀포국민체육센터 수영장 (및 동방파제 오픈워터)',
    courseLength: '25m',
    lanes: '25m × 6레인 (오픈워터 해변 코스 병행)',
    certification: '서귀포 권역 수영·오픈워터 경기장',
    regionName: '제주특별자치도',
    sigunguName: '서귀포시',
    lDongRegnCd: '50',
    lDongSignguCd: '130',
    address: '제주특별자치도 서귀포시 동방파제 / 서귀포국민체육센터',
    mapX: 126.5601,
    mapY: 33.2461,
    homepage: 'https://www.seogwipo.go.kr/',
    notes: '오픈워터스위밍 국가대표 선발전 및 전국 마스터즈 대회 개최지',
    matchRe: /서귀포\s*국민\s*체육\s*센터|동방파제/,
  },
  {
    id: 'pool-jincheon-ntc',
    name: '진천 국가대표선수촌 수영장',
    courseLength: '50m',
    lanes: '50m × 10레인 (다이빙풀·아티스틱 전용수조 보유)',
    hasDivingPool: true,
    certification: '대한체육회 국가대표선수촌 공인 경기장',
    regionName: '충청북도',
    sigunguName: '진천군',
    lDongRegnCd: '43',
    lDongSignguCd: '750',
    address: '충청북도 진천군 광혜원면 선수촌로 105 진천 국가대표선수촌 수영장',
    mapX: 127.4342,
    mapY: 36.9854,
    homepage: 'https://www.sports.or.kr/',
    notes: '경영·다이빙·아티스틱스위밍·수구 국가대표 선발전 및 강화훈련 전용 수영장',
    matchRe: /진천\s*(?:국가대표\s*)?선수촌\s*수영장|선수촌로\s*105/,
  },
  {
    id: 'pool-haman-sports',
    name: '함안체육회실내수영장 (함안국민체육센터)',
    courseLength: '25m',
    lanes: '25m × 6레인',
    certification: '군 단위 수영·철인3종 수상구조 강습 경기장',
    regionName: '경상남도',
    sigunguName: '함안군',
    lDongRegnCd: '48',
    lDongSignguCd: '730',
    address: '경상남도 함안군 가야읍 함안대로 619-4 함안체육회실내수영장',
    mapX: 128.4065,
    mapY: 35.2724,
    homepage: 'https://www.gyeongnam.go.kr/',
    notes: '철인3종 수상인명구조요원 강습회 및 함안군 생활체육 수영대회 개최지',
    matchRe: /함안\s*체육회\s*실내\s*수영장|함안\s*국민\s*체육\s*센터|함안대로\s*619-4/,
  },
];

interface RawMcstPoolRecord {
  id: string;
  name: string;
  rawName: string;
  name2021: string;
  datasetStatus: 'BOTH' | 'NEW_2025' | 'ONLY_2021';
  sidoShort: string;
  regionName: string;
  lDongRegnCd: string;
  lDongSignguCd?: string;
  sigunguName: string;
  address: string;
  courseLength: string;
  lanes: string;
  hasDivingPool: boolean;
  indoorOutdoor: string;
  owner: string;
  operator: string;
  manager: string;
  homepage: string;
  totAreaSqm: number;
  seats: number;
  builtYear: string;
  renovYear: string;
  note: string;
  mapX?: number;
  mapY?: number;
  coordSource?: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAutoMatchRe(name: string, rawName: string): RegExp | null {
  const candidates = [name, rawName]
    .map((s) =>
      s
        .replace(/\(수영장\)|실내수영장|부설수영장|수영장/g, '')
        .replace(/\s+/g, '')
        .trim()
    )
    .filter((s) => s.length >= 4 && !/^(국민체육센터|문화체육센터|청소년수련관|올림픽기념)$/.test(s));

  if (candidates.length === 0) return null;
  const pattern = Array.from(new Set(candidates))
    .map((c) => escapeRegExp(c))
    .join('|');
  return new RegExp(pattern);
}

let cachedMergedCatalog: SwimmingPoolSpec[] | null = null;

export function getMergedSwimmingPoolsCatalog(): SwimmingPoolSpec[] {
  if (cachedMergedCatalog) return cachedMergedCatalog;

  const mcstList = publicSwimmingPoolsJson as RawMcstPoolRecord[];
  const claimedCuratedIds = new Set<string>();
  const merged: SwimmingPoolSpec[] = [];

  for (const mcst of mcstList) {
    const mcstSearchText = `${mcst.name} ${mcst.rawName} ${mcst.name2021} ${mcst.address} ${mcst.sigunguName}`;
    // 광주광역시: SWIMMING_POOLS_CATALOG may have '12' or '29'
    const matchedCurated = SWIMMING_POOLS_CATALOG.find((cur) => {
      if (claimedCuratedIds.has(cur.id)) return false;
      const sameReg =
        cur.lDongRegnCd === mcst.lDongRegnCd ||
        cur.regionName === mcst.regionName;
      if (!sameReg) return false;
      if (cur.matchRe.test(mcstSearchText)) return true;
      const curCity = cur.sigunguName.split(' ')[0];
      const mcstCity = mcst.sigunguName.split(' ')[0];
      if (
        curCity &&
        curCity === mcstCity &&
        ((cur.id === 'pool-pohang-indoor' && mcst.rawName.includes('포항수영장')) ||
          (cur.id === 'pool-seoul-olympic' && mcst.rawName.includes('올림픽 수영경기장')))
      ) {
        return true;
      }
      return false;
    });

    if (matchedCurated) {
      claimedCuratedIds.add(matchedCurated.id);
      merged.push({
        id: matchedCurated.id,
        name: matchedCurated.name,
        rawName: mcst.rawName,
        name2021: mcst.name2021 || undefined,
        datasetStatus: mcst.datasetStatus,
        courseLength: matchedCurated.courseLength,
        lanes: mcst.lanes.includes('규격 미상') ? matchedCurated.lanes : mcst.lanes,
        hasDivingPool:
          mcst.hasDivingPool || matchedCurated.lanes.includes('다이빙'),
        indoorOutdoor: mcst.indoorOutdoor || '실내',
        certification: matchedCurated.certification,
        regionName: mcst.regionName,
        sigunguName: matchedCurated.sigunguName || mcst.sigunguName,
        lDongRegnCd: mcst.lDongRegnCd,
        lDongSignguCd: matchedCurated.lDongSignguCd,
        address: matchedCurated.address || mcst.address,
        mapX: matchedCurated.mapX,
        mapY: matchedCurated.mapY,
        owner: mcst.owner || undefined,
        operator: mcst.operator || undefined,
        manager: mcst.manager || undefined,
        homepage: matchedCurated.homepage || mcst.homepage || undefined,
        totAreaSqm: mcst.totAreaSqm || undefined,
        seats: mcst.seats || undefined,
        builtYear: mcst.builtYear || undefined,
        renovYear: mcst.renovYear || undefined,
        notes: matchedCurated.notes || mcst.note || undefined,
        matchRe: matchedCurated.matchRe,
      });
    } else {
      const autoRe = buildAutoMatchRe(mcst.name, mcst.rawName);
      merged.push({
        id: mcst.id,
        name: mcst.name,
        rawName: mcst.rawName,
        name2021: mcst.name2021 || undefined,
        datasetStatus: mcst.datasetStatus,
        courseLength: mcst.courseLength === '50m' ? '50m' : '25m',
        lanes: mcst.lanes,
        hasDivingPool: mcst.hasDivingPool,
        indoorOutdoor: mcst.indoorOutdoor || '실내',
        certification:
          mcst.courseLength === '50m'
            ? '공공체육시설 50m 경영장'
            : '공공체육시설 수영장',
        regionName: mcst.regionName,
        sigunguName: mcst.sigunguName,
        lDongRegnCd: mcst.lDongRegnCd,
        lDongSignguCd: mcst.lDongSignguCd || '',
        address: mcst.address
          ? `${mcst.regionName} ${mcst.sigunguName} ${mcst.address}`
          : `${mcst.regionName} ${mcst.sigunguName}`,
        mapX: mcst.mapX || 127.5,
        mapY: mcst.mapY || 36.5,
        owner: mcst.owner || undefined,
        operator: mcst.operator || undefined,
        manager: mcst.manager || undefined,
        homepage: mcst.homepage || undefined,
        totAreaSqm: mcst.totAreaSqm || undefined,
        seats: mcst.seats || undefined,
        builtYear: mcst.builtYear || undefined,
        renovYear: mcst.renovYear || undefined,
        notes:
          mcst.note ||
          (mcst.courseLength === '50m'
            ? '공공체육시설 50m 정규 경영장 · 시·도/전국 수영대회 경기장'
            : '지자체 공공체육시설 수영장 · 생활체육 대회 경기장'),
        matchRe: autoRe || /(?!)/,
      });
    }
  }

  for (const cur of SWIMMING_POOLS_CATALOG) {
    if (!claimedCuratedIds.has(cur.id)) {
      merged.push({
        ...cur,
        datasetStatus: 'COMPETITION_EXTRA',
        indoorOutdoor: cur.lanes.includes('오픈워터') ? '실외/해변' : '실내',
      });
    }
  }

  cachedMergedCatalog = merged;
  return merged;
}

/**
 * 전체 수영 대회(allSwimEvents) 및 현재 필터링된 수영 대회(filteredSwimEvents)를
 * 각 수영장에 매칭하여 대회 개최 횟수(totalEventCount, filteredEventCount)와 대회 목록을 집계한다.
 */
export function buildSwimmingPoolsWithStats(
  allSwimEvents: UnifiedEventItem[],
  filteredSwimEvents: UnifiedEventItem[]
): SwimmingPoolWithStats[] {
  const filteredIds = new Set(filteredSwimEvents.map((e) => e.id));
  const catalog = getMergedSwimmingPoolsCatalog();

  return catalog
    .map((pool) => {
      const isCuratedPool = pool.id.startsWith('pool-');
      const matchedEvents = allSwimEvents
        .filter((ev) => {
          if (!isCuratedPool && ev.lDongRegnCd && pool.lDongRegnCd && ev.lDongRegnCd !== pool.lDongRegnCd) {
            return false;
          }
          const text = `${ev.addr1 || ''} ${ev.rawTitle || ev.title} ${ev.invitation || ''} ${ev.scheduleNote || ''}`;
          return pool.matchRe.test(text);
        })
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

      const filteredCount = matchedEvents.filter((ev) =>
        filteredIds.has(ev.id)
      ).length;

      return {
        ...pool,
        totalEventCount: matchedEvents.length,
        filteredEventCount: filteredCount,
        events: matchedEvents,
      };
    })
    .sort(
      (a, b) =>
        b.totalEventCount - a.totalEventCount ||
        (a.courseLength === '50m' ? -1 : 1) ||
        a.regionName.localeCompare(b.regionName, 'ko') ||
        a.name.localeCompare(b.name, 'ko')
    );
}

/**
 * 이벤트의 주소·제목·초댓말에서 매칭되는 수영장을 찾아 반환한다.
 * (우선순위: 1. venuePoolId 명시 매칭 -> 2. SWIMMING_POOLS_CATALOG 큐레이션 경기장 -> 3. 전체 공공체육시설 수영장)
 */
export function findMatchingSwimmingPool(
  ev: Pick<
    UnifiedEventItem,
    | 'addr1'
    | 'title'
    | 'rawTitle'
    | 'invitation'
    | 'scheduleNote'
    | 'lDongRegnCd'
    | 'venuePoolId'
  >
): SwimmingPoolSpec | null {
  const catalog = getMergedSwimmingPoolsCatalog();

  if (ev.venuePoolId) {
    const byId = catalog.find((p) => p.id === ev.venuePoolId);
    if (byId) return byId;
  }

  const text = `${ev.addr1 || ''} ${ev.rawTitle || ev.title || ''} ${ev.invitation || ''} ${ev.scheduleNote || ''}`;
  // 1) 큐레이션 수영대회 경기장 우선 탐색
  for (const pool of SWIMMING_POOLS_CATALOG) {
    if (pool.matchRe.test(text)) {
      return catalog.find((p) => p.id === pool.id) || pool;
    }
  }

  // 2) 전체 병합 수영장 카탈로그 탐색
  for (const pool of catalog) {
    if (
      ev.lDongRegnCd &&
      pool.lDongRegnCd &&
      ev.lDongRegnCd !== pool.lDongRegnCd
    ) {
      continue;
    }
    if (pool.matchRe.test(text)) {
      return pool;
    }
  }

  return null;
}

export function buildNaverMapSearchUrl(query: string): string {
  const cleaned = (query || '').trim();
  return `https://map.naver.com/p/search/${encodeURIComponent(cleaned || '대한민국')}`;
}
