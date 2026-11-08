/**
 * Firebase Firestore(`events` 컬렉션) 문서 사실확인 후, 유효한 문서만 정적 JSON에 중복 없이 병합하는 점검 도구
 *
 * 사용법: node scripts/verify-cloud-events.mjs [--apply]
 *   - 옵션 없이 실행하면 점검 보고서만 출력 (JSON 변경 없음)
 *   - --apply 를 붙이면 유효·신규 문서를 public/data/auto-crawled-events.json 에 추가
 *     (이후 `npm run normalize-data` 로 시리즈 재계산·압축 저장)
 *
 * 사실확인 기준:
 *   1) 형식: 제목 존재, 시작/종료일이 YYYYMMDD 이고 1990~2035년, 시작일 ≤ 종료일
 *   2) 정책: 공용 normalizeEventDoc 통과 (스포츠 더미 일정·운영 공지 제외)
 *   3) 출처: 문서의 링크 중 하나 이상이 실제로 열리고(HTTP 2xx),
 *      그 페이지 본문에 행사 제목의 핵심 단어가 절반 이상 들어 있어야 함
 *   4) 중복: 같은 id, 또는 (정규화 제목 + 시작일)이 같은 문서가 JSON에 이미 있으면 추가하지 않음
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { collection, getDocsFromServer, getFirestore } from 'firebase/firestore';
import { normalizeEventDoc } from '../src/shared/promoPolicy.js';
import { normalizeSeriesTitle } from '../src/shared/seriesLinker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const EVENTS_PATH = path.join(ROOT_DIR, 'public', 'data', 'auto-crawled-events.json');
const REPORT_PATH = path.join(ROOT_DIR, 'public', 'data', 'cloud-verify-report.json');
const APPLY = process.argv.includes('--apply');

// Firebase Web 설정은 공개 식별자 (src/services/firebase.ts 와 동일)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDwEWu2_OKbqZC9UIsmb6sW2_pUizdA5Ys',
  authDomain: 'koreaeventlist.firebaseapp.com',
  projectId: 'koreaeventlist',
  storageBucket: 'koreaeventlist.firebasestorage.app',
  messagingSenderId: '603041792508',
  appId: '1:603041792508:web:666141167d411a7d797279',
};

const FETCH_TIMEOUT_MS = 7000;
const CONCURRENCY = 12;

function fetchPage(url, depth = 0) {
  return new Promise((resolve) => {
    if (depth > 4) return resolve({ ok: false, status: 0, reason: 'redirect-loop' });
    let client;
    try {
      client = url.startsWith('https') ? https : http;
    } catch {
      return resolve({ ok: false, status: 0, reason: 'bad-url' });
    }
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
        timeout: FETCH_TIMEOUT_MS,
        rejectUnauthorized: false,
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          return resolve(fetchPage(next, depth + 1));
        }
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size < 3_000_000) chunks.push(Buffer.from(c));
        });
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const ctype = String(res.headers['content-type'] || '');
          const head = buf.subarray(0, 4000).toString('latin1');
          const charsetMatch =
            ctype.match(/charset=([\w-]+)/i) || head.match(/charset=["']?([\w-]+)/i);
          const charset = (charsetMatch ? charsetMatch[1] : 'utf-8').toLowerCase();
          let text;
          try {
            text = new TextDecoder(/euc-kr|ks_c_5601|cp949/.test(charset) ? 'euc-kr' : 'utf-8').decode(buf);
          } catch {
            text = buf.toString('utf-8');
          }
          resolve({ ok: status >= 200 && status < 300, status, text, isBinary: /pdf|hwp|octet-stream/i.test(ctype) });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, reason: 'timeout' });
    });
    req.on('error', (err) => resolve({ ok: false, status: 0, reason: err.code || err.message }));
  });
}

/** 제목에서 사실확인용 핵심 단어 추출 (연도·회차·말머리·일반 수식어 제외) */
function titleKeywords(title) {
  const { canonicalName } = normalizeSeriesTitle(title);
  const stop = new Set(['안내', '개최', '행사', '대회', '참가자', '모집', '공고', '알림', '홍보', '및', '제', '년', '회']);
  return canonicalName
    .replace(/[^가-힣A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stop.has(w) && !/^\d+$/.test(w));
}

function pageMatchesTitle(pageText, title) {
  const plain = pageText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, '');
  const keys = titleKeywords(title);
  if (keys.length === 0) return { matched: false, ratio: 0 };
  const hit = keys.filter((k) => plain.includes(k.replace(/\s+/g, ''))).length;
  const ratio = hit / keys.length;
  return { matched: ratio >= 0.5, ratio: Number(ratio.toFixed(2)) };
}

function isValidYmd(s) {
  if (!/^\d{8}$/.test(String(s || ''))) return false;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  return y >= 1990 && y <= 2035 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function dedupeKey(doc) {
  return `${normalizeSeriesTitle(doc.title).baseKey}|${doc.eventDate?.startDate || ''}`;
}

async function verifyDoc(doc) {
  const start = doc.eventDate?.startDate;
  const end = doc.eventDate?.endDate || start;
  if (!doc.title) return { verdict: 'invalid', reason: '제목 없음' };
  if (!isValidYmd(start) || !isValidYmd(end) || start > end) {
    return { verdict: 'invalid', reason: `날짜 형식 오류 (${start}~${end})` };
  }
  const normalized = normalizeEventDoc(doc);
  if (!normalized) return { verdict: 'invalid', reason: '정책 제외 (더미 일정 또는 운영 공지)' };

  const urls = [...new Set((doc.links || []).map((l) => l?.url).filter((u) => /^https?:\/\//i.test(u || '')))];
  if (urls.length === 0) return { verdict: 'unverified', reason: '출처 링크 없음' };

  const attempts = [];
  for (const url of urls.slice(0, 4)) {
    const page = await fetchPage(url);
    if (!page.ok) {
      attempts.push(`${url} → ${page.status || page.reason}`);
      continue;
    }
    if (page.isBinary) {
      // 첨부파일(PDF/HWP)이 열리면 출처 존재로 인정하되 본문 대조는 생략
      return { verdict: 'valid', reason: `첨부 출처 확인 (${url})`, normalized, sourceUrl: url };
    }
    const m = pageMatchesTitle(page.text || '', doc.title);
    if (m.matched) {
      return { verdict: 'valid', reason: `출처 본문 일치 ${Math.round(m.ratio * 100)}%`, normalized, sourceUrl: url };
    }
    attempts.push(`${url} → 본문 불일치(${Math.round(m.ratio * 100)}%)`);
  }
  return { verdict: 'unverified', reason: attempts.join(' | ') };
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  const existing = Array.isArray(payload.events) ? payload.events : [];
  const existingIds = new Set(existing.map((d) => d.id));
  const existingKeys = new Set(existing.map(dedupeKey));

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  // 오프라인 캐시가 아니라 서버에서 직접 읽어야 "0건"과 "접속 실패"를 구분할 수 있다
  let snap;
  try {
    snap = await getDocsFromServer(collection(db, 'events'));
  } catch (err) {
    console.error(`[verify] Firestore 서버 조회 실패 (${err?.code || err?.message}). 클라우드 문서를 확인할 수 없어 JSON은 변경하지 않습니다.`);
    process.exit(2);
  }
  const cloudDocs = [];
  snap.forEach((s) => {
    const data = s.data();
    cloudDocs.push({ ...data, id: data?.id || s.id });
  });
  console.log(`[verify] 클라우드 문서 ${cloudDocs.length}건 점검 시작 (동시 ${CONCURRENCY}건)`);

  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < cloudDocs.length) {
      const doc = cloudDocs[cursor++];
      const duplicate = existingIds.has(doc.id) || (doc.title && existingKeys.has(dedupeKey(doc)));
      if (duplicate) {
        results.push({ id: doc.id, title: doc.title, verdict: 'duplicate', reason: 'JSON에 이미 있음' });
        continue;
      }
      const r = await verifyDoc(doc);
      results.push({ id: doc.id, title: doc.title, ...r });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const summary = results.reduce((acc, r) => ((acc[r.verdict] = (acc[r.verdict] || 0) + 1), acc), {});
  const toInsert = [];
  const seenKeys = new Set(existingKeys);
  for (const r of results) {
    if (r.verdict !== 'valid') continue;
    const key = dedupeKey(r.normalized);
    if (seenKeys.has(key)) continue; // 클라우드 내부 중복 제거
    seenKeys.add(key);
    toInsert.push(r.normalized);
  }

  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        cloudTotal: cloudDocs.length,
        summary,
        insertedCount: APPLY ? toInsert.length : 0,
        results: results.map(({ normalized, ...rest }) => rest),
      },
      null,
      1
    ),
    'utf-8'
  );

  if (APPLY && toInsert.length > 0) {
    payload.events = [...existing, ...toInsert];
    fs.writeFileSync(EVENTS_PATH, JSON.stringify(payload), 'utf-8');
  }

  console.log('[verify] 결과:', JSON.stringify(summary));
  console.log(`[verify] 유효·신규 ${toInsert.length}건 ${APPLY ? 'JSON에 추가 완료' : '(점검 모드: 추가 안 함, --apply 로 반영)'}`);
  console.log(`[verify] 상세 보고서: ${path.relative(ROOT_DIR, REPORT_PATH)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[verify] 실패:', err);
  process.exit(1);
});
