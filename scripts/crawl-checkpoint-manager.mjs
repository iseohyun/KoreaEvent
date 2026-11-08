/**
 * 크롤링 사이트별 증분 수집(Incremental Crawl) 체크포인트 매니저
 * - 저장 경로: `public/data/crawl-checkpoints.json`
 * - 역할:
 *   1) 각 크롤링 소스(연맹 게시판, 대회 포털, 지자체 사이트 등)별로
 *      - `lastCrawledAt`: 마지막 크롤링 수행 시각 (ISO 8601)
 *      - `maxPostId` / `minPostId`: 게시판 고유 글번호(idx, wr_id, tourcd, no, r_idx, cid 등)의 수집 범위
 *      - `latestPostIds`: 최근 수집된 상위 게시글 ID 목록 (글번호가 비순차적인 게시판 대비)
 *      - `minEventDate` / `maxEventDate`: 수집된 행사 일정 범위 (YYYYMMDD ~ YYYYMMDD)
 *      - `totalItems`: 해당 소스에서 누적 수집된 이벤트 건수
 *   2) 동작 루틴:
 *      - [최초 수집 또는 체크포인트 없음 (`--full` 포함)]:
 *        전체 페이지·전체 연도를 전수 스캔(Full Scan)한 후 체크포인트 기록 업데이트
 *      - [이전 체크포인트가 존재하는 경우 (증분 수집 Incremental Scan)]:
 *        1페이지(최신 글)부터 순회하며 `shouldSkipPost(siteId, postId)`가 true(이미 수집 완료된 마지막 글 이하)이면
 *        상세 페이지 HTTP 요청을 생략하고, 페이지 내 모든 글이 이미 수집된 범위이면 다음 페이지 탐색을 조기 종료(Early-Stop)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const CHECKPOINT_FILE_PATH = path.join(
  ROOT_DIR,
  'public',
  'data',
  'crawl-checkpoints.json'
);
const AUTO_CRAWLED_PATH = path.join(
  ROOT_DIR,
  'public',
  'data',
  'auto-crawled-events.json'
);
const ADMIN_REGISTRY_PATH = path.join(
  ROOT_DIR,
  'public',
  'geo',
  'admin-promo-registry.json'
);
const SPORTS_REGISTRY_PATH = path.join(
  ROOT_DIR,
  'public',
  'data',
  'sports-federation-registry.json'
);
const AUDIT_REPORT_PATH = path.join(
  ROOT_DIR,
  'public',
  'data',
  'crawl-audit-report.json'
);

/**
 * CLI 인자(`--full`) 또는 환경변수(`FORCE_FULL_CRAWL=1`)로 전체 재수집 강제 여부 확인
 */
export function isForceFullCrawl() {
  return (
    process.argv.includes('--full') ||
    process.env.FORCE_FULL_CRAWL === '1' ||
    process.env.FORCE_FULL_CRAWL === 'true'
  );
}

/**
 * 체크포인트 JSON 로드 (파일이 없으면 빈 구조 반환)
 */
export function loadCrawlCheckpoints() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CHECKPOINT_FILE_PATH, 'utf-8'));
      if (raw && typeof raw === 'object' && raw.sources) {
        return raw;
      }
    }
  } catch (err) {
    console.warn('[Checkpoint] 체크포인트 로드 실패, 신규 생성합니다:', err.message);
  }
  return {
    version: 1,
    updatedAt: null,
    description:
      '사이트별 마지막 크롤링 시점(lastCrawledAt), 게시판 글번호 범위(minPostId~maxPostId), 행사 일정 범위(minEventDate~maxEventDate) 관리 파일',
    sources: {},
  };
}

/**
 * 체크포인트 JSON 저장
 */
export function saveCrawlCheckpoints(checkpointState) {
  checkpointState.updatedAt = new Date().toISOString();
  fs.writeFileSync(
    CHECKPOINT_FILE_PATH,
    JSON.stringify(checkpointState, null, 2),
    'utf-8'
  );
}

/**
 * 특정 사이트(sourceKey)에 유효한 이전 크롤링 기록이 존재하는지 확인
 */
export function hasSourceCheckpoint(checkpointState, sourceKey) {
  if (isForceFullCrawl()) return false;
  const entry = checkpointState?.sources?.[sourceKey];
  if (!entry || !entry.lastCrawledAt) return false;
  return (
    (entry.maxPostId !== null && entry.maxPostId !== undefined) ||
    (Array.isArray(entry.latestPostIds) && entry.latestPostIds.length > 0) ||
    Boolean(entry.maxEventDate)
  );
}

/**
 * 게시글 번호(postId)가 이미 이전 크롤링에서 수집된 범위인지 판별
 * - 숫자형 ID(idx, wr_id, tourcd, no, r_idx, cid 등)가 이전 `maxPostId` 이하이거나
 *   `knownPostIds` 집합에 포함되어 있으면 true 반환
 */
export function isAlreadyCrawledPost(checkpointState, sourceKey, postId) {
  if (isForceFullCrawl()) return false;
  const entry = checkpointState?.sources?.[sourceKey];
  if (!entry) return false;

  const strId = String(postId ?? '').trim();
  if (!strId) return false;

  if (Array.isArray(entry.latestPostIds) && entry.latestPostIds.includes(strId)) {
    return true;
  }

  const numId = Number(strId.replace(/[^\d]/g, ''));
  if (
    Number.isFinite(numId) &&
    numId > 0 &&
    typeof entry.maxPostId === 'number' &&
    entry.maxPostId > 0
  ) {
    return numId <= entry.maxPostId;
  }

  return false;
}

/**
 * 크롤링 완료 후 특정 소스(sourceKey)의 체크포인트 메타데이터 갱신
 */
export function updateSourceCheckpoint(
  checkpointState,
  sourceKey,
  {
    name,
    boardUrl,
    postIds = [],
    eventDates = [],
    totalItems = 0,
    lastPostTitle = '',
  } = {}
) {
  if (!checkpointState.sources) {
    checkpointState.sources = {};
  }

  const prev = checkpointState.sources[sourceKey] || {};

  const numericIds = postIds
    .map((id) => Number(String(id).replace(/[^\d]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);

  const prevMaxId = typeof prev.maxPostId === 'number' ? prev.maxPostId : null;
  const prevMinId = typeof prev.minPostId === 'number' ? prev.minPostId : null;

  const maxPostId =
    numericIds.length > 0
      ? Math.max(...numericIds, ...(prevMaxId !== null ? [prevMaxId] : []))
      : prevMaxId;
  const minPostId =
    numericIds.length > 0
      ? Math.min(...numericIds, ...(prevMinId !== null ? [prevMinId] : []))
      : prevMinId;

  const validDates = eventDates
    .map((d) => String(d || '').trim())
    .filter((d) => /^\d{8}$/.test(d))
    .sort();

  const minEventDate =
    validDates.length > 0
      ? prev.minEventDate && prev.minEventDate < validDates[0]
        ? prev.minEventDate
        : validDates[0]
      : prev.minEventDate || null;

  const maxEventDate =
    validDates.length > 0
      ? prev.maxEventDate && prev.maxEventDate > validDates[validDates.length - 1]
        ? prev.maxEventDate
        : validDates[validDates.length - 1]
      : prev.maxEventDate || null;

  const mergedLatestIds = Array.from(
    new Set([
      ...postIds.map((id) => String(id).trim()).filter(Boolean),
      ...(Array.isArray(prev.latestPostIds) ? prev.latestPostIds : []),
    ])
  )
    .sort((a, b) => Number(b.replace(/[^\d]/g, '')) - Number(a.replace(/[^\d]/g, '')))
    .slice(0, 50);

  checkpointState.sources[sourceKey] = {
    sourceKey,
    name: name || prev.name || sourceKey,
    boardUrl: boardUrl || prev.boardUrl || '',
    lastCrawledAt: new Date().toISOString(),
    firstCrawledAt: prev.firstCrawledAt || new Date().toISOString(),
    minPostId,
    maxPostId,
    latestPostIds: mergedLatestIds,
    minEventDate,
    maxEventDate,
    totalItems: Math.max(totalItems, prev.totalItems || 0),
    lastPostTitle: lastPostTitle || prev.lastPostTitle || '',
  };
}

/**
 * 기존 `public/data/auto-crawled-events.json`에 수집된 데이터로부터
 * 각 사이트/게시판별 초기 체크포인트(`crawl-checkpoints.json`)를 역산·부트스트랩
 */
export function bootstrapCheckpointsFromExistingEvents() {
  if (!fs.existsSync(AUTO_CRAWLED_PATH)) {
    console.warn('[Checkpoint] auto-crawled-events.json 파일이 없습니다.');
    return null;
  }

  const autoJson = JSON.parse(fs.readFileSync(AUTO_CRAWLED_PATH, 'utf-8'));
  const events = Array.isArray(autoJson.events) ? autoJson.events : [];
  const state = loadCrawlCheckpoints();

  const sourceBuckets = {
    'swim-ksf': {
      name: '대한수영연맹 대회일정 게시판 (korswim.co.kr/11)',
      boardUrl: 'https://www.korswim.co.kr/11',
      match: (ev) => ev.id.startsWith('swim-ksf-'),
      extractPostId: (ev) => ev.id.replace(/^swim-ksf-/, ''),
    },
    'swim-busan': {
      name: '부산광역시수영연맹 공지사항 (busanswimming.kr)',
      boardUrl: 'http://www.busanswimming.kr/BoardList.asp?gubun=notice',
      match: (ev) => ev.id.startsWith('swim-busan-'),
      extractPostId: (ev) => {
        const m = ev.id.match(/(\d+)$/);
        return m ? m[1] : null;
      },
    },
    'swim-ulsan': {
      name: '울산광역시수영연맹 공지사항 (ulsanswimming.com)',
      boardUrl: 'http://www.ulsanswimming.com/board/notice',
      match: (ev) => ev.id.startsWith('swim-ulsan-'),
      extractPostId: (ev) => {
        const m = ev.id.match(/(\d+)$/);
        return m ? m[1] : null;
      },
    },
    'swim-seoul': {
      name: '서울특별시수영연맹 대회일정 (seoulswim.or.kr)',
      boardUrl: 'http://www.seoulswim.or.kr/bbs/board.php?bo_table=schedule',
      match: (ev) => ev.id.startsWith('swim-seoul-'),
      extractPostId: (ev) => {
        const m = ev.id.match(/(\d+)$/);
        return m ? m[1] : null;
      },
    },
    'swim-gyeonggi': {
      name: '경기도수영연맹 대회안내 (gswimming.com)',
      boardUrl: 'http://www.gswimming.com/34',
      match: (ev) => ev.id.startsWith('swim-gg-') || ev.id.startsWith('swim-gyeonggi-'),
      extractPostId: (ev) => {
        const m = ev.id.match(/(\d+)$/);
        return m ? m[1] : null;
      },
    },
    'swim-gangwon': {
      name: '강원특별자치도수영연맹 대회공지 (gwswim.or.kr)',
      boardUrl: 'https://www.gwswim.or.kr/bbs/board.php?bo_table=501',
      match: (ev) => ev.id.startsWith('swim-gw-') || ev.id.startsWith('swim-gangwon-'),
      extractPostId: (ev) => {
        const m = ev.id.match(/(\d+)$/);
        return m ? m[1] : null;
      },
    },
    'swim-sfinder': {
      name: '스파인더 수영 마스터즈/동호회 (sfinder.co.kr/swimming)',
      boardUrl: 'https://www.sfinder.co.kr/contest/contest_list/swimming',
      match: (ev) => ev.id.startsWith('swim-sfinder-'),
      extractPostId: (ev) => ev.id.replace(/^swim-sfinder-/, ''),
    },
    'run-roadrun': {
      name: '마라톤온라인 전국 대회일정 (roadrun.co.kr)',
      boardUrl: 'http://www.roadrun.co.kr/schedule/list.php',
      match: (ev) => ev.id.startsWith('run-roadrun-'),
      extractPostId: (ev) => ev.id.replace(/^run-roadrun-/, ''),
    },
    'run-sfinder': {
      name: '스파인더 러닝 대회일정 (sfinder.co.kr/running)',
      boardUrl: 'https://www.sfinder.co.kr/contest/contest_list/running',
      match: (ev) => ev.id.startsWith('run-sfinder-'),
      extractPostId: (ev) => ev.id.replace(/^run-sfinder-/, ''),
    },
    'cyc-thebike': {
      name: '더바이크 전국 자전거·그란폰도 대회 (thebike.co.kr)',
      boardUrl: 'https://www.thebike.co.kr/race/list.php',
      match: (ev) => ev.id.startsWith('cyc-thebike-'),
      extractPostId: (ev) => ev.id.replace(/^cyc-thebike-/, ''),
    },
    'cyc-sfinder': {
      name: '스파인더 바이크 대회일정 (sfinder.co.kr/bike)',
      boardUrl: 'https://www.sfinder.co.kr/contest/contest_list/bike',
      match: (ev) => ev.id.startsWith('cyc-sfinder-'),
      extractPostId: (ev) => ev.id.replace(/^cyc-sfinder-/, ''),
    },
    'tri-ktf': {
      name: '대한철인3종협회 대회일정 게시판 (triathlon.or.kr)',
      boardUrl: 'https://www.triathlon.or.kr/events/tour/',
      match: (ev) => ev.id.startsWith('tri-ktf-'),
      extractPostId: (ev) => ev.id.replace(/^tri-ktf-/, ''),
    },
    'tri-regional-search': {
      name: '시·도/시·군·구 철인3종협회 포털 오픈검색 디스커버리 (네이버 카페·블로그·폼)',
      boardUrl: 'https://search.naver.com/search.naver?where=nexearch&query=%EC%B2%A0%EC%9D%B83%EC%A2%85%ED%98%91%ED%9A%8C%EC%9E%A5%EB%B0%B0+%EC%95%84%EC%BF%A0%EC%95%84%EC%8A%AC%EB%A1%A0%EB%8C%80%ED%9A%8C',
      match: (ev) =>
        ev.id.startsWith('tri-') && !ev.id.startsWith('tri-ktf-'),
      extractPostId: (ev) => ev.id,
    },
    'korservice2-portal': {
      name: '한국관광공사 KorService2 공공데이터포털 축제·행사 API',
      boardUrl: 'https://apis.data.go.kr/B551011/KorService2/searchFestival2',
      match: (ev) => ev.id.startsWith('portal-') || /^\d{6,10}$/.test(ev.id),
      extractPostId: (ev) => ev.id.replace(/^portal-/, ''),
    },
    'municipal-267-portals': {
      name: '전국 267개 광역·기초지자체 문화관광·새소식·고시공고 홍보 사이트',
      boardUrl: 'public/geo/admin-promo-registry.json',
      match: (ev) =>
        ev.id.startsWith('muni-') ||
        ev.id.startsWith('archive-') ||
        ev.id.startsWith('seoul-'),
      extractPostId: (ev) => {
        const m = ev.id.match(/(\d{4,})$/);
        return m ? m[1] : ev.id;
      },
    },
  };

  for (const [key, cfg] of Object.entries(sourceBuckets)) {
    const matched = events.filter(cfg.match);
    if (matched.length === 0) continue;

    const postIds = [];
    const eventDates = [];
    for (const ev of matched) {
      const pid = cfg.extractPostId(ev);
      if (pid) postIds.push(pid);
      if (ev.eventDate?.startDate) eventDates.push(ev.eventDate.startDate);
      if (ev.eventDate?.endDate) eventDates.push(ev.eventDate.endDate);
    }

    // 가장 최근 게시글 제목 찾기
    const sortedByDate = [...matched].sort((a, b) =>
      (b.eventDate?.startDate || '').localeCompare(a.eventDate?.startDate || '')
    );

    updateSourceCheckpoint(state, key, {
      name: cfg.name,
      boardUrl: cfg.boardUrl,
      postIds,
      eventDates,
      totalItems: matched.length,
      lastPostTitle: sortedByDate[0]?.title || '',
    });
  }

  // 2) 스포츠 연맹·채널 마스터 레지스트리(sports-federation-registry.json) 내 모든 개별 사이트 수집기록 등록
  const nowIso = new Date().toISOString();
  state.sportsSites = state.sportsSites || {};
  if (fs.existsSync(SPORTS_REGISTRY_PATH)) {
    try {
      const sportsReg = JSON.parse(fs.readFileSync(SPORTS_REGISTRY_PATH, 'utf-8'));
      const sportGroups = sportsReg?.sports || {};
      for (const [sportCode, group] of Object.entries(sportGroups)) {
        const allChannels = [
          ...(group.worldAndNational || []),
          ...(group.provincialFederations || []),
          ...(group.municipalFederations || []),
          ...(group.individualPoolChannels || []),
        ];
        for (const ch of allChannels) {
          const siteKey = ch.id || `${sportCode}-${ch.name}`;
          const boardUrl = ch.scheduleUrl || ch.homepageUrl || '';
          let hostDomain = '';
          try {
            hostDomain = new URL(boardUrl).hostname.replace(/^www\./, '').toLowerCase();
          } catch {
            hostDomain = '';
          }

          const cityKeyword = String(ch.city || '')
            .split(/[·/\s(]+/)[0]
            .trim();

          const matchedEvents = events.filter((ev) => {
            if (
              hostDomain &&
              hostDomain !== 'triathlon.or.kr' &&
              hostDomain !== 'bikelife.cycling.or.kr' &&
              Array.isArray(ev.links) &&
              ev.links.some((l) => String(l.url || '').toLowerCase().includes(hostDomain))
            ) {
              return true;
            }
            const evText = `${ev.title || ''} ${ev.organizer?.host || ''} ${ev.addr1 || ''} ${ev.sigunguName || ''}`;
            const sportMatched =
              (sportCode === 'SWIMMING' && ev.id.startsWith('swim-')) ||
              (sportCode === 'RUNNING' && ev.id.startsWith('run-')) ||
              (sportCode === 'CYCLING' && ev.id.startsWith('cyc-')) ||
              (sportCode === 'TRIATHLON' && ev.id.startsWith('tri-'));
            if (!sportMatched) return false;
            if (ch.level === 3) return ev.promoLevel === 3;
            if (cityKeyword && cityKeyword.length >= 2 && cityKeyword !== '전국') {
              return evText.includes(cityKeyword);
            }
            return false;
          });

          const numericIds = matchedEvents
            .map((ev) => {
              const m = String(ev.id).match(/(\d+)$/);
              return m ? Number(m[1]) : NaN;
            })
            .filter((n) => Number.isFinite(n) && n > 0);

          const dates = matchedEvents
            .flatMap((ev) => [ev.eventDate?.startDate, ev.eventDate?.endDate])
            .filter((d) => /^\d{8}$/.test(String(d || '')))
            .sort();

          const latestEv = [...matchedEvents].sort((a, b) =>
            String(b.eventDate?.startDate || '').localeCompare(String(a.eventDate?.startDate || ''))
          )[0];

          state.sportsSites[siteKey] = {
            siteKey,
            sport: sportCode,
            level: ch.level,
            name: ch.name,
            city: ch.city || '전국',
            boardUrl,
            lastCrawledAt: state.sportsSites[siteKey]?.lastCrawledAt || autoJson.crawledAt || nowIso,
            minPostId: numericIds.length > 0 ? Math.min(...numericIds) : null,
            maxPostId: numericIds.length > 0 ? Math.max(...numericIds) : null,
            minEventDate: dates.length > 0 ? dates[0] : null,
            maxEventDate: dates.length > 0 ? dates[dates.length - 1] : null,
            totalItems: matchedEvents.length,
            lastPostTitle: latestEv?.title || '',
          };
        }
      }
    } catch (err) {
      console.warn('[Checkpoint] 스포츠 연맹 사이트 체크포인트 생성 경고:', err.message);
    }
  }

  // 3) 전국 267개 지자체(17개 광역시도 + 250개 시군구) 모든 홍보 사이트의 개별 수집기록 등록
  state.municipalSites = state.municipalSites || {};
  let auditScanMap = new Map();
  let auditTime = autoJson.lastCrawledAt || autoJson.crawledAt || nowIso;
  if (fs.existsSync(AUDIT_REPORT_PATH)) {
    try {
      const auditJson = JSON.parse(fs.readFileSync(AUDIT_REPORT_PATH, 'utf-8'));
      if (auditJson.auditedAt) auditTime = auditJson.auditedAt;
      if (Array.isArray(auditJson.municipalSiteScanRecords)) {
        for (const rec of auditJson.municipalSiteScanRecords) {
          auditScanMap.set(`${rec.tier}:${rec.key}`, rec);
        }
      }
    } catch {
      // ignore
    }
  }

  if (fs.existsSync(ADMIN_REGISTRY_PATH)) {
    try {
      const adminReg = JSON.parse(fs.readFileSync(ADMIN_REGISTRY_PATH, 'utf-8'));

      // (A) 17개 광역시·도
      for (const prov of Object.values(adminReg.provinces || {})) {
        const siteKey = `prov-${prov.lDongRegnCd}-${prov.regionId}`;
        const scanRec = auditScanMap.get(`TIER1_PROVINCE:${prov.regionId}`);
        const provEvents = events.filter(
          (ev) => String(ev.lDongRegnCd) === String(prov.lDongRegnCd)
        );
        const numericIds = provEvents
          .map((ev) => {
            const m = String(ev.id).match(/(\d+)$/);
            return m ? Number(m[1]) : NaN;
          })
          .filter((n) => Number.isFinite(n) && n > 0);
        const dates = provEvents
          .flatMap((ev) => [ev.eventDate?.startDate, ev.eventDate?.endDate])
          .filter((d) => /^\d{8}$/.test(String(d || '')))
          .sort();
        const latestEv = [...provEvents].sort((a, b) =>
          String(b.eventDate?.startDate || '').localeCompare(String(a.eventDate?.startDate || ''))
        )[0];

        state.municipalSites[siteKey] = {
          siteKey,
          tier: 'TIER1_PROVINCE',
          lDongRegnCd: prov.lDongRegnCd,
          lDongSignguCd: '000',
          name: prov.name,
          promoName: prov.promo1Name,
          boardUrl: scanRec?.usedUrl || prov.promo1Url,
          fallbackUrl: prov.promo2Url || prov.hallUrl || '',
          reachable: scanRec ? Boolean(scanRec.reachable) : true,
          httpStatus: scanRec?.statusCode || 200,
          lastCrawledAt: auditTime,
          minPostId: numericIds.length > 0 ? Math.min(...numericIds) : null,
          maxPostId: numericIds.length > 0 ? Math.max(...numericIds) : null,
          minEventDate: dates.length > 0 ? dates[0] : null,
          maxEventDate: dates.length > 0 ? dates[dates.length - 1] : null,
          directExtractedPosts: scanRec?.extractedPostCount ?? 0,
          totalItems: provEvents.length,
          lastPostTitle: latestEv?.title || '',
        };
      }

      // (B) 250개 시·군·구
      for (const [muniKey, muni] of Object.entries(adminReg.municipalities || {})) {
        const siteKey = `muni-${muniKey}`;
        const scanRec = auditScanMap.get(`TIER2_MUNICIPALITY:${muniKey}`);
        const muniEvents = events.filter(
          (ev) =>
            String(ev.lDongRegnCd) === String(muni.lDongRegnCd) &&
            String(ev.lDongSignguCd) === String(muni.lDongSignguCd)
        );
        const numericIds = muniEvents
          .map((ev) => {
            const m = String(ev.id).match(/(\d+)$/);
            return m ? Number(m[1]) : NaN;
          })
          .filter((n) => Number.isFinite(n) && n > 0);
        const dates = muniEvents
          .flatMap((ev) => [ev.eventDate?.startDate, ev.eventDate?.endDate])
          .filter((d) => /^\d{8}$/.test(String(d || '')))
          .sort();
        const latestEv = [...muniEvents].sort((a, b) =>
          String(b.eventDate?.startDate || '').localeCompare(String(a.eventDate?.startDate || ''))
        )[0];

        state.municipalSites[siteKey] = {
          siteKey,
          tier: 'TIER2_MUNICIPALITY',
          lDongRegnCd: muni.lDongRegnCd,
          lDongSignguCd: muni.lDongSignguCd,
          name: `${muni.regionName} ${muni.name}`,
          promoName: muni.promo1Name,
          boardUrl: scanRec?.usedUrl || muni.promo1Url,
          fallbackUrl: muni.hallUrl || muni.promo2Url || '',
          reachable: scanRec ? Boolean(scanRec.reachable) : true,
          httpStatus: scanRec?.statusCode || 200,
          lastCrawledAt: auditTime,
          minPostId: numericIds.length > 0 ? Math.min(...numericIds) : null,
          maxPostId: numericIds.length > 0 ? Math.max(...numericIds) : null,
          minEventDate: dates.length > 0 ? dates[0] : null,
          maxEventDate: dates.length > 0 ? dates[dates.length - 1] : null,
          directExtractedPosts: scanRec?.extractedPostCount ?? 0,
          totalItems: muniEvents.length,
          lastPostTitle: latestEv?.title || '',
        };
      }
    } catch (err) {
      console.warn('[Checkpoint] 267개 지자체 사이트 체크포인트 생성 경고:', err.message);
    }
  }

  state.summary = {
    coreBoardSourcesCount: Object.keys(state.sources || {}).length,
    sportsFederationSitesCount: Object.keys(state.sportsSites || {}).length,
    municipalSitesCount: Object.keys(state.municipalSites || {}).length,
    totalTrackedSitesCount:
      Object.keys(state.sources || {}).length +
      Object.keys(state.sportsSites || {}).length +
      Object.keys(state.municipalSites || {}).length,
    totalEventsIndexed: events.length,
  };

  saveCrawlCheckpoints(state);
  return state;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const state = bootstrapCheckpointsFromExistingEvents();
  console.log(
    `[Checkpoint] 전수조사 수집기록 저장 완료 -> 핵심 게시판 ${state?.summary?.coreBoardSourcesCount}곳 + 스포츠 연맹·채널 ${state?.summary?.sportsFederationSitesCount}곳 + 전국 지자체 ${state?.summary?.municipalSitesCount}곳 = 총 ${state?.summary?.totalTrackedSitesCount}개 크롤링 대상 (${CHECKPOINT_FILE_PATH})`
  );
}
