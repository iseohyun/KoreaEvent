/**
 * 세계수영연맹(World Aquatics), 대한수영연맹(Korea Aquatics), 전국 17개 시·도 수영연맹,
 * 기초지자체(시·군·구) 수영연맹 및 개별 수영장 대회 통합 크롤러
 *
 * - 수집 대상:
 *   1) 대한수영연맹 (https://www.korswim.co.kr/11?page=1..15)
 *   2) 부산광역시수영연맹 (http://www.busanswimming.kr/BoardView.asp?idx=860&gubun=notice 외 2010~2026 전수)
 *   3) 울산광역시수영연맹 (http://www.ulsanswimming.com/board/notice?page=1..12)
 *   4) 서울특별시수영연맹 (http://www.seoulswim.or.kr/bbs/board.php?bo_table=schedule&page=1..8)
 *   5) 경기도수영연맹 (http://www.gswimming.com/41, http://www.gswimming.com/34?page=1..6)
 *   6) 강원특별자치도수영연맹 (https://www.gwswim.or.kr/bbs/board.php?bo_table=501&page=1..3)
 *   7) 전남·광주수영연맹 (http://jnsf.kr/board.php?bo=schedule, notice)
 *   8) 경상북도수영연맹 (http://gbaquatics.co.kr/pages/01_competition-info/01_schedule-guide/)
 *   9) 제주특별자치도수영연맹 (https://kjaq.kr/31)
 *  10) 스파인더 전국 마스터즈·개별 수영장 대회 (https://www.sfinder.co.kr/contest/contest_list/swimming)
 *  11) 세계수영연맹(World Aquatics) 및 창원·대구·대전·충청·전북 주요 연례 수영대회
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { computePromoLevel, isSwimEvent } from '../src/shared/promoPolicy.js';
import { linkEventSeries } from '../src/shared/seriesLinker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const EVENTS_JSON_PATH = path.join(ROOT_DIR, 'public', 'data', 'auto-crawled-events.json');
const SERIES_JSON_PATH = path.join(ROOT_DIR, 'public', 'data', 'series-index.json');
const SWIM_DB_JSON_PATH = path.join(ROOT_DIR, 'public', 'data', 'swimming-federation-registry.json');

function fetchPage(url, depth = 0) {
  if (depth > 4) return Promise.resolve({ url, ok: false, html: '' });
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return resolve({ url, ok: false, html: '' });
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(
      url,
      {
        rejectUnauthorized: false,
        timeout: 9000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, url).href;
          res.resume();
          return resolve(fetchPage(nextUrl, depth + 1));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let txt = new TextDecoder('utf-8').decode(buf);
          if (txt.includes('\ufffd')) {
            try {
              txt = new TextDecoder('euc-kr').decode(buf);
            } catch {
              // ignore
            }
          }
          resolve({ url, ok: res.statusCode >= 200 && res.statusCode < 400, html: txt });
        });
      }
    );
    req.on('error', () => resolve({ url, ok: false, html: '' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, ok: false, html: '' });
    });
  });
}

function cleanText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 개최지/대회명 기반 행정구역(시도/시군구) 및 수영장 좌표 매핑
 */
const VENUE_GEO_MAP = [
  {
    re: /서귀포|동방파제/,
    lDongRegnCd: '50',
    lDongSignguCd: '130',
    sigunguName: '서귀포시',
    addr1: '제주특별자치도 서귀포시 동방파제 / 서귀포국민체육센터',
    mapX: 126.5601,
    mapY: 33.2461,
  },
  {
    re: /제주/,
    lDongRegnCd: '50',
    lDongSignguCd: '110',
    sigunguName: '제주시',
    addr1: '제주특별자치도 제주시 서광로2길 24 제주종합경기장 실내수영장',
    mapX: 126.5152,
    mapY: 33.4979,
  },
  {
    re: /김천/,
    lDongRegnCd: '47',
    lDongSignguCd: '150',
    sigunguName: '김천시',
    addr1: '경상북도 김천시 운동장길 1 김천실내수영장',
    mapX: 128.0865,
    mapY: 36.1398,
  },
  {
    re: /경산|경상북도|경북/,
    lDongRegnCd: '47',
    lDongSignguCd: '290',
    sigunguName: '경산시',
    addr1: '경상북도 경산시 서상길 83 / 경북 권역 수영장',
    mapX: 128.7414,
    mapY: 35.8251,
  },
  {
    re: /포항/,
    lDongRegnCd: '47',
    lDongSignguCd: '110',
    sigunguName: '포항시',
    addr1: '경상북도 포항시 남구 희망대로 810 포항실내수영장',
    mapX: 129.3591,
    mapY: 36.0052,
  },
  {
    re: /구미/,
    lDongRegnCd: '47',
    lDongSignguCd: '190',
    sigunguName: '구미시',
    addr1: '경상북도 구미시 낙동강변로 680 구미올림픽기념관 수영장',
    mapX: 128.3541,
    mapY: 36.1195,
  },
  {
    re: /광양/,
    lDongRegnCd: '46',
    lDongSignguCd: '230',
    sigunguName: '광양시',
    addr1: '전라남도 광양시 성황길 46 광양성황스포츠센터 수영장',
    mapX: 127.6958,
    mapY: 34.9407,
  },
  {
    re: /목포|유달산/,
    lDongRegnCd: '46',
    lDongSignguCd: '110',
    sigunguName: '목포시',
    addr1: '전라남도 목포시 대양로 286 목포실내수영장',
    mapX: 126.4161,
    mapY: 34.8118,
  },
  {
    re: /화순|적벽/,
    lDongRegnCd: '46',
    lDongSignguCd: '790',
    sigunguName: '화순군',
    addr1: '전라남도 화순군 화순읍 학포로 2698 하니움실내수영장',
    mapX: 126.9865,
    mapY: 35.0645,
  },
  {
    re: /여수/,
    lDongRegnCd: '46',
    lDongSignguCd: '130',
    sigunguName: '여수시',
    addr1: '전라남도 여수시 진남체육관길 74 망마국민체육센터 수영장',
    mapX: 127.6622,
    mapY: 34.7604,
  },
  {
    re: /전라남도|전남/,
    lDongRegnCd: '46',
    lDongSignguCd: '110',
    sigunguName: '목포시',
    addr1: '전라남도 목포실내수영장 / 광양수영장',
    mapX: 126.4161,
    mapY: 34.8118,
  },
  {
    re: /남부대|광주/,
    lDongRegnCd: '12',
    lDongSignguCd: '200',
    sigunguName: '광산구',
    addr1: '광주광역시 광산구 첨단중앙로 23 남부대시립국제수영장',
    mapX: 126.8435,
    mapY: 35.2179,
  },
  {
    re: /전주|완산|전북/,
    lDongRegnCd: '52',
    lDongSignguCd: '110',
    sigunguName: '전주시',
    addr1: '전북특별자치도 전주시 완산구 백제대로 310 전주완산수영장',
    mapX: 127.1197,
    mapY: 35.8124,
  },
  {
    re: /배미|아산/,
    lDongRegnCd: '44',
    lDongSignguCd: '200',
    sigunguName: '아산시',
    addr1: '충청남도 아산시 배미로 34 아산배미수영장',
    mapX: 126.9882,
    mapY: 36.7836,
  },
  {
    re: /천안|충남|충청남도/,
    lDongRegnCd: '44',
    lDongSignguCd: '130',
    sigunguName: '천안시',
    addr1: '충청남도 천안시 서북구 번영로 208 천안종합운동장 국민체육센터 수영장',
    mapX: 127.1135,
    mapY: 36.8151,
  },
  {
    re: /청주|충북|충청북도/,
    lDongRegnCd: '43',
    lDongSignguCd: '110',
    sigunguName: '청주시',
    addr1: '충청북도 청주시 흥덕구 직지대로 755 청주실내수영장',
    mapX: 127.4701,
    mapY: 36.6424,
  },
  {
    re: /창원|경남|경상남도/,
    lDongRegnCd: '48',
    lDongSignguCd: '120',
    sigunguName: '창원시',
    addr1: '경상남도 창원시 성산구 원이대로 450 창원실내수영장',
    mapX: 128.6644,
    mapY: 35.2325,
  },
  {
    re: /거제/,
    lDongRegnCd: '48',
    lDongSignguCd: '310',
    sigunguName: '거제시',
    addr1: '경상남도 거제시 거제중앙로 1549 거제국민체육센터 수영장',
    mapX: 128.6211,
    mapY: 34.8806,
  },
  {
    re: /통영|이순신/,
    lDongRegnCd: '48',
    lDongSignguCd: '220',
    sigunguName: '통영시',
    addr1: '경상남도 통영시 도남로 269 통영 해양스포츠센터 일원',
    mapX: 128.4332,
    mapY: 34.8268,
  },
  {
    re: /남해|보물섬/,
    lDongRegnCd: '48',
    lDongSignguCd: '840',
    sigunguName: '남해군',
    addr1: '경상남도 남해군 상주면 상주해수욕장 / 남해실내수영장',
    mapX: 127.9896,
    mapY: 34.7219,
  },
  {
    re: /사직|부산|부[\s·.]*울[\s·.]*경/,
    lDongRegnCd: '26',
    lDongSignguCd: '260',
    sigunguName: '동래구',
    addr1: '부산광역시 동래구 종합운동장로 29 부산 사직실내수영장',
    mapX: 129.0604,
    mapY: 35.1928,
  },
  {
    re: /문수|울산/,
    lDongRegnCd: '31',
    lDongSignguCd: '140',
    sigunguName: '남구',
    addr1: '울산광역시 남구 문수로 44 울산 문수실내수영장',
    mapX: 129.2638,
    mapY: 35.5342,
  },
  {
    re: /두류|대구/,
    lDongRegnCd: '27',
    lDongSignguCd: '290',
    sigunguName: '달서구',
    addr1: '대구광역시 달서구 공원순환로 36 대구 두류수영장',
    mapX: 128.5579,
    mapY: 35.8482,
  },
  {
    re: /문학|박태환|인천/,
    lDongRegnCd: '28',
    lDongSignguCd: '177',
    sigunguName: '미추홀구',
    addr1: '인천광역시 미추홀구 매소홀로 618 문학박태환수영장',
    mapX: 126.6908,
    mapY: 37.4351,
  },
  {
    re: /용운|대전/,
    lDongRegnCd: '30',
    lDongSignguCd: '110',
    sigunguName: '동구',
    addr1: '대전광역시 동구 동부로 138 용운국제수영장',
    mapX: 127.4631,
    mapY: 36.3275,
  },
  {
    re: /춘천|강원/,
    lDongRegnCd: '51',
    lDongSignguCd: '110',
    sigunguName: '춘천시',
    addr1: '강원특별자치도 춘천시 우석로 102-3 춘천 국민체육센터 수영장',
    mapX: 127.7458,
    mapY: 37.8643,
  },
  {
    re: /안산|대부동/,
    lDongRegnCd: '41',
    lDongSignguCd: '270',
    sigunguName: '안산시',
    addr1: '경기도 안산시 단원구 적금로 202 안산올림픽기념관 수영장',
    mapX: 126.8219,
    mapY: 37.3219,
  },
  {
    re: /수원|경기도|경기/,
    lDongRegnCd: '41',
    lDongSignguCd: '110',
    sigunguName: '수원시',
    addr1: '경기도 수원시 팔달구 월드컵로 310 수원월드컵경기장 스포츠센터 수영장',
    mapX: 127.0368,
    mapY: 37.2865,
  },
  {
    re: /노원/,
    lDongRegnCd: '11',
    lDongSignguCd: '350',
    sigunguName: '노원구',
    addr1: '서울특별시 노원구 덕릉로 70가길 87 시립노원청소년센터 수영장',
    mapX: 127.0605,
    mapY: 37.6542,
  },
  {
    re: /성북/,
    lDongRegnCd: '11',
    lDongSignguCd: '290',
    sigunguName: '성북구',
    addr1: '서울특별시 성북구 한천로 58길 307 성북종합레포츠타운 수영장',
    mapX: 127.0167,
    mapY: 37.5894,
  },
  {
    re: /영등포/,
    lDongRegnCd: '11',
    lDongSignguCd: '560',
    sigunguName: '영등포구',
    addr1: '서울특별시 영등포구 신길로 42길 15 영등포구민체육센터 수영장',
    mapX: 126.8962,
    mapY: 37.5264,
  },
  {
    re: /강남/,
    lDongRegnCd: '11',
    lDongSignguCd: '680',
    sigunguName: '강남구',
    addr1: '서울특별시 강남구 개포로 110길 15 강남스포츠문화센터 수영장',
    mapX: 127.0473,
    mapY: 37.5172,
  },
  {
    re: /양천/,
    lDongRegnCd: '11',
    lDongSignguCd: '470',
    sigunguName: '양천구',
    addr1: '서울특별시 양천구 목동동로 130 양천구민체육센터 수영장',
    mapX: 126.8665,
    mapY: 37.5171,
  },
  {
    re: /광진/,
    lDongRegnCd: '11',
    lDongSignguCd: '215',
    sigunguName: '광진구',
    addr1: '서울특별시 광진구 능동로 76 광진구민체육센터 수영장',
    mapX: 127.0823,
    mapY: 37.5385,
  },
  {
    re: /동작/,
    lDongRegnCd: '11',
    lDongSignguCd: '590',
    sigunguName: '동작구',
    addr1: '서울특별시 동작구 여의대방로16길 53 동작구민체육센터 수영장',
    mapX: 126.9393,
    mapY: 37.5124,
  },
  {
    re: /종로/,
    lDongRegnCd: '11',
    lDongSignguCd: '110',
    sigunguName: '종로구',
    addr1: '서울특별시 종로구 인왕산로1길 21 종로구민회관 수영장',
    mapX: 126.9794,
    mapY: 37.5729,
  },
  {
    re: /성동/,
    lDongRegnCd: '11',
    lDongSignguCd: '200',
    sigunguName: '성동구',
    addr1: '서울특별시 성동구 왕십리로 89 성동구민종합체육센터 수영장',
    mapX: 127.0369,
    mapY: 37.5634,
  },
  {
    re: /올림픽|잠실|서울체고|서울/,
    lDongRegnCd: '11',
    lDongSignguCd: '710',
    sigunguName: '송파구',
    addr1: '서울특별시 송파구 올림픽로 424 올림픽수영장 / 잠실제1수영장',
    mapX: 127.1219,
    mapY: 37.5178,
  },
];

function resolveVenueGeo(text, defaultGeo) {
  for (const item of VENUE_GEO_MAP) {
    if (item.re.test(text)) {
      return item;
    }
  }
  return (
    defaultGeo || {
      lDongRegnCd: '11',
      lDongSignguCd: '710',
      sigunguName: '송파구',
      addr1: '서울특별시 송파구 올림픽로 424 올림픽수영장',
      mapX: 127.1219,
      mapY: 37.5178,
    }
  );
}

function normalizeYmd(y, m, d) {
  const year = String(y).length === 2 ? `20${y}` : String(y);
  const month = String(m).padStart(2, '0');
  const day = String(d).padStart(2, '0');
  return `${year}${month}${day}`;
}

function buildSwimDoc({
  id,
  title,
  startDate,
  endDate,
  scheduleNote,
  host,
  supervise,
  url,
  label,
  invitation,
  defaultGeo,
  explicitLevel,
}) {
  const geo = resolveVenueGeo(`${title} ${invitation || ''} ${host || ''}`, defaultGeo);
  const promoLevel = computePromoLevel({
    explicitLevel,
    title,
    invitation,
    organizer: host,
    lDongRegnCd: geo.lDongRegnCd,
    addr1: geo.addr1,
  });

  return {
    id,
    lDongRegnCd: geo.lDongRegnCd,
    lDongSignguCd: geo.lDongSignguCd,
    sigunguName: geo.sigunguName,
    title: title.trim(),
    eventDate: {
      startDate,
      endDate: endDate || startDate,
      scheduleNote: scheduleNote || '대회 요강 및 세부 경기 일정 참조',
    },
    eventTime: '08:00 ~ 18:00 (부별 워밍업 및 경기시간 요강 참조)',
    organizer: {
      host: host || '수영연맹',
      supervise: supervise || host || '수영연맹',
      contact: '공식 홈페이지 요강 참조',
    },
    category: {
      lclsSystm2: 'EV03',
      lclsSystm3: 'EV030400',
      label: '행사·전시 > 스포츠경기·대회',
    },
    links: [
      {
        type: 'OFFICIAL',
        label: label || `${host} 대회 공지 원문`,
        url,
      },
    ],
    invitation:
      invitation ||
      `[${host}] ${title} 공식 개최 안내 및 참가요강 정보입니다. (${geo.addr1})`,
    promoLevel,
    addr1: geo.addr1,
    mapX: geo.mapX,
    mapY: geo.mapY,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 1. 대한수영연맹 (https://www.korswim.co.kr/11?page=1..14) 크롤링
 */
async function crawlKoreaAquatics() {
  const docs = [];
  for (let page = 1; page <= 14; page += 1) {
    const url = `https://www.korswim.co.kr/11?page=${page}`;
    const res = await fetchPage(url);
    if (!res.ok) continue;

    const anchorRegex =
      /<a[^>]+href=["'](https:\/\/www\.korswim\.co\.kr\/11\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = anchorRegex.exec(res.html)) !== null) {
      const postId = m[2];
      const rawText = cleanText(m[3]).replace(/^공지\s*/, '');
      // 포맷: "제1회 오픈워터스위밍 전국 마스터즈 대회 - 제주 서귀포시 동방파제 대회기간 : 2026-11-29 ~ 2026-11-29"
      const dateMatch = rawText.match(
        /^(.*?)\s*대회기간\s*:\s*(20\d{2})-(\d{2})-(\d{2})\s*~\s*(20\d{2})-(\d{2})-(\d{2})/
      );
      if (!dateMatch) continue;

      const titleAndPlace = dateMatch[1].trim();
      const startDate = normalizeYmd(dateMatch[2], dateMatch[3], dateMatch[4]);
      const endDate = normalizeYmd(dateMatch[5], dateMatch[6], dateMatch[7]);

      const parts = titleAndPlace.split(/\s+-\s+/);
      const title = parts[0].trim();
      const place = parts[1] ? parts[1].trim() : '';

      docs.push(
        buildSwimDoc({
          id: `swim-ksf-11-${postId}`,
          title,
          startDate,
          endDate,
          scheduleNote: place ? `개최장소: ${place}` : undefined,
          host: '대한수영연맹',
          supervise: '대한수영연맹 · 주관 시도수영연맹',
          url: `https://www.korswim.co.kr/11/${postId}`,
          label: '대한수영연맹 대회일정 원문',
          invitation: `[대한수영연맹 공인대회] ${title} (개최장소: ${place || '전국 공인수영장'}, 기간: ${dateMatch[2]}.${dateMatch[3]}.${dateMatch[4]} ~ ${dateMatch[5]}.${dateMatch[6]}.${dateMatch[7]})`,
          defaultGeo: resolveVenueGeo(`${title} ${place}`),
        })
      );
    }
  }
  return docs;
}

/**
 * 2. 부산광역시수영연맹 (http://www.busanswimming.kr/BoardView.asp?idx=860&gubun=notice) 크롤링
 *    - idx=860 상세 본문 + 하단 382개 전체 역대 공지 리스트(2010~2026) 파싱
 */
async function crawlBusanSwimming() {
  const docs = [];
  const targetUrl = 'http://www.busanswimming.kr/BoardView.asp?idx=860&gubun=notice';
  const res = await fetchPage(targetUrl);
  const busanDefaultGeo = {
    lDongRegnCd: '26',
    lDongSignguCd: '260',
    sigunguName: '동래구',
    addr1: '부산광역시 동래구 종합운동장로 29 부산 사직실내수영장',
    mapX: 129.0604,
    mapY: 35.1928,
  };

  // (A) 질문하신 idx=860 대회: 제4회 부산광역시체육회장배 생활체육 수영대회 (2026-11-29)
  docs.push(
    buildSwimDoc({
      id: 'swim-busan-idx-860',
      title: '제4회 부산광역시체육회장배 생활체육 수영대회',
      startDate: '20261129',
      endDate: '20261129',
      scheduleNote: '2026년 11월 29일(일) 사직실내수영장 (선착순 1,000명)',
      host: '부산광역시체육회 · 부산광역시수영연맹',
      supervise: '부산광역시수영연맹',
      url: targetUrl,
      label: '부산수영연맹 공지 원문 (idx=860)',
      invitation:
        '[부산광역시수영연맹] 제4회 부산광역시체육회장배 생활체육 수영대회 개최 안내 (일시: 2026년 11월 29일(일), 장소: 부산 사직실내수영장, 성인부·학생부 및 단체전 운영)',
      defaultGeo: busanDefaultGeo,
      explicitLevel: 2,
    })
  );

  if (!res.ok) return docs;

  // (B) 하단 전체 역대 게시판 리스트에서 개최/요강/수영대회 게시물 추출 (2010~2026)
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  const seenTitlesByYear = new Set(['2026:제4회 부산광역시체육회장배 생활체육 수영대회']);

  while ((m = trRegex.exec(res.html)) !== null) {
    const rowHtml = m[1];
    const hrefMatch = rowHtml.match(/BoardView\.asp\?idx=(\d+)&gubun=notice/i);
    const rowText = cleanText(rowHtml);
    const dateMatch = rowText.match(/(20\d{2})-(\d{2})-(\d{2})/);
    if (!dateMatch) continue;

    const anchorMatch = rowHtml.match(
      /<a[^>]+href=["'][^"']*BoardView\.asp\?idx=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
    );
    const idx = anchorMatch ? anchorMatch[1] : hrefMatch ? hrefMatch[1] : '';
    let rawTitle = anchorMatch ? cleanText(anchorMatch[2]) : '';
    if (!rawTitle) continue;

    // 대진표/입장순서/마감/결과 중복 공지보다는 대회 개최/요강/대회명 대표 게시물 위주 추출
    if (
      !/수영\s*대회|생활체육\s*대회|시장배|체육회장배|교육감배|교육감기|연맹회장배|회장기|아레나\s*마스터즈|이순신장군배/.test(
        rawTitle
      )
    ) {
      continue;
    }
    if (/입장순서|감독자회의|대표자회의|워밍업|스타트\s*연습|배부\s*불가|경품\s*미수령|선발명단/.test(rawTitle)) {
      continue;
    }

    // 제목 정제 (괄호 안 부가 안내문 정리)
    let cleanTitle = rawTitle
      .replace(/\[\d+\]$/g, '')
      .replace(/\(개최요강[^)]*\)/g, '')
      .replace(/\(신청[^)]*\)/g, '')
      .replace(/\(참가[^)]*\)/g, '')
      .replace(/\(내용\s*필독[^)]*\)/g, '')
      .replace(/\(마감\)/g, '')
      .replace(/-마감$/g, '')
      .replace(/\s*(개최\s*알림|개최\s*통보|개최\s*안내|개최\s*요강|개최\s*예정|개최|참가\s*신청\s*안내|공지사항|경기순서.*|대진표.*|종합성적표.*|기록결과.*)$/g, '')
      .trim();

    if (!/대회/.test(cleanTitle)) {
      cleanTitle = `${cleanTitle} 수영대회`;
    }

    const postYear = dateMatch[1];
    const postYmd = normalizeYmd(dateMatch[1], dateMatch[2], dateMatch[3]);
    const dedupKey = `${postYear}:${cleanTitle.replace(/\s+/g, '')}`;
    if (seenTitlesByYear.has(dedupKey)) continue;
    seenTitlesByYear.add(dedupKey);

    const viewUrl = idx
      ? `http://www.busanswimming.kr/BoardView.asp?idx=${idx}&gubun=notice`
      : 'http://www.busanswimming.kr/BoardList.asp?gubun=notice';

    docs.push(
      buildSwimDoc({
        id: `swim-busan-idx-${idx || postYmd}`,
        title: cleanTitle,
        startDate: postYmd,
        endDate: postYmd,
        scheduleNote: `부산수영연맹 공지일: ${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`,
        host: '부산광역시수영연맹',
        supervise: '부산광역시수영연맹',
        url: viewUrl,
        label: '부산수영연맹 공지 원문',
        invitation: `[부산광역시수영연맹] ${cleanTitle} 공식 공지 및 대회 요강 안내입니다.`,
        defaultGeo: busanDefaultGeo,
      })
    );
  }

  return docs;
}

/**
 * 3. 울산광역시수영연맹 (http://www.ulsanswimming.com/board/notice?page=1..10) 크롤링
 */
async function crawlUlsanSwimming() {
  const docs = [];
  const ulsanGeo = {
    lDongRegnCd: '31',
    lDongSignguCd: '140',
    sigunguName: '남구',
    addr1: '울산광역시 남구 문수로 44 울산 문수실내수영장',
    mapX: 129.2638,
    mapY: 35.5342,
  };
  const seen = new Set();

  for (let page = 1; page <= 10; page += 1) {
    const url = `http://www.ulsanswimming.com/board/notice?page=${page}`;
    const res = await fetchPage(url);
    if (!res.ok) continue;

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = trRegex.exec(res.html)) !== null) {
      const rowHtml = m[1];
      const aMatch = rowHtml.match(/<a[^>]+href=["']([^"']*\/board\/notice\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
      const dateMatch = cleanText(rowHtml).match(/(20\d{2})-(\d{2})-(\d{2})/);
      if (!aMatch || !dateMatch) continue;

      const href = new URL(aMatch[1], 'http://www.ulsanswimming.com').href;
      const postId = (href.match(/\/(\d+)$/) || [])[1] || dateMatch[0];
      const rawTitle = cleanText(aMatch[2]).replace(/\s*첨부$/, '').trim();

      if (!/수영\s*대회|시장배|체육회장배|연맹회장배|교육감배|마스터즈/.test(rawTitle)) continue;
      if (/워밍업|레인\s*배정|레인\s*배치|기록지|선수\s*프로그램|양식/.test(rawTitle)) continue;

      let cleanTitle = rawTitle
        .replace(/\s*(참가요강\s*공지|참가요강|개최\s*공지|개최\s*안내|요강\s*공지).*$/g, '')
        .trim();

      const dedupKey = `${dateMatch[1]}:${cleanTitle.replace(/\s+/g, '')}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const ymd = normalizeYmd(dateMatch[1], dateMatch[2], dateMatch[3]);
      docs.push(
        buildSwimDoc({
          id: `swim-ulsan-${postId}`,
          title: cleanTitle,
          startDate: ymd,
          endDate: ymd,
          host: '울산광역시수영연맹',
          supervise: '울산광역시체육회 · 울산광역시수영연맹',
          url: href,
          label: '울산수영연맹 공지 원문',
          invitation: `[울산광역시수영연맹] ${cleanTitle} 개최 요강 및 참가 안내입니다. (장소: 울산 문수실내수영장)`,
          defaultGeo: ulsanGeo,
        })
      );
    }
  }
  return docs;
}

/**
 * 4. 서울특별시수영연맹 (http://www.seoulswim.or.kr/bbs/board.php?bo_table=schedule&page=1..6) 크롤링
 */
async function crawlSeoulSwimming() {
  const docs = [];
  const seoulGeo = {
    lDongRegnCd: '11',
    lDongSignguCd: '710',
    sigunguName: '송파구',
    addr1: '서울특별시 송파구 올림픽로 424 올림픽수영장 / 잠실제1수영장',
    mapX: 127.1219,
    mapY: 37.5178,
  };
  const seen = new Set();

  for (let page = 1; page <= 6; page += 1) {
    const url = `http://www.seoulswim.or.kr/bbs/board.php?bo_table=schedule&page=${page}`;
    const res = await fetchPage(url);
    if (!res.ok) continue;

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = trRegex.exec(res.html)) !== null) {
      const rowHtml = m[1];
      const aMatch = rowHtml.match(
        /<a[^>]+href=["']([^"']*bo_table=schedule[^"']*wr_id=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i
      );
      if (!aMatch) continue;

      const href = aMatch[1].replace(/&amp;/g, '&');
      const wrId = aMatch[2];
      const rawTitle = cleanText(aMatch[3]);
      if (!/수영|시장기|구청장배|체육회장배|교육감배|연맹회장배|마스터즈/.test(rawTitle)) continue;

      const rowText = cleanText(rowHtml);
      // 날짜가 YYYY-MM-DD 또는 MM-DD 형식
      let ymd = '20260901';
      const fullDate = rowText.match(/(20\d{2})[-.](\d{2})[-.](\d{2})/);
      const shortDate = rowText.match(/\b(\d{2})-(\d{2})\b/);
      const titleYear = (rawTitle.match(/\b(20\d{2})\b/) || [])[1] || '2026';

      if (fullDate) {
        ymd = normalizeYmd(fullDate[1], fullDate[2], fullDate[3]);
      } else if (shortDate) {
        ymd = normalizeYmd(titleYear, shortDate[1], shortDate[2]);
      }

      let cleanTitle = rawTitle
        .replace(/^참가\s*마감\s*\[개최요강\]\s*/g, '')
        .replace(/^참가\s*마감\)\s*/g, '')
        .replace(/^\(수정\)\s*/g, '')
        .replace(/\s*(개최\s*알림|개최\s*안내|개최\s*공지)$/g, '')
        .trim();

      const dedupKey = `${ymd.slice(0, 4)}:${cleanTitle.replace(/\s+/g, '')}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      docs.push(
        buildSwimDoc({
          id: `swim-seoul-${wrId}`,
          title: cleanTitle,
          startDate: ymd,
          endDate: ymd,
          host: '서울특별시수영연맹',
          supervise: '서울특별시수영연맹 · 자치구수영연맹',
          url: href.startsWith('http') ? href : `http://www.seoulswim.or.kr${href}`,
          label: '서울수영연맹 대회일정 원문',
          invitation: `[서울특별시수영연맹] ${cleanTitle} 개최 요강 및 참가 안내입니다.`,
          defaultGeo: seoulGeo,
        })
      );
    }
  }
  return docs;
}

/**
 * 5. 경기도수영연맹 (http://www.gswimming.com/41, http://www.gswimming.com/34?page=1..4) 크롤링
 */
async function crawlGyeonggiSwimming() {
  const docs = [];
  const gyeonggiGeo = {
    lDongRegnCd: '41',
    lDongSignguCd: '110',
    sigunguName: '수원시',
    addr1: '경기도 수원시 팔달구 월드컵로 310 수원월드컵경기장 스포츠센터 수영장',
    mapX: 127.0368,
    mapY: 37.2865,
  };
  const seen = new Set();

  // (A) http://www.gswimming.com/41 (경기도 수영대회 접수/일정)
  const res41 = await fetchPage('http://www.gswimming.com/41');
  if (res41.ok) {
    const cleaned41 = cleanText(res41.html);
    const regex41 =
      /\[(모집마감|모집중)\]\s*([^\n]+?)\s+(20\d{2}-\d{2}-\d{2})\s*~\s*(20\d{2}-\d{2}-\d{2})\s+(20\d{2})-(\d{2})-(\d{2})/g;
    let m;
    let idx = 1;
    while ((m = regex41.exec(cleaned41)) !== null) {
      let cleanTitle = m[2]
        .replace(/\(등록선수[^)]*\)/g, '')
        .replace(/\(비등록선수[^)]*\)/g, '')
        .trim();
      if (/^테스트/.test(cleanTitle)) continue;
      const ymd = normalizeYmd(m[5], m[6], m[7]);
      const dedupKey = `${m[5]}:${cleanTitle.replace(/\s+/g, '')}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      docs.push(
        buildSwimDoc({
          id: `swim-gyeonggi-41-${ymd}-${idx++}`,
          title: cleanTitle,
          startDate: ymd,
          endDate: ymd,
          host: '경기도수영연맹',
          supervise: '경기도수영연맹',
          url: 'http://www.gswimming.com/41',
          label: '경기도수영연맹 대회일정 원문',
          invitation: `[경기도수영연맹] ${cleanTitle} 개최 안내 (대회일: ${m[5]}.${m[6]}.${m[7]})`,
          defaultGeo: gyeonggiGeo,
        })
      );
    }
  }

  for (let page = 1; page <= 4; page += 1) {
    const url = `http://www.gswimming.com/34?page=${page}`;
    const res = await fetchPage(url);
    if (!res.ok) continue;

    const cleaned34 = cleanText(res.html);
    const regex34 =
      /(\d{1,3})\s+([^\n]+?(?:개최\s*통보|참가요강\s*공지))\s+경기도수영연맹\s+(20\d{2})\.(\d{2})\.(\d{2})/g;
    let m;
    while ((m = regex34.exec(cleaned34)) !== null) {
      const postId = m[1];
      let cleanTitle = m[2]
        .replace(/\s*(개최\s*통보|참가요강\s*공지|개최\s*안내|개최\s*알림)$/g, '')
        .trim();

      if (!/수영|선발전|대축전|체전|의장배|교육감배/.test(cleanTitle)) continue;

      const ymd = normalizeYmd(m[3], m[4], m[5]);
      const dedupKey = `${m[3]}:${cleanTitle.replace(/\s+/g, '')}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      docs.push(
        buildSwimDoc({
          id: `swim-gyeonggi-34-${postId}`,
          title: cleanTitle,
          startDate: ymd,
          endDate: ymd,
          host: '경기도수영연맹',
          supervise: '경기도수영연맹',
          url: `http://www.gswimming.com/34/${postId}`,
          label: '경기도수영연맹 대회일정표 원문',
          invitation: `[경기도수영연맹] ${cleanTitle} 개최 안내 및 대회 일정표 공지입니다.`,
          defaultGeo: gyeonggiGeo,
        })
      );
    }
  }
  return docs;
}

/**
 * 6. 강원·전남광주·경북·제주·스파인더·창원 등 크롤링 및 보강
 */
async function crawlOtherFederationsAndPools() {
  const docs = [];

  // (A) 강원특별자치도수영연맹 (gwswim.or.kr bo_table=501)
  const gwRes = await fetchPage('https://www.gwswim.or.kr/bbs/board.php?bo_table=501');
  if (gwRes.ok) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = trRegex.exec(gwRes.html)) !== null) {
      const rowHtml = m[1];
      const aMatch = rowHtml.match(
        /<a[^>]+href=["']([^"']*bo_table=501[^"']*wr_id=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i
      );
      if (!aMatch) continue;
      const href = aMatch[1].replace(/&amp;/g, '&');
      const wrId = aMatch[2];
      const rawTitle = cleanText(aMatch[3]);
      if (!/수영|체육대회|도지사|교육감|회장기|수구/.test(rawTitle)) continue;
      if (/현황|대회\s*일정$/.test(rawTitle)) continue;

      const rowText = cleanText(rowHtml);
      const yearMatch = rawTitle.match(/\b(20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : '2026';
      const mmdd = rowText.match(/\b(\d{2})-(\d{2})\b/);
      const ymd = mmdd ? normalizeYmd(year, mmdd[1], mmdd[2]) : `${year}0615`;

      docs.push(
        buildSwimDoc({
          id: `swim-gangwon-${wrId}`,
          title: rawTitle.replace(/^\(최종\)\s*/, '').replace(/\s*대진표$/, ''),
          startDate: ymd,
          endDate: ymd,
          host: '강원특별자치도수영연맹',
          supervise: '강원특별자치도수영연맹',
          url: href.startsWith('//') ? `https:${href}` : href,
          label: '강원수영연맹 대회일정 원문',
          defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '춘천시'),
        })
      );
    }
  }

  // (B) 전남·광주수영연맹 (jnsf.kr)
  const jnRes = await fetchPage('http://jnsf.kr/board.php?bo=schedule');
  if (jnRes.ok) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    const seen = new Set();
    while ((m = trRegex.exec(jnRes.html)) !== null) {
      const rowHtml = m[1];
      const aMatch = rowHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const dateMatch = cleanText(rowHtml).match(/(20\d{2})\.(\d{2})\.(\d{2})/);
      if (!aMatch || !dateMatch) continue;

      let title = cleanText(aMatch[2])
        .replace(/\s*(HWP|PDF|XLSX)(\s*\+\d+)?$/i, '')
        .replace(/\s*(운영지침|대진표.*|참가신청서.*|요강)$/g, '')
        .trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);

      const ymd = normalizeYmd(dateMatch[1], dateMatch[2], dateMatch[3]);
      const href = new URL(aMatch[1].replace(/&amp;/g, '&'), 'http://jnsf.kr').href;
      docs.push(
        buildSwimDoc({
          id: `swim-jeonnam-${ymd}-${seen.size}`,
          title: /수영/.test(title) ? title : `${title} (수영경기)`,
          startDate: ymd,
          endDate: ymd,
          host: '전라남도수영연맹 · 광주광역시수영연맹',
          supervise: '전라남도수영연맹',
          url: href,
          label: '전남수영연맹 대회일정 원문',
          defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '목포시'),
        })
      );
    }
  }

  // (C) 경상북도수영연맹 (gbaquatics.co.kr)
  const gbRes = await fetchPage(
    'http://gbaquatics.co.kr/pages/01_competition-info/01_schedule-guide/'
  );
  if (gbRes.ok) {
    const itemRegex =
      /공지\s+([^\n<]+?)\s+대회기간\s*:\s*(20\d{2})-(\d{2})-(\d{2})\s*~\s*(20\d{2})-(\d{2})-(\d{2})/g;
    const cleaned = cleanText(gbRes.html);
    let m;
    let idx = 1;
    while ((m = itemRegex.exec(cleaned)) !== null) {
      const title = m[1].replace(/\s*참가요강$/, '').trim();
      const startDate = normalizeYmd(m[2], m[3], m[4]);
      const endDate = normalizeYmd(m[5], m[6], m[7]);
      docs.push(
        buildSwimDoc({
          id: `swim-gyeongbuk-${startDate}-${idx++}`,
          title,
          startDate,
          endDate,
          host: '경상북도수영연맹',
          supervise: '경상북도수영연맹',
          url: 'http://gbaquatics.co.kr/pages/01_competition-info/01_schedule-guide/',
          label: '경북수영연맹 대회일정 원문',
          defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '경산시'),
        })
      );
    }
  }

  // (D) 제주특별자치도수영연맹 (kjaq.kr/31)
  const jjRes = await fetchPage('https://kjaq.kr/31');
  if (jjRes.ok) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = trRegex.exec(jjRes.html)) !== null) {
      const rowHtml = m[1];
      const aMatch = rowHtml.match(/<a[^>]+href=["'](https:\/\/kjaq\.kr\/31\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
      const dateMatch = cleanText(rowHtml).match(/(20\d{2})\.(\d{2})\.(\d{2})/);
      if (!aMatch || !dateMatch) continue;
      const postId = aMatch[2];
      const rawTitle = cleanText(aMatch[3]).replace(/^\[(도내대회|전국대회)\]\s*/, '').trim();
      const ymd = normalizeYmd(dateMatch[1], dateMatch[2], dateMatch[3]);
      docs.push(
        buildSwimDoc({
          id: `swim-jeju-31-${postId}`,
          title: rawTitle,
          startDate: ymd,
          endDate: ymd,
          host: '제주특별자치도수영연맹',
          supervise: '제주특별자치도수영연맹',
          url: aMatch[1],
          label: '제주수영연맹 대회일정 원문',
          defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '제주시'),
        })
      );
    }
  }

  // (E) 세계수영연맹(World Aquatics), 창원시수영연맹, 인천·대구·대전·충북·충남·전북 및 개별 수영장(Lv.0) 주요 대회
  const curatedFederationAndPoolEvents = [
    // Lv.3 세계수영연맹(World Aquatics)
    {
      id: 'swim-world-aquatics-wc-incheon-2024',
      title: '2024 World Aquatics Swimming World Cup Incheon (세계수영연맹 경영 월드컵 인천)',
      startDate: '20241024',
      endDate: '20241026',
      host: '세계수영연맹 (World Aquatics) · 대한수영연맹',
      url: 'https://www.worldaquatics.com/competitions',
      label: 'World Aquatics 공식 대회 안내',
      explicitLevel: 3,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '미추홀구'),
    },
    {
      id: 'swim-world-aquatics-championships-2025',
      title: '2025 World Aquatics Championships (세계수영선수권대회 국가대표 파견)',
      startDate: '20250711',
      endDate: '20250803',
      host: '세계수영연맹 (World Aquatics) · 대한수영연맹',
      url: 'https://www.worldaquatics.com/competitions',
      label: 'World Aquatics 공식 대회 안내',
      explicitLevel: 3,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '송파구'),
    },
    {
      id: 'swim-world-aquatics-wc-2026',
      title: '2026 World Aquatics Swimming World Cup Series (세계수영연맹 경영 월드컵)',
      startDate: '20261015',
      endDate: '20261017',
      host: '세계수영연맹 (World Aquatics) · 대한수영연맹',
      url: 'https://www.worldaquatics.com/competitions',
      label: 'World Aquatics 공식 대회 안내',
      explicitLevel: 3,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '미추홀구'),
    },
    // Lv.2 광역시·도 수영연맹 (인천, 대구, 대전, 경남 등)
    {
      id: 'swim-incheon-76-2026',
      title: '제76회 인천광역시수영연맹회장배 마스터즈 수영대회',
      startDate: '20260222',
      endDate: '20260222',
      host: '인천광역시수영연맹',
      url: 'https://www.sfinder.co.kr/contest/contest_list/swimming',
      label: '인천수영연맹 / 스파인더 대회 안내',
      explicitLevel: 2,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '미추홀구'),
    },
    {
      id: 'swim-incheon-75-2025',
      title: '제75회 인천광역시수영연맹회장배 마스터즈 수영대회',
      startDate: '20250223',
      endDate: '20250223',
      host: '인천광역시수영연맹',
      url: 'https://www.sfinder.co.kr/contest/contest_list/swimming',
      label: '인천수영연맹 / 스파인더 대회 안내',
      explicitLevel: 2,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '미추홀구'),
    },
    {
      id: 'swim-ulsan-mayor-14-2025',
      title: '2025 제14회 울산광역시장배 수영대회',
      startDate: '20251109',
      endDate: '20251109',
      host: '울산광역시수영연맹',
      url: 'http://www.ulsanswimming.com/board/notice',
      label: '울산수영연맹 공지사항',
      explicitLevel: 2,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '남구'),
    },
    {
      id: 'swim-ulsan-mayor-13-2024',
      title: '2024 제13회 울산광역시장배 수영대회',
      startDate: '20241110',
      endDate: '20241110',
      host: '울산광역시수영연맹',
      url: 'http://www.ulsanswimming.com/board/notice',
      label: '울산수영연맹 공지사항',
      explicitLevel: 2,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '남구'),
    },
    // Lv.1 기초지자체(창원 등)
    {
      id: 'swim-changwon-mayor-2026',
      title: '2026 제16회 창원특례시장배 전국 마스터즈 수영대회',
      startDate: '20260613',
      endDate: '20260614',
      host: '창원시수영연맹 · 창원특례시체육회',
      url: 'https://cafe.daum.net/cwsun',
      label: '창원시수영연맹 공식 커뮤니티',
      explicitLevel: 1,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '창원시'),
    },
    {
      id: 'swim-changwon-mayor-2025',
      title: '2025 제15회 창원특례시장배 전국 마스터즈 수영대회',
      startDate: '20250614',
      endDate: '20250615',
      host: '창원시수영연맹 · 창원특례시체육회',
      url: 'https://cafe.daum.net/cwsun',
      label: '창원시수영연맹 공식 커뮤니티',
      explicitLevel: 1,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '창원시'),
    },
    {
      id: 'swim-changwon-fed-2026',
      title: '2026 제18회 창원시수영연맹회장배 생활체육 수영대회',
      startDate: '20261018',
      endDate: '20261018',
      host: '창원시수영연맹',
      url: 'https://cafe.daum.net/cwsun',
      label: '창원시수영연맹 공식 커뮤니티',
      explicitLevel: 1,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '창원시'),
    },
    {
      id: 'swim-changwon-fed-2025',
      title: '2025 제17회 창원시수영연맹회장배 생활체육 수영대회',
      startDate: '20251019',
      endDate: '20251019',
      host: '창원시수영연맹',
      url: 'https://cafe.daum.net/cwsun',
      label: '창원시수영연맹 공식 커뮤니티',
      explicitLevel: 1,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '창원시'),
    },
    // Lv.0 각 수영장·체육센터 내 개별 행사 (스파인더 등)
    {
      id: 'swim-pool-olympic-swimmer-2026',
      title: '2026 물 만난 SWIMMER 페스티벌 (올림픽수영장 자체 행사)',
      startDate: '20261231',
      endDate: '20261231',
      host: '올림픽수영장 · 스파인더',
      url: 'https://www.sfinder.co.kr/contest/contest_list/swimming',
      label: '스파인더 개별 수영장 행사 안내',
      explicitLevel: 0,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '송파구'),
    },
    {
      id: 'swim-pool-nowon-youth-2026',
      title: '2026 KTA YOUTH Swim Festival (시립노원청소년센터 수영장)',
      startDate: '20260726',
      endDate: '20260726',
      host: '시립노원청소년센터 수영장',
      url: 'https://www.sfinder.co.kr/contest/contest_list/swimming',
      label: '스파인더 개별 수영장 행사 안내',
      explicitLevel: 0,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '노원구'),
    },
    {
      id: 'swim-pool-daebu-soop-2026',
      title: 'SOOP Swim Fest 2026 (안산 대부동 복지체육센터 수영장)',
      startDate: '20260620',
      endDate: '20260621',
      host: '대부동 복지체육센터 수영장',
      url: 'https://www.sfinder.co.kr/contest/contest_list/swimming',
      label: '스파인더 개별 수영장 행사 안내',
      explicitLevel: 0,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '안산시'),
    },
    {
      id: 'swim-pool-nowon-union-3-2025',
      title: '제3회 노원·망우·성북·동대문·강북 연합 청소년센터 수영대회 (노원청소년센터 지하2층 수영장)',
      startDate: '20251207',
      endDate: '20251207',
      host: '사립노원청소년센터 수영장',
      url: 'https://www.sfinder.co.kr/contest/contest_list/swimming',
      label: '스파인더 개별 수영장 행사 안내',
      explicitLevel: 0,
      defaultGeo: VENUE_GEO_MAP.find((v) => v.sigunguName === '노원구'),
    },
  ];

  for (const item of curatedFederationAndPoolEvents) {
    docs.push(buildSwimDoc(item));
  }

  return docs;
}

async function main() {
  console.log('🏊 [Swimming Federation Crawler] 세계·대한·시도·지자체 수영연맹 크롤링 시작...');

  const existingRaw = await fs.readFile(EVENTS_JSON_PATH, 'utf-8');
  const payload = JSON.parse(existingRaw);
  const existingEvents = Array.isArray(payload.events) ? payload.events : [];

  const [ksfDocs, busanDocs, ulsanDocs, seoulDocs, gyeonggiDocs, otherDocs] = await Promise.all([
    crawlKoreaAquatics(),
    crawlBusanSwimming(),
    crawlUlsanSwimming(),
    crawlSeoulSwimming(),
    crawlGyeonggiSwimming(),
    crawlOtherFederationsAndPools(),
  ]);

  console.log(
    `  - 대한수영연맹(KSF): ${ksfDocs.length}건, 부산수영연맹: ${busanDocs.length}건, 울산수영연맹: ${ulsanDocs.length}건, 서울수영연맹: ${seoulDocs.length}건, 경기도수영연맹: ${gyeonggiDocs.length}건, 기타/개별수영장: ${otherDocs.length}건`
  );

  const allNewSwimDocs = [
    ...ksfDocs,
    ...busanDocs,
    ...ulsanDocs,
    ...seoulDocs,
    ...gyeonggiDocs,
    ...otherDocs,
  ];

  // 기존 이벤트 맵에 병합 + 모든 이벤트의 promoLevel을 새 4단계 정책(Lv.3~Lv.0)으로 재계산
  const eventMap = new Map();
  for (const ev of existingEvents) {
    const recomputedLevel = computePromoLevel({
      title: ev.title,
      invitation: ev.invitation,
      organizer: ev.organizer?.host,
      lDongRegnCd: ev.lDongRegnCd,
      addr1: ev.addr1,
    });
    eventMap.set(ev.id, {
      ...ev,
      promoLevel: recomputedLevel,
    });
  }

  for (const swimDoc of allNewSwimDocs) {
    eventMap.set(swimDoc.id, swimDoc);
  }

  const mergedList = Array.from(eventMap.values());

  // 시리즈(회차) 재연결
  const { docs: linkedEvents, seriesMap } = linkEventSeries(mergedList);
  const seriesList = Object.values(seriesMap).filter(
    (s) => Array.isArray(s.editions) && s.editions.length >= 2
  );

  // 연도별 통계 및 수영 레벨별 통계 집계
  const eventsByYear = {};
  const swimLevelCounts = { 3: 0, 2: 0, 1: 0, 0: 0 };
  for (const ev of linkedEvents) {
    const yr = String(ev.eventYear || ev.eventDate?.startDate?.slice(0, 4) || '기타');
    eventsByYear[yr] = (eventsByYear[yr] || 0) + 1;
    const text = `${ev.title} ${ev.invitation || ''} ${ev.organizer?.host || ''}`;
    if (isSwimEvent(text)) {
      const lv = ev.promoLevel ?? 0;
      swimLevelCounts[lv] = (swimLevelCounts[lv] || 0) + 1;
    }
  }

  const updatedPayload = {
    ...payload,
    crawledAt: new Date().toISOString(),
    totalEvents: linkedEvents.length,
    swimmingFederationEventsAdded: allNewSwimDocs.length,
    swimLevelCounts,
    multiEditionSeriesCount: seriesList.length,
    yearBreakdown: eventsByYear,
    seriesMap,
    events: linkedEvents,
  };

  await fs.writeFile(EVENTS_JSON_PATH, JSON.stringify(updatedPayload, null, 2), 'utf-8');
  await fs.writeFile(
    SERIES_JSON_PATH,
    JSON.stringify(
      {
        generatedAt: updatedPayload.crawledAt,
        totalSeries: seriesList.length,
        series: seriesList,
      },
      null,
      2
    ),
    'utf-8'
  );

  // swimming-federation-registry.json 에 크롤링 통계 반영
  try {
    const swimDbRaw = await fs.readFile(SWIM_DB_JSON_PATH, 'utf-8');
    const swimDb = JSON.parse(swimDbRaw);
    swimDb.updatedAt = updatedPayload.crawledAt;
    swimDb.crawlSummary = {
      totalSwimEvents:
        swimLevelCounts[3] + swimLevelCounts[2] + swimLevelCounts[1] + swimLevelCounts[0],
      levelBreakdown: swimLevelCounts,
      bySource: {
        koreaAquatics: ksfDocs.length,
        busanSwimming: busanDocs.length,
        ulsanSwimming: ulsanDocs.length,
        seoulSwimming: seoulDocs.length,
        gyeonggiSwimming: gyeonggiDocs.length,
        otherFederationsAndPools: otherDocs.length,
      },
    };
    await fs.writeFile(SWIM_DB_JSON_PATH, JSON.stringify(swimDb, null, 2), 'utf-8');
  } catch {
    // ignore
  }

  console.log(`✅ 총 이벤트 수: ${linkedEvents.length}건`);
  console.log(`✅ 수영 행사 레벨별 분포:`, swimLevelCounts);
  console.log(`✅ 다회차 연결 시리즈 수: ${seriesList.length}개`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
