/**
 * 크롤링 결과 최종 정규화 + 시리즈 재연결 + 압축 저장 (크롤링 파이프라인의 마지막 단계)
 *
 * 실행 순서 (package.json `npm run crawl`):
 *   1) crawl-municipal-events.mjs   — 지자체·공공포털 행사 (JSON을 새로 생성)
 *   2) crawl-swimming-federations.mjs — 수영 연맹 대회 (기존 JSON에 병합)
 *   3) crawl-sports-all.mjs          — 러닝·자전거·철인 (기존 JSON에 병합)
 *   4) normalize-events.mjs (이 파일) — 공용 normalizeEventDoc 적용, 시리즈 재계산, 압축 저장
 *
 * 하는 일:
 * - src/shared/promoPolicy.js 의 normalizeEventDoc 을 모든 행사에 적용
 *   (스포츠 더미 일정 제외, 일반 행사 더미 일정 dateUnknown 표시, 대회 제목 기준 지자체 코드·범위 동기화)
 * - 지자체 코드가 바뀐 문서가 있으므로 linkEventSeries 로 회차 시리즈를 다시 계산
 * - 프런트 첫 로딩 용량을 줄이기 위해 들여쓰기 없는 압축 JSON 으로 저장
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEventDoc } from '../src/shared/promoPolicy.js';
import { linkEventSeries } from '../src/shared/seriesLinker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const EVENTS_PATH = path.join(ROOT_DIR, 'public', 'data', 'auto-crawled-events.json');
const SERIES_PATH = path.join(ROOT_DIR, 'public', 'data', 'series-index.json');

function main() {
  const beforeBytes = fs.statSync(EVENTS_PATH).size;
  const payload = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  const rawEvents = Array.isArray(payload.events) ? payload.events : [];

  let dropped = 0;
  let markedUnknown = 0;
  let deduped = 0;
  const byKey = new Map();
  const seenIds = new Set();

  for (const ev of rawEvents) {
    const next = normalizeEventDoc(ev);
    if (!next) {
      dropped++;
      continue;
    }
    if (seenIds.has(next.id)) {
      deduped++;
      continue;
    }
    seenIds.add(next.id);

    const cleanTitle = String(next.title || '').replace(/\s+/g, '').toLowerCase();
    const dedupeKey = [
      next.lDongRegnCd || '',
      next.lDongSignguCd || '',
      next.category?.lclsSystm3 || '',
      cleanTitle,
      next.eventDate?.startDate || '',
    ].join('|');

    const prev = byKey.get(dedupeKey);
    if (prev) {
      // 동일 지역·분류·제목·시작일 중복 문서는 링크만 병합하고 중복 제외
      const urlSet = new Set((prev.links || []).map((l) => l.url));
      for (const l of next.links || []) {
        if (l?.url && !urlSet.has(l.url)) {
          prev.links = [...(prev.links || []), l];
          urlSet.add(l.url);
        }
      }
      deduped++;
      continue;
    }

    if (next.eventDate?.dateUnknown && !ev.eventDate?.dateUnknown) markedUnknown++;
    byKey.set(dedupeKey, next);
  }

  const normalized = Array.from(byKey.values());

  const { docs: linkedDocs, seriesMap } = linkEventSeries(normalized);
  const seriesList = Object.values(seriesMap || {});

  const { seriesMap: _oldSeriesMap, eventsByYear: _oldByYear, ...meta } = payload;
  const output = {
    ...meta,
    normalizedAt: new Date().toISOString(),
    totalEvents: linkedDocs.length,
    dateUnknownCount: linkedDocs.filter((d) => d.eventDate?.dateUnknown).length,
    events: linkedDocs,
  };

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(output), 'utf-8');
  fs.writeFileSync(
    SERIES_PATH,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      totalSeriesCount: seriesList.length,
      multiEditionSeriesCount: seriesList.filter((s) => s.editions.length >= 2).length,
      series: seriesList,
    }),
    'utf-8'
  );

  const afterBytes = fs.statSync(EVENTS_PATH).size;
  console.log('[normalize] 입력', rawEvents.length, '건 → 출력', linkedDocs.length, '건');
  console.log('[normalize] 정책 제외(더미 일정·운영 공지)', dropped, '건 / 중복 병합 제외', deduped, '건 / 일반 행사 일정 미정 표시', markedUnknown, '건 (누적', output.dateUnknownCount, '건)');
  console.log(
    '[normalize] JSON 크기',
    (beforeBytes / 1024 / 1024).toFixed(2),
    'MB →',
    (afterBytes / 1024 / 1024).toFixed(2),
    'MB'
  );
}

main();
