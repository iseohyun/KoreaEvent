/**
 * 특별 홍보관 > 수영 · 러닝 · 자전거 · 철인 (SpecialPromoView)
 * - 상단 메뉴바의 아이콘(목록보기 / 달력보기 / 지도보기)으로 뷰 모드를 전환
 * - 페이지 내부의 연도 필터 및 대회 목록 전환 탭은 제거하고 상단 통합 필터·메뉴바와 연동
 * - 범위 구분 ("세계/대한연맹" / "광역시도" / "시군구" / "동네"): lv 표기 없이 공식 범위 명칭만 사용
 * - 달력보기: 기존의 달력보기(EventCalendarView, 일 ~ 월) 컴포넌트로 표시
 * - 지도보기:
 *   - 2단계(전국 250개 시·군·구 + 17개 시·도 경계)까지 한 번에 그리고 지도는 상단에 고정
 *   - 하단에 주차별 보기 리스트를 배치하고 1열(주차), 2열(행사)로 표기
 *   - 기본 위치는 오늘이 포함된 주로 자동 스크롤 및 하이라이트
 *   - 키보드 위/아래(ArrowUp/ArrowDown)를 통해 이전/이후 주로 이동
 *   - 지자체 색상:
 *     - 선택 주(0주): 빨강 100%
 *     - 1주 후: 빨강 50%, 2주 후: 빨강 25%, 3주 후: 빨강 10%
 *     - 1주 전: 파랑 50%, 2주 전: 파랑 25%, 3주 전: 파랑 10%
 *     - 동일 지자체에 2개 이상의 표시할 대회가 존재할 때, 오늘(기준 주)과 가장 가까운 대회를 기준으로 지도에서 색상 표시
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  MapPin,
  Share2,
  Ticket,
} from 'lucide-react';
import {
  CalendarDisplayOptions,
  FirestorePromoLink,
  PromoLevel,
  SpecialPromoSport,
  ViewMode,
  UnifiedEventItem,
} from '../types/event';
import {
  ACTIVE_PROMO_LEVELS,
  getEventCityShortName,
  isAttachmentLink,
  isSpecificEventLink,
  matchesSportCategory,
  PROMO_LEVEL_SHORT_LABELS,
  SPORT_LABELS,
} from '../shared/promoPolicy';
import { EventCalendarView } from './EventCalendarView';
import { GeoCollection, GeoFeature } from './KoreaAdminMap';
import styles from './SpecialPromoView.module.css';
import { formatYmdRange } from '../shared/dateFormat';

interface SpecialPromoViewProps {
  sport: SpecialPromoSport;
  viewMode: ViewMode;
  events: UnifiedEventItem[];
  calendarOptions: CalendarDisplayOptions;
  targetYear?: number;
  onSelectEvent: (event: UnifiedEventItem) => void;
}

interface MapWeekRow {
  weekIdx: number;
  weekNo: number;
  year: number;
  startYmd: string;
  endYmd: string;
  midMs: number;
  label: string; // 예: "W45: 11/5 ~ 11"
  containsToday: boolean;
  events: UnifiedEventItem[];
}

interface MuniHighlightInfo {
  diff: number; // -3 ~ +3
  distanceDays: number;
  primaryEvent: UnifiedEventItem;
  allWindowEvents: Array<{ diff: number; event: UnifiedEventItem }>;
}

const SCOPE_CARD_CLASS: Record<PromoLevel, string> = {
  3: styles.cardScope3,
  2: styles.cardScope2,
  1: styles.cardScope1,
  0: styles.cardScope0,
};

const SCOPE_PILL_CLASS: Record<PromoLevel, string> = {
  3: styles.scopePill3,
  2: styles.scopePill2,
  1: styles.scopePill1,
  0: styles.scopePill0,
};

const SVG_WIDTH = 680;
const SVG_HEIGHT = 440;
const SVG_PAD = 16;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdToMs(ymd: string): number {
  if (!ymd || ymd.length < 8) return 0;
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6)) - 1;
  const d = Number(ymd.slice(6, 8));
  return new Date(y, m, d).getTime();
}

function renderLinkIcon(lnk: FirestorePromoLink) {
  if (lnk.type === 'ATTACHMENT' || isAttachmentLink(lnk.url, lnk.label)) {
    return <FileText size={16} />;
  }
  switch (lnk.type) {
    case 'OFFICIAL':
      return <Globe size={16} />;
    case 'TIER1_PROMO':
      return <Globe size={16} />;
    case 'TIER2_PROMO':
      return <Building2 size={16} />;
    case 'TICKET':
      return <Ticket size={16} />;
    case 'SNS':
      return <Share2 size={16} />;
    default:
      return <ExternalLink size={16} />;
  }
}

/**
 * 주차별 보기 리스트 생성 (1열: 주차, 2열: 행사)
 */
function buildMapWeekRows(
  year: number,
  sportEvents: UnifiedEventItem[],
  todayYmd: string
): MapWeekRow[] {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const days: Array<{ ymd: string; month: number; day: number; ms: number }> = [];
  const cur = new Date(startOfYear);

  while (cur <= endOfYear) {
    const m = cur.getMonth() + 1;
    const d = cur.getDate();
    const ymd = `${year}${pad2(m)}${pad2(d)}`;
    days.push({
      ymd,
      month: m,
      day: d,
      ms: cur.getTime(),
    });
    cur.setDate(cur.getDate() + 1);
  }

  const rows: MapWeekRow[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    const weekIdx = Math.floor(i / 7);
    const weekNo = weekIdx + 1;
    const first = slice[0];
    const last = slice[slice.length - 1];

    const rangeLabel =
      first.month === last.month
        ? `${first.month}/${first.day} ~ ${last.day}`
        : `${first.month}/${first.day} ~ ${last.month}/${last.day}`;

    const startYmd = first.ymd;
    const endYmd = last.ymd;
    const midMs = Math.round((first.ms + last.ms) / 2);
    const containsToday = todayYmd >= startYmd && todayYmd <= endYmd;

    const matchingEvents = sportEvents
      .filter((ev) => {
        if (ev.dateUnknown) return false;
        const s = (ev.startDate || '').slice(0, 8);
        const e = (ev.endDate || s).slice(0, 8);
        if (!s || s.length < 8) return false;
        return s <= endYmd && e >= startYmd;
      })
      .sort((a, b) => {
        if (a.startDate !== b.startDate) {
          return (a.startDate || '').localeCompare(b.startDate || '');
        }
        return b.promoLevel - a.promoLevel;
      });

    rows.push({
      weekIdx,
      weekNo,
      year,
      startYmd,
      endYmd,
      midMs,
      label: `W${weekNo}: ${rangeLabel}`,
      containsToday,
      events: matchingEvents,
    });
  }

  return rows;
}

/**
 * 2단계 시·군·구 GeoFeature와 행사 간 지자체 코드 매칭
 */
function doesFeatureMatchEvent(feat: GeoFeature, ev: UnifiedEventItem): boolean {
  const evReg = String(ev.lDongRegnCd || '').trim();
  const evSig = String(ev.lDongSignguCd || '').trim();

  if (ev.regionId === 'sejong' || evReg === '36110' || evReg === '36') {
    return feat.properties.regionId === 'sejong';
  }

  if (feat.properties.lDongRegnCd !== evReg) {
    return false;
  }

  if (!evSig || evSig === 'ALL' || evSig === '000') {
    return false;
  }

  return (
    feat.properties.lDongSignguCd === evSig ||
    feat.properties.parentSignguCd === evSig
  );
}

/**
 * 주차 차이(diff: -3 ~ +3)에 따른 지도 지자체 폴리곤 색상 반환
 * - 0주(선택 주): 빨간색 100%
 * - 1주 후(+1): 빨강 50%, 2주 후(+2): 빨강 25%, 3주 후(+3): 빨강 10%
 * - 1주 전(-1): 파랑 50%, 2주 전(-2): 파랑 25%, 3주 전(-3): 파랑 10%
 */
function getDiffFillColor(diff: number): string {
  switch (diff) {
    case 0:
      return 'rgba(220, 38, 38, 1)'; // 당주: 빨간색 100%
    case 1:
      return 'rgba(239, 68, 68, 0.50)'; // 1주후: 빨강 50%
    case 2:
      return 'rgba(239, 68, 68, 0.25)'; // 2주후: 빨강 25%
    case 3:
      return 'rgba(239, 68, 68, 0.10)'; // 3주후: 빨강 10%
    case -1:
      return 'rgba(37, 99, 235, 0.50)'; // 1주전: 파랑 50%
    case -2:
      return 'rgba(37, 99, 235, 0.25)'; // 2주전: 파랑 25%
    case -3:
      return 'rgba(37, 99, 235, 0.10)'; // 3주전: 파랑 10%
    default:
      return '#f8fafc';
  }
}

function getDiffBadgeText(diff: number): string {
  if (diff === 0) return '이번 주 (빨강 100%)';
  if (diff > 0) return `${diff}주 후 (빨강 ${diff === 1 ? 50 : diff === 2 ? 25 : 10}%)`;
  const abs = Math.abs(diff);
  return `${abs}주 전 (파랑 ${abs === 1 ? 50 : abs === 2 ? 25 : 10}%)`;
}

export const SpecialPromoView: React.FC<SpecialPromoViewProps> = ({
  sport,
  viewMode,
  events,
  calendarOptions,
  targetYear,
  onSelectEvent,
}) => {
  const sportLabel = SPORT_LABELS[sport] || '수영';

  // 각 범위("세계/대한연맹"=3, "광역시도"=2, "시군구"=1, "동네"=0) 펼치기/접기 상태
  const [expandedScopes, setExpandedScopes] = useState<Record<PromoLevel, boolean>>({
    3: true,
    2: true,
    1: true,
    0: true,
  });

  // 지도보기용 전국 1단계(17개 시도) + 2단계(250개 시군구) GeoJSON
  const [provincesGeo, setProvincesGeo] = useState<GeoCollection | null>(null);
  const [municipalitiesGeo, setMunicipalitiesGeo] = useState<GeoCollection | null>(
    null
  );
  const [hoveredFeature, setHoveredFeature] = useState<GeoFeature | null>(null);

  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    Promise.all([
      fetch(`${baseUrl}geo/skorea-provinces-geo.json`).then((r) => r.json()),
      fetch(`${baseUrl}geo/skorea-municipalities-geo.json`).then((r) => r.json()),
    ])
      .then(([provData, muniData]) => {
        setProvincesGeo(provData);
        setMunicipalitiesGeo(muniData);
      })
      .catch((err) => {
        console.error('Failed to load administrative GeoJSON:', err);
      });
  }, []);

  const toggleScopeExpand = (level: PromoLevel) => {
    setExpandedScopes((prev) => ({
      ...prev,
      [level]: !prev[level],
    }));
  };

  // 현재 선택된 스포츠 종목 행사 필터링 (상단 필터의 지역·날짜·범위·상태·세부검색이 이미 반영된 events 기준)
  const sportEvents = useMemo(() => {
    return events.filter((ev) =>
      matchesSportCategory(
        `${ev.title} ${ev.invitation || ''} ${ev.summary || ''} ${ev.organizer || ''}`,
        sport
      )
    );
  }, [events, sport]);

  // 1. 목록보기용 범위별 그룹 ("세계/대한연맹" -> "광역시도" -> "시군구" -> "동네")
  const scopeGroups = useMemo(() => {
    return ACTIVE_PROMO_LEVELS.map((level) => ({
      level,
      scopeName: PROMO_LEVEL_SHORT_LABELS[level],
      items: sportEvents
        .filter((ev) => ev.promoLevel === level)
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
    })).filter((group) => group.items.length > 0);
  }, [sportEvents]);

  // 오늘 날짜 (YYYYMMDD) 및 기준 연도
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayYmd = `${todayYear}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const todayMs = new Date(todayYear, now.getMonth(), now.getDate()).getTime();
  const activeCalendarYear = targetYear || todayYear;

  // 3. 지도보기용 주차별 리스트 (1열: 주차, 2열: 행사)
  const mapWeekRows = useMemo(() => {
    return buildMapWeekRows(activeCalendarYear, sportEvents, todayYmd);
  }, [activeCalendarYear, sportEvents, todayYmd]);

  // 오늘이 포함된 주 인덱스 (기본 위치)
  const todayWeekIdx = useMemo(() => {
    const found = mapWeekRows.findIndex((r) => r.containsToday);
    if (found >= 0) return found;
    // 다른 연도를 조회 중인 경우 오늘 월/일에 해당하는 주차로 매칭
    const sameDateYmd = `${activeCalendarYear}${todayYmd.slice(4, 8)}`;
    const fallback = mapWeekRows.findIndex(
      (r) => sameDateYmd >= r.startYmd && sameDateYmd <= r.endYmd
    );
    return fallback >= 0 ? fallback : 0;
  }, [mapWeekRows, todayYmd, activeCalendarYear]);

  const [activeWeekIdx, setActiveWeekIdx] = useState<number>(todayWeekIdx);
  const weekRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  // 지도보기 진입 또는 기준 연도 변경 시 오늘이 포함된 주로 자동 선택
  useEffect(() => {
    setActiveWeekIdx(todayWeekIdx);
  }, [todayWeekIdx, sport]);

  // 선택된 주(activeWeekIdx)로 하단 주차별 리스트 자동 스크롤
  useEffect(() => {
    if (viewMode !== 'MAP') return;
    const timer = setTimeout(() => {
      const rowEl = weekRowRefs.current[activeWeekIdx];
      if (rowEl) {
        rowEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [viewMode, activeWeekIdx]);

  // 7-2: 키보드 위/아래(ArrowUp / ArrowDown)를 통해 이전/이후 주로 이동
  useEffect(() => {
    if (viewMode !== 'MAP') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveWeekIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveWeekIdx((prev) => Math.min(mapWeekRows.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, mapWeekRows.length]);

  // 2단계 전국 시·군·구(250개) + 1단계 시·도(17개) 통합 SVG 투영 계산
  const mapProjection = useMemo(() => {
    const muniFeatures = municipalitiesGeo?.features || [];
    if (muniFeatures.length === 0) return null;

    let minLng = 999;
    let minLat = 999;
    let maxLng = -999;
    let maxLat = -999;

    muniFeatures.forEach((f) => {
      const [bx0, by0, bx1, by1] = f.properties.bbox;
      if (bx0 < minLng) minLng = bx0;
      if (by0 < minLat) minLat = by0;
      if (bx1 > maxLng) maxLng = bx1;
      if (by1 > maxLat) maxLat = by1;
    });

    const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
    const cosFactor = Math.cos(midLatRad);

    const geoWidth = Math.max((maxLng - minLng) * cosFactor, 0.02);
    const geoHeight = Math.max(maxLat - minLat, 0.02);

    const drawW = SVG_WIDTH - SVG_PAD * 2;
    const drawH = SVG_HEIGHT - SVG_PAD * 2;

    const scale = Math.min(drawW / geoWidth, drawH / geoHeight);
    const offsetX = SVG_PAD + (drawW - geoWidth * scale) / 2;
    const offsetY = SVG_PAD + (drawH - geoHeight * scale) / 2;

    const projectPoint = (lng: number, lat: number): [number, number] => {
      const x = offsetX + (lng - minLng) * cosFactor * scale;
      const y = offsetY + (maxLat - lat) * scale;
      return [x, y];
    };

    const ringToSvgPath = (ring: [number, number][]): string => {
      if (!ring || ring.length === 0) return '';
      return (
        ring
          .map((pt, idx) => {
            const [x, y] = projectPoint(pt[0], pt[1]);
            return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ') + ' Z'
      );
    };

    const geometryToSvgPath = (geom: GeoFeature['geometry']): string => {
      if (geom.type === 'Polygon') {
        return geom.coordinates
          .map((ring: [number, number][]) => ringToSvgPath(ring))
          .join(' ');
      }
      if (geom.type === 'MultiPolygon') {
        return geom.coordinates
          .map((poly: [number, number][][]) =>
            poly.map((ring) => ringToSvgPath(ring)).join(' ')
          )
          .join(' ');
      }
      return '';
    };

    return {
      projectPoint,
      geometryToSvgPath,
    };
  }, [municipalitiesGeo]);

  // 7-3: 현재 선택 주(activeWeekIdx) 기준 [-3주 ~ +3주] 내 각 2단계 시·군·구별 하이라이트 색상 계산
  // (만약 한 지자체에 2개 이상의 표시할 대회가 존재할 때, 오늘/기준 주와 가장 가까운 대회를 기준으로 표시)
  const muniHighlightByKostatCode = useMemo(() => {
    const result = new Map<string, MuniHighlightInfo>();
    const muniFeatures = municipalitiesGeo?.features || [];
    if (muniFeatures.length === 0 || mapWeekRows.length === 0) {
      return result;
    }

    const activeRow = mapWeekRows[activeWeekIdx];
    const refMs = activeRow?.containsToday ? todayMs : activeRow?.midMs || todayMs;

    // [-3주 ~ +3주] 윈도우에 속한 주차들의 이벤트 수집
    const windowEntries: Array<{
      diff: number;
      absDiff: number;
      distanceDays: number;
      event: UnifiedEventItem;
    }> = [];

    for (let diff = -3; diff <= 3; diff += 1) {
      const targetIdx = activeWeekIdx + diff;
      if (targetIdx < 0 || targetIdx >= mapWeekRows.length) continue;
      const weekRow = mapWeekRows[targetIdx];
      weekRow.events.forEach((ev) => {
        const evStartMs = ymdToMs(ev.startDate);
        const evEndMs = ymdToMs(ev.endDate || ev.startDate);
        const distMs =
          refMs >= evStartMs && refMs <= evEndMs
            ? 0
            : Math.min(Math.abs(evStartMs - refMs), Math.abs(evEndMs - refMs));
        const distanceDays = Math.round(distMs / (1000 * 60 * 60 * 24));

        windowEntries.push({
          diff,
          absDiff: Math.abs(diff),
          distanceDays,
          event: ev,
        });
      });
    }

    if (windowEntries.length === 0) {
      return result;
    }

    muniFeatures.forEach((feat) => {
      const matched = windowEntries.filter((entry) =>
        doesFeatureMatchEvent(feat, entry.event)
      );
      if (matched.length === 0) return;

      // 2개 이상의 표시할 대회가 존재할 때 오늘(기준 주)과 가장 가까운 대회를 최우선 선택
      matched.sort((a, b) => {
        if (a.absDiff !== b.absDiff) return a.absDiff - b.absDiff;
        if (a.distanceDays !== b.distanceDays) return a.distanceDays - b.distanceDays;
        // 동일 거리일 경우 앞으로 다가오는 대회(양수 diff) 우선
        if (a.diff !== b.diff) return b.diff - a.diff;
        return b.event.promoLevel - a.event.promoLevel;
      });

      const best = matched[0];
      result.set(feat.properties.kostatCode, {
        diff: best.diff,
        distanceDays: best.distanceDays,
        primaryEvent: best.event,
        allWindowEvents: matched.map((m) => ({ diff: m.diff, event: m.event })),
      });
    });

    return result;
  }, [municipalitiesGeo, mapWeekRows, activeWeekIdx, todayMs]);

  // 지도 라벨: 같은 시(예: 창원시 5개 구, 수원시 4개 구)는 라벨을 하나만 표시 (가장 가까운 주의 구를 대표로)
  const mapLabelEntries = useMemo(() => {
    const byGroup = new Map<string, { feat: GeoFeature; info: MuniHighlightInfo }>();
    (municipalitiesGeo?.features || []).forEach((feat) => {
      const info = muniHighlightByKostatCode.get(feat.properties.kostatCode);
      if (!info) return;
      const groupKey = `${feat.properties.lDongRegnCd}-${
        feat.properties.parentSignguCd || feat.properties.lDongSignguCd
      }`;
      const prev = byGroup.get(groupKey);
      if (!prev || Math.abs(info.diff) < Math.abs(prev.info.diff)) {
        byGroup.set(groupKey, { feat, info });
      }
    });
    return Array.from(byGroup.values());
  }, [municipalitiesGeo, muniHighlightByKostatCode]);

  const activeWeekRow = mapWeekRows[activeWeekIdx] || null;

  return (
    <div
      className={
        viewMode === 'MAP'
          ? styles.mapModeViewport
          : viewMode === 'CALENDAR'
            ? styles.calendarModeViewport
            : styles.page
      }
    >
      {/* 1. 목록보기 ("세계/대한연맹", "광역시도", "시군구", "동네" 클릭 시 펼치기/접기 애니메이션) */}
      {viewMode === 'LIST' && (
        <>
          {scopeGroups.length === 0 ? (
            <div className={styles.emptyState}>
              현재 선택한 필터 조건에 해당하는 {sportLabel} 대회가 없습니다. (상단 필터에서 범위·연도·월 선택을 확인해 보세요)
            </div>
          ) : (
            scopeGroups.map((group, groupIdx) => {
              const isExpanded = expandedScopes[group.level];
              return (
                <React.Fragment key={group.level}>
                  {groupIdx > 0 && <hr className={styles.levelDivider} />}

                  <section
                    className={styles.levelGroup}
                    aria-label={group.scopeName}
                  >
                    {/* 범위 분류 헤더 버튼: 클릭 시 펼치기/접기 애니메이션 */}
                    <button
                      type="button"
                      className={styles.levelGroupHeaderBtn}
                      onClick={() => toggleScopeExpand(group.level)}
                      aria-expanded={isExpanded}
                    >
                      <div className={styles.levelHeaderLeft}>
                        <span className={SCOPE_PILL_CLASS[group.level]}>
                          {group.scopeName}
                        </span>
                        <span className={styles.levelCountText}>
                          {group.items.length}건
                        </span>
                      </div>

                      <div className={styles.levelHeaderRight}>
                        <span className={styles.collapseToggleHint}>
                          {isExpanded ? '접기' : '펼치기'}
                        </span>
                        {isExpanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </div>
                    </button>

                    {/* 부드러운 펼치기/접기 애니메이션 래퍼 */}
                    <div
                      className={`${styles.levelCollapseWrapper} ${
                        isExpanded ? styles.levelCollapseWrapperOpen : ''
                      }`}
                    >
                      <div className={styles.levelCollapseInner}>
                        <div className={styles.levelCardList}>
                          {group.items.map((ev) => {
                            const specificLinks = (ev.links || []).filter((lnk) =>
                              isSpecificEventLink(lnk.url, lnk.label)
                            );

                            return (
                              <article
                                key={ev.id}
                                className={`${styles.card} ${SCOPE_CARD_CLASS[ev.promoLevel]}`}
                                onClick={() => onSelectEvent(ev)}
                              >
                                {/* 1행: 범위 배지 + 제목 <---> 주최 */}
                                <div className={styles.rowBetween}>
                                  <div className={styles.titleRow}>
                                    <span className={SCOPE_PILL_CLASS[ev.promoLevel]}>
                                      {PROMO_LEVEL_SHORT_LABELS[ev.promoLevel]}
                                    </span>
                                    <h3 className={styles.title}>{ev.title}</h3>
                                    {ev.seriesHistory &&
                                      ev.seriesHistory.length >= 2 && (
                                        <span className={styles.seriesBadge}>
                                          🔄 역대 {ev.seriesHistory.length}회차
                                        </span>
                                      )}
                                  </div>
                                  {ev.organizer && (
                                    <span className={styles.organizer}>
                                      {ev.organizer}
                                    </span>
                                  )}
                                </div>

                                {/* 2행: 간단소개 */}
                                {(ev.invitation || ev.summary) && (
                                  <p className={styles.intro}>
                                    {ev.invitation || ev.summary}
                                  </p>
                                )}

                                {/* 3행: 위치/날짜 <---> 구체적 이벤트 공지·홍보 링크 & 붉은색 모집공고(PDF/HWP) 아이콘 */}
                                <div className={styles.rowBetween}>
                                  <div className={styles.metaGroup}>
                                    <span className={styles.metaItem}>
                                      <MapPin size={13} />
                                      <span>
                                        <strong>
                                          [{getEventCityShortName(ev)}]
                                        </strong>{' '}
                                        {ev.addr1 ||
                                          `${ev.regionName} ${ev.sigunguName}`}
                                      </span>
                                    </span>
                                    <span className={styles.metaItem}>
                                      <Calendar size={13} />
                                      <span>
                                        {formatYmdRange(ev.startDate, ev.endDate)}
                                      </span>
                                    </span>
                                  </div>

                                  {specificLinks.length > 0 && (
                                    <div
                                      className={styles.linkIcons}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {specificLinks.map((lnk, idx) => {
                                        const isRedAttachment =
                                          lnk.type === 'ATTACHMENT' ||
                                          isAttachmentLink(lnk.url, lnk.label);

                                        return (
                                          <a
                                            key={`${lnk.url}-${idx}`}
                                            href={lnk.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`${styles.linkIconBtn} ${
                                              isRedAttachment
                                                ? styles.linkIconBtnRed
                                                : ''
                                            }`}
                                            title={lnk.label}
                                            aria-label={lnk.label}
                                          >
                                            {renderLinkIcon(lnk)}
                                          </a>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </section>
                </React.Fragment>
              );
            })
          )}
        </>
      )}

      {/* 2. 달력보기: 기존의 달력보기(일 ~ 월, EventCalendarView) 그대로 표시 */}
      {viewMode === 'CALENDAR' && (
        <EventCalendarView
          events={sportEvents}
          displayOptions={calendarOptions}
          targetYear={activeCalendarYear}
          onSelectEvent={onSelectEvent}
        />
      )}

      {/* 3. 지도보기: 상단 고정 2단계 전국 행정지도 + 하단 주차별 보기 리스트 (1열: 주차, 2열: 행사) */}
      {viewMode === 'MAP' && (
        <div className={styles.specialMapLayout}>
          {/* 상단 고정: 전국 2단계 시·군·구(250개) + 1단계 시·도(17개) 행정지도 */}
          <section className={styles.mapTopFixedPane} aria-label="전국 2단계 행정지도">
            <div className={styles.mapTopBarInfo}>
              <div className={styles.activeWeekBanner}>
                <span className={styles.activeWeekPill}>
                  {activeWeekRow ? activeWeekRow.label : ''}
                </span>
                {activeWeekRow?.containsToday && (
                  <span className={styles.todayWeekTag}>오늘 포함 주</span>
                )}
                <span className={styles.keyGuideText}>
                  ⌨️ 키보드 <strong>↑ / ↓ 방향키</strong>(또는 아래 행 클릭)로 주차를 이동합니다
                </span>
              </div>

              <div className={styles.colorScaleLegend}>
                <span className={styles.scaleChip} style={{ background: 'rgba(37, 99, 235, 0.10)', color: '#1e3a8a' }}>
                  3주전(파랑 10%)
                </span>
                <span className={styles.scaleChip} style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#1e3a8a' }}>
                  2주전(파랑 25%)
                </span>
                <span className={styles.scaleChip} style={{ background: 'rgba(37, 99, 235, 0.50)', color: '#ffffff' }}>
                  1주전(파랑 50%)
                </span>
                <span className={styles.scaleChip} style={{ background: 'rgba(220, 38, 38, 1)', color: '#ffffff', fontWeight: 900 }}>
                  선택주(빨강 100%)
                </span>
                <span className={styles.scaleChip} style={{ background: 'rgba(239, 68, 68, 0.50)', color: '#ffffff' }}>
                  1주후(빨강 50%)
                </span>
                <span className={styles.scaleChip} style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#7f1d1d' }}>
                  2주후(빨강 25%)
                </span>
                <span className={styles.scaleChip} style={{ background: 'rgba(239, 68, 68, 0.10)', color: '#7f1d1d' }}>
                  3주후(빨강 10%)
                </span>
              </div>
            </div>

            <div className={styles.mapCanvasWrap}>
              {hoveredFeature && (
                <div className={styles.mapHoverTooltip}>
                  <strong>
                    {hoveredFeature.properties.regionName}{' '}
                    {hoveredFeature.properties.name}
                  </strong>
                  {(() => {
                    const info = muniHighlightByKostatCode.get(
                      hoveredFeature.properties.kostatCode
                    );
                    if (!info) {
                      return <span>전후 3주 내 {sportLabel} 대회 없음</span>;
                    }
                    return (
                      <>
                        <span className={styles.tooltipDiffTag}>
                          기준 표시: {getDiffBadgeText(info.diff)}
                        </span>
                        <span>대표 대회: {info.primaryEvent.title}</span>
                      </>
                    );
                  })()}
                </div>
              )}

              {mapProjection && municipalitiesGeo ? (
                <svg
                  viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                  className={styles.twoLevelSvgMap}
                  role="img"
                  aria-label="전국 2단계 시군구 행정지도"
                >
                  {/* 2단계 전국 250개 시·군·구 폴리곤 한번에 렌더링 */}
                  <g>
                    {municipalitiesGeo.features.map((feat) => {
                      const info = muniHighlightByKostatCode.get(
                        feat.properties.kostatCode
                      );
                      const fill = info ? getDiffFillColor(info.diff) : '#f8fafc';
                      const isCurrentWeekRed = info?.diff === 0;
                      const d = mapProjection.geometryToSvgPath(feat.geometry);

                      return (
                        <path
                          key={feat.properties.kostatCode}
                          d={d}
                          fill={fill}
                          stroke={isCurrentWeekRed ? '#991b1b' : '#cbd5e1'}
                          strokeWidth={isCurrentWeekRed ? 1.3 : 0.45}
                          className={styles.muniPolygon}
                          onMouseEnter={() => setHoveredFeature(feat)}
                          onMouseLeave={() => setHoveredFeature(null)}
                          onClick={() => {
                            if (info?.primaryEvent) {
                              onSelectEvent(info.primaryEvent);
                            }
                          }}
                        />
                      );
                    })}
                  </g>

                  {/* 1단계 17개 시·도 광역 경계선 오버레이 */}
                  {provincesGeo && (
                    <g pointerEvents="none">
                      {provincesGeo.features.map((prov) => (
                        <path
                          key={`prov-${prov.properties.kostatCode}`}
                          d={mapProjection.geometryToSvgPath(prov.geometry)}
                          fill="none"
                          stroke="#475569"
                          strokeWidth={1.1}
                          strokeOpacity={0.75}
                        />
                      ))}
                    </g>
                  )}

                  {/* 전후 3주 내 대회가 있는 지자체 라벨 표시 (선택 주 지자체는 굵은 빨강 강조) */}
                  <g pointerEvents="none">
                    {mapLabelEntries.map(({ feat, info }) => {
                      const [cx, cy] = mapProjection.projectPoint(
                        feat.properties.center[0],
                        feat.properties.center[1]
                      );
                      const shortCity = getEventCityShortName(info.primaryEvent);

                      return (
                        <text
                          key={`lbl-${feat.properties.kostatCode}`}
                          x={cx}
                          y={cy}
                          className={
                            info.diff === 0
                              ? styles.mapLabelCurrentWeek
                              : styles.mapLabelWindowWeek
                          }
                        >
                          {shortCity}
                        </text>
                      );
                    })}
                  </g>
                </svg>
              ) : (
                <div className={styles.mapLoadingText}>
                  전국 2단계(시·군·구) 행정지도를 불러오는 중입니다...
                </div>
              )}
            </div>
          </section>

          {/* 하단 스크롤: 주차별 보기 리스트 (1열: 주차, 2열: 행사) */}
          <section
            className={styles.weeklyBottomScrollPane}
            aria-label="주차별 대회 리스트"
          >
            <table className={styles.weeklyListTable}>
              <thead>
                <tr>
                  <th className={styles.colWeekTh}>주차</th>
                  <th className={styles.colEventsTh}>행사</th>
                </tr>
              </thead>
              <tbody>
                {mapWeekRows.map((row) => {
                  const diff = row.weekIdx - activeWeekIdx;
                  const isSelected = diff === 0;
                  const isWithin3Weeks = Math.abs(diff) <= 3 && diff !== 0;

                  return (
                    <tr
                      key={row.weekNo}
                      ref={(el) => {
                        weekRowRefs.current[row.weekIdx] = el;
                      }}
                      className={`${styles.weeklyTr} ${
                        isSelected
                          ? styles.weeklyTrSelected
                          : isWithin3Weeks
                            ? styles.weeklyTrNear
                            : ''
                      }`}
                      onClick={() => setActiveWeekIdx(row.weekIdx)}
                    >
                      {/* 1열: 주차 */}
                      <td className={styles.colWeekTd}>
                        <div className={styles.weekCellInner}>
                          <span className={styles.weekLabelText}>{row.label}</span>
                          <div className={styles.weekSubBadges}>
                            {row.containsToday && (
                              <span className={styles.todayRowBadge}>오늘</span>
                            )}
                            {isSelected && (
                              <span className={styles.selectedRowBadge}>
                                선택 (빨강 100%)
                              </span>
                            )}
                            {!isSelected && Math.abs(diff) <= 3 && (
                              <span
                                className={
                                  diff > 0
                                    ? styles.diffFutureBadge
                                    : styles.diffPastBadge
                                }
                              >
                                {diff > 0 ? `+${diff}주` : `${diff}주`}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2열: 행사 */}
                      <td className={styles.colEventsTd}>
                        {row.events.length === 0 ? (
                          <span className={styles.noWeekEventText}>-</span>
                        ) : (
                          <div className={styles.weekEventsList}>
                            {row.events.map((ev) => {
                              const cityShort = getEventCityShortName(ev);
                              const scopeText =
                                PROMO_LEVEL_SHORT_LABELS[ev.promoLevel];
                              return (
                                <button
                                  key={`${row.weekNo}-${ev.id}`}
                                  type="button"
                                  className={`${styles.weekEventChip} ${
                                    isSelected ? styles.weekEventChipSelected : ''
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveWeekIdx(row.weekIdx);
                                    onSelectEvent(ev);
                                  }}
                                >
                                  <span className={SCOPE_PILL_CLASS[ev.promoLevel]}>
                                    {scopeText}
                                  </span>
                                  <strong className={styles.weekEventCity}>
                                    [{cityShort}]
                                  </strong>
                                  <span className={styles.weekEventTitle}>
                                    {ev.title}
                                  </span>
                                  <span className={styles.weekEventDate}>
                                    ({formatYmdRange(ev.startDate, ev.endDate)})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
};
