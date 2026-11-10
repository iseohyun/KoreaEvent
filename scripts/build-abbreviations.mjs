import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const EVENTS_PATH = path.join(ROOT_DIR, 'public', 'data', 'auto-crawled-events.json');
const SRC_ABBR_PATH = path.join(ROOT_DIR, 'src', 'constants', 'abbreviations.json');
const PUB_ABBR_PATH = path.join(ROOT_DIR, 'public', 'data', 'abbreviations.json');

const data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
const docs = Array.isArray(data.events) ? data.events : [];

const regexRules = [
  {
    id: 'regex-strip-notice-prefix',
    label: '전화번호·문의 및 [요강수정]/[참가마감] 등 머리말 제거',
    example: '[요강수정]제11회 서울특별시연맹회장배수영대회 -> 제11회 서울특별시연맹회장배수영대회',
    pattern:
      '(?:\\b0\\d{1,2}-\\d{3,4}-\\d{4}\\b\\s*(?:\\(\\s*문의\\s*\\))?\\s*)|^(?:참가\\s*(?:신청\\s*)?마감\\s*)*(?:\\[[^\\]]+\\]\\s*)+|^(?:\\(\\s*(?:대회\\s*)?(?:참가\\s*(?:신청\\s*)?마감|요강\\s*수정|개최\\s*요강\\s*수정|수정|경영|다이빙(?:\\s*\\/\\s*요강\\s*수정)?|수구|아티스틱\\s*스위밍)\\s*\\)\\s*)+',
    replacement: '',
    enabled: true,
  },
  {
    id: 'regex-jeonnam-gwangju-special',
    label: '전남광주통합특별시(전남/광주) 지자체명 및 띄어쓰기 정리',
    example: '제51회 전남광주통합특별시(전남)학생종합체육대회 (수영경기) -> 51\' 전남 학생종합체육대회(수영)',
    pattern: '전남광주통합특별시\\s*\\(\\s*(전남|광주)\\s*\\)\\s*',
    replacement: '$1 ',
    enabled: true,
  },
  {
    id: 'regex-keep-sport-discipline-paren',
    label: '(수영경기) 등 종목 괄호를 (수영)으로 축약·보존',
    example: '학생종합체육대회 (수영경기) -> 학생종합체육대회(수영)',
    pattern: '\\s*\\(\\s*(수영|경영|다이빙|수구|아티스틱)\\s*(?:경기)?\\s*\\)',
    replacement: '($1)',
    enabled: true,
  },
  {
    id: 'regex-bilingual-en-ko-paren',
    label: '영문+한글(괄호) 병기 시 한글만 표기',
    example: '2026 World Aquatics... (세계수영연맹 경영 월드컵) -> 2026 세계수영연맹 경영 월드컵',
    pattern: '([A-Za-z][A-Za-z0-9\\s.,&:\'"-]*)\\s*\\(([0-9\\s]*[가-힣][^)]*)\\)',
    replacement: '$2',
    enabled: true,
  },
  {
    id: 'regex-bilingual-en-ko-inline',
    label: '영문 대문자+한글 연속 병기 시 한글만 표기',
    example: '2026 LOTTE AQUATHLON 롯데 아쿠아슬론 대회 -> 2026 롯데 아쿠아슬론 대회',
    pattern: '\\b[A-Z]{2,}(?:\\s+[A-Z0-9&.]{2,})+\\s+(?=[가-힣]{2,})',
    replacement: '',
    enabled: true,
  },
  {
    id: 'regex-bilingual-ko-en-tail',
    label: '한글 대회명 뒤 영문 병기 제거',
    example: '2026. G.S 수구 오픈 대회 2026. G.S KOREA WATER POLO OPEN -> 2026. G.S 수구 오픈 대회',
    pattern: '([가-힣])\\s+(?:(?:19|20)\\d{2}\\.?\\s*)?[A-Za-z][A-Za-z0-9.\\s&:\'"-]{7,}$',
    replacement: '$1',
    enabled: true,
  },
  {
    id: 'regex-remove-parens',
    label: '불필요한 부가 괄호 (...) 문구 삭제 ((수영) 등 종목 표기는 유지)',
    example: '2026 물 만난 SWIMMER 페스티벌 (올림픽수영장 자체 행사) -> 2026 물 만난 SWIMMER 페스티벌',
    pattern: '\\s*\\((?!(?:수영|경영|다이빙|수구|아티스틱)\\))[^)]*\\)\\s*',
    replacement: ' ',
    enabled: true,
  },
  {
    id: 'regex-year-4digit',
    label: '연도 년(年) 제거',
    example: '2026년 -> 2026',
    pattern: '((?:19|20)\\d{2})\\s*년',
    replacement: '$1',
    enabled: true,
  },
  {
    id: 'regex-edition-apostrophe',
    label: '제N회 / 제N차 축약 및 뒤 띄어쓰기 보정',
    example: "제25회 -> 25', 제2차 -> 2', 제1회유소년 -> 1' 유소년",
    pattern: '제\\s*(\\d+)\\s*[회차]\\s*',
    replacement: "$1' ",
    enabled: true,
  },
  {
    id: 'regex-cup-swim-suffix',
    label: '~배/기/컵 뒤 중복 (전국/마스터즈/생활체육) 수영대회 생략',
    example: "2026 제16회 창원특례시장배 전국 마스터즈 수영대회 -> 2026 16' 창원시장배",
    pattern: '([배기컵])\\s*(?:전국\\s*)?(?:마스터즈\\s*|생활체육\\s*|전도\\s*)?수영대회',
    replacement: '$1',
    enabled: true,
  },
];

const presetActiveWords = [
  { from: '회장배 전국수영대회', to: '전국 수영연맹회장배', enabled: true },
  { from: '전남광주통합특별시장배', to: '전남광주시장배', enabled: true },
  { from: '전남광주통합특별시', to: '전남광주', enabled: true },
  { from: '창원특례시장배', to: '창원시장배', enabled: true },
  { from: '특례시장배', to: '시장배', enabled: true },
  { from: '특례시장', to: '시장', enabled: true },
  { from: '오픈워터스위밍', to: '오픈워터', enabled: true },
  { from: '전국수영대회', to: '전국배', enabled: true },
  { from: '학생체육대회', to: '학생배', enabled: true },
  { from: '부산광역시', to: '부산', enabled: true },
  { from: '서울특별시', to: '서울', enabled: true },
  { from: '경상남도', to: '경남', enabled: true },
  { from: '경상북도', to: '경북', enabled: true },
  { from: '초등학교', to: '초등', enabled: true },
  { from: '수영대회', to: '대회', enabled: true },
  { from: '국가대표', to: '국대', enabled: true },
  { from: '후보선수', to: '후보', enabled: true },
  { from: '대구광역시', to: '대구', enabled: true },
  { from: '인천광역시', to: '인천', enabled: true },
  { from: '광주광역시', to: '광주', enabled: true },
  { from: '대전광역시', to: '대전', enabled: true },
  { from: '울산광역시', to: '울산', enabled: true },
  { from: '세종특별자치시', to: '세종', enabled: true },
  { from: '강원특별자치도', to: '강원', enabled: true },
  { from: '전북특별자치도', to: '전북', enabled: true },
  { from: '제주특별자치도', to: '제주', enabled: true },
  { from: '충청북도', to: '충북', enabled: true },
  { from: '충청남도', to: '충남', enabled: true },
  { from: '전라북도', to: '전북', enabled: true },
  { from: '전라남도', to: '전남', enabled: true },
  { from: '전국소년체육대회', to: '소년체전', enabled: true },
  { from: '전국생활체육대축전', to: '대축전', enabled: true },
  { from: '전국체육대회', to: '전국체전', enabled: true },
  { from: '아티스틱스위밍', to: '아티스틱', enabled: true },
  { from: '트라이애슬론', to: '철인3종', enabled: true },
];

const freqMap = new Map();
for (const doc of docs) {
  const t = String(doc.title || '');
  const matches = t.match(/[가-힣]{4,}/g) || [];
  for (const w of matches) {
    freqMap.set(w, (freqMap.get(w) || 0) + 1);
  }
}

const presetMap = new Map(presetActiveWords.map((p) => [p.from, p]));
const wordRules = [];
let idx = 1;

for (const p of presetActiveWords) {
  wordRules.push({
    id: `w-${String(idx++).padStart(4, '0')}`,
    from: p.from,
    to: p.to,
    count: freqMap.get(p.from) || 1,
    enabled: p.enabled,
  });
}

const sortedCandidates = Array.from(freqMap.entries())
  .filter(([w]) => !presetMap.has(w))
  .sort(
    (a, b) =>
      b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0], 'ko')
  );

for (const [word, count] of sortedCandidates) {
  wordRules.push({
    id: `w-${String(idx++).padStart(4, '0')}`,
    from: word,
    to: '',
    count,
    enabled: false,
  });
}

const out = {
  version: '1.1.0',
  description:
    '행사명 및 텍스트 축약보기 기본 규칙 (정규식 규칙 및 전체 이벤트에서 수집된 4글자 이상 단어 후보 사전)',
  totalCollectedCandidates: wordRules.length,
  regexRules,
  wordRules,
};

fs.writeFileSync(SRC_ABBR_PATH, JSON.stringify(out, null, 2), 'utf8');
fs.writeFileSync(PUB_ABBR_PATH, JSON.stringify(out, null, 2), 'utf8');
console.log(
  `[abbreviations] 총 ${wordRules.length}개 4글자 이상 단어 후보 수집 및 저장 완료 (기본 활성: ${presetActiveWords.length}개)`
);
