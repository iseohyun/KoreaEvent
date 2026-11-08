/**
 * 회차별·연도별 연속 행사/대회 자동 매칭 및 양방향 링크 엔진 (프런트엔드 + 크롤러 공용)
 *
 * 예시:
 * - "2024년 제17회 거제시장배 수영대회" (2024) <-> "2025년 제18회 거제 시장배 전국 마스터즈 수영대회" (2025) <-> "2026년 제19회 거제시장배 전국 마스터즈 수영대회" (2026)
 * - "[행사] 제32회 거제예술제" (2026) <-> "(공연/전시)제30회 거제예술제" (2024) <-> "제29회 거제예술제" (2023) <-> "제28회 거제예술제" (2022)
 * - "2026 거제 돗자리영화제(장화신은 고양이)" <-> "2025 거제 돗자리 영화제 - 스즈메의 문단속" <-> "(영화)2024 거제 돗자리 영화제"
 */

/**
 * 제목/설명에서 회차 번호(예: "제19회", "18회", "제 10+1 회")를 추출합니다.
 * @param {string} title
 * @returns {number | undefined}
 */
export function extractEditionNumber(title = '') {
  const s = String(title || '');

  // 특수 표기: "제10+1회" -> 11
  const plusMatch = s.match(/제?\s*(\d{1,3})\s*\+\s*(\d{1,2})\s*회/);
  if (plusMatch) {
    return Number(plusMatch[1]) + Number(plusMatch[2]);
  }

  // 일반 표기: "제19회", "제 18 회", "19회" (단, "1회차/2회차" 같은 당일 소회차는 본 대회 회차가 없을 때만 후순위)
  const mainMatch = s.match(/제\s*(\d{1,3})\s*회(?!\s*차)/);
  if (mainMatch) {
    return Number(mainMatch[1]);
  }

  const fallbackMatch = s.match(/(?:^|[\s([·])(\d{1,3})\s*회(?!\s*차)/);
  if (fallbackMatch) {
    const num = Number(fallbackMatch[1]);
    if (num >= 1 && num <= 200) return num;
  }

  return undefined;
}

/**
 * 행사 시작일(YYYYMMDD) 또는 제목에서 개최 연도(YYYY)를 추출합니다.
 * @param {string} title
 * @param {string} startDate
 * @returns {number | undefined}
 */
export function extractEventYear(title = '', startDate = '') {
  const titleMatch = String(title || '').match(/\b(20\d{2})\s*년?/);
  if (titleMatch) {
    return Number(titleMatch[1]);
  }

  const cleanStart = String(startDate || '').replace(/[^0-9]/g, '');
  if (cleanStart.length >= 4) {
    const y = Number(cleanStart.slice(0, 4));
    if (y >= 1990 && y <= 2035) return y;
  }

  return undefined;
}

/**
 * 대회/행사 제목에서 회차, 연도, 말머리([행사], (공연) 등), 부제, 공백을 제거하여
 * 연속 대회 매칭용 정규화 키(baseKey)와 사람이 읽기 좋은 대표 대회명(canonicalName)을 생성합니다.
 *
 * @param {string} rawTitle
 * @returns {{ baseKey: string, canonicalName: string }}
 */
export function normalizeSeriesTitle(rawTitle = '') {
  let s = String(rawTitle || '').trim();

  // HTML 엔티티 복원
  s = s
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  // 1) 선두 말머리 제거: [행사], (공연/전시), [아트포유], [거제시] 등 반복 제거
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s
      .replace(/^\s*\[[^\]]{1,16}\]\s*/g, '')
      .replace(/^\s*\([^)]{1,16}\)\s*/g, '')
      .replace(/^\s*<[^>]{1,16}>\s*/g, '')
      .trim();
  }

  // 2) 연도 표기 제거: "2026년", "2025", "'26"
  s = s
    .replace(/\b20\d{2}\s*년?\s*(도)?/g, ' ')
    .replace(/['’]\d{2}\s*년?/g, ' ');

  // 3) 회차 표기 제거: "제19회", "제 18 회", "제10+1회", "18회"
  s = s
    .replace(/제?\s*\d{1,3}\s*\+\s*\d{1,2}\s*회(차)?/g, ' ')
    .replace(/제\s*\d{1,3}\s*회(차)?/g, ' ')
    .replace(/(?:^|\s)\d{1,3}\s*회(차)?(?=\s|$)/g, ' ')
    .replace(/\b\d{1,3}\s*주년\s*(기념)?/g, ' ');

  // 4) 후행 부제/장소/소괄호 부연 설명 정리
  s = s
    .replace(/\s+-\s+[^-]+$/g, '')
    .replace(/\s*[《〈<\[]([^》〉>\]]+)[》〉>\]]\s*$/g, '')
    .replace(/\((?:\d+월|\d+회차|[^)]{3,})\)\s*$/g, '')
    .replace(/\s*(?:개최\s*안내|참가자\s*모집|홍보|알림|공고)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const canonicalName = s || String(rawTitle || '').trim();

  // 5) 비교용 정규화 키 (공백, 특수문자, 해마다 선택적으로 붙는 수식어 차이를 흡수)
  let baseKey = canonicalName
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^가-힣a-z0-9]/g, '');

  // '전국', '마스터즈', '어울림', '광역시/시' 축약 등 해마다 선택적으로 달라지는 수식어 정규화
  baseKey = baseKey
    .replace(/(서울|부산|대구|인천|광주|대전|울산)(?:특별시|광역시|시)/g, '$1')
    .replace(/교육감기/g, '교육감배')
    .replace(/(?:수영)?연맹회장배/g, '수영연맹회장배')
    .replace(
      /(시장배|군수배|구청장배|도지사배|체육회장배|수영연맹회장배|교육감배)(?:전국)?(?:마스터즈|어울림|동호인|생활체육)?/g,
      '$1'
    )
    .replace(/전국(?=.{2,}(대회|축제|페스티벌|선수권|마라톤|수영|가요제|경연))/g, '')
    .replace(/생활체육(?=.{0,6}수영대회)/g, '')
    .replace(/한마당축제$/g, '축제')
    .replace(/문화축제$/g, '축제');

  return {
    baseKey,
    canonicalName,
  };
}

/**
 * 두 정규화 키가 동일 시리즈인지 판별 (완전 일치 또는 높은 포함 관계)
 * @param {string} keyA
 * @param {string} keyB
 * @returns {boolean}
 */
function isSameSeriesKey(keyA, keyB) {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  if (keyA.length < 4 || keyB.length < 4) return false;

  const longer = keyA.length >= keyB.length ? keyA : keyB;
  const shorter = keyA.length >= keyB.length ? keyB : keyA;

  if (shorter.length >= 5 && longer.includes(shorter) && shorter.length / longer.length >= 0.72) {
    return true;
  }

  return false;
}

/**
 * 전체 FirestoreEventDoc 목록을 받아 시리즈(연속 대회/연례 행사)를 그룹화하고,
 * 각 문서에 seriesId, seriesName, edition, eventYear, prevEventId, nextEventId, seriesHistory를 주입합니다.
 *
 * @param {Array<any>} docs
 */
export function linkEventSeries(docs = []) {
  const enriched = docs.map((doc) => {
    const edition = doc.edition ?? extractEditionNumber(doc.title);
    const eventYear = doc.eventYear ?? extractEventYear(doc.title, doc.eventDate?.startDate);
    const { baseKey, canonicalName } = normalizeSeriesTitle(doc.title);
    return {
      ...doc,
      edition,
      eventYear,
      _baseKey: baseKey,
      _canonicalName: canonicalName,
    };
  });

  // 지역(시도 + 시군구) 단위로 1차 버킷팅 후 baseKey 유사도 클러스터링
  /** @type {Map<string, Array<any>>} */
  const regionBuckets = new Map();
  for (const item of enriched) {
    const regBucketKey = `${item.lDongRegnCd || '00'}-${item.lDongSignguCd || '000'}`;
    if (!regionBuckets.has(regBucketKey)) {
      regionBuckets.set(regBucketKey, []);
    }
    regionBuckets.get(regBucketKey).push(item);
  }

  /** @type {Record<string, any>} */
  const seriesMap = {};
  /** @type {Map<string, any>} */
  const docResultMap = new Map();

  for (const [regBucketKey, bucketItems] of regionBuckets.entries()) {
    /** @type {Array<{ key: string, canonicalName: string, items: Array<any> }>} */
    const clusters = [];

    for (const item of bucketItems) {
      if (!item._baseKey || item._baseKey.length < 3) {
        docResultMap.set(item.id, item);
        continue;
      }

      let matchedCluster = clusters.find((c) => isSameSeriesKey(c.key, item._baseKey));
      if (!matchedCluster) {
        matchedCluster = {
          key: item._baseKey,
          canonicalName: item._canonicalName,
          items: [],
        };
        clusters.push(matchedCluster);
      }
      matchedCluster.items.push(item);
    }

    for (const cluster of clusters) {
      const items = cluster.items;
      const hasExplicitEdition = items.some((it) => typeof it.edition === 'number');
      const distinctIds = new Set(items.map((it) => it.id));

      if (distinctIds.size < 2 && !hasExplicitEdition) {
        for (const it of items) {
          docResultMap.set(it.id, it);
        }
        continue;
      }

      // 연도 -> 회차 -> 시작일 순 정렬
      items.sort((a, b) => {
        const yA = a.eventYear || 0;
        const yB = b.eventYear || 0;
        if (yA !== yB) return yA - yB;
        const eA = a.edition || 0;
        const eB = b.edition || 0;
        if (eA !== eB) return eA - eB;
        return String(a.eventDate?.startDate || '').localeCompare(
          String(b.eventDate?.startDate || '')
        );
      });

      // 동일 연도 내 중복 항목 정리하여 깔끔한 역대 타임라인(historyList) 생성
      // (같은 연도에 회차가 명시된 항목이 있으면 회차 없는 중복 상시 안내 항목은 타임라인에서 병합)
      const yearsWithEdition = new Set(
        items.filter((it) => typeof it.edition === 'number' && it.eventYear).map((it) => it.eventYear)
      );

      const dedupedHistoryItems = [];
      const seenHistoryKeys = new Set();

      for (const it of items) {
        if (
          it.edition === undefined &&
          it.eventYear &&
          yearsWithEdition.has(it.eventYear) &&
          items.length > 1
        ) {
          continue;
        }
        const hKey = `${it.eventYear || ''}-${it.edition ?? ''}-${it.eventDate?.startDate?.slice(0, 6) || ''}`;
        if (seenHistoryKeys.has(hKey)) continue;
        seenHistoryKeys.add(hKey);
        dedupedHistoryItems.push(it);
      }

      const effectiveTimeline = dedupedHistoryItems.length > 0 ? dedupedHistoryItems : items;

      const seriesId = `series-${regBucketKey}-${cluster.key}`;
      const latestItem = effectiveTimeline[effectiveTimeline.length - 1];
      const seriesName = cluster.canonicalName || latestItem.title;

      const historyList = effectiveTimeline.map((it) => ({
        id: it.id,
        title: it.title,
        edition: it.edition,
        year: it.eventYear,
        startDate: it.eventDate?.startDate || '',
        endDate: it.eventDate?.endDate || '',
        primaryUrl: it.links?.[0]?.url,
      }));

      if (historyList.length >= 2 || hasExplicitEdition) {
        seriesMap[seriesId] = {
          seriesId,
          seriesName,
          lDongRegnCd: latestItem.lDongRegnCd,
          lDongSignguCd: latestItem.lDongSignguCd,
          sigunguName: latestItem.sigunguName,
          editions: historyList,
        };
      }

      for (const curr of items) {
        const idxInTimeline = effectiveTimeline.findIndex((t) => t.id === curr.id);
        let prev;
        let next;
        if (idxInTimeline !== -1) {
          prev = idxInTimeline > 0 ? effectiveTimeline[idxInTimeline - 1] : undefined;
          next =
            idxInTimeline < effectiveTimeline.length - 1
              ? effectiveTimeline[idxInTimeline + 1]
              : undefined;
        } else {
          // 타임라인에서 생략된 보조 문서도 가장 가까운 이전/다음 회차를 가리키도록 연결
          prev = effectiveTimeline.filter((t) => (t.eventYear || 0) < (curr.eventYear || 0)).pop();
          next = effectiveTimeline.find((t) => (t.eventYear || 0) > (curr.eventYear || 0));
        }

        docResultMap.set(curr.id, {
          ...curr,
          seriesId,
          seriesName,
          prevEventId: prev ? prev.id : undefined,
          nextEventId: next ? next.id : undefined,
          seriesHistory: historyList.length >= 2 ? historyList : undefined,
        });
      }
    }
  }

  const finalDocs = enriched.map((item) => {
    const resolved = docResultMap.get(item.id) || item;
    const { _baseKey, _canonicalName, ...cleanDoc } = resolved;
    return cleanDoc;
  });

  return {
    docs: finalDocs,
    seriesMap,
  };
}
