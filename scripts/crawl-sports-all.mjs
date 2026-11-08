/**
 * 수영 · 러닝 · 자전거 · 철인3종 4대 스포츠 연맹/지자체/대회 홈페이지 통합 크롤러
 * - 1) 대회 연맹 및 지자체 홈페이지 마스터 DB 생성 (`public/data/sports-federation-registry.json`)
 * - 2) 대회 목록 사이트에서 이벤트 검출 시:
 *      - 구체적인 해당 이벤트 공지 상세 페이지 URL 수집
 *      - 해당 사이트 내부에 링크된 실제 대회 홍보/접수 외부 홈페이지 URL 함께 수집
 *      - 모집공고 / 개최요강 / 참가신청서 `.pdf`, `.hwp` 첨부파일 링크 함께 수집 (`type: 'ATTACHMENT'`)
 * - 3) 각 종목별 범위("세계/대한연맹" / "광역시도" / "시군구" / "동네") 분류 및 역대 회차 시리즈 연결
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import {
  computePromoLevel,
  detectSportCategory,
  isAttachmentLink,
  isSpecificEventLink,
  normalizeEventDoc,
} from '../src/shared/promoPolicy.js';
import { linkEventSeries } from '../src/shared/seriesLinker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const AUTO_CRAWLED_PATH = path.join(ROOT_DIR, 'public', 'data', 'auto-crawled-events.json');
const SERIES_INDEX_PATH = path.join(ROOT_DIR, 'public', 'data', 'series-index.json');
const SWIM_REGISTRY_PATH = path.join(ROOT_DIR, 'public', 'data', 'swimming-federation-registry.json');
const SPORTS_REGISTRY_PATH = path.join(ROOT_DIR, 'public', 'data', 'sports-federation-registry.json');

function fetchRaw(url, encoding = 'utf-8', timeoutMs = 9000) {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          timeout: timeoutMs,
          rejectUnauthorized: false,
        },
        (res) => {
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const redirectUrl = new URL(res.headers.location, url).href;
            resolve(fetchRaw(redirectUrl, encoding, timeoutMs));
            return;
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            try {
              const buf = Buffer.concat(chunks);
              const dec = new TextDecoder(encoding);
              resolve(dec.decode(buf));
            } catch {
              resolve('');
            }
          });
        }
      );
      req.on('error', () => resolve(''));
      req.on('timeout', () => {
        req.destroy();
        resolve('');
      });
    } catch {
      resolve('');
    }
  });
}

function cleanHtmlText(str = '') {
  return String(str)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 텍스트(장소/제목/주최)에서 17개 시도 및 시군구 코드 매핑
 */
const CITY_REGION_MAP = [
  { kw: /거제/, regCd: '48', sigCd: '310', sigName: '거제시' },
  { kw: /창원|마산|진해/, regCd: '48', sigCd: '120', sigName: '창원시' },
  { kw: /진주/, regCd: '48', sigCd: '170', sigName: '진주시' },
  { kw: /통영/, regCd: '48', sigCd: '220', sigName: '통영시' },
  { kw: /사천/, regCd: '48', sigCd: '240', sigName: '사천시' },
  { kw: /김해/, regCd: '48', sigCd: '250', sigName: '김해시' },
  { kw: /밀양/, regCd: '48', sigCd: '270', sigName: '밀양시' },
  { kw: /양산/, regCd: '48', sigCd: '330', sigName: '양산시' },
  { kw: /남해/, regCd: '48', sigCd: '840', sigName: '남해군' },
  { kw: /합천/, regCd: '48', sigCd: '890', sigName: '합천군' },
  { kw: /산청/, regCd: '48', sigCd: '860', sigName: '산청군' },
  { kw: /함양/, regCd: '48', sigCd: '870', sigName: '함양군' },
  { kw: /거창/, regCd: '48', sigCd: '880', sigName: '거창군' },
  { kw: /하동/, regCd: '48', sigCd: '850', sigName: '하동군' },
  { kw: /창녕/, regCd: '48', sigCd: '740', sigName: '창녕군' },
  { kw: /함안/, regCd: '48', sigCd: '730', sigName: '함안군' },
  { kw: /의령/, regCd: '48', sigCd: '720', sigName: '의령군' },
  { kw: /김천/, regCd: '47', sigCd: '150', sigName: '김천시' },
  { kw: /포항/, regCd: '47', sigCd: '110', sigName: '포항시' },
  { kw: /경주/, regCd: '47', sigCd: '130', sigName: '경주시' },
  { kw: /안동/, regCd: '47', sigCd: '170', sigName: '안동시' },
  { kw: /구미/, regCd: '47', sigCd: '190', sigName: '구미시' },
  { kw: /영주/, regCd: '47', sigCd: '210', sigName: '영주시' },
  { kw: /영천/, regCd: '47', sigCd: '230', sigName: '영천시' },
  { kw: /상주/, regCd: '47', sigCd: '250', sigName: '상주시' },
  { kw: /문경/, regCd: '47', sigCd: '280', sigName: '문경시' },
  { kw: /경산/, regCd: '47', sigCd: '290', sigName: '경산시' },
  { kw: /울진/, regCd: '47', sigCd: '930', sigName: '울진군' },
  { kw: /영덕/, regCd: '47', sigCd: '770', sigName: '영덕군' },
  { kw: /청송/, regCd: '47', sigCd: '750', sigName: '청송군' },
  { kw: /예천/, regCd: '47', sigCd: '900', sigName: '예천군' },
  { kw: /춘천/, regCd: '51', sigCd: '110', sigName: '춘천시' },
  { kw: /원주/, regCd: '51', sigCd: '130', sigName: '원주시' },
  { kw: /강릉|경포/, regCd: '51', sigCd: '150', sigName: '강릉시' },
  { kw: /동해/, regCd: '51', sigCd: '170', sigName: '동해시' },
  { kw: /태백/, regCd: '51', sigCd: '190', sigName: '태백시' },
  { kw: /속초/, regCd: '51', sigCd: '210', sigName: '속초시' },
  { kw: /삼척/, regCd: '51', sigCd: '230', sigName: '삼척시' },
  { kw: /홍천/, regCd: '51', sigCd: '720', sigName: '홍천군' },
  { kw: /횡성/, regCd: '51', sigCd: '730', sigName: '횡성군' },
  { kw: /영월/, regCd: '51', sigCd: '750', sigName: '영월군' },
  { kw: /평창|대관령/, regCd: '51', sigCd: '760', sigName: '평창군' },
  { kw: /정선/, regCd: '51', sigCd: '770', sigName: '정선군' },
  { kw: /철원/, regCd: '51', sigCd: '780', sigName: '철원군' },
  { kw: /화천/, regCd: '51', sigCd: '790', sigName: '화천군' },
  { kw: /양구/, regCd: '51', sigCd: '800', sigName: '양구군' },
  { kw: /인제|설악/, regCd: '51', sigCd: '810', sigName: '인제군' },
  { kw: /고성/, regCd: '51', sigCd: '820', sigName: '고성군' },
  { kw: /양양/, regCd: '51', sigCd: '830', sigName: '양양군' },
  { kw: /수원/, regCd: '41', sigCd: '110', sigName: '수원시' },
  { kw: /성남|분당/, regCd: '41', sigCd: '130', sigName: '성남시' },
  { kw: /의정부/, regCd: '41', sigCd: '150', sigName: '의정부시' },
  { kw: /안양/, regCd: '41', sigCd: '170', sigName: '안양시' },
  { kw: /부천/, regCd: '41', sigCd: '190', sigName: '부천시' },
  { kw: /광명/, regCd: '41', sigCd: '210', sigName: '광명시' },
  { kw: /평택/, regCd: '41', sigCd: '220', sigName: '평택시' },
  { kw: /동두천|왕방산/, regCd: '41', sigCd: '250', sigName: '동두천시' },
  { kw: /안산|대부도/, regCd: '41', sigCd: '270', sigName: '안산시' },
  { kw: /고양|일산/, regCd: '41', sigCd: '280', sigName: '고양시' },
  { kw: /과천/, regCd: '41', sigCd: '290', sigName: '과천시' },
  { kw: /구리/, regCd: '41', sigCd: '310', sigName: '구리시' },
  { kw: /남양주/, regCd: '41', sigCd: '360', sigName: '남양주시' },
  { kw: /오산/, regCd: '41', sigCd: '370', sigName: '오산시' },
  { kw: /시흥/, regCd: '41', sigCd: '390', sigName: '시흥시' },
  { kw: /군포/, regCd: '41', sigCd: '410', sigName: '군포시' },
  { kw: /의왕/, regCd: '41', sigCd: '430', sigName: '의왕시' },
  { kw: /하남|미사리/, regCd: '41', sigCd: '450', sigName: '하남시' },
  { kw: /용인/, regCd: '41', sigCd: '460', sigName: '용인시' },
  { kw: /파주|임진각/, regCd: '41', sigCd: '480', sigName: '파주시' },
  { kw: /이천/, regCd: '41', sigCd: '500', sigName: '이천시' },
  { kw: /안성/, regCd: '41', sigCd: '550', sigName: '안성시' },
  { kw: /김포/, regCd: '41', sigCd: '570', sigName: '김포시' },
  { kw: /화성|동탄/, regCd: '41', sigCd: '590', sigName: '화성시' },
  { kw: /광주(?!광역|MBC|시\s*서구|시\s*북구|시\s*남구|시\s*동구|시\s*광산구)/, regCd: '41', sigCd: '610', sigName: '광주시' },
  { kw: /양주/, regCd: '41', sigCd: '630', sigName: '양주시' },
  { kw: /포천/, regCd: '41', sigCd: '650', sigName: '포천시' },
  { kw: /여주/, regCd: '41', sigCd: '670', sigName: '여주시' },
  { kw: /양평/, regCd: '41', sigCd: '830', sigName: '양평군' },
  { kw: /가평/, regCd: '41', sigCd: '820', sigName: '가평군' },
  { kw: /연천/, regCd: '41', sigCd: '800', sigName: '연천군' },
  { kw: /청주/, regCd: '43', sigCd: '110', sigName: '청주시' },
  { kw: /충주/, regCd: '43', sigCd: '130', sigName: '충주시' },
  { kw: /제천/, regCd: '43', sigCd: '150', sigName: '제천시' },
  { kw: /단양/, regCd: '43', sigCd: '800', sigName: '단양군' },
  { kw: /보은/, regCd: '43', sigCd: '720', sigName: '보은군' },
  { kw: /옥천/, regCd: '43', sigCd: '730', sigName: '옥천군' },
  { kw: /영동/, regCd: '43', sigCd: '740', sigName: '영동군' },
  { kw: /진천/, regCd: '43', sigCd: '750', sigName: '진천군' },
  { kw: /괴산/, regCd: '43', sigCd: '760', sigName: '괴산군' },
  { kw: /음성/, regCd: '43', sigCd: '770', sigName: '음성군' },
  { kw: /천안/, regCd: '44', sigCd: '130', sigName: '천안시' },
  { kw: /공주/, regCd: '44', sigCd: '150', sigName: '공주시' },
  { kw: /보령|대천/, regCd: '44', sigCd: '180', sigName: '보령시' },
  { kw: /아산/, regCd: '44', sigCd: '200', sigName: '아산시' },
  { kw: /서산/, regCd: '44', sigCd: '210', sigName: '서산시' },
  { kw: /논산/, regCd: '44', sigCd: '230', sigName: '논산시' },
  { kw: /계룡/, regCd: '44', sigCd: '250', sigName: '계룡시' },
  { kw: /당진/, regCd: '44', sigCd: '270', sigName: '당진시' },
  { kw: /부여/, regCd: '44', sigCd: '760', sigName: '부여군' },
  { kw: /예산/, regCd: '44', sigCd: '810', sigName: '예산군' },
  { kw: /태안/, regCd: '44', sigCd: '825', sigName: '태안군' },
  { kw: /홍성/, regCd: '44', sigCd: '800', sigName: '홍성군' },
  { kw: /전주/, regCd: '52', sigCd: '110', sigName: '전주시' },
  { kw: /군산|새만금/, regCd: '52', sigCd: '130', sigName: '군산시' },
  { kw: /익산/, regCd: '52', sigCd: '140', sigName: '익산시' },
  { kw: /정읍/, regCd: '52', sigCd: '180', sigName: '정읍시' },
  { kw: /남원/, regCd: '52', sigCd: '190', sigName: '남원시' },
  { kw: /김제/, regCd: '52', sigCd: '210', sigName: '김제시' },
  { kw: /무주/, regCd: '52', sigCd: '730', sigName: '무주군' },
  { kw: /부안|적벽강|변산/, regCd: '52', sigCd: '800', sigName: '부안군' },
  { kw: /고창/, regCd: '52', sigCd: '790', sigName: '고창군' },
  { kw: /진안/, regCd: '52', sigCd: '720', sigName: '진안군' },
  { kw: /장수/, regCd: '52', sigCd: '740', sigName: '장수군' },
  { kw: /순창/, regCd: '52', sigCd: '770', sigName: '순창군' },
  { kw: /목포/, regCd: '46', sigCd: '110', sigName: '목포시' },
  { kw: /여수/, regCd: '46', sigCd: '130', sigName: '여수시' },
  { kw: /순천/, regCd: '46', sigCd: '150', sigName: '순천시' },
  { kw: /나주|영산강/, regCd: '46', sigCd: '170', sigName: '나주시' },
  { kw: /광양/, regCd: '46', sigCd: '230', sigName: '광양시' },
  { kw: /담양/, regCd: '46', sigCd: '710', sigName: '담양군' },
  { kw: /구례|지리산/, regCd: '46', sigCd: '730', sigName: '구례군' },
  { kw: /고흥/, regCd: '46', sigCd: '770', sigName: '고흥군' },
  { kw: /보성/, regCd: '46', sigCd: '780', sigName: '보성군' },
  { kw: /화순/, regCd: '46', sigCd: '790', sigName: '화순군' },
  { kw: /해남/, regCd: '46', sigCd: '820', sigName: '해남군' },
  { kw: /영암/, regCd: '46', sigCd: '830', sigName: '영암군' },
  { kw: /무안/, regCd: '46', sigCd: '840', sigName: '무안군' },
  { kw: /영광/, regCd: '46', sigCd: '870', sigName: '영광군' },
  { kw: /완도/, regCd: '46', sigCd: '890', sigName: '완도군' },
  { kw: /서귀포/, regCd: '50', sigCd: '130', sigName: '서귀포시' },
  { kw: /제주/, regCd: '50', sigCd: '110', sigName: '제주시' },
  { kw: /부산|해운대|광안리|다대포|사직|기장|영도|을숙도|삼락/, regCd: '26', sigCd: '260', sigName: '동래구' },
  { kw: /대구|수성못|두류|신천|달성/, regCd: '27', sigCd: '260', sigName: '수성구' },
  { kw: /인천|송도|청라|영종|정서진|강화|문학/, regCd: '28', sigCd: '185', sigName: '연수구' },
  { kw: /광주광역|광주MBC|상무시민|김대중컨벤션/, regCd: '12', sigCd: '270', sigName: '서구' },
  { kw: /대전|갑천|엑스포|대청호|한밭/, regCd: '30', sigCd: '200', sigName: '유성구' },
  { kw: /울산|태화강|문수|간절곶|진하|대왕암/, regCd: '31', sigCd: '140', sigName: '남구' },
  { kw: /세종|호수공원/, regCd: '36110', sigCd: '110', sigName: '세종시' },
  { kw: /잠실|올림픽공원|송파/, regCd: '11', sigCd: '710', sigName: '송파구' },
  { kw: /여의도|영등포/, regCd: '11', sigCd: '560', sigName: '영등포구' },
  { kw: /상암|월드컵공원|마포/, regCd: '11', sigCd: '440', sigName: '마포구' },
  { kw: /뚝섬|광진/, regCd: '11', sigCd: '215', sigName: '광진구' },
  { kw: /반포|서초/, regCd: '11', sigCd: '650', sigName: '서초구' },
  { kw: /광화문|청계천|종로/, regCd: '11', sigCd: '110', sigName: '종로구' },
  { kw: /서울|한강/, regCd: '11', sigCd: '710', sigName: '송파구' },
];

function resolveRegionFromText(text = '') {
  for (const item of CITY_REGION_MAP) {
    if (item.kw.test(text)) {
      return {
        lDongRegnCd: item.regCd,
        lDongSignguCd: item.sigCd,
        sigunguName: item.sigName,
      };
    }
  }
  return {
    lDongRegnCd: '11',
    lDongSignguCd: '710',
    sigunguName: '송파구',
  };
}

/**
 * 1) 4대 스포츠(수영·러닝·자전거·철인) 연맹·지자체 마스터 레지스트리 DB 생성
 */
function buildSportsFederationRegistry(swimReg) {
  return {
    updatedAt: new Date().toISOString(),
    description:
      '특별 홍보관 4대 스포츠(수영·러닝·자전거·철인) 세계/중앙연맹(Lv.3 전국), 광역시·도 연맹(Lv.2 광역), 기초지자체(Lv.1 지자체), 개별시설·크루(Lv.0 동네) 홈페이지 마스터 DB',
    sports: {
      SWIMMING: {
        sport: 'SWIMMING',
        label: '수영',
        worldAndNational: swimReg?.worldAndNational || [],
        provincialFederations: swimReg?.provincialFederations || [],
        municipalFederations: swimReg?.municipalFederations || [],
        individualPoolChannels: swimReg?.individualPoolChannels || [],
      },
      RUNNING: {
        sport: 'RUNNING',
        label: '러닝',
        worldAndNational: [
          {
            id: 'world-athletics',
            level: 3,
            name: '세계육상연맹 (World Athletics)',
            city: 'Monaco / 국제 순회',
            homepageUrl: 'https://worldathletics.org',
            scheduleUrl: 'https://worldathletics.org/competitions',
          },
          {
            id: 'kaaf-korea',
            level: 3,
            name: '대한육상연맹 (Korea Association of Athletics Federations)',
            city: '서울 (올림픽회관)',
            homepageUrl: 'http://www.kaaf.or.kr',
            scheduleUrl: 'http://www.kaaf.or.kr/ver3/info/info01.asp',
          },
          {
            id: 'marathon-pe-kr',
            level: 3,
            name: '마라톤온라인 (전국 마라톤·러닝 대회 통합 일정·공식사이트 링크 포털)',
            city: '전국',
            homepageUrl: 'http://www.marathon.pe.kr',
            scheduleUrl: 'http://www.roadrun.co.kr/schedule/list.php',
          },
          {
            id: 'run1080-kma',
            level: 3,
            name: '전국마라톤협회 (전마협 / KMA)',
            city: '전국 (대전 본부)',
            homepageUrl: 'http://www.run1080.com',
            scheduleUrl: 'http://www.run1080.com',
          },
        ],
        provincialFederations: [
          { id: 'run-seoul', level: 2, city: '서울', name: '서울특별시육상연맹', homepageUrl: 'http://www.seoulathletics.or.kr' },
          { id: 'run-busan', level: 2, city: '부산', name: '부산광역시육상연맹', homepageUrl: 'http://www.bsaaf.or.kr' },
          { id: 'run-daegu', level: 2, city: '대구', name: '대구광역시육상연맹 (대구국제마라톤)', homepageUrl: 'https://www.daegusports.or.kr' },
          { id: 'run-incheon', level: 2, city: '인천', name: '인천광역시육상연맹', homepageUrl: 'https://www.i-sports.or.kr' },
          { id: 'run-gwangju', level: 2, city: '광주', name: '광주광역시육상연맹', homepageUrl: 'https://www.gjsports.or.kr' },
          { id: 'run-daejeon', level: 2, city: '대전', name: '대전광역시육상연맹', homepageUrl: 'https://www.djsports.or.kr' },
          { id: 'run-ulsan', level: 2, city: '울산', name: '울산광역시육상연맹 (태화강 마라톤)', homepageUrl: 'https://www.usports.or.kr' },
          { id: 'run-gyeonggi', level: 2, city: '경기', name: '경기도육상연맹', homepageUrl: 'http://www.ggaf.or.kr' },
          { id: 'run-gangwon', level: 2, city: '강원', name: '강원특별자치도육상연맹', homepageUrl: 'http://www.gwaf.or.kr' },
          { id: 'run-chungbuk', level: 2, city: '충북', name: '충청북도육상연맹', homepageUrl: 'https://www.cbsports.or.kr' },
          { id: 'run-chungnam', level: 2, city: '충남', name: '충청남도육상연맹', homepageUrl: 'https://www.cnsports.or.kr' },
          { id: 'run-jeonbuk', level: 2, city: '전북', name: '전북특별자치도육상연맹', homepageUrl: 'https://www.jbsports.or.kr' },
          { id: 'run-jeonnam', level: 2, city: '전남', name: '전라남도육상연맹', homepageUrl: 'https://www.jnsports.or.kr' },
          { id: 'run-gyeongbuk', level: 2, city: '경북', name: '경상북도육상연맹', homepageUrl: 'https://www.gbsports.or.kr' },
          { id: 'run-gyeongnam', level: 2, city: '경남', name: '경상남도육상연맹', homepageUrl: 'https://www.gnsports.or.kr' },
          { id: 'run-jeju', level: 2, city: '제주', name: '제주특별자치도육상연맹', homepageUrl: 'https://www.jejusports.or.kr' },
        ],
        municipalFederations: [
          { id: 'run-muni-chuncheon', level: 1, city: '춘천', name: '춘천마라톤 조직위 / 춘천시육상연맹', homepageUrl: 'https://www.chuncheonmarathon.com' },
          { id: 'run-muni-gyeongju', level: 1, city: '경주', name: '경주국제마라톤 / 동아마라톤 경주', homepageUrl: 'http://www.gyeongjumarathon.com' },
          { id: 'run-muni-jinju', level: 1, city: '진주', name: '진주남강마라톤 조직위원회', homepageUrl: 'http://www.jinjumarathon.com' },
          { id: 'run-muni-changwon', level: 1, city: '창원', name: '창원통일마라톤 조직위원회', homepageUrl: 'http://www.cwmarathon.com' },
          { id: 'run-muni-geoje', level: 1, city: '거제', name: '거제시육상연맹 / 거제 산방산·섬꽃 러닝', homepageUrl: 'http://imdorun.creatorlink.net' },
        ],
        individualPoolChannels: [
          {
            id: 'run-crew-sfinder',
            level: 0,
            name: '스파인더 러닝 (전국 러닝크루·트레일러닝·동네 레이스 채널)',
            homepageUrl: 'https://www.sfinder.co.kr/contest/contest_list/running',
          },
        ],
      },
      CYCLING: {
        sport: 'CYCLING',
        label: '자전거',
        worldAndNational: [
          {
            id: 'uci-world',
            level: 3,
            name: '세계사이클연맹 (UCI - Union Cycliste Internationale)',
            city: 'Aigle / 국제 순회',
            homepageUrl: 'https://www.uci.org',
            scheduleUrl: 'https://www.uci.org/calendar/all',
          },
          {
            id: 'kcf-korea',
            level: 3,
            name: '대한사이클연맹 (Korea Cycling Federation)',
            city: '서울 (올림픽회관)',
            homepageUrl: 'https://www.cycling.or.kr',
            scheduleUrl: 'https://www.cycling.or.kr/news/schedule/',
          },
          {
            id: 'kcf-bikelife',
            level: 3,
            name: '대한사이클연맹 생활체육 (전국 그란폰도·메디오폰도·마스터즈 포털)',
            city: '전국',
            homepageUrl: 'https://bikelife.cycling.or.kr',
            scheduleUrl: 'https://bikelife.cycling.or.kr/events/tour/',
          },
          {
            id: 'thebike-korea',
            level: 3,
            name: '더바이크 (전국 자전거·그란폰도·MTB 대회 공식 접수처)',
            city: '전국',
            homepageUrl: 'https://www.thebike.co.kr',
            scheduleUrl: 'https://www.thebike.co.kr/race/list.php',
          },
        ],
        provincialFederations: [
          { id: 'cyc-seoul', level: 2, city: '서울', name: '서울특별시자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-busan', level: 2, city: '부산', name: '부산광역시자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-daegu', level: 2, city: '대구', name: '대구광역시자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-incheon', level: 2, city: '인천', name: '인천광역시자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-gwangju', level: 2, city: '광주', name: '광주광역시자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-ulsan', level: 2, city: '울산', name: '울산광역시자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-gyeonggi', level: 2, city: '경기', name: '경기도자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-gangwon', level: 2, city: '강원', name: '강원특별자치도자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-jeonbuk', level: 2, city: '전북', name: '전북특별자치도자전거연맹', homepageUrl: 'https://www.jbcycling.or.kr' },
          { id: 'cyc-jeonnam', level: 2, city: '전남', name: '전라남도자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-gyeongbuk', level: 2, city: '경북', name: '경상북도자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-gyeongnam', level: 2, city: '경남', name: '경상남도자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
        ],
        municipalFederations: [
          { id: 'cyc-muni-inje', level: 1, city: '인제', name: '설악 그란폰도 조직위원회 (인제군)', homepageUrl: 'http://www.granfondo.kr' },
          { id: 'cyc-muni-muju', level: 1, city: '무주', name: '무주 메디오폰도 / 전북자전거연맹', homepageUrl: 'https://www.jbcycling.or.kr' },
          { id: 'cyc-muni-jeongseon', level: 1, city: '정선', name: '정선 그란폰도 조직위원회', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-muni-hongcheon', level: 1, city: '홍천', name: '홍천 바이크 페스티벌 / 홍천군자전거연맹', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
          { id: 'cyc-muni-hwacheon', level: 1, city: '화천', name: '화천 DMZ 랠리 전국평화자전거대회', homepageUrl: 'https://www.dmzrally.com' },
          { id: 'cyc-muni-dongducheon', level: 1, city: '동두천', name: '동두천 왕방산 국제 MTB 대회', homepageUrl: 'https://bikelife.cycling.or.kr/events/tour/' },
        ],
        individualPoolChannels: [
          {
            id: 'cyc-local-sfinder',
            level: 0,
            name: '스파인더 바이크 (자전거 동호회·밸런스바이크·시티라이드 채널)',
            homepageUrl: 'https://www.sfinder.co.kr/contest/contest_list/bike',
          },
        ],
      },
      TRIATHLON: {
        sport: 'TRIATHLON',
        label: '철인',
        worldAndNational: [
          {
            id: 'world-triathlon',
            level: 3,
            name: '세계철인3종연맹 (World Triathlon)',
            city: 'Lausanne / 국제 순회',
            homepageUrl: 'https://www.triathlon.org',
            scheduleUrl: 'https://www.triathlon.org/events',
          },
          {
            id: 'ktf-korea',
            level: 3,
            name: '대한철인3종협회 (Korea Triathlon Federation)',
            city: '서울 (올림픽회관)',
            homepageUrl: 'https://www.triathlon.or.kr',
            scheduleUrl: 'https://www.triathlon.or.kr/events/tour/',
          },
          {
            id: 'ironman-korea',
            level: 3,
            name: '아이언맨 코리아 (IRONMAN 70.3 Goseong / Gurye)',
            city: '구례 · 고성',
            homepageUrl: 'https://www.ironman.com',
            scheduleUrl: 'https://www.triathlon.or.kr/events/tour/',
          },
        ],
        provincialFederations: [
          { id: 'tri-seoul', level: 2, city: '서울', name: '서울특별시철인3종협회', homepageUrl: 'http://www.seoultriathlon.or.kr' },
          { id: 'tri-busan', level: 2, city: '부산', name: '부산광역시철인3종협회', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-daegu', level: 2, city: '대구', name: '대구광역시철인3종협회', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-incheon', level: 2, city: '인천', name: '인천광역시철인3종협회', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-ulsan', level: 2, city: '울산', name: '울산광역시철인3종협회 (태화강 아쿠아슬론)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-sejong', level: 2, city: '세종', name: '세종특별자치시철인3종협회', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-gyeonggi', level: 2, city: '경기', name: '경기도철인3종협회', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-chungnam', level: 2, city: '충남', name: '충청남도철인3종협회 (홍성·보령·부여)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-jeonbuk', level: 2, city: '전북', name: '전북특별자치도철인3종협회 (새만금·익산)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-jeonnam', level: 2, city: '전남', name: '전라남도철인3종협회 (구례·여수·순천)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-gyeongbuk', level: 2, city: '경북', name: '경상북도철인3종협회 (포항·울진·경주)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-gyeongnam', level: 2, city: '경남', name: '경상남도철인3종협회 (통영·거제·합천)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-jeju', level: 2, city: '제주', name: '제주특별자치도철인3종협회', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
        ],
        municipalFederations: [
          { id: 'tri-muni-tongyeong', level: 1, city: '통영', name: '통영시철인3종협회 (통영 월드 트라이애슬론컵)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-muni-geoje', level: 1, city: '거제', name: '거제시철인3종협회 (지세포 트라이애슬론)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-muni-iksan', level: 1, city: '익산', name: '익산시철인3종협회 (웅포 트라이애슬론·아쿠아슬론)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-muni-hapcheon', level: 1, city: '합천', name: '합천군철인3종협회 (황강 트라이애슬론·아쿠아슬론)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
          { id: 'tri-muni-goseong', level: 1, city: '고성', name: '경남 고성군철인3종협회 (아이언맨 70.3 고성)', homepageUrl: 'https://www.triathlon.or.kr/events/tour/' },
        ],
        individualPoolChannels: [
          {
            id: 'tri-youth-channel',
            level: 0,
            name: 'KTA YOUTH & 유소년 아쿠아슬론·듀애슬론 페스티벌 채널',
            homepageUrl: 'https://www.triathlon.or.kr/events/tour/',
          },
        ],
      },
    },
  };
}

/**
 * 2-A) 부산수영연맹(busanswimming.kr/BoardView.asp?idx=860&gubun=notice) 및
 *      대한수영연맹(korswim.co.kr/11/{id})에서 모집공고/개최요강 PDF·HWP 링크 수집
 */
async function enrichSwimmingAttachmentLinks(existingEvents) {
  console.log('🏊 [1/4] 수영 대회 모집공고(PDF/HWP) 및 구체적 공지 링크 정밀 보강 중...');

  // 1) 부산광역시수영연맹 idx=860 게시물의 첨부파일 추출
  const busan860Url = 'http://www.busanswimming.kr/BoardView.asp?idx=860&gubun=notice';
  const busanHtml = await fetchRaw(busan860Url, 'utf-8');
  const busanAttachments = [];
  if (busanHtml) {
    const linkMatches = [...busanHtml.matchAll(/<a[^>]+href=["']([^"']+\.(?:pdf|hwp))["'][^>]*>([\s\S]*?)<\/a>/gi)];
    for (const m of linkMatches) {
      const rawHref = m[1].trim();
      const labelText = cleanHtmlText(m[2]) || path.basename(rawHref);
      const absUrl = new URL(encodeURI(rawHref), 'http://www.busanswimming.kr/').href;
      busanAttachments.push({
        rawHref,
        label: labelText.includes('요강') || labelText.includes('신청서')
          ? `모집공고/요강 · ${labelText}`
          : `개최요강/공고 (${path.basename(rawHref)})`,
        url: absUrl,
      });
    }
  }

  // 2) 대한수영연맹(korswim.co.kr/11/{id}) 최근 대회 상세 페이지에서 PDF/HWP 다운로드 링크 수집
  const ksfTargets = existingEvents.filter(
    (ev) =>
      ev.id.startsWith('swim-ksf-') &&
      ev.eventDate?.startDate >= '20250101' &&
      ev.links?.some((l) => /korswim\.co\.kr\/11\/\d+/.test(l.url))
  );

  const ksfAttachmentMap = new Map();
  const batchSize = 10;
  for (let i = 0; i < Math.min(ksfTargets.length, 40); i += batchSize) {
    const slice = ksfTargets.slice(i, i + batchSize);
    await Promise.all(
      slice.map(async (ev) => {
        const detailLink = ev.links.find((l) => /korswim\.co\.kr\/11\/\d+/.test(l.url));
        if (!detailLink) return;
        const html = await fetchRaw(detailLink.url, 'utf-8', 6000);
        if (!html) return;
        const dlMatches = [
          ...html.matchAll(
            /<a[^>]+href=["'](https?:\/\/www\.korswim\.co\.kr\/bbs\/download\.php\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
          ),
        ];
        const attList = [];
        for (const dm of dlMatches) {
          const url = dm[1].replace(/&amp;/g, '&');
          const text = cleanHtmlText(dm[2]);
          if (/\.(pdf|hwp|hwpx)/i.test(text) || /요강|공고|신청/i.test(text)) {
            attList.push({
              type: 'ATTACHMENT',
              label: `모집공고/개최요강 · ${text.slice(0, 60)}`,
              url,
            });
          }
        }
        if (attList.length > 0) {
          ksfAttachmentMap.set(ev.id, attList);
        }
      })
    );
  }

  let updatedSwimCount = 0;
  for (const ev of existingEvents) {
    const rawText = `${ev.title} ${ev.invitation || ''} ${ev.organizer?.host || ''}`;
    if (detectSportCategory(rawText) !== 'SWIMMING') continue;

    // 부산수영연맹 idx=860 및 산하 대회의 PDF/HWP 매칭
    if (ev.id.startsWith('swim-busan-')) {
      const addLinks = [];
      if (ev.id === 'swim-busan-notice-860' || /부산광역시체육회장배/.test(ev.title)) {
        addLinks.push(
          {
            type: 'ATTACHMENT',
            label: '모집공고/개최요강 PDF (체육회장배 개최요강_1.pdf)',
            url: 'http://www.busanswimming.kr/DataFile/%EC%B2%B4%EC%9C%A1%ED%9A%8C%EC%9E%A5%EB%B0%B0%20%EA%B0%9C%EC%B5%9C%EC%9A%94%EA%B0%95_1.pdf',
          },
          {
            type: 'ATTACHMENT',
            label: '참가신청서 HWP (학생부)',
            url: 'http://www.busanswimming.kr/DataFile/%EC%B0%B8%EA%B0%80%EC%8B%A0%EC%B2%AD%EC%84%9C(%ED%95%99%EC%83%9D%EB%B6%80)_10.hwp',
          },
          {
            type: 'ATTACHMENT',
            label: '참가신청서 HWP (성인부)',
            url: 'http://www.busanswimming.kr/DataFile/%EC%B0%B8%EA%B0%80%EC%8B%A0%EC%B2%AD%EC%84%9C(%EC%84%B1%EC%9D%B8%EB%B6%80)_9.hwp',
          }
        );
      } else if (/교육감배/.test(ev.title) && ev.eventDate?.startDate >= '20240101') {
        addLinks.push({
          type: 'ATTACHMENT',
          label: '모집공고/개최요강 PDF (교육감배 개최요강.pdf)',
          url: 'http://www.busanswimming.kr/Data/%EA%B5%90%EC%9C%A1%EA%B0%90%EB%B0%B0%20%EA%B0%9C%EC%B5%9C%EC%9A%94%EA%B0%95,%EA%B2%BD%EA%B8%B0%EC%A2%85%EB%AA%A9,%EA%B8%B0%EC%A4%80%EA%B8%B0%EB%A1%9D,%EB%8C%80%EC%B1%85.pdf',
        });
      } else if (/5대\s*인기종목|빅5/.test(ev.title)) {
        addLinks.push({
          type: 'ATTACHMENT',
          label: '모집공고/개최요강 PDF (개최요강 빅5.pdf)',
          url: 'http://www.busanswimming.kr/Data/%EA%B0%9C%EC%B5%9C%EC%9A%94%EA%B0%95%20(%EB%B9%855).pdf',
        });
      } else if (/부산광역시장배/.test(ev.title) && ev.eventDate?.startDate >= '20230101') {
        addLinks.push({
          type: 'ATTACHMENT',
          label: '모집공고/개최요강 PDF (부산광역시장배 요강.pdf)',
          url: 'http://www.busanswimming.kr/Data/%EC%9A%94%EA%B0%95_2.pdf',
        });
      }

      if (addLinks.length > 0) {
        const existingUrls = new Set((ev.links || []).map((l) => l.url));
        for (const al of addLinks) {
          if (!existingUrls.has(al.url)) {
            ev.links.push(al);
            existingUrls.add(al.url);
          }
        }
      }
    }

    // 대한수영연맹 첨부파일 반영
    if (ksfAttachmentMap.has(ev.id)) {
      const existingUrls = new Set((ev.links || []).map((l) => l.url));
      for (const al of ksfAttachmentMap.get(ev.id)) {
        if (!existingUrls.has(al.url)) {
          ev.links.push(al);
          existingUrls.add(al.url);
        }
      }
    }

    // 구체적인 공지 페이지 또는 첨부공고만 남기고 단순 대표 도메인 루트 링크 제거
    if (Array.isArray(ev.links)) {
      ev.links = ev.links
        .map((lnk) => ({
          ...lnk,
          type: isAttachmentLink(lnk.url, lnk.label) ? 'ATTACHMENT' : lnk.type,
        }))
        .filter((lnk) => isSpecificEventLink(lnk.url, lnk.label));
    }

    ev.promoLevel = computePromoLevel({
      explicitLevel: ev.promoLevel,
      title: ev.title,
      invitation: ev.invitation,
      organizer: ev.organizer?.host,
      lDongRegnCd: ev.lDongRegnCd,
      addr1: ev.addr1,
    });
    updatedSwimCount++;
  }

  console.log(`   -> 수영 이벤트 ${updatedSwimCount}건 구체적 링크·첨부공고(PDF/HWP) 정제 완료 (KSF 첨부 추출: ${ksfAttachmentMap.size}건)`);
}

/**
 * 2-B) 러닝(마라톤·트레일러닝·러닝크루) 크롤링
 * - 출처 1: 마라톤온라인 (`http://www.roadrun.co.kr/schedule/list.php`) ->
 *   대회 상세 공지 팝업(`view.php?no=...`) + 실제 대회가 홍보된 외부 홈페이지(`<img src="image/home.gif">`) 동시 수집!
 * - 출처 2: 스파인더 러닝 (`https://www.sfinder.co.kr/contest/contest_list/running`)
 */
async function crawlRunningEvents() {
  console.log('🏃 [2/4] 러닝(마라톤·트레일런·크루) 대회 및 실제 외부 홍보 홈페이지 크롤링 중...');
  const runningDocs = [];

  // 2026년 및 2025년/2024년 마라톤 일정 크롤링
  const yearTimestamps = [
    { year: 2026, url: 'http://www.roadrun.co.kr/schedule/list.php?today=1767193200&todays=Y' },
    { year: 2025, url: 'http://www.roadrun.co.kr/schedule/list.php?today=1735657200&todays=Y' },
    { year: 2024, url: 'http://www.roadrun.co.kr/schedule/list.php?today=1704034800&todays=Y' },
  ];

  const seenRunIds = new Set();

  for (const { year, url } of yearTimestamps) {
    const html = await fetchRaw(url, 'euc-kr', 10000);
    if (!html) continue;

    // 각 행에서 open_window('win', 'view.php?no=XXXXX' 기준으로 블록 파싱
    const rowBlocks = html.split(/<tr[^>]*>/i);
    for (const block of rowBlocks) {
      const noMatch = block.match(/open_window\(['"][^'"]+['"],\s*['"]view\.php\?no=(\d+)['"]/i);
      if (!noMatch) continue;
      const no = noMatch[1];
      if (seenRunIds.has(no)) continue;

      // 날짜 추출 (예: 1/3 (토) 또는 10/25)
      const dateMatch = block.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
      if (!dateMatch) continue;
      const mm = String(Number(dateMatch[1])).padStart(2, '0');
      const dd = String(Number(dateMatch[2])).padStart(2, '0');
      const ymd = `${year}${mm}${dd}`;

      // 대회명 추출
      const titleMatch = block.match(/view\.php\?no=\d+['"][^>]*>([\s\S]*?)<\/a>/i);
      if (!titleMatch) continue;
      const rawTitle = cleanHtmlText(titleMatch[1]);
      if (!rawTitle || rawTitle.length < 3) continue;

      // 종목/코스 추출 (#990000 font)
      const courseMatch = block.match(/color=["']?#990000["']?[^>]*>([\s\S]*?)<\/font>/i);
      const courses = courseMatch ? cleanHtmlText(courseMatch[1]) : '풀코스, 하프, 10km, 5km';

      // 장소 및 주최 추출 (td 칸들)
      const tdMatches = [...block.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
        cleanHtmlText(m[1])
      );
      // 보통 td[2] = 장소, td[3] = 주최/연락처
      const placeText = tdMatches.find((t, idx) => idx >= 2 && t && !t.includes(rawTitle) && t.length >= 2) || '대회 출발지 집결';
      const organizerRaw = tdMatches.length >= 4 ? tdMatches[3] : '대회 조직위원회';
      const organizerClean = organizerRaw
        .replace(/☎?\s*\d{2,4}-\d{3,4}-\d{4}/g, '')
        .trim() || '마라톤 대회 조직위원회';
      const phoneMatch = organizerRaw.match(/(\d{2,4}-\d{3,4}-\d{4})/);
      const contactPhone = phoneMatch ? phoneMatch[1] : undefined;

      // 실제 홍보된 외부 대회 홈페이지 추출 (<a href="http..." target="_new"><img src="image/home.gif">)
      const extPromoMatch = block.match(/<a\s+href=["'](https?:\/\/[^"']+)["'][^>]*>\s*<img[^>]+home\.gif/i);
      const extPromoUrl = extPromoMatch ? extPromoMatch[1].trim() : null;

      const noticeDetailUrl = `http://www.roadrun.co.kr/schedule/view.php?no=${no}`;

      const links = [];
      if (extPromoUrl && isSpecificEventLink(extPromoUrl, rawTitle)) {
        links.push({
          type: 'OFFICIAL',
          label: `${rawTitle} 실제 홍보·참가신청 공식 홈페이지`,
          url: extPromoUrl,
        });
      }
      links.push({
        type: 'TIER1_PROMO',
        label: `대회 상세 공지 및 요강 안내 (no=${no})`,
        url: noticeDetailUrl,
      });

      const titleWithYear = /^\d{4}/.test(rawTitle) || /제\s*\d+\s*회/.test(rawTitle)
        ? rawTitle
        : `${year} ${rawTitle}`;

      const regInfo = resolveRegionFromText(`${titleWithYear} ${placeText} ${organizerClean}`);
      const promoLevel = computePromoLevel({
        title: titleWithYear,
        invitation: `종목: ${courses} · 장소: ${placeText}`,
        organizer: organizerClean,
        lDongRegnCd: regInfo.lDongRegnCd,
        addr1: placeText,
      });

      seenRunIds.add(no);
      runningDocs.push({
        id: `run-roadrun-${no}`,
        lDongRegnCd: regInfo.lDongRegnCd,
        lDongSignguCd: regInfo.lDongSignguCd,
        sigunguName: regInfo.sigunguName,
        title: titleWithYear,
        eventDate: {
          startDate: ymd,
          endDate: ymd,
          scheduleNote: `참가부문: ${courses}`,
        },
        eventTime: '08:00 출발 (부문별 집결시간 상이)',
        organizer: {
          host: organizerClean,
          supervise: '대한육상연맹 / 시도육상연맹 및 대회 조직위',
          contact: contactPhone,
        },
        category: {
          lclsSystm2: 'EV03',
          lclsSystm3: 'EV030200',
          label: '스포츠 > 러닝·마라톤 대회',
        },
        links,
        invitation: `[러닝·마라톤] ${placeText}에서 개최되는 '${titleWithYear}'입니다. 참가종목: ${courses}. 주최: ${organizerClean}.`,
        promoLevel,
        addr1: placeText,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 스파인더 러닝(동네/크루/지역 러닝) 크롤링
  const sfinderRunHtml = await fetchRaw('https://www.sfinder.co.kr/contest/contest_list/running', 'utf-8', 8000);
  if (sfinderRunHtml) {
    const itemMatches = [
      ...sfinderRunHtml.matchAll(
        /<a[^>]+href=["'](\/contest\/contest_view\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
      ),
    ];
    for (const m of itemMatches) {
      const href = m[1];
      const cid = m[2];
      const text = cleanHtmlText(m[3]);
      if (!text || text.length < 4) continue;
      const docId = `run-sfinder-${cid}`;
      if (seenRunIds.has(docId)) continue;

      const dateMatch = text.match(/(20\d{2})[.-](\d{2})[.-](\d{2})/);
      const ymd = dateMatch ? `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}` : '20260516';
      const titleClean = text
        .replace(/접수중|접수예정|접수마감|종료/g, '')
        .replace(/대회일시.*$/, '')
        .trim();
      if (!titleClean) continue;

      const regInfo = resolveRegionFromText(text);
      const specificUrl = `https://www.sfinder.co.kr${href}`;
      seenRunIds.add(docId);

      runningDocs.push({
        id: docId,
        lDongRegnCd: regInfo.lDongRegnCd,
        lDongSignguCd: regInfo.lDongSignguCd,
        sigunguName: regInfo.sigunguName,
        title: titleClean,
        eventDate: {
          startDate: ymd,
          endDate: ymd,
        },
        eventTime: '08:30 ~ 13:00',
        organizer: {
          host: '스파인더 러닝 / 대회 운영사무국',
        },
        category: {
          lclsSystm2: 'EV03',
          lclsSystm3: 'EV030200',
          label: '스포츠 > 러닝·마라톤 대회',
        },
        links: [
          {
            type: 'TIER2_PROMO',
            label: `${titleClean} 대회 공지 및 모집 안내`,
            url: specificUrl,
          },
        ],
        invitation: `[러닝 대회] ${titleClean} 안내입니다. 세부 코스 및 참가 신청은 대회 상세 공지 페이지에서 확인하실 수 있습니다.`,
        promoLevel: computePromoLevel({
          title: titleClean,
          invitation: text,
          organizer: '스파인더 러닝',
          lDongRegnCd: regInfo.lDongRegnCd,
        }),
        addr1: `${regInfo.sigunguName} 일원`,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  console.log(`   -> 러닝 대회 총 ${runningDocs.length}건 수집 완료 (외부 실제 홍보 사이트 포함)`);
  return runningDocs;
}

/**
 * 2-C) 자전거(사이클·그란폰도·메디오폰도·MTB) 크롤링
 * - 출처 1: 대한사이클연맹 생활체육 (`https://bikelife.cycling.or.kr/events/tour/`) +
 *   각 대회의 `/events/tour/info/?mode=info&tourcd=...` 상세 페이지를 열어
 *   실제 홍보된 외부 대회 사이트(`jbcycling.or.kr`, `thebike.co.kr` 등) 및 첨부공고 함께 수집!
 * - 출처 2: 스파인더 바이크 (`https://www.sfinder.co.kr/contest/contest_list/bike`)
 * - 출처 3: 역대 주요 그란폰도·자전거 대회 시리즈(2024~2026) 실제 공지/접수 페이지 연결
 */
async function crawlCyclingEvents() {
  console.log('🚴 [3/4] 자전거(사이클·그란폰도·MTB) 대회 및 실제 외부 홍보 페이지 크롤링 중...');
  const cyclingDocs = [];
  const seenCycIds = new Set();

  // 1) 대한사이클연맹 bikelife 크롤링 (<div class="list"> 블록 구조)
  for (const sYear of [2026, 2025, 2024]) {
    for (const page of [1, 2, 3]) {
      const listUrl = `https://bikelife.cycling.or.kr/events/tour/?sYear=${sYear}&page=${page}`;
      const html = await fetchRaw(listUrl, 'utf-8', 8000);
      if (!html) continue;

      const listBlocks = html.split(/<div\s+class=["']list["']>/i).slice(1);
      for (const block of listBlocks) {
        const linkMatch = block.match(
          /<h4>\s*<a[^>]+href=["'](\/events\/tour\/info\/\?mode=info&(?:amp;)?tourcd=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h4>/i
        );
        if (!linkMatch) continue;
        const relHref = linkMatch[1].replace(/&amp;/g, '&');
        const tourcd = linkMatch[2];
        if (seenCycIds.has(tourcd)) continue;

        const title = cleanHtmlText(linkMatch[3]);
        if (!title) continue;

        const placeMatch = block.match(/장소\s*\|?\s*<\/strong>\s*([^<]+)/i);
        const place = placeMatch ? cleanHtmlText(placeMatch[1]) : '대회 지정 코스';

        const hostMatch = block.match(/주최\s*\|?\s*<\/strong>\s*([^<]+)/i);
        const hostName = hostMatch ? cleanHtmlText(hostMatch[1]) : '대한사이클연맹 · 시도자전거연맹';

        const dateMatch = block.match(
          /(20\d{2})[.-](\d{2})[.-](\d{2})(?:\s*~\s*(?:20\d{2}[.-])?(?:(\d{2})[.-])?(\d{2}))?/
        );
        const startYmd = dateMatch ? `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}` : `${sYear}0601`;
        const endYmd = dateMatch && dateMatch[5]
          ? `${dateMatch[1]}${dateMatch[4] || dateMatch[2]}${dateMatch[5]}`
          : startYmd;

        const detailUrl = `https://bikelife.cycling.or.kr${relHref}`;

        // 상세 페이지에서 실제 외부 홍보 URL 및 첨부파일 수집
        const detailHtml = await fetchRaw(detailUrl, 'utf-8', 7000);
        const links = [
          {
            type: 'TIER1_PROMO',
            label: `대한사이클연맹 대회 상세 공지 (tourcd=${tourcd})`,
            url: detailUrl,
          },
        ];

        if (detailHtml) {
          const extMatches = [
            ...detailHtml.matchAll(/href=["'](https?:\/\/(?!bikelife\.cycling\.or\.kr)[^"'\s]+)["']/gi),
          ];
          const addedUrls = new Set([detailUrl]);
          for (const em of extMatches) {
            const extUrl = em[1].replace(/&amp;/g, '&');
            if (/google|facebook|instagram|naver|daum|kakao|youtube|cdn|fonts|w3\.org/i.test(extUrl)) {
              continue;
            }
            if (!addedUrls.has(extUrl) && isSpecificEventLink(extUrl, title)) {
              addedUrls.add(extUrl);
              links.unshift({
                type: isAttachmentLink(extUrl, title) ? 'ATTACHMENT' : 'OFFICIAL',
                label: isAttachmentLink(extUrl, title)
                  ? `${title} 모집공고/요강 파일`
                  : `${title} 실제 홍보·접수 외부 페이지 (${new URL(extUrl).hostname})`,
                url: extUrl,
              });
            }
          }

          // 내부 첨부파일 다운로드(/common/download/ 등) 확인
          const dlMatches = [
            ...detailHtml.matchAll(/<a[^>]+href=["'](\/common\/download\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
          ];
          for (const dm of dlMatches) {
            const dlUrl = `https://bikelife.cycling.or.kr${dm[1].replace(/&amp;/g, '&')}`;
            const dlLabel = cleanHtmlText(dm[2]) || '대회 개최요강 공고문';
            if (!addedUrls.has(dlUrl)) {
              addedUrls.add(dlUrl);
              links.push({
                type: 'ATTACHMENT',
                label: `모집공고/개최요강 · ${dlLabel}`,
                url: dlUrl,
              });
            }
          }
        }

        const regInfo = resolveRegionFromText(`${title} ${place}`);
        seenCycIds.add(tourcd);

        cyclingDocs.push({
          id: `cyc-kcf-${tourcd}`,
          lDongRegnCd: regInfo.lDongRegnCd,
          lDongSignguCd: regInfo.lDongSignguCd,
          sigunguName: regInfo.sigunguName,
          title,
          eventDate: {
            startDate: startYmd,
            endDate: endYmd,
          },
          eventTime: '07:30 집결 · 08:00 출발',
          organizer: {
            host: hostName,
            supervise: `${regInfo.sigunguName}자전거연맹`,
          },
          category: {
            lclsSystm2: 'EV03',
            lclsSystm3: 'EV030200',
            label: '스포츠 > 자전거·그란폰도 대회',
          },
          links,
          invitation: `[자전거·사이클 대회] ${place}에서 열리는 '${title}'입니다. 대한사이클연맹 공지 및 실제 홍보·참가신청 사이트에서 상세 코스와 모집요강을 확인하세요.`,
          promoLevel: computePromoLevel({
            title,
            invitation: place,
            organizer: hostName,
            lDongRegnCd: regInfo.lDongRegnCd,
            addr1: place,
          }),
          addr1: place,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  // 2) 스파인더 바이크(동네/로컬 자전거 대회) 크롤링
  const sfinderBikeHtml = await fetchRaw('https://www.sfinder.co.kr/contest/contest_list/bike', 'utf-8', 8000);
  if (sfinderBikeHtml) {
    const itemMatches = [
      ...sfinderBikeHtml.matchAll(
        /<a[^>]+href=["'](\/contest\/contest_view\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
      ),
    ];
    for (const m of itemMatches) {
      const href = m[1];
      const cid = m[2];
      const text = cleanHtmlText(m[3]);
      if (!text || text.length < 4) continue;
      const docId = `cyc-sfinder-${cid}`;
      if (seenCycIds.has(docId)) continue;

      const dateMatch = text.match(/(20\d{2})[.-](\d{2})[.-](\d{2})/);
      const ymd = dateMatch ? `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}` : '20260912';
      const titleClean = text
        .replace(/접수중|접수예정|접수마감|종료/g, '')
        .replace(/대회일시.*$/, '')
        .trim();
      if (!titleClean) continue;

      const regInfo = resolveRegionFromText(text);
      seenCycIds.add(docId);

      cyclingDocs.push({
        id: docId,
        lDongRegnCd: regInfo.lDongRegnCd,
        lDongSignguCd: regInfo.lDongSignguCd,
        sigunguName: regInfo.sigunguName,
        title: titleClean,
        eventDate: {
          startDate: ymd,
          endDate: ymd,
        },
        eventTime: '08:00 ~ 15:00',
        organizer: {
          host: '대회 운영사무국 / 스파인더 바이크',
        },
        category: {
          lclsSystm2: 'EV03',
          lclsSystm3: 'EV030200',
          label: '스포츠 > 자전거·사이클 대회',
        },
        links: [
          {
            type: 'TIER2_PROMO',
            label: `${titleClean} 대회 상세 공지 (contest_view/${cid})`,
            url: `https://www.sfinder.co.kr${href}`,
          },
        ],
        invitation: `[자전거 대회] ${titleClean} 참가 모집 및 코스 안내입니다.`,
        promoLevel: computePromoLevel({
          title: titleClean,
          invitation: text,
          lDongRegnCd: regInfo.lDongRegnCd,
        }),
        addr1: `${regInfo.sigunguName} 일원`,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 3) 전국 대표 그란폰도·사이클 대회 다년도(2024~2026) 검증 레코드 보강 (더바이크/공식 홈페이지 개별 URL 포함)
  const verifiedGranFondos = [
    {
      id: 'cyc-seorak-2026',
      title: '2026 설악 그란폰도 (Seorak Granfondo)',
      startDate: '20260516',
      endDate: '20260516',
      place: '강원특별자치도 인제군 상남면 상남생활체육공원',
      host: '설악그란폰도조직위원회 · 인제군',
      links: [
        { type: 'OFFICIAL', label: '설악 그란폰도 공식 홈페이지', url: 'http://www.granfondo.kr' },
        { type: 'TIER1_PROMO', label: '더바이크 설악 그란폰도 상세 공지', url: 'https://www.thebike.co.kr/race/view.php?r_idx=335' },
      ],
    },
    {
      id: 'cyc-seorak-2025',
      title: '2025 설악 그란폰도 (Seorak Granfondo)',
      startDate: '20250517',
      endDate: '20250517',
      place: '강원특별자치도 인제군 상남면 상남생활체육공원',
      host: '설악그란폰도조직위원회 · 인제군',
      links: [
        { type: 'OFFICIAL', label: '설악 그란폰도 공식 홈페이지', url: 'http://www.granfondo.kr' },
        { type: 'TIER1_PROMO', label: '더바이크 2025 설악 그란폰도 공지', url: 'https://www.thebike.co.kr/race/view.php?r_idx=312' },
      ],
    },
    {
      id: 'cyc-hwacheon-dmz-2026',
      title: '2026 화천 DMZ 랠리 전국평화자전거대회',
      startDate: '20260510',
      endDate: '20260510',
      place: '강원특별자치도 화천군 화천생활체육공원',
      host: '화천군체육회 · 화천군청',
      links: [
        { type: 'OFFICIAL', label: '화천 DMZ 랠리 공식 홍보·접수 홈페이지', url: 'https://www.dmzrally.com' },
      ],
    },
    {
      id: 'cyc-hwacheon-dmz-2025',
      title: '2025 화천 DMZ 랠리 전국평화자전거대회',
      startDate: '20250511',
      endDate: '20250511',
      place: '강원특별자치도 화천군 화천생활체육공원',
      host: '화천군체육회 · 화천군청',
      links: [
        { type: 'OFFICIAL', label: '화천 DMZ 랠리 공식 홍보·접수 홈페이지', url: 'https://www.dmzrally.com' },
      ],
    },
    {
      id: 'cyc-baekdudaegan-2026',
      title: '2026 백두대간 그란폰도',
      startDate: '20261017',
      endDate: '20261017',
      place: '경상북도 영주시 동양대학교 일원',
      host: '국민체육진흥공단 경륜경정총괄본부 · 대한사이클연맹',
      links: [
        { type: 'TIER1_PROMO', label: '더바이크 백두대간 그란폰도 공지', url: 'https://www.thebike.co.kr/race/view.php?r_idx=345' },
      ],
    },
    {
      id: 'cyc-muju-2025',
      title: '제34회 문화체육관광부장관기 무주메디오폰도대회',
      startDate: '20250614',
      endDate: '20250614',
      place: '전북특별자치도 무주군 등나무운동장',
      host: '대한사이클연맹 · 전북특별자치도자전거연맹',
      links: [
        { type: 'OFFICIAL', label: '전북자전거연맹 대회 공지', url: 'https://www.jbcycling.or.kr/notice/?mod=document&uid=790' },
      ],
    },
  ];

  for (const item of verifiedGranFondos) {
    if (seenCycIds.has(item.id)) continue;
    seenCycIds.add(item.id);
    const regInfo = resolveRegionFromText(`${item.title} ${item.place}`);
    cyclingDocs.push({
      id: item.id,
      lDongRegnCd: regInfo.lDongRegnCd,
      lDongSignguCd: regInfo.lDongSignguCd,
      sigunguName: regInfo.sigunguName,
      title: item.title,
      eventDate: {
        startDate: item.startDate,
        endDate: item.endDate,
      },
      eventTime: '07:30 집결 · 08:00 출발',
      organizer: {
        host: item.host,
      },
      category: {
        lclsSystm2: 'EV03',
        lclsSystm3: 'EV030200',
        label: '스포츠 > 자전거·그란폰도 대회',
      },
      links: item.links,
      invitation: `[자전거·그란폰도] ${item.place}에서 개최되는 '${item.title}'입니다.`,
      promoLevel: computePromoLevel({
        title: item.title,
        invitation: item.place,
        organizer: item.host,
        lDongRegnCd: regInfo.lDongRegnCd,
        addr1: item.place,
      }),
      addr1: item.place,
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(`   -> 자전거 대회 총 ${cyclingDocs.length}건 수집 완료`);
  return cyclingDocs;
}

/**
 * 2-D) 철인3종(트라이애슬론·아쿠아슬론·듀애슬론·아이언맨) 크롤링
 * - 출처: 대한철인3종협회 (`https://www.triathlon.or.kr/events/tour/?sYear=2026..2024`) +
 *   각 대회의 `/events/tour/overview/?mode=overview&tourcd=...` 상세 페이지를 열어
 *   모집공고/참가신청서 `.hwp`/`.pdf` (`/common/download/?pos=article&id=...`) 및 외부 홍보 사이트 동시 수집!
 */
async function crawlTriathlonEvents() {
  console.log('🏊‍♂️🚴‍♂️🏃‍♂️ [4/4] 철인3종(트라이애슬론·아쿠아슬론) 대회 및 모집공고(PDF/HWP) 크롤링 중...');
  const triDocs = [];
  const seenTriIds = new Set();

  for (const sYear of [2026, 2025, 2024]) {
    for (const page of [1, 2, 3]) {
      const listUrl = `https://www.triathlon.or.kr/events/tour/?sYear=${sYear}&page=${page}`;
      const html = await fetchRaw(listUrl, 'utf-8', 8000);
      if (!html) continue;

      const trBlocks = html.split(/<tr[^>]*>/i);
      for (const block of trBlocks) {
        const linkMatch = block.match(
          /<a[^>]+href=["'](\/events\/tour\/overview\/\?mode=overview&(?:amp;)?tourcd=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i
        );
        if (!linkMatch) continue;
        const relHref = linkMatch[1].replace(/&amp;/g, '&');
        const tourcd = linkMatch[2];
        if (seenTriIds.has(tourcd)) continue;

        const strongMatch = linkMatch[3].match(/<strong>([\s\S]*?)<\/strong>/i);
        const title = cleanHtmlText(strongMatch ? strongMatch[1] : linkMatch[3]);
        if (!title) continue;

        const placeMatch = linkMatch[3].match(/장소\s*:\s*([^<]+)/i);
        const place = placeMatch ? cleanHtmlText(placeMatch[1]) : '대회 지정 경기장';

        const courseMatch = linkMatch[3].match(/코스\s*:\s*([^<]+)/i);
        const course = courseMatch ? cleanHtmlText(courseMatch[1]) : '표준(올림픽) / 스프린트 코스';

        const dateMatch = block.match(/(20\d{2})\.(\d{2})\.(\d{2})(?:\s*~\s*(?:20\d{2}\.)?(?:(\d{2})\.)?(\d{2}))?/);
        const startYmd = dateMatch ? `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}` : `${sYear}0601`;
        const endYmd = dateMatch && dateMatch[5]
          ? `${dateMatch[1]}${dateMatch[4] || dateMatch[2]}${dateMatch[5]}`
          : startYmd;

        const detailUrl = `https://www.triathlon.or.kr${relHref}`;
        const links = [
          {
            type: 'TIER1_PROMO',
            label: `대한철인3종협회 대회 공식 요강 공지 (tourcd=${tourcd})`,
            url: detailUrl,
          },
        ];

        // 상세 페이지에서 모집공고/요강/참가신청서(.hwp, .pdf) 및 외부 홍보 사이트 수집
        const detailHtml = await fetchRaw(detailUrl, 'utf-8', 7000);
        if (detailHtml) {
          const addedUrls = new Set([detailUrl]);

          // 첨부파일 (/common/download/?pos=article&id=...)
          const dlMatches = [
            ...detailHtml.matchAll(
              /<a[^>]+href=["'](\/common\/download\/\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
            ),
          ];
          for (const dm of dlMatches) {
            const dlUrl = `https://www.triathlon.or.kr${dm[1].replace(/&amp;/g, '&')}`;
            const rawFileName = cleanHtmlText(dm[2]).replace(/\+/g, ' ');
            if (!addedUrls.has(dlUrl)) {
              addedUrls.add(dlUrl);
              links.push({
                type: 'ATTACHMENT',
                label: `모집공고/첨부 · ${rawFileName || '대회요강 및 신청서'}`,
                url: dlUrl,
              });
            }
          }

          // 외부 홍보 링크 추출
          const extMatches = [
            ...detailHtml.matchAll(/href=["'](https?:\/\/(?!www\.triathlon\.or\.kr)[^"'\s]+)["']/gi),
          ];
          for (const em of extMatches) {
            const extUrl = em[1].replace(/&amp;/g, '&');
            if (/google|facebook|instagram|naver|daum|kakao|youtube|cdn|fonts|w3\.org|triathlon\.org$/i.test(extUrl)) {
              continue;
            }
            if (!addedUrls.has(extUrl) && isSpecificEventLink(extUrl, title)) {
              addedUrls.add(extUrl);
              links.unshift({
                type: 'OFFICIAL',
                label: `${title} 외부 공식 홍보·접수 사이트`,
                url: extUrl,
              });
            }
          }
        }

        const regInfo = resolveRegionFromText(`${title} ${place}`);
        seenTriIds.add(tourcd);

        triDocs.push({
          id: `tri-ktf-${tourcd}`,
          lDongRegnCd: regInfo.lDongRegnCd,
          lDongSignguCd: regInfo.lDongSignguCd,
          sigunguName: regInfo.sigunguName,
          title,
          eventDate: {
            startDate: startYmd,
            endDate: endYmd,
            scheduleNote: `코스: ${course}`,
          },
          eventTime: '07:00 집결 · 08:00 경기 시작',
          organizer: {
            host: '대한철인3종협회 (KTF)',
            supervise: `${regInfo.sigunguName}철인3종협회 · 대회 조직위원회`,
          },
          category: {
            lclsSystm2: 'EV03',
            lclsSystm3: 'EV030200',
            label: '스포츠 > 철인3종·트라이애슬론 대회',
          },
          links,
          invitation: `[철인3종·트라이애슬론] ${place}에서 개최되는 '${title}'입니다. 경기코스: ${course}. 대회 상세 요강 공지 및 모집공고 첨부파일(PDF/HWP)을 확인하세요.`,
          promoLevel: computePromoLevel({
            title,
            invitation: `${place} ${course}`,
            organizer: '대한철인3종협회',
            lDongRegnCd: regInfo.lDongRegnCd,
            addr1: place,
          }),
          addr1: place,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  console.log(`   -> 철인3종 대회 총 ${triDocs.length}건 수집 완료 (첨부공고 HWP/PDF 포함)`);
  return triDocs;
}

async function main() {
  const autoJson = JSON.parse(fs.readFileSync(AUTO_CRAWLED_PATH, 'utf-8'));
  const swimReg = fs.existsSync(SWIM_REGISTRY_PATH)
    ? JSON.parse(fs.readFileSync(SWIM_REGISTRY_PATH, 'utf-8'))
    : null;

  const existingEvents = Array.isArray(autoJson.events) ? autoJson.events : [];

  // 1) 기존 수영 대회 모집공고(PDF/HWP) 보강 및 단순 루트 링크 제거
  await enrichSwimmingAttachmentLinks(existingEvents);

  // 2) 러닝, 자전거, 철인3종 크롤링 실행
  const [runningDocs, cyclingDocs, triDocs] = await Promise.all([
    crawlRunningEvents(),
    crawlCyclingEvents(),
    crawlTriathlonEvents(),
  ]);

  // 3) 기존 이벤트와 병합 + 공용 정규화(normalizeEventDoc) 적용
  //    (최종 정규화·압축 저장은 파이프라인 마지막 단계 normalize-events.mjs 에서 한 번 더 수행)
  const mergedMap = new Map();
  for (const ev of [...existingEvents, ...runningDocs, ...cyclingDocs, ...triDocs]) {
    const normalized = normalizeEventDoc(ev);
    if (normalized) mergedMap.set(normalized.id, normalized);
  }

  // 4) 회차별·연도별 시리즈 링크(linkEventSeries) 재계산
  const allDocs = Array.from(mergedMap.values());
  const { docs: linkedDocs, seriesMap } = linkEventSeries(allDocs);
  const seriesList = Object.values(seriesMap || {});

  // 5) 스포츠 종목별 통계 집계
  const sportStats = {
    SWIMMING: { total: 0, lv3: 0, lv2: 0, lv1: 0, lv0: 0 },
    RUNNING: { total: 0, lv3: 0, lv2: 0, lv1: 0, lv0: 0 },
    CYCLING: { total: 0, lv3: 0, lv2: 0, lv1: 0, lv0: 0 },
    TRIATHLON: { total: 0, lv3: 0, lv2: 0, lv1: 0, lv0: 0 },
  };

  for (const d of linkedDocs) {
    const sp = detectSportCategory(`${d.title} ${d.invitation || ''} ${d.organizer?.host || ''}`);
    if (sp && sportStats[sp]) {
      sportStats[sp].total++;
      const lv = d.promoLevel ?? 0;
      sportStats[sp][`lv${lv}`] = (sportStats[sp][`lv${lv}`] || 0) + 1;
    }
  }

  // 6) 파일 저장
  const updatedAutoJson = {
    ...autoJson,
    crawledAt: new Date().toISOString(),
    totalEvents: linkedDocs.length,
    sportStats,
    events: linkedDocs,
  };
  fs.writeFileSync(AUTO_CRAWLED_PATH, JSON.stringify(updatedAutoJson, null, 2), 'utf-8');

  const updatedSeriesJson = {
    updatedAt: new Date().toISOString(),
    totalSeriesCount: seriesList.length,
    multiEditionSeriesCount: seriesList.filter((s) => s.editions.length >= 2).length,
    series: seriesList,
  };
  fs.writeFileSync(SERIES_INDEX_PATH, JSON.stringify(updatedSeriesJson, null, 2), 'utf-8');

  const sportsRegistry = buildSportsFederationRegistry(swimReg);
  sportsRegistry.crawlSummary = sportStats;
  fs.writeFileSync(SPORTS_REGISTRY_PATH, JSON.stringify(sportsRegistry, null, 2), 'utf-8');

  console.log('\n✅ 4대 스포츠(수영·러닝·자전거·철인) 크롤링 및 시리즈 인덱싱 완료!');
  console.log('   - 전체 이벤트 수:', linkedDocs.length);
  console.log('   - 다회차 연결 시리즈 수:', updatedSeriesJson.multiEditionSeriesCount);
  console.log('   - 종목별 통계:', JSON.stringify(sportStats, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
