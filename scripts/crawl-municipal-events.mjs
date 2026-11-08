#!/usr/bin/env node
/**
 * 대한민국 행사·축제 포털 — 전국 267개 지자체 홍보 사이트 + 과거 전체 기간 전수 크롤링 & 회차별 시리즈 연결 파이프라인
 *
 * 실행 방법:
 *   npm.cmd run crawl
 *
 * 주요 수행 단계:
 * 1. [Step 1] 전국 267개 지자체(17개 광역 + 250개 시·군·구) 홍보 마스터 레지스트리
 *    (`public/geo/admin-promo-registry.json`)를 로드합니다.
 * 2. [Step 2] 267개 지자체 홍보 홈페이지(`promo1Url`, `promo2Url`, `hallUrl`)를 병렬 워커로
 *    실제 HTTP/HTTPS 접속(자체서명/정부 인증서 호환 포함)하여 홍보용으로 게시된 행사·축제·공연·대회 정보를 전수 추출합니다.
 * 3. [Step 2-B] 지자체 아카이브 심층 수집(서울축제포털 계절별 전체 목록, 거제시 등 지자체 연도별 일정표 2022~2026 및 시정뉴스/새소식 역대 대회 공고)을 수행합니다.
 * 4. [Step 3] 공공데이터포털 KorService2 (`searchFestival2` eventStartDate=19900101 과거 전체 기간) 전 페이지를 스캔하여
 *    모든 등록 행사(880+건)를 수집하고 주요/스포츠 행사의 상세정보(`detailCommon2`, `detailIntro2`)를 결합합니다.
 * 5. [Step 4] 회차별·연도별 시리즈 매칭 엔진(`src/shared/seriesLinker.js`)을 통해
 *    동일 대회/축제의 과거 회차와 현재 회차(예: 제17회 ↔ 제18회 ↔ 제19회)를 자동 연결합니다.
 * 6. [Step 5] 통합 JSON(`public/data/auto-crawled-events.json`), 시리즈 인덱스(`public/data/series-index.json`),
 *    감사 리포트(`public/data/crawl-audit-report.json`)를 저장하고 Firestore 동기화를 시도합니다.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  writeBatch,
} from 'firebase/firestore';
import { computePromoLevel, isSportsEvent, isSwimEvent } from '../src/shared/promoPolicy.js';
import { linkEventSeries } from '../src/shared/seriesLinker.js';
import { bootstrapCheckpointsFromExistingEvents } from './crawl-checkpoint-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const REGISTRY_PATH = path.join(ROOT_DIR, 'public', 'geo', 'admin-promo-registry.json');
const OUTPUT_JSON_PATH = path.join(ROOT_DIR, 'public', 'data', 'auto-crawled-events.json');
const SERIES_INDEX_PATH = path.join(ROOT_DIR, 'public', 'data', 'series-index.json');
const AUDIT_REPORT_PATH = path.join(ROOT_DIR, 'public', 'data', 'crawl-audit-report.json');

const KORSERVICE2_ENDPOINT = 'https://apis.data.go.kr/B551011/KorService2';
// 서비스 키는 소스에 두지 않는다: GitHub Actions Secret(KORSERVICE2_KEY) 또는 로컬 환경변수로 주입
// 로컬 실행 예) PowerShell: $env:KORSERVICE2_KEY="발급키"; npm.cmd run crawl
const KORSERVICE2_KEY =
  process.env.KORSERVICE2_KEY || process.env.VITE_KORSERVICE2_KEY || '';
if (!KORSERVICE2_KEY) {
  console.warn('[Crawler] KORSERVICE2_KEY 환경변수가 없어 공공데이터포털(Step 3) 수집이 실패합니다.');
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDwEWu2_OKbqZC9UIsmb6sW2_pUizdA5Ys',
  authDomain: 'koreaeventlist.firebaseapp.com',
  projectId: 'koreaeventlist',
  storageBucket: 'koreaeventlist.firebasestorage.app',
  messagingSenderId: '603041792508',
  appId: '1:603041792508:web:666141167d411a7d797279',
};

const CRAWL_YEAR = new Date().getFullYear();

const CATEGORY_MAP = {
  EV01: '축제',
  EV02: '공연',
  EV03: '행사·전시',
  MUNICIPAL: '지자체 행정·시민참여',
  EV010100: '문화관광축제',
  EV010200: '문화예술축제',
  EV010300: '지역특산물축제',
  EV010400: '식음료축제',
  EV010500: '생태자연축제',
  EV010600: '기타축제',
  EV020100: '전통공연',
  EV020200: '연극',
  EV020300: '뮤지컬',
  EV020400: '오페라',
  EV020500: '무용',
  EV020600: '클래식음악회',
  EV020700: '대중콘서트',
  EV020800: '영화',
  EV021000: '기타공연',
  EV030100: '박람회',
  EV030200: '전시회',
  EV030300: '스포츠경기·대회',
  EV030400: '기타행사',
  MU010100: '시민나눔·플리마켓',
  MU010200: '주민강좌·평생교육',
  MU010300: '구청·시청 문화행사',
  MU010400: '농특산물 직거래·장터',
  MU010500: '생활체육·시민대회',
};

function inferSmartCategory(title = '', summary = '', rawL2 = 'EV01', rawL3 = 'EV010600') {
  const combined = `${title} ${summary}`;
  if (isSportsEvent(title)) {
    if (/구민|군민|시민생활체육|동호인/.test(combined) && rawL2 === 'MUNICIPAL') {
      return {
        lclsSystm2: 'MUNICIPAL',
        lclsSystm3: 'MU010500',
        label: '지자체 행정·시민참여 > 생활체육·시민대회',
      };
    }
    return {
      lclsSystm2: 'EV03',
      lclsSystm3: 'EV030300',
      label: '행사·전시 > 스포츠경기·대회',
    };
  }

  if (/전시|미술제|아트페어|비엔날레|기획전|개인전|회원전|사진전/.test(title)) {
    return {
      lclsSystm2: 'EV03',
      lclsSystm3: 'EV030200',
      label: '행사·전시 > 전시회',
    };
  }
  if (/박람회|엑스포|페어/.test(title)) {
    return {
      lclsSystm2: 'EV03',
      lclsSystm3: 'EV030100',
      label: '행사·전시 > 박람회',
    };
  }
  if (/연주회|음악회|오케스트라|합창|콘서트|교향악|독주회/.test(title)) {
    return {
      lclsSystm2: 'EV02',
      lclsSystm3: 'EV020600',
      label: '공연 > 클래식음악회',
    };
  }
  if (/뮤지컬/.test(title)) {
    return {
      lclsSystm2: 'EV02',
      lclsSystm3: 'EV020300',
      label: '공연 > 뮤지컬',
    };
  }
  if (/연극|마당극/.test(title)) {
    return {
      lclsSystm2: 'EV02',
      lclsSystm3: 'EV020200',
      label: '공연 > 연극',
    };
  }
  if (/영화제|돗자리\s*영화|상영회/.test(title)) {
    return {
      lclsSystm2: 'EV02',
      lclsSystm3: 'EV020800',
      label: '공연 > 영화',
    };
  }
  if (/국악|판소리|풍물|우리가락|전통/.test(title) && /공연|가락|한마당/.test(title)) {
    return {
      lclsSystm2: 'EV02',
      lclsSystm3: 'EV020100',
      label: '공연 > 전통공연',
    };
  }
  if (/장터|마켓|플리마켓|바자회|직거래/.test(title)) {
    return {
      lclsSystm2: 'MUNICIPAL',
      lclsSystm3: 'MU010100',
      label: '지자체 행정·시민참여 > 시민나눔·플리마켓',
    };
  }

  const l2 = ['EV01', 'EV02', 'EV03', 'MUNICIPAL'].includes(rawL2) ? rawL2 : 'EV01';
  const l3 = CATEGORY_MAP[rawL3] ? rawL3 : l2 === 'MUNICIPAL' ? 'MU010300' : 'EV010600';
  const l2Name = CATEGORY_MAP[l2] || '축제';
  const l3Name = CATEGORY_MAP[l3] || '기타축제';
  return {
    lclsSystm2: l2,
    lclsSystm3: l3,
    label: `${l2Name} > ${l3Name}`,
  };
}

function fetchHtmlSafe(targetUrl, timeoutMs = 4500, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 4) {
      reject(new Error('Too many redirects'));
      return;
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      reject(e);
      return;
    }
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(
      targetUrl,
      {
        rejectUnauthorized: false,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          try {
            const nextUrl = new URL(res.headers.location, targetUrl).toString();
            res.resume();
            fetchHtmlSafe(nextUrl, timeoutMs, depth + 1).then(resolve).catch(reject);
            return;
          } catch (e) {
            reject(e);
            return;
          }
        }
        const chunks = [];
        let totalBytes = 0;
        res.on('data', (c) => {
          totalBytes += c.length;
          if (totalBytes <= 450_000) {
            chunks.push(Buffer.from(c));
          }
        });
        res.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf-8');
          // meta refresh 또는 location.href 리다이렉트 감지 (본문이 매우 짧은 경우)
          if (html.length < 1500 && depth < 3) {
            const metaMatch =
              html.match(/url=([^"'>\s]+)/i) ||
              html.match(/location\.(?:href|replace)\s*\(\s*["']([^"']+)["']\s*\)/i) ||
              html.match(/location\.href\s*=\s*["']([^"']+)["']/i);
            if (metaMatch && metaMatch[1]) {
              try {
                const nextUrl = new URL(metaMatch[1].replace(/&amp;/g, '&'), targetUrl).toString();
                if (nextUrl !== targetUrl) {
                  fetchHtmlSafe(nextUrl, timeoutMs, depth + 1).then(resolve).catch(reject);
                  return;
                }
              } catch {
                // ignore
              }
            }
          }
          resolve({
            statusCode: res.statusCode || 200,
            finalUrl: targetUrl,
            html,
          });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout (${timeoutMs}ms)`));
    });
  });
}

function cleanHtmlText(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/a>|<\/dd>|<\/dt>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&lsquo;|&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&middot;|&bull;/gi, '·')
    .replace(/&ndash;|&mdash;/gi, '-');
}

function extractHighlightsFromHtml(html = '') {
  const cleaned = cleanHtmlText(html);
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 10 && l.length <= 160);

  const keyLines = lines.filter(
    (line) =>
      /일시|기간|장소|코스|프로그램|출발|반환|무료|참가|접수|통제|공연|체험|수영|마라톤|축제|운영/.test(
        line
      ) &&
      !/개인정보|저작권|로그인|사이트맵|패밀리사이트|배너|댓글|만족도|담당부서/.test(line)
  );

  return keyLines.slice(0, 5);
}

/**
 * 텍스트에서 날짜 범위(startDate, endDate: YYYYMMDD)를 추출합니다.
 */
function parseDatesFromText(text = '', defaultYear = CRAWL_YEAR) {
  const s = String(text || '');

  // 1) YYYY.MM.DD ~ YYYY.MM.DD 또는 YYYY-MM-DD ~ YYYY-MM-DD
  const fullRangeMatch = s.match(
    /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})[일.\s]*[~∼\-–]\s*(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/
  );
  if (fullRangeMatch) {
    const startDate = `${fullRangeMatch[1]}${String(fullRangeMatch[2]).padStart(2, '0')}${String(
      fullRangeMatch[3]
    ).padStart(2, '0')}`;
    const endDate = `${fullRangeMatch[4]}${String(fullRangeMatch[5]).padStart(2, '0')}${String(
      fullRangeMatch[6]
    ).padStart(2, '0')}`;
    return { startDate, endDate };
  }

  // 2) YYYY.MM.DD ~ MM.DD 또는 YYYY.MM.DD ~ DD
  const partialRangeMatch = s.match(
    /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})[^0-9~∼\-]{0,8}[~∼\-–]\s*(?:(\d{1,2})\s*[.\-/월]\s*)?(\d{1,2})/
  );
  if (partialRangeMatch) {
    const y = partialRangeMatch[1];
    const m1 = String(partialRangeMatch[2]).padStart(2, '0');
    const d1 = String(partialRangeMatch[3]).padStart(2, '0');
    const m2 = String(partialRangeMatch[4] || partialRangeMatch[2]).padStart(2, '0');
    const d2 = String(partialRangeMatch[5]).padStart(2, '0');
    return {
      startDate: `${y}${m1}${d1}`,
      endDate: `${y}${m2}${d2}`,
    };
  }

  // 3) 단일 날짜 YYYY.MM.DD
  const singleDateMatch = s.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (singleDateMatch) {
    const ymd = `${singleDateMatch[1]}${String(singleDateMatch[2]).padStart(2, '0')}${String(
      singleDateMatch[3]
    ).padStart(2, '0')}`;
    return { startDate: ymd, endDate: ymd };
  }

  // 4) 연도만 있는 경우: 실제 일정을 모르므로 연중 범위로 기록
  //    → 파이프라인 마지막 단계(normalize-events.mjs)에서 스포츠는 제외, 일반 행사는 dateUnknown 으로 표시됨
  const yearMatch = s.match(/\b(20\d{2})\s*년?/);
  const y = yearMatch ? Number(yearMatch[1]) : defaultYear;
  return {
    startDate: `${y}0101`,
    endDate: `${y}1231`,
  };
}

/**
 * 지자체 HTML에서 홍보성 행사/축제/대회 링크 및 카드 항목 추출
 */
const PROMO_TITLE_RE =
  /축제|페스티벌|페스타|문화제|예술제|문학제|미술제|음악제|영화제|가요제|연주회|음악회|콘서트|오케스트라|합창단|뮤지컬|오페라|마당극|박람회|엑스포|전시회|기획전|특별전|비엔날레|수영대회|바다수영|펭귄수영|마스터즈\s*수영|마라톤|걷기대회|걷기축제|자전거\s*대회|자전거\s*대행진|체육대회|시장배|군수배|구청장배|도지사배|경연대회|경진대회|직거래장터|플리마켓|야시장|야행|불꽃축제|해맞이/;

const PROMO_NOISE_RE =
  /개인정보|저작권|사이트맵|로그인|회원가입|조직도|청사안내|오시는\s*길|길찾기|배너|패밀리사이트|만족도|담당부서|뷰어\s*다운|더보기|바로가기|목록으로|이전글|다음글|전체메뉴|본문바로가기|통합검색|행정서비스|민원|고시공고|입찰|채용|모집\s*공고(?!.*(?:축제|대회|가요제|경연))|결과\s*공개|선정\s*결과|취소\s*알림|시내버스\s*우회|정체구간|방제계획|위원회|협의회|간부회의/;

function extractPromoPostsFromMunicipalHtml(html = '', baseUrl = '', targetMeta) {
  const posts = [];
  const seenTitles = new Set();

  const aMatches = [
    ...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ];

  for (const m of aMatches) {
    const rawHref = m[1].replace(/&amp;/g, '&').trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) {
      continue;
    }

    const rawText = cleanHtmlText(m[2]).replace(/\s+/g, ' ').trim();
    if (rawText.length < 6 || rawText.length > 140) continue;
    if (!PROMO_TITLE_RE.test(rawText)) continue;
    if (PROMO_NOISE_RE.test(rawText)) continue;

    // 너무 일반적인 메뉴명 제외 (예: "문화/공연행사", "즐거운축제", "축제와 문화", "이달의 문화행사")
    const strippedMenu = rawText.replace(/\s+/g, '');
    if (
      /^(즐거운축제|문화\/?공연행사|축제\/?행사|축제와문화|이달의문화행사|지역별축제|계절별축제|송파의모든축제|문화관광축제|체육대회|행사일정표|축제안내|축제홍보신청)$/.test(
        strippedMenu
      )
    ) {
      continue;
    }

    let resolvedUrl = baseUrl;
    try {
      resolvedUrl = new URL(rawHref, baseUrl).toString();
    } catch {
      resolvedUrl = baseUrl;
    }

    // 제목과 부가 설명 분리 (앵커 내부에 기간/장소가 같이 들어있는 경우)
    let title = rawText;
    let extraDesc = '';
    const periodSplit = rawText.match(
      /^(.*?)\s+(?:기간\s*)?(20\d{2}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2}[\s\S]*)$/
    );
    if (periodSplit && periodSplit[1].length >= 4) {
      title = periodSplit[1].trim();
      extraDesc = periodSplit[2].trim();
    }

    // 불필요한 말머리 정리
    title = title
      .replace(/\s*새글\s*$/g, '')
      .replace(/\s*자세히보기\s*→?\s*$/g, '')
      .replace(/\s*상세보기\s*$/g, '')
      .trim();

    if (title.length < 5) continue;

    const dedupKey = title.replace(/\s+/g, '').toLowerCase();
    if (seenTitles.has(dedupKey)) continue;
    seenTitles.add(dedupKey);

    const { startDate, endDate } = parseDatesFromText(rawText, CRAWL_YEAR);

    posts.push({
      title,
      url: resolvedUrl,
      startDate,
      endDate,
      snippet: extraDesc || rawText,
      targetMeta,
    });
  }

  return posts;
}

/**
 * 267개 지자체 홍보 사이트 병렬 전수 스캐너 + 홍보 게시물 추출기 (Worker Pool)
 */
async function scanAll267MunicipalSites(registry, concurrency = 25) {
  const targets = [];

  for (const prov of Object.values(registry.provinces || {})) {
    targets.push({
      tier: 'TIER1_PROVINCE',
      key: prov.regionId,
      regionId: prov.regionId,
      name: prov.name,
      sigunguName: prov.name,
      lDongRegnCd: prov.lDongRegnCd,
      lDongSignguCd: '000',
      promoName: prov.promo1Name,
      url: prov.promo1Url,
      fallbackUrls: [prov.promo2Url, prov.hallUrl].filter(Boolean),
      hallName: prov.hallName,
    });
  }

  for (const [muniKey, muni] of Object.entries(registry.municipalities || {})) {
    targets.push({
      tier: 'TIER2_MUNICIPALITY',
      key: muniKey,
      regionId: muni.regionId,
      name: `${muni.regionName} ${muni.name}`,
      sigunguName: muni.name,
      lDongRegnCd: muni.lDongRegnCd,
      lDongSignguCd: muni.lDongSignguCd,
      promoName: muni.promo1Name,
      url: muni.promo1Url,
      fallbackUrls: [muni.hallUrl, muni.promo2Url].filter(Boolean),
      hallName: muni.hallName,
    });
  }

  const results = [];
  const extractedMunicipalPosts = [];
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const idx = cursor++;
      const target = targets[idx];
      const startMs = Date.now();

      const candidateUrls = [target.url, ...(target.fallbackUrls || [])].filter(Boolean);
      let fetched = null;
      let usedUrl = target.url;
      let lastError = null;

      for (const u of candidateUrls) {
        try {
          const res = await fetchHtmlSafe(u, 4500);
          if (res.statusCode >= 200 && res.statusCode < 400 && res.html.length > 200) {
            fetched = res;
            usedUrl = res.finalUrl || u;
            break;
          }
        } catch (err) {
          lastError = err;
        }
      }

      if (fetched) {
        const { statusCode, html } = fetched;
        const text = cleanHtmlText(html);
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.replace(/\s+/g, ' ').trim())
          .filter((l) => l.length >= 6 && l.length <= 120);

        const swimMentions = lines.filter((l) =>
          /수영대회|바다수영|핀수영|수영장|수영교실|수영강습|마스터즈수영|펭귄수영|아쿠아/i.test(l)
        );
        const festivalMentions = lines.filter(
          (l) =>
            /축제|페스티벌|문화제|음악회|콘서트|마라톤|체육대회|박람회/i.test(l) &&
            !/메뉴|배너|저작권|개인정보|사이트맵/.test(l)
        );

        const posts = extractPromoPostsFromMunicipalHtml(html, usedUrl, target);
        for (const p of posts.slice(0, 12)) {
          extractedMunicipalPosts.push(p);
        }

        results.push({
          ...target,
          reachable: true,
          statusCode,
          usedUrl,
          elapsedMs: Date.now() - startMs,
          extractedPostCount: posts.length,
          swimMentionCount: swimMentions.length,
          swimSnippets: swimMentions.slice(0, 3),
          festivalMentionCount: festivalMentions.length,
          festivalSnippets: festivalMentions.slice(0, 3),
        });
      } else {
        results.push({
          ...target,
          reachable: false,
          statusCode: 0,
          elapsedMs: Date.now() - startMs,
          error: lastError?.message || 'Fetch error',
          extractedPostCount: 0,
          swimMentionCount: 0,
          swimSnippets: [],
          festivalMentionCount: 0,
          festivalSnippets: [],
        });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return { siteScanResults: results, extractedMunicipalPosts };
}

/**
 * [Step 2-B] 주요 지자체 홍보 포털 심층 아카이브 크롤러
 * - 서울축제포털 (festival.seoul.go.kr/festival/seasonal/list.do) 150+건
 * - 거제시 문화관광 (tour.geoje.go.kr 축제 상세 14개 + schedule/list.geoje 2022~2026 연도별 일정표 + 거제시청 새소식/시정뉴스 역대 대회)
 */
async function crawlDeepMunicipalArchives(registry) {
  const deepDocs = [];

  // 1) 서울특별시 서울축제포털 계절별·지역별 전체 목록 파싱
  try {
    const seoulMunis = Object.values(registry.municipalities || {}).filter(
      (m) => m.lDongRegnCd === '11'
    );
    const { html } = await fetchHtmlSafe(
      'https://festival.seoul.go.kr/festival/seasonal/list.do',
      6000
    );
    const matches = [
      ...html.matchAll(
        /<a[^>]+href=["']([^"']*festacode=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
      ),
    ];
    const seenCode = new Set();

    for (const m of matches) {
      const festacode = m[2];
      if (!festacode || seenCode.has(festacode)) continue;
      seenCode.add(festacode);

      const rawText = cleanHtmlText(m[3]).replace(/\s+/g, ' ').trim();
      if (rawText.length < 6) continue;

      const fullUrl = new URL(
        m[1].replace(/&amp;/g, '&'),
        'https://festival.seoul.go.kr'
      ).toString();

      // 예: "전통/역사 중구 2026 복작복작 오늘전통축제 기간 2026-11-12 ~ 2026-11-12 장소 문화역서울284 전관"
      let matchedMuni = seoulMunis.find((sm) => rawText.includes(sm.name));
      const sigunguName = matchedMuni ? matchedMuni.name : '종로구';
      const lDongSignguCd = matchedMuni ? matchedMuni.lDongSignguCd : '110';

      const { startDate, endDate } = parseDatesFromText(rawText, CRAWL_YEAR);

      let title = rawText
        .replace(/^(전통\/역사|문화\/예술|관광\/체육|생태\/자연|기타)\s*/g, '')
        .replace(new RegExp(`^${sigunguName}\\s*`), '')
        .replace(/\s*기간\s*20\d{2}[\s\S]*$/, '')
        .trim();

      const placeMatch = rawText.match(/장소\s+(.+)$/);
      const placeStr = placeMatch ? placeMatch[1].trim() : `서울특별시 ${sigunguName} 일원`;

      if (!title || title.length < 3) continue;

      const categoryObj = inferSmartCategory(title, rawText, 'EV01', 'EV010200');
      const promoLevel = computePromoLevel({
        title,
        invitation: rawText,
        organizer: `서울특별시 · ${sigunguName}`,
        lDongRegnCd: '11',
        addr1: placeStr,
      });

      deepDocs.push({
        id: `muni-seoul-festa-${festacode}`,
        lDongRegnCd: '11',
        lDongSignguCd,
        sigunguName,
        title,
        eventDate: {
          startDate,
          endDate,
        },
        eventTime: '상시 운영 (서울축제포털 상세 안내 참조)',
        organizer: {
          host: `서울특별시 · ${sigunguName}청`,
          supervise: '서울축제포털 (FUN SEOUL)',
          contact: '다산콜센터 02-120',
        },
        category: categoryObj,
        links: [
          {
            type: 'TIER1_PROMO',
            label: `서울축제포털 상세 (festacode=${festacode})`,
            url: fullUrl,
          },
          ...(matchedMuni
            ? [
                {
                  type: 'TIER2_PROMO',
                  label: `${matchedMuni.name} 홍보포털 (${matchedMuni.promo1Name})`,
                  url: matchedMuni.promo1Url,
                },
              ]
            : []),
        ],
        invitation: `${sigunguName}에서 개최되는 「${title}」 행사입니다. (${rawText})`,
        promoLevel,
        addr1: placeStr.startsWith('서울') ? placeStr : `서울특별시 ${sigunguName} ${placeStr}`,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Step 2-B] 서울축제포털 상세 목록 수집 경고:', err?.message);
  }

  // 2) 경상남도 거제시 (48-310) 문화관광 대표 축제 서브페이지 + 2022~2026 연도별 일정표 + 시청 새소식/시정뉴스 역대 대회
  try {
    // 2-1) 거제시 14개 대표 축제 전용 서브페이지 크롤링
    const geojeMain = await fetchHtmlSafe('https://tour.geoje.go.kr', 5000);
    const menuLinks = [
      ...new Set(
        [
          ...geojeMain.html.matchAll(
            /href=["'](\/index\.geoje\?menuCd=DOM_0000085040\d{2}000000)["']/gi
          ),
        ].map((m) => m[1])
      ),
    ];

    for (const relHref of menuLinks) {
      if (relHref.endsWith('8504000000000')) continue;
      try {
        const subUrl = `https://tour.geoje.go.kr${relHref}`;
        const { html } = await fetchHtmlSafe(subUrl, 5000);
        const lines = cleanHtmlText(html)
          .split(/\r?\n/)
          .map((l) => l.replace(/\s+/g, ' ').trim())
          .filter((l) => l.length > 2);

        const infoIdx = lines.findIndex((l) => l.includes('정보수정요청'));
        if (infoIdx === -1) continue;

        const block = lines.slice(infoIdx + 1, infoIdx + 18);
        const festTitle = block[0] || '';
        if (!festTitle || festTitle.length < 3) continue;

        const place = block[1] || '경상남도 거제시 일원';
        const joinedBlock = block.join(' / ');
        const { startDate, endDate } = parseDatesFromText(joinedBlock, CRAWL_YEAR);

        const descLines = block.filter((l) => l.length >= 20 && !l.startsWith('*동영상'));
        const invitation =
          descLines.join(' ') ||
          `거제시 문화관광 포털에서 안내하는 ${festTitle} 공식 홍보 페이지입니다.`;

        const menuCdMatch = relHref.match(/menuCd=([A-Z0-9_]+)/);
        const menuId = menuCdMatch ? menuCdMatch[1] : festTitle.replace(/\s+/g, '');

        const categoryObj = inferSmartCategory(festTitle, invitation, 'EV01', 'EV010100');
        const promoLevel = computePromoLevel({
          title: festTitle,
          invitation,
          organizer: '거제시청',
          lDongRegnCd: '48',
          addr1: `경상남도 거제시 ${place}`,
        });

        deepDocs.push({
          id: `muni-geoje-fest-${menuId}`,
          lDongRegnCd: '48',
          lDongSignguCd: '310',
          sigunguName: '거제시',
          title: festTitle,
          eventDate: { startDate, endDate },
          eventTime: '축제 기간 내 상시 운영',
          organizer: {
            host: '거제시청 · 축제추진위원회',
            contact: '055-639-3000',
          },
          category: categoryObj,
          links: [
            {
              type: 'TIER2_PROMO',
              label: `거제문화관광 축제 상세 (${festTitle})`,
              url: subUrl,
            },
            {
              type: 'TIER1_PROMO',
              label: '경남관광길잡이 홍보포털',
              url: 'https://tour.gyeongnam.go.kr',
            },
          ],
          invitation: invitation.slice(0, 280),
          promoLevel,
          addr1: `경상남도 거제시 ${place}`,
          mapX: 128.6211,
          mapY: 34.8806,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // ignore individual subpage error
      }
    }

    // 2-2) 거제시 연도별 행사일정표 아카이브 (2022년 ~ 2026년 주요 월 스캔)
    const archiveMonths = [];
    for (const y of [2022, 2023, 2024, 2025, 2026]) {
      for (const m of ['01', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']) {
        archiveMonths.push({ y, m, ym: `${y}-${m}` });
      }
    }

    const seenGeojeSids = new Set();
    let calCursor = 0;

    async function geojeCalWorker() {
      while (calCursor < archiveMonths.length) {
        const { y, m, ym } = archiveMonths[calCursor++];
        const calUrl = `https://www.geoje.go.kr/schedule/list.geoje?boardId=FESTIVAL&year=${y}&month=${m}&searchStartDt=${ym}&menuCd=DOM_000008504014001000`;
        try {
          const { html } = await fetchHtmlSafe(calUrl, 4500);
          const itemMatches = [
            ...html.matchAll(
              /<a[^>]+href=["']([^"']*dataSid=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
            ),
          ];
          for (const match of itemMatches) {
            const sid = match[2];
            if (!sid || seenGeojeSids.has(sid)) continue;
            seenGeojeSids.add(sid);

            let rawTitle = cleanHtmlText(match[3]).replace(/\s+/g, ' ').trim();
            if (!rawTitle || rawTitle.length < 3 || rawTitle.endsWith('..')) continue;

            const viewUrl = `https://www.geoje.go.kr/board/view.geoje?boardId=FESTIVAL&menuCd=DOM_000008504014001000&paging=ok&startPage=1&dataSid=${sid}`;
            const startDate = `${y}${m}01`;
            const endDate = `${y}${m}28`;

            const categoryObj = inferSmartCategory(rawTitle, '', 'EV01', 'EV010200');
            const promoLevel = computePromoLevel({
              title: rawTitle,
              invitation: rawTitle,
              organizer: '거제시청',
              lDongRegnCd: '48',
              addr1: '경상남도 거제시',
            });

            deepDocs.push({
              id: `muni-geoje-cal-${sid}`,
              lDongRegnCd: '48',
              lDongSignguCd: '310',
              sigunguName: '거제시',
              title: rawTitle,
              eventDate: {
                startDate,
                endDate,
                scheduleNote: `${y}년 ${Number(m)}월 거제시 문화·공연·축제 일정표 수록 행사`,
              },
              eventTime: '세부 일정은 거제시 문화관광 원문 참조',
              organizer: {
                host: '거제시청 · 거제문화예술재단',
                contact: '055-639-3391',
              },
              category: categoryObj,
              links: [
                {
                  type: 'TIER2_PROMO',
                  label: `거제시 문화관광 행사일정 상세 (dataSid=${sid})`,
                  url: viewUrl,
                },
                {
                  type: 'TIER2_PROMO',
                  label: '거제문화관광 홍보포털',
                  url: 'https://tour.geoje.go.kr',
                },
              ],
              invitation: `${y}년 ${Number(m)}월 거제시 공식 문화관광 행사일정표에 게시된 「${rawTitle}」 홍보 정보입니다.`,
              promoLevel,
              addr1: '경상남도 거제시 계룡로 125 (고현동)',
              mapX: 128.6211,
              mapY: 34.8806,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch {
          // ignore
        }
      }
    }

    await Promise.all(Array.from({ length: 12 }, () => geojeCalWorker()));

    // 2-3) 거제시청 통합검색/새소식/시정뉴스(BBS_0000008, BBS_0000120)에 수록된 실제 역대 거제시장배 대회 및 주요 축제 공고
    const geojeHistoricalRecords = [
      {
        id: 'muni-geoje-mayor-swim-19',
        title: '2026년 제19회 거제시장배 전국 마스터즈 수영대회',
        startDate: '20261024',
        endDate: '20261025',
        scheduleNote: '2026. 10. 24.(토) ~ 10. 25.(일) 2일간 / 성인부 300명·학생부 300명',
        eventTime: '09:00 ~ 18:00',
        host: '거제시 · 거제시체육회',
        supervise: '거제시수영연맹',
        contact: '055-639-4021',
        addr1: '경상남도 거제시 동부면 거제중앙로 150 (거제 동부학생수영장, 동부실내체육관)',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000008&menuCd=DOM_000008902001001000&dataSid=306453777',
        invitation:
          '2026년 제19회 거제시장배 전국 마스터즈 수영대회 개최 안내! 일시: 2026. 10. 24.(토) ~ 10. 25.(일) 2일간 / 장소: 거제 동부학생수영장, 동부실내체육관 / 성인부 300명·학생부 300명 선착순 마감.',
      },
      {
        id: 'muni-geoje-mayor-swim-18',
        title: '2025년 제18회 거제 시장배 전국 마스터즈 수영대회',
        startDate: '20251025',
        endDate: '20251026',
        scheduleNote: '2025년 10월 개최 (제18회 거제시장배 수영대회)',
        eventTime: '09:00 ~ 18:00',
        host: '거제시 · 거제시체육회',
        supervise: '거제시수영연맹',
        contact: '055-639-4021',
        addr1: '경상남도 거제시 동부면 거제중앙로 150 (거제 동부학생수영장)',
        url: 'https://www.geoje.go.kr/board/list.geoje?boardId=BBS_0000008&menuCd=DOM_000008902001001000&searchType=DATA_TITLE&keyword=%EA%B1%B0%EC%A0%9C%EC%8B%9C%EC%9E%A5%EB%B0%B0',
        invitation:
          '제18회 거제 시장배 전국 마스터즈 수영대회. 거제 동부학생수영장에서 전국 마스터즈 수영 동호인 및 학생부 선수들이 참가하여 기량을 겨루는 거제시 대표 연례 수영대회입니다.',
      },
      {
        id: 'muni-geoje-mayor-swim-17',
        title: '2024년 제17회 거제시장배 수영대회',
        startDate: '20241026',
        endDate: '20241026',
        scheduleNote: '2024. 10. 26.(토) 개최 / 성인부 150명, 학생부 250명 참가',
        eventTime: '09:00 ~ 17:00',
        host: '거제시 · 거제시체육회',
        supervise: '거제시수영연맹',
        contact: '055-639-3381',
        addr1: '경상남도 거제시 동부면 거제중앙로 150 (동부초등학교 수영장)',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000120&menuCd=DOM_000008902003001000&dataSid=306158936',
        invitation:
          '제17회 거제시장배 수영대회가 동부초등학교 수영장에서 개최되었습니다. 성인부 150명, 학생부 250명이 참가해 다양한 연령대의 선수들이 물살을 가르며 기량을 펼쳤습니다.',
      },
      {
        id: 'muni-geoje-mayor-marathon-9',
        title: '2025년 제9회 거제시장배 휠체어 마라톤대회',
        startDate: '20251026',
        endDate: '20251026',
        scheduleNote: '접수기간: 2025. 9. 29. ~ 10. 26. / 거제시민·경남도민·부산시민 참가',
        eventTime: '09:00 ~ 15:00',
        host: '거제시 · 거제시장애인체육회',
        contact: '055-633-6001',
        addr1: '경상남도 거제시 계룡로 125 (거제시 일원)',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000008&menuCd=DOM_000008902001001000&dataSid=306284246',
        invitation:
          '제9회 거제시장배 휠체어 마라톤대회 참가자 모집 및 개최 안내 (거제시청 새소식 dataSid=306284246).',
      },
      {
        id: 'muni-geoje-mayor-marathon-7',
        title: '2023년 제7회 거제시장배 어울림 휠체어마라톤대회',
        startDate: '20230916',
        endDate: '20230916',
        scheduleNote: '2023년 제7회 거제시장배 어울림 휠체어마라톤대회',
        eventTime: '09:00 ~ 15:00',
        host: '거제시 · 거제시장애인체육회',
        contact: '055-633-6001',
        addr1: '경상남도 거제시 계룡로 125 (거제시 일원)',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000008&menuCd=DOM_000008902001001000&dataSid=306082429',
        invitation:
          '제7회 거제시장배 어울림 휠체어마라톤대회 홍보 공고 (거제시청 새소식 dataSid=306082429).',
      },
      {
        id: 'muni-geoje-penguin-15',
        title: '2025년 제15회 거제도 국제펭귄수영축제',
        startDate: '20250111',
        endDate: '20250111',
        scheduleNote: '2025. 1. 11.(토) 09:30 ~ / 참가신청 선착순 500명',
        eventTime: '09:30 ~ 16:00',
        host: '옥포2동 주민자치회 · 거제도국제펭귄수영축제추진위원회',
        contact: '055-639-3000',
        addr1: '경상남도 거제시 덕포동 덕포해수욕장 일원',
        url: 'https://tour.geoje.go.kr/index.geoje?menuCd=DOM_000008504017000000',
        invitation:
          '한겨울 차가운 바다 그러나 그보다 더 뜨거운 열정과 낭만이 있는 제15회 거제도국제펭귄수영축제! 덕포해수욕장 일원에서 겨울바다 수영대회, 황금광어를 잡아라, 맨발 얼음물 오래 버티기 등이 진행됩니다.',
      },
      {
        id: 'muni-geoje-penguin-14',
        title: '2022년 제14회 거제도 국제펭귄수영축제',
        startDate: '20221210',
        endDate: '20221210',
        scheduleNote: '2022. 12. 10.(토) 덕포해수욕장 개최',
        eventTime: '09:30 ~ 16:00',
        host: '옥포2동 주민자치회 · 거제도국제펭귄수영축제추진위원회',
        contact: '055-639-3000',
        addr1: '경상남도 거제시 덕포동 덕포해수욕장 일원',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000008&menuCd=DOM_000008902001001000&dataSid=306044989',
        invitation:
          '제14회 거제도 국제펭귄수영축제가 덕포해수욕장에서 개최됩니다. 겨울바다 수영대회, 맨손광어잡기, 새해소원빌기 등 다양한 체험행사와 시식코너가 운영됩니다.',
      },
      {
        id: 'muni-geoje-flower-20',
        title: '2026년 제20회 거제섬꽃축제',
        startDate: '20261030',
        endDate: '20261108',
        scheduleNote: '2026년 제20회 거제섬꽃축제 및 가을꽃 전시 관람',
        eventTime: '09:00 ~ 18:00',
        host: '거제시 · 거제시농업기술센터',
        contact: '055-639-6443',
        addr1: '경상남도 거제시 거제면 거제남서로 3595 (거제시농업개발원)',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000008&menuCd=DOM_000008902001001000&dataSid=306430284',
        invitation:
          '거제시 농업개발원에서 직접 키워낸 가을꽃과 거제의 문화를 접목한 제20회 거제섬꽃축제 홍보 공고입니다.',
      },
      {
        id: 'muni-geoje-flower-18',
        title: '2024년 제18회 거제섬꽃축제',
        startDate: '20241026',
        endDate: '20241103',
        scheduleNote: '꽃을 찾아 떠나는 치유여행 (야간 개방 20:00까지)',
        eventTime: '09:00 ~ 20:00',
        host: '거제시 · 거제시농업기술센터',
        contact: '055-639-6443',
        addr1: '경상남도 거제시 거제면 거제남서로 3595 (거제시농업개발원)',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000008&menuCd=DOM_000008902001001000&dataSid=306124103',
        invitation:
          '꽃을 찾아 떠나는 치유여행을 주제로 한 제18회 거제섬꽃축제! 거제사또 부임 행차, 이시우 전국가요제, 청소년 스타킹 대회 본선 및 40여 개 체험프로그램 운영.',
      },
      {
        id: 'muni-geoje-seodanggol-7',
        title: '2026년 제7회 아주 서당골천 빛축제',
        startDate: '20261031',
        endDate: '20261130',
        scheduleNote: '점등식 2026. 10. 31.(토) 18:00~18:40',
        eventTime: '10:00 ~ 21:00',
        host: '아주동 주민자치회 · 거제시',
        contact: '055-639-3000',
        addr1: '경상남도 거제시 아주동 1712번지 서당골천 일원',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000008&menuCd=DOM_000008902001001000&dataSid=306503925',
        invitation:
          '제7회 아주 서당골천 빛축제! 서당골천 테마별 조명 시설물 조성, 체험부스, 프리마켓, 주민자치센터 프로그램 발표회 운영.',
      },
      {
        id: 'muni-geoje-seodanggol-6',
        title: '2025년 제6회 아주 서당골천 빛축제',
        startDate: '20251025',
        endDate: '20251130',
        scheduleNote: '2025년 10월 점등 및 야경 산책 운영',
        eventTime: '10:00 ~ 21:00',
        host: '아주동 주민자치회 · 거제시',
        contact: '055-639-3381',
        addr1: '경상남도 거제시 아주동 1712번지 서당골천 일원',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000120&menuCd=DOM_000008902003001000&dataSid=306307115',
        invitation:
          '빛으로 물든 서당골천, 제6회 아주 서당골천 빛축제! 아주동 주민자치회 주관으로 지역주민과 관광객이 함께하는 가을 빛축제입니다.',
      },
      {
        id: 'muni-geoje-seodanggol-5',
        title: '2024년 제5회 아주 서당골천 빛축제',
        startDate: '20241026',
        endDate: '20241230',
        scheduleNote: '2024. 10. 26. ~ 12. 30. (66일간 서당골천 야간 점등)',
        eventTime: '10:00 ~ 21:00',
        host: '아주동 주민자치회 · 거제시',
        contact: '055-639-3381',
        addr1: '경상남도 거제시 아주동 1712번지 서당골천 일원',
        url: 'https://www.geoje.go.kr/board/view.geoje?boardId=BBS_0000120&menuCd=DOM_000008902003001000&dataSid=306158936',
        invitation:
          '제5회 아주 서당골천 빛축제! 아주동 15개 기관·단체 체험부스와 시민 가을음악회, 66일간의 서당골천 야간 경관 조명 운영.',
      },
    ];

    for (const rec of geojeHistoricalRecords) {
      const categoryObj = inferSmartCategory(rec.title, rec.invitation, 'EV03', 'EV030300');
      const promoLevel = computePromoLevel({
        title: rec.title,
        invitation: rec.invitation,
        organizer: rec.host,
        lDongRegnCd: '48',
        addr1: rec.addr1,
      });

      deepDocs.push({
        id: rec.id,
        lDongRegnCd: '48',
        lDongSignguCd: '310',
        sigunguName: '거제시',
        title: rec.title,
        eventDate: {
          startDate: rec.startDate,
          endDate: rec.endDate,
          scheduleNote: rec.scheduleNote,
        },
        eventTime: rec.eventTime,
        organizer: {
          host: rec.host,
          supervise: rec.supervise,
          contact: rec.contact,
        },
        category: categoryObj,
        links: [
          {
            type: 'TIER2_PROMO',
            label: '거제시청 공식 홍보/공고 원문 바로가기',
            url: rec.url,
          },
          {
            type: 'TIER2_PROMO',
            label: '거제문화관광 홍보포털',
            url: 'https://tour.geoje.go.kr',
          },
        ],
        invitation: rec.invitation,
        promoLevel,
        addr1: rec.addr1,
        mapX: 128.6211,
        mapY: 34.8806,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Step 2-B] 거제시 아카이브 수집 경고:', err?.message);
  }

  return deepDocs;
}

async function callKorService2Json(operation, params = {}) {
  const query = new URLSearchParams({
    serviceKey: KORSERVICE2_KEY,
    MobileOS: 'ETC',
    MobileApp: 'KoreaEventListCrawler',
    _type: 'json',
    ...Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ),
  });

  const url = `${KORSERVICE2_ENDPOINT}/${operation}?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`KorService2 HTTP ${res.status} on ${operation}`);
  }
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    return { items: [], totalCount: 0 };
  }
  const json = JSON.parse(text);
  const body = json?.response?.body;
  const rawItems = body?.items?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return {
    items,
    totalCount: Number(body?.totalCount ?? items.length),
  };
}

function parseSigunguNameFromAddr(addr1 = '') {
  const parts = addr1.trim().split(/\s+/);
  if (parts.length >= 3 && /(시|군|구)$/.test(parts[1]) && /(구)$/.test(parts[2])) {
    return `${parts[1]} ${parts[2]}`;
  }
  if (parts.length >= 2 && /(시|군|구)$/.test(parts[1])) {
    return parts[1];
  }
  return parts[1] || '전체';
}

function buildPromoLinksForEvent(registry, lDongRegnCd, lDongSignguCd, sigunguName, officialUrl) {
  const links = [];

  if (officialUrl && /^https?:\/\//i.test(officialUrl)) {
    links.push({
      type: 'OFFICIAL',
      label: '행사 공식 안내 페이지',
      url: officialUrl,
    });
  }

  const muniKey = `${lDongRegnCd}-${lDongSignguCd}`;
  const muniRecord =
    registry?.municipalities?.[muniKey] ||
    Object.values(registry?.municipalities || {}).find(
      (m) => m.lDongRegnCd === lDongRegnCd && sigunguName && m.name.includes(sigunguName)
    );

  if (muniRecord) {
    links.push({
      type: 'TIER2_PROMO',
      label: `${muniRecord.name} 홍보포털 (${muniRecord.promo1Name})`,
      url: muniRecord.promo1Url,
    });
  }

  const provRecord = Object.values(registry?.provinces || {}).find(
    (p) => p.lDongRegnCd === lDongRegnCd
  );

  if (provRecord) {
    links.push({
      type: 'TIER1_PROMO',
      label: `${provRecord.name} 홍보포털 (${provRecord.promo1Name})`,
      url: provRecord.promo1Url,
    });
  }

  const seen = new Set();
  return links.filter((l) => {
    if (!l.url || seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}

function stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function runDailyCrawler() {
  const startedAt = new Date();
  console.log('================================================================');
  console.log(`[Crawler] 대한민국 267개 지자체 & 과거 전체 기간 전수 크롤링 시작: ${startedAt.toISOString()}`);
  console.log('================================================================');

  // 1) 267개 지자체 홍보 마스터 레지스트리 로드
  const registryRaw = await fs.readFile(REGISTRY_PATH, 'utf-8');
  const registry = JSON.parse(registryRaw);
  const provCount = Object.keys(registry.provinces || {}).length;
  const muniCount = Object.keys(registry.municipalities || {}).length;
  console.log(
    `[Step 1] 지자체 홍보 레지스트리 로드 완료: 광역 ${provCount}개 + 시군구 ${muniCount}개 = 총 ${
      provCount + muniCount
    }개 사이트`
  );

  // 2) 267개 지자체 사이트 실제 병렬 HTTP 접속 스캔 및 홍보 게시물 추출 (25개 동시 워커)
  console.log('[Step 2] 전국 267개 지자체 홍보 홈페이지 병렬 스캔 및 게시물 추출 중 (25 workers)...');
  const scanStart = Date.now();
  const { siteScanResults, extractedMunicipalPosts } = await scanAll267MunicipalSites(registry, 25);
  const scanElapsedSec = ((Date.now() - scanStart) / 1000).toFixed(1);

  const reachableSites = siteScanResults.filter((r) => r.reachable);
  const swimDetectedSites = siteScanResults.filter((r) => r.swimMentionCount > 0);
  const festivalDetectedSites = siteScanResults.filter((r) => r.festivalMentionCount > 0);

  console.log(
    `[Step 2 완료] 소요시간 ${scanElapsedSec}초 | 전체 ${siteScanResults.length}곳 중 HTTP 정상응답 ${reachableSites.length}곳 | 축제·행사 감지 ${festivalDetectedSites.length}곳 | 수영 감지 ${swimDetectedSites.length}곳 | 지자체 웹 직접 추출 홍보글 ${extractedMunicipalPosts.length}건`
  );

  const crawledDocsMap = new Map();
  let preservedPortalCount = 0;
  try {
    const prevRaw = await fs.readFile(OUTPUT_JSON_PATH, 'utf-8');
    const prevJson = JSON.parse(prevRaw);
    if (Array.isArray(prevJson.events)) {
      for (const ev of prevJson.events) {
        if (ev && ev.id) {
          crawledDocsMap.set(ev.id, ev);
          if (String(ev.id).startsWith('portal-')) {
            preservedPortalCount++;
          }
        }
      }
      console.log(
        `[Step 2-0] 기존 스냅샷(${crawledDocsMap.size}건, 공공포털 ${preservedPortalCount}건) 로드 완료 — 증분 병합 준비`
      );
    }
  } catch {
    // 최초 실행 시 빈 맵에서 시작
  }

  // 2-A) 267개 지자체 사이트에서 직접 추출된 홍보 게시글 등록
  extractedMunicipalPosts.forEach((post, idx) => {
    const meta = post.targetMeta;
    const docId = `muni-web-${meta.lDongRegnCd}-${meta.lDongSignguCd}-${idx}`;
    const categoryObj = inferSmartCategory(post.title, post.snippet, 'EV01', 'EV010600');
    const links = buildPromoLinksForEvent(
      registry,
      meta.lDongRegnCd,
      meta.lDongSignguCd,
      meta.sigunguName,
      post.url
    );
    const invitation =
      post.snippet && post.snippet.length > post.title.length + 6
        ? post.snippet
        : `${meta.name} 공식 홍보 홈페이지(${meta.promoName})에 게시된 「${post.title}」 안내입니다.`;

    const promoLevel = computePromoLevel({
      title: post.title,
      invitation,
      organizer: meta.hallName || meta.name,
      lDongRegnCd: meta.lDongRegnCd,
      addr1: meta.name,
    });

    crawledDocsMap.set(docId, {
      id: docId,
      lDongRegnCd: meta.lDongRegnCd,
      lDongSignguCd: meta.lDongSignguCd,
      sigunguName: meta.sigunguName,
      title: post.title,
      eventDate: {
        startDate: post.startDate,
        endDate: post.endDate,
      },
      eventTime: '지자체 홍보 페이지 안내 참조',
      organizer: {
        host: meta.hallName || meta.name,
        supervise: meta.promoName,
      },
      category: categoryObj,
      links,
      invitation,
      promoLevel,
      addr1: meta.name,
      updatedAt: new Date().toISOString(),
    });
  });

  // 2-B) 서울축제포털 전체 목록 & 거제시 연도별 아카이브(2022~2026) 심층 수집
  console.log('[Step 2-B] 지자체 심층 아카이브(서울축제포털 전체 + 거제시 2022~2026 역대 행사·대회) 수집 중...');
  const deepDocs = await crawlDeepMunicipalArchives(registry);
  for (const d of deepDocs) {
    crawledDocsMap.set(d.id, d);
  }
  console.log(`[Step 2-B 완료] 심층 아카이브 ${deepDocs.length}건 추가 완료`);

  // 2-C) 서울축제포털 (festacode=974) 실시간 파싱
  let seoul974Invitation =
    '차 없는 잠실대교 위에서 맞이하는 상쾌한 일요일 아침! 잠실수중보 남단(출발·도착)부터 잠실대교(반환)까지 왕복 5km 코스를 기록·경쟁 없이 걷기, 달리기, 자전거, 유아차, 반려견과 함께 자유롭게 즐기세요. (※ 오전 5시~10시 잠실대교 상행 방향 편도 통제)';
  try {
    const { html } = await fetchHtmlSafe(
      'https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=974',
      5000
    );
    const highlights = extractHighlightsFromHtml(html);
    if (highlights.length >= 2) {
      seoul974Invitation = highlights.join(' / ');
    }
  } catch {
    // fallback 유지
  }

  crawledDocsMap.set('portal-4124907', {
    id: 'portal-4124907',
    portalContentId: '4124907',
    lDongRegnCd: '11',
    lDongSignguCd: '740',
    sigunguName: '강동구',
    title: '2026 쉬엄쉬엄 모닝 (11월 잠실한강공원·잠실대교)',
    eventDate: {
      startDate: '20261018',
      endDate: '20261122',
      scheduleNote: '11. 8.(일) / 11. 15.(일) / 11. 22.(일) 주말 아침 집중 운영',
    },
    eventTime: '07:00 ~ 09:00 (교통통제 05:00 ~ 10:00)',
    organizer: {
      host: '서울특별시 (관광체육국)',
      supervise: '서울시 체육회',
      contact: '다산콜센터 02-120 / 운영사무국 1644-6155',
    },
    category: {
      lclsSystm2: 'EV03',
      lclsSystm3: 'EV030400',
      label: '행사·전시 > 기타행사 (시민 건강·러닝·자전거)',
    },
    links: [
      {
        type: 'TIER1_PROMO',
        label: '서울시 홍보주소1 · 서울축제포털 상세 (festacode=974)',
        url: 'https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=974',
      },
      {
        type: 'TIER2_PROMO',
        label: '강동구 문화관광 홍보포털',
        url: 'https://www.gangdong.go.kr/web/culture/main.do',
      },
      {
        type: 'OFFICIAL',
        label: '서울시체육회 공식 홈페이지',
        url: 'https://www.seoulsports.or.kr',
      },
    ],
    invitation: seoul974Invitation,
    promoLevel: 0,
    addr1: '서울특별시 강동구 선사로 83-19 (천호동)',
    mapX: 127.1179813872,
    mapY: 37.5452481279,
    imageUrl: 'https://tong.visitkorea.or.kr/cms/resource/63/4147163_image2_1.jpg',
    updatedAt: new Date().toISOString(),
  });

  // 3) 공공데이터포털 KorService2 과거 전체 기간(19900101~) 전수 스캔
  console.log('[Step 3] 공공데이터포털 KorService2 과거 전체 기간(1990년~현재) 전수 스캔 중...');
  let portalTotalScanned = 0;
  let portalSwimMatches = [];
  let portalStepFailed = false;

  try {
    const firstPage = await callKorService2Json('searchFestival2', {
      numOfRows: 1000,
      pageNo: 1,
      arrange: 'C',
      eventStartDate: '19900101',
    });

    const allPortalItems = [...firstPage.items];
    const totalPages = Math.ceil(firstPage.totalCount / 1000);
    for (let p = 2; p <= totalPages; p++) {
      const nextRes = await callKorService2Json('searchFestival2', {
        numOfRows: 1000,
        pageNo: p,
        arrange: 'C',
        eventStartDate: '19900101',
      });
      allPortalItems.push(...nextRes.items);
    }

    portalTotalScanned = allPortalItems.length;
    portalSwimMatches = allPortalItems.filter((it) => isSwimEvent(String(it.title || '')));

    console.log(
      `[Step 3] KorService2 전체 ${firstPage.totalCount}건 중 ${portalTotalScanned}건 전수 로드 완료 | 수영 매칭: ${portalSwimMatches.length}건`
    );

    // 수영/스포츠/회차 대회 및 최신 수정 상위 60건은 detailCommon2 + detailIntro2 상세 조회 수행
    const detailTargetIds = new Set([
      ...portalSwimMatches.map((it) => String(it.contentid)),
      ...allPortalItems
        .filter((it) => isSportsEvent(String(it.title || '')) || /제?\s*\d+\s*회/.test(String(it.title || '')))
        .map((it) => String(it.contentid)),
      ...allPortalItems.slice(0, 40).map((it) => String(it.contentid)),
    ]);

    const detailMap = new Map();
    const detailIdsArray = Array.from(detailTargetIds).filter(Boolean);
    let detailCursor = 0;

    async function detailWorker() {
      while (detailCursor < detailIdsArray.length) {
        const cid = detailIdsArray[detailCursor++];
        try {
          const [commonRes, introRes] = await Promise.all([
            callKorService2Json('detailCommon2', { contentId: cid, numOfRows: 1, pageNo: 1 }),
            callKorService2Json('detailIntro2', {
              contentId: cid,
              contentTypeId: '15',
              numOfRows: 1,
              pageNo: 1,
            }),
          ]);
          detailMap.set(cid, {
            common: commonRes.items[0] || {},
            intro: introRes.items[0] || {},
          });
        } catch {
          // ignore
        }
      }
    }

    await Promise.all(Array.from({ length: 12 }, () => detailWorker()));

    // 전체 880+건 모두 crawledDocsMap에 저장 (기존 20건 제한 해제)
    for (const raw of allPortalItems) {
      const contentId = String(raw.contentid || '').trim();
      if (!contentId || crawledDocsMap.has(`portal-${contentId}`)) continue;

      const detailEntry = detailMap.get(contentId) || { common: {}, intro: {} };
      const { common, intro } = detailEntry;

      const title = String(raw.title || '행사명 없음').trim();
      const addr1 = String(raw.addr1 || '').trim();
      const lDongRegnCd = String(raw.lDongRegnCd || '11').trim();
      const lDongSignguCd = String(raw.lDongSignguCd || '110').trim();
      const sigunguName = parseSigunguNameFromAddr(addr1);

      const overviewText = cleanHtmlText(String(common.overview || ''))
        .replace(/\s+/g, ' ')
        .trim();
      const programText = cleanHtmlText(String(intro.program || ''))
        .replace(/\s+/g, ' ')
        .trim();
      const playtimeText = cleanHtmlText(String(intro.playtime || ''))
        .replace(/\s+/g, ' ')
        .trim();

      const homepageHrefMatch = String(common.homepage || '').match(/href=["']([^"']+)["']/i);
      const officialUrl = homepageHrefMatch ? homepageHrefMatch[1] : undefined;

      const hostName =
        cleanHtmlText(String(intro.sponsor1 || '')).trim() ||
        `${sigunguName} · 지역축제추진위원회`;
      const superviseName = cleanHtmlText(String(intro.sponsor2 || '')).trim() || undefined;
      const contactTel = String(raw.tel || common.tel || '').trim() || undefined;

      const categoryObj = inferSmartCategory(
        title,
        `${overviewText} ${programText}`,
        String(raw.lclsSystm2 || 'EV01'),
        String(raw.lclsSystm3 || 'EV010600')
      );

      const links = buildPromoLinksForEvent(
        registry,
        lDongRegnCd,
        lDongSignguCd,
        sigunguName,
        officialUrl
      );

      const invitationSummary =
        overviewText.length > 10
          ? overviewText.slice(0, 240) + (overviewText.length > 240 ? '...' : '')
          : `${sigunguName} 일원(${addr1 || sigunguName})에서 열리는 「${title}」 행사입니다. 상세 일정과 프로그램은 연결된 지자체 홍보 포털에서 확인하실 수 있습니다.`;

      const promoLevel = computePromoLevel({
        title,
        invitation: `${invitationSummary} ${programText}`,
        organizer: `${hostName} ${superviseName || ''}`,
        lDongRegnCd,
        addr1,
      });

      const mapX = raw.mapx ? parseFloat(String(raw.mapx)) : undefined;
      const mapY = raw.mapy ? parseFloat(String(raw.mapy)) : undefined;

      crawledDocsMap.set(`portal-${contentId}`, {
        id: `portal-${contentId}`,
        portalContentId: contentId,
        lDongRegnCd,
        lDongSignguCd,
        sigunguName,
        title,
        eventDate: {
          startDate: String(raw.eventstartdate || ''),
          endDate: String(raw.eventenddate || raw.eventstartdate || ''),
          scheduleNote: programText ? programText.slice(0, 80) : undefined,
        },
        eventTime: playtimeText || '상시 운영 (세부 프로그램별 상이)',
        organizer: {
          host: hostName,
          supervise: superviseName,
          contact: contactTel,
        },
        category: categoryObj,
        links,
        invitation: invitationSummary,
        promoLevel,
        addr1,
        mapX: mapX && !Number.isNaN(mapX) ? mapX : undefined,
        mapY: mapY && !Number.isNaN(mapY) ? mapY : undefined,
        imageUrl: raw.firstimage
          ? String(raw.firstimage).replace(/^http:/, 'https:')
          : undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    portalStepFailed = true;
    console.error('[Step 3] KorService2 수집 실패:', err?.message || err);
  }

  // 4) 회차별·연도별 대회 시리즈 자동 매칭 및 양방향 링크 생성
  console.log('[Step 4] 회차별·연도별 연속 행사/대회 시리즈 자동 매칭 중...');
  const rawDocsArray = Array.from(crawledDocsMap.values());
  const { docs: linkedDocs, seriesMap } = linkEventSeries(rawDocsArray);

  // 홍보레벨 높은 순(3 -> 2 -> 0) 및 최신 시작일 순으로 정렬
  const finalDocs = linkedDocs.sort((a, b) => {
    const lvDiff = (b.promoLevel ?? 0) - (a.promoLevel ?? 0);
    if (lvDiff !== 0) return lvDiff;
    return String(b.eventDate?.startDate || '').localeCompare(String(a.eventDate?.startDate || ''));
  });

  // 연도별 그룹 인덱스 및 요약 통계 생성
  const eventsByYear = {};
  const yearSummary = {};
  for (const docItem of finalDocs) {
    const y = String(docItem.eventYear || docItem.eventDate?.startDate?.slice(0, 4) || CRAWL_YEAR);
    if (!eventsByYear[y]) eventsByYear[y] = [];
    eventsByYear[y].push(docItem.id);
    yearSummary[y] = (yearSummary[y] || 0) + 1;
  }

  const multiEditionSeriesCount = Object.values(seriesMap).filter(
    (s) => s.editions && s.editions.length >= 2
  ).length;

  console.log(
    `[Step 4 완료] 전체 ${finalDocs.length}건 | 식별된 시리즈 ${
      Object.keys(seriesMap).length
    }개 (다회차 연결 시리즈 ${multiEditionSeriesCount}개)`
  );

  // 5) 통합 JSON + 시리즈 인덱스 + 감사 리포트 저장
  await fs.mkdir(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_JSON_PATH,
    JSON.stringify(
      {
        lastCrawledAt: new Date().toISOString(),
        totalCrawledCount: finalDocs.length,
        yearSummary,
        seriesSummary: {
          totalSeriesCount: Object.keys(seriesMap).length,
          multiEditionSeriesCount,
        },
        promoLevelSummary: {
          level3: finalDocs.filter((d) => d.promoLevel === 3).length,
          level2: finalDocs.filter((d) => d.promoLevel === 2).length,
          level1: finalDocs.filter((d) => d.promoLevel === 1).length,
          level0: finalDocs.filter((d) => !d.promoLevel).length,
        },
        seriesMap,
        eventsByYear,
        events: finalDocs,
      },
      null,
      2
    ),
    'utf-8'
  );

  await fs.writeFile(
    SERIES_INDEX_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalSeriesCount: Object.keys(seriesMap).length,
        multiEditionSeriesCount,
        seriesMap,
      },
      null,
      2
    ),
    'utf-8'
  );

  await fs.writeFile(
    AUDIT_REPORT_PATH,
    JSON.stringify(
      {
        auditedAt: new Date().toISOString(),
        totalMunicipalSitesScanned: siteScanResults.length,
        reachableMunicipalSitesCount: reachableSites.length,
        festivalKeywordDetectedSitesCount: festivalDetectedSites.length,
        swimKeywordDetectedSitesCount: swimDetectedSites.length,
        directMunicipalExtractedPostsCount: extractedMunicipalPosts.length,
        deepArchiveExtractedCount: deepDocs.length,
        totalFinalEventsCount: finalDocs.length,
        yearSummary,
        multiEditionSeriesCount,
        swimDetectedSites: swimDetectedSites.map((s) => ({
          name: s.name,
          url: s.usedUrl || s.url,
          snippets: s.swimSnippets,
        })),
        portalTotalScanned: portalTotalScanned || preservedPortalCount,
        portalSwimMatchesCount: portalSwimMatches.length,
        portalSwimMatches: portalSwimMatches.map((m) => ({
          contentid: m.contentid,
          title: m.title,
          addr1: m.addr1,
          eventstartdate: m.eventstartdate,
          eventenddate: m.eventenddate,
        })),
        municipalSiteScanRecords: siteScanResults.map((s) => ({
          key: s.key,
          tier: s.tier,
          name: s.name,
          lDongRegnCd: s.lDongRegnCd,
          lDongSignguCd: s.lDongSignguCd,
          url: s.url,
          usedUrl: s.usedUrl || s.url,
          reachable: s.reachable,
          statusCode: s.statusCode,
          elapsedMs: s.elapsedMs,
          extractedPostCount: s.extractedPostCount,
          festivalMentionCount: s.festivalMentionCount,
          swimMentionCount: s.swimMentionCount,
        })),
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(
    `[Step 5] 정적 JSON 저장 완료: 총 ${finalDocs.length}건 (Lv.3=${
      finalDocs.filter((d) => d.promoLevel === 3).length
    }건, Lv.2=${finalDocs.filter((d) => d.promoLevel === 2).length}건, 다회차 연결=${multiEditionSeriesCount}개 시리즈)`
  );

  // 6) Firebase Firestore Smart Upsert (상위 홍보레벨 및 다회차 대표 문서 우선 동기화)
  console.log('[Step 6] Firebase Firestore (koreaeventlist) 동기화 중...');
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const colRef = collection(db, 'events');

    const existingSnap = await withTimeout(getDocs(colRef), 2500, 'Firestore getDocs');
    const manualIds = new Set();
    existingSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data?.manualEdited === true) {
        manualIds.add(docSnap.id);
      }
    });

    const batch = writeBatch(db);
    let upsertedCount = 0;

    // Firestore 단일 배치 한도(500건)를 고려하여 상위 중요 문서 400건 배치 동기화
    for (const item of finalDocs.slice(0, 400)) {
      if (manualIds.has(item.id)) continue;
      const ref = doc(db, 'events', item.id);
      batch.set(ref, stripUndefined(item), { merge: true });
      upsertedCount++;
    }

    await withTimeout(batch.commit(), 3000, 'Firestore batch.commit');
    console.log(`[Step 6] Firebase Firestore 클라우드 DB 동기화 성공! (${upsertedCount}건)`);
  } catch (err) {
    console.warn(
      `[Step 6] Firestore 동기화 건너뜀 (${
        err?.code || err?.message
      }) — 모든 데이터(${finalDocs.length}건)는 정적 JSON(auto-crawled-events.json)에 저장되었습니다.`
    );
  }

  // 사이트별 마지막 게시글 ID·수집시각·날짜범위 체크포인트(crawl-checkpoints.json) 업데이트
  bootstrapCheckpointsFromExistingEvents();

  console.log('================================================================');
  if (portalStepFailed && preservedPortalCount === 0) {
    console.error('[Crawler] 핵심 단계(KorService2) 실패 및 기존 스냅샷 부재로 비정상 종료합니다 (exit 1).');
    console.log('================================================================');
    process.exit(1);
  }
  if (portalStepFailed) {
    console.warn(
      `[Crawler] KorService2 API 키 미설정 또는 응답 지연으로 기존 공공포털 스냅샷(${preservedPortalCount}건)을 유지하고 다음 단계로 진행합니다.`
    );
  }
  console.log('[Crawler] 전수 스캔 및 시리즈 매칭 JSON 생성 완료!');
  console.log('================================================================');
  process.exit(0);
}

runDailyCrawler().catch((err) => {
  console.error('[Crawler] 치명적 오류:', err);
  process.exit(1);
});
