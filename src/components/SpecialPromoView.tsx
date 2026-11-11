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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  RotateCcw,
  Share2,
  Ticket,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CalendarDisplayOptions,
  FirestorePromoLink,
  PoolFilterState,
  PromoLevel,
  RegistrationProgressStatus,
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
import { getSpecialPromoFormatShortLabels } from '../constants/categories';
import {
  buildSwimmingPoolsWithStats,
  SwimmingPoolWithStats,
} from '../constants/swimmingPools';
import { GeoCollection, GeoFeature } from './KoreaAdminMap';
import styles from './SpecialPromoView.module.css';
import { formatYmdRange } from '../shared/dateFormat';

interface SpecialPromoViewProps {
  sport: SpecialPromoSport;
  viewMode: ViewMode;
  events: UnifiedEventItem[];
  allEvents?: UnifiedEventItem[];
  calendarOptions: CalendarDisplayOptions;
  targetYear?: number;
  poolFilters?: PoolFilterState;
  onUpdatePoolFilter?: <K extends keyof PoolFilterState>(
    key: K,
    value: PoolFilterState[K]
  ) => void;
  onResetPoolFilters?: () => void;
  onSelectEvent: (event: UnifiedEventItem) => void;
  onChangeCalendarOptions?: (next: CalendarDisplayOptions) => void;
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

type WeekDiffOffset = -3 | -2 | -1 | 0 | 1 | 2 | 3;

interface WeekLegendItemConfig {
  diff: WeekDiffOffset;
  label: string;
  colorTone: 'blue' | 'red';
  enabled: boolean;
  opacityPct: number; // 0 ~ 100
}

const WEEK_DIFF_ORDER: WeekDiffOffset[] = [-3, -2, -1, 0, 1, 2, 3];

const DEFAULT_WEEK_LEGEND_CONFIGS: Record<WeekDiffOffset, WeekLegendItemConfig> = {
  [-3]: { diff: -3, label: '3주전', colorTone: 'blue', enabled: true, opacityPct: 10 },
  [-2]: { diff: -2, label: '2주전', colorTone: 'blue', enabled: true, opacityPct: 25 },
  [-1]: { diff: -1, label: '1주전', colorTone: 'blue', enabled: true, opacityPct: 50 },
  [0]: { diff: 0, label: '이번주', colorTone: 'red', enabled: true, opacityPct: 100 },
  [1]: { diff: 1, label: '1주후', colorTone: 'red', enabled: true, opacityPct: 50 },
  [2]: { diff: 2, label: '2주후', colorTone: 'red', enabled: true, opacityPct: 25 },
  [3]: { diff: 3, label: '3주후', colorTone: 'red', enabled: true, opacityPct: 10 },
};

interface MuniHighlightInfo {
  diff: WeekDiffOffset; // -3 ~ +3
  distanceDays: number;
  primaryEvent: UnifiedEventItem;
  allWindowEvents: Array<{ diff: WeekDiffOffset; event: UnifiedEventItem }>;
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
const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 7;

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
 * 주차 차이(diff: -3 ~ +3) 및 사용자 범례 설정(표시여부·% 농도)에 따른 지도 지자체 폴리곤 색상 반환
 */
function getDiffFillColor(
  diff: WeekDiffOffset,
  legendConfigs: Record<WeekDiffOffset, WeekLegendItemConfig>
): string {
  const cfg = legendConfigs[diff];
  if (!cfg || !cfg.enabled) return '#f8fafc';
  const alpha = Math.max(0, Math.min(100, cfg.opacityPct)) / 100;
  if (diff === 0) {
    return `rgba(220, 38, 38, ${alpha})`;
  }
  if (diff > 0) {
    return `rgba(239, 68, 68, ${alpha})`;
  }
  return `rgba(37, 99, 235, ${alpha})`;
}

function getDiffBadgeText(
  diff: WeekDiffOffset,
  legendConfigs: Record<WeekDiffOffset, WeekLegendItemConfig>
): string {
  const cfg = legendConfigs[diff];
  const pct = cfg ? cfg.opacityPct : 0;
  if (diff === 0) return `이번주 (빨강 ${pct}%)`;
  if (diff > 0) return `${diff}주후 (빨강 ${pct}%)`;
  return `${Math.abs(diff)}주전 (파랑 ${pct}%)`;
}

function buildPoolMapLinks(pool: SwimmingPoolWithStats) {
  const query = `${pool.regionName} ${pool.sigunguName} ${pool.name}`.trim();
  const encoded = encodeURIComponent(query);
  return {
    naver: `https://map.naver.com/p/search/${encoded}`,
    daum: `https://map.kakao.com/link/search/${encoded}`,
    google: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
}

function buildPoolOneLineSummary(pool: SwimmingPoolWithStats): string {
  const parts: string[] = [];
  if (pool.certification) {
    parts.push(pool.certification);
  }
  if (pool.courseLength === '50m' && !pool.certification.includes('국제')) {
    parts.push('50m 정규 경기장');
  } else if (pool.totalEventCount > 0 && pool.courseLength === '25m') {
    parts.push('생활체육 대회 경기장');
  }
  if (pool.hasDivingPool && !pool.certification.includes('다이빙')) {
    parts.push('다이빙장 보유');
  }
  if (pool.notes) {
    parts.push(pool.notes);
  }
  const joined = parts.join(' · ');
  return joined || (pool.courseLength === '50m' ? '국제규격 50m 수영장' : '공공 실내수영장');
}

/**
 * 수영장 이름 줄바꿈 분리:
 * - 기본 수영장 이름은 줄바꿈 하지 않음 (white-space: nowrap)
 * - `/`가 등장 시 `/`를 제거하고 줄바꿈하여 표시
 * - 괄호 표기(...)가 있는 경우 괄호 표시는 다음 줄로 줄바꿈하여 표시
 */
function splitPoolNameAndParens(
  name: string,
  name2021?: string
): { mainName: string; parenLines: string[] } {
  const raw = (name || '').trim();
  const slashParts = raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  const allLines: string[] = [];
  for (const part of slashParts) {
    const firstOpen = part.indexOf('(');
    if (firstOpen > 0) {
      const head = part.slice(0, firstOpen).trim();
      const tail = part.slice(firstOpen).trim();
      if (head) allLines.push(head);
      if (tail) allLines.push(tail);
    } else if (part) {
      allLines.push(part);
    }
  }

  const mainName = allLines[0] || raw;
  const parenLines = allLines.slice(1);

  if (name2021 && name2021.trim()) {
    const normRaw = raw.replace(/\s+/g, '');
    const norm2021 = name2021.trim().replace(/\s+/g, '');
    if (norm2021 !== normRaw) {
      const oldClean = name2021.replace(/\//g, ' ').trim();
      const oldTag = `(구 명칭: ${oldClean})`;
      if (!parenLines.includes(oldTag)) {
        parenLines.push(oldTag);
      }
    }
  }

  return { mainName, parenLines };
}

/**
 * 소재지 행정 2단계(시·도 + 시·군·구) 표기 생성
 */
function formatPoolAdmin2Addr(pool: SwimmingPoolWithStats): string {
  const r = (pool.regionName || '').trim();
  const s = (pool.sigunguName || '').trim();
  if (!s || r === s || (r.includes('세종') && s.includes('세종'))) {
    return r || s;
  }
  return `${r} ${s}`.trim();
}

type PoolDetailType = 'COURSE' | 'EVENTS' | 'ADDR';

interface SwimRegistrationComputed {
  status: RegistrationProgressStatus;
  badgeText: string;
  dDayText: string | null;
  periodDisplay: string | null;
  quotaNote?: string;
  methodNote?: string;
  registrationUrl?: string;
  closedNote?: string;
}

function formatYmdDotShort(ymd?: string): string {
  if (!ymd || ymd.length < 8) return '';
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

function formatIsoTimestampKst(iso?: string): string {
  if (!iso) return '';
  const trimmed = iso.trim();
  if (/^\d{8}$/.test(trimmed)) {
    return formatYmdDotShort(trimmed);
  }
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return trimmed;
  const y = dt.getFullYear();
  const m = pad2(dt.getMonth() + 1);
  const d = pad2(dt.getDate());
  const hh = pad2(dt.getHours());
  const mm = pad2(dt.getMinutes());
  return `${y}.${m}.${d} ${hh}:${mm}`;
}

function getEffectiveUpdateIso(ev: UnifiedEventItem): string {
  return (
    ev.updatedAt ||
    ev.firstSeenAt ||
    (ev.publishedAt && ev.publishedAt.length === 8
      ? `${ev.publishedAt.slice(0, 4)}-${ev.publishedAt.slice(4, 6)}-${ev.publishedAt.slice(6, 8)}T09:00:00+09:00`
      : '') ||
    ''
  );
}

function getEffectiveUpdateSortableKey(ev: UnifiedEventItem): string {
  const pubYmd = (ev.publishedAt || '').replace(/[^0-9]/g, '').slice(0, 8);
  const firstYmd = (ev.firstSeenAt || '').replace(/[^0-9]/g, '').slice(0, 8);
  const updYmd = (ev.updatedAt || '').replace(/[^0-9]/g, '').slice(0, 8);
  const bestYmd = [pubYmd, firstYmd, updYmd].filter((x) => x.length === 8).sort().pop() || '00000000';
  return `${bestYmd}-${ev.updatedAt || ''}-${ev.startDate || ''}`;
}

function computeSwimRegistrationInfo(
  ev: UnifiedEventItem,
  todayYmd: string,
  todayMs: number
): SwimRegistrationComputed {
  const reg = ev.registrationPeriod;
  if (!reg || !reg.startDate || reg.startDate.length < 8) {
    return {
      status: 'CHECK_NOTICE',
      badgeText: '요강/공지 확인',
      dDayText: null,
      periodDisplay: null,
    };
  }

  const sYmd = reg.startDate.slice(0, 8);
  const eYmd = (reg.endDate || reg.startDate).slice(0, 8);
  const startStr = `${formatYmdDotShort(sYmd)}${reg.openTime ? ` ${reg.openTime}` : ''}`;
  const endStr = `${formatYmdDotShort(eYmd)}${reg.closeTime ? ` ${reg.closeTime}` : ''}`;
  const periodDisplay = sYmd === eYmd && !reg.openTime && !reg.closeTime
    ? startStr
    : `${startStr} ~ ${endStr}`;

  if (reg.closedEarly) {
    return {
      status: 'REGISTRATION_CLOSED',
      badgeText: '선착순 조기마감',
      dDayText: '마감',
      periodDisplay,
      quotaNote: reg.quotaNote,
      methodNote: reg.methodNote,
      registrationUrl: reg.registrationUrl,
      closedNote: reg.closedNote,
    };
  }

  if (todayYmd < sYmd) {
    const diffDays = Math.max(
      0,
      Math.round((ymdToMs(sYmd) - todayMs) / (1000 * 60 * 60 * 24))
    );
    return {
      status: 'REGISTRATION_UPCOMING',
      badgeText: '곧 등록 시작',
      dDayText: diffDays === 0 ? '오늘 오픈' : `오픈 D-${diffDays}`,
      periodDisplay,
      quotaNote: reg.quotaNote,
      methodNote: reg.methodNote,
      registrationUrl: reg.registrationUrl,
    };
  }

  if (todayYmd >= sYmd && todayYmd <= eYmd) {
    const diffDays = Math.max(
      0,
      Math.round((ymdToMs(eYmd) - todayMs) / (1000 * 60 * 60 * 24))
    );
    return {
      status: 'REGISTRATION_OPEN',
      badgeText: '지금 등록중',
      dDayText: diffDays === 0 ? '오늘 마감' : `마감 D-${diffDays}`,
      periodDisplay,
      quotaNote: reg.quotaNote,
      methodNote: reg.methodNote,
      registrationUrl: reg.registrationUrl,
    };
  }

  return {
    status: 'REGISTRATION_CLOSED',
    badgeText: '접수 마감',
    dDayText: '마감',
    periodDisplay,
    quotaNote: reg.quotaNote,
    methodNote: reg.methodNote,
    registrationUrl: reg.registrationUrl,
    closedNote: reg.closedNote,
  };
}

export const SpecialPromoView: React.FC<SpecialPromoViewProps> = ({
  sport,
  viewMode,
  events,
  allEvents,
  calendarOptions,
  targetYear,
  poolFilters: externalPoolFilters,
  onSelectEvent,
  onChangeCalendarOptions,
}) => {
  const sportLabel = SPORT_LABELS[sport] || '수영';

  const activePoolFilters: PoolFilterState = externalPoolFilters || {
    regionName: 'ALL',
    sigunguName: 'ALL',
    courses: { '50m': true, '25m': true },
    keyword: '',
  };

  // 세부정보는 한 번에 한 가지씩만 표시: 'COURSE'(50m 여부 규격 상세) | 'EVENTS'(개최 대회 목록) | 'ADDR'(상세주소 및 지도 링크)
  const [activePoolDetail, setActivePoolDetail] = useState<{
    poolId: string;
    type: PoolDetailType;
  } | null>(null);
  const [fullyExpandedPoolIds, setFullyExpandedPoolIds] = useState<
    Record<string, boolean>
  >({});
  // 대회 개최 횟수 열 토글: 'THIS_YEAR'(올해) | 'ALL'(전체)
  const [poolCountMode, setPoolCountMode] = useState<'THIS_YEAR' | 'ALL'>('THIS_YEAR');
  // 지도 전체 화면 보기 상태
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);

  // 수영장 지도(POOLS_MAP)에서 선택/호버된 수영장 상태
  const [selectedPoolIdOnMap, setSelectedPoolIdOnMap] = useState<string | null>(null);
  const [hoveredPoolOnMap, setHoveredPoolOnMap] =
    useState<SwimmingPoolWithStats | null>(null);
  const poolRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const togglePoolDetail = (poolId: string, type: PoolDetailType) => {
    setActivePoolDetail((prev) => {
      if (prev && prev.poolId === poolId && prev.type === type) {
        return null;
      }
      return { poolId, type };
    });
  };

  const togglePoolFullExpand = (poolId: string) => {
    setFullyExpandedPoolIds((prev) => ({
      ...prev,
      [poolId]: !prev[poolId],
    }));
  };

  // 전체 화면 모드에서 ESC 키로 해제
  useEffect(() => {
    if (!isMapFullscreen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMapFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMapFullscreen]);

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
        `${ev.rawTitle || ev.title} ${ev.title} ${ev.invitation || ''} ${ev.summary || ''} ${ev.organizer || ''}`,
        sport
      )
    );
  }, [events, sport]);

  // 전체 연도 수영 대회 (수영장별 누적 개최 횟수 산출용)
  const allSwimEvents = useMemo(() => {
    const sourceList = allEvents && allEvents.length > 0 ? allEvents : events;
    return sourceList.filter((ev) =>
      matchesSportCategory(
        `${ev.rawTitle || ev.title} ${ev.title} ${ev.invitation || ''} ${ev.summary || ''} ${ev.organizer || ''}`,
        'SWIMMING'
      )
    );
  }, [allEvents, events]);

  const swimmingPoolsWithStats = useMemo(() => {
    return buildSwimmingPoolsWithStats(allSwimEvents, sportEvents);
  }, [allSwimEvents, sportEvents]);

  // 수영장 전용 필터(소재지 시·도/시·군·구, 50m/25m 복수 선택, 검색어[대회명·수영장 이름 등]) 적용
  const filteredSwimmingPools = useMemo(() => {
    const q = activePoolFilters.keyword.trim().toLowerCase();
    const courses = activePoolFilters.courses || { '50m': true, '25m': true };
    return swimmingPoolsWithStats.filter((p) => {
      if (
        activePoolFilters.regionName !== 'ALL' &&
        p.regionName !== activePoolFilters.regionName
      ) {
        return false;
      }
      if (
        activePoolFilters.sigunguName !== 'ALL' &&
        p.sigunguName !== activePoolFilters.sigunguName
      ) {
        return false;
      }
      if (p.courseLength === '50m' && !courses['50m']) {
        return false;
      }
      if (p.courseLength === '25m' && !courses['25m']) {
        return false;
      }
      if (q) {
        const eventTitlesHay = p.events
          .map((ev) => `${ev.title} ${ev.rawTitle || ''} ${ev.organizer || ''}`)
          .join(' ');
        const hay = `${p.name} ${p.rawName || ''} ${p.name2021 || ''} ${p.regionName} ${p.sigunguName} ${p.address} ${p.lanes} ${p.certification || ''} ${p.notes || ''} ${eventTitlesHay}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [swimmingPoolsWithStats, activePoolFilters]);

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

  // 지도 우상단 리모콘(범례 보이기/숨기기) 및 우하단 7단계 범례(3주전~3주후 표시여부 및 % 농도) 상태
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [legendConfigs, setLegendConfigs] = useState<
    Record<WeekDiffOffset, WeekLegendItemConfig>
  >(() => ({ ...DEFAULT_WEEK_LEGEND_CONFIGS }));

  const toggleLegendDiffEnabled = useCallback((diff: WeekDiffOffset) => {
    setLegendConfigs((prev) => ({
      ...prev,
      [diff]: {
        ...prev[diff],
        enabled: !prev[diff].enabled,
      },
    }));
  }, []);

  const updateLegendDiffOpacity = useCallback(
    (diff: WeekDiffOffset, rawPct: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(Number(rawPct) || 0)));
      setLegendConfigs((prev) => ({
        ...prev,
        [diff]: {
          ...prev[diff],
          opacityPct: clamped,
        },
      }));
    },
    []
  );

  const resetLegendConfigs = useCallback(() => {
    setLegendConfigs({ ...DEFAULT_WEEK_LEGEND_CONFIGS });
  }, []);

  // 지도 확대/축소(휠 스크롤 및 리모콘) & 드래그 이동 상태
  const [mapZoom, setMapZoom] = useState<number>(1);
  const [mapPan, setMapPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState<boolean>(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const clampPan = useCallback((panX: number, panY: number, zoom: number) => {
    if (zoom <= 1.01) return { x: 0, y: 0 };
    const maxOffsetX = ((zoom - 1) * SVG_WIDTH) / 2 + 60;
    const maxOffsetY = ((zoom - 1) * SVG_HEIGHT) / 2 + 40;
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, panX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, panY)),
    };
  }, []);

  const handleZoomByFactor = useCallback(
    (factor: number, focalSvgX = SVG_WIDTH / 2, focalSvgY = SVG_HEIGHT / 2) => {
      setMapZoom((prevZoom) => {
        const nextZoom = Number(
          Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, prevZoom * factor)).toFixed(2)
        );
        if (nextZoom === prevZoom) return prevZoom;
        setMapPan((prevPan) => {
          if (nextZoom <= 1.01) return { x: 0, y: 0 };
          const ratio = nextZoom / prevZoom;
          const dx = focalSvgX - SVG_WIDTH / 2;
          const dy = focalSvgY - SVG_HEIGHT / 2;
          const nextPanX = dx - (dx - prevPan.x) * ratio;
          const nextPanY = dy - (dy - prevPan.y) * ratio;
          return clampPan(nextPanX, nextPanY, nextZoom);
        });
        return nextZoom;
      });
    },
    [clampPan]
  );

  const handleResetMapZoom = useCallback(() => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
  }, []);

  // 지도 위/아래 마우스 휠 스크롤로 확대/축소 (페이지 스크롤 간섭 방지를 위해 passive: false 등록)
  useEffect(() => {
    if (viewMode !== 'MAP' && viewMode !== 'POOLS_MAP') return;
    const el = mapCanvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      // 우하단 범례나 우상단 리모콘 위에서 스크롤할 때는 지도 줌 동작 제외
      if (target && target.closest('[data-map-ui="true"]')) {
        return;
      }
      e.preventDefault();

      let focalX = SVG_WIDTH / 2;
      let focalY = SVG_HEIGHT / 2;
      const svgEl = svgRef.current;
      if (svgEl) {
        const rect = svgEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          focalX = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;
          focalY = ((e.clientY - rect.top) / rect.height) * SVG_HEIGHT;
        }
      }

      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      handleZoomByFactor(factor, focalX, focalY);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewMode, handleZoomByFactor]);

  const handleMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-map-ui="true"]')) return;
    setIsDraggingMap(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: mapPan.x,
      panY: mapPan.y,
      moved: false,
    };
  };

  const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingMap || !dragStartRef.current) return;
    const dxClient = e.clientX - dragStartRef.current.clientX;
    const dyClient = e.clientY - dragStartRef.current.clientY;
    if (Math.abs(dxClient) > 3 || Math.abs(dyClient) > 3) {
      dragStartRef.current.moved = true;
    }
    const svgEl = svgRef.current;
    const rect = svgEl ? svgEl.getBoundingClientRect() : null;
    const scaleX = rect && rect.width > 0 ? SVG_WIDTH / rect.width : 1;
    const scaleY = rect && rect.height > 0 ? SVG_HEIGHT / rect.height : 1;

    const nextPan = clampPan(
      dragStartRef.current.panX + dxClient * scaleX,
      dragStartRef.current.panY + dyClient * scaleY,
      mapZoom
    );
    setMapPan(nextPan);
  };

  const handleMapMouseUp = () => {
    setIsDraggingMap(false);
  };

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

    // [-3주 ~ +3주] 윈도우에 속한 주차들의 이벤트 수집 (범례에서 표시여부가 체크된 주차만 반영)
    const windowEntries: Array<{
      diff: WeekDiffOffset;
      absDiff: number;
      distanceDays: number;
      event: UnifiedEventItem;
    }> = [];

    for (const diff of WEEK_DIFF_ORDER) {
      if (!legendConfigs[diff]?.enabled) continue;
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
  }, [municipalitiesGeo, mapWeekRows, activeWeekIdx, todayMs, legendConfigs]);

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

  const isSwimmingPoolsList = sport === 'SWIMMING' && viewMode === 'POOLS';
  const isSwimmingPoolsMap = sport === 'SWIMMING' && viewMode === 'POOLS_MAP';
  const isSwimmingPoolsMode = isSwimmingPoolsList || isSwimmingPoolsMap;
  const isSwimNewsMode = sport === 'SWIMMING' && viewMode === 'SWIM_NEWS';
  const isSpecialSwimSubView = isSwimmingPoolsMode || isSwimNewsMode;

  // 새소식 대시보드 내부 빠른 필터 상태 (섹션 선택 + 업데이트 기간 필터)
  const [newsSectionFilter, setNewsSectionFilter] = useState<
    'ALL' | 'OPEN' | 'UPCOMING' | 'UPDATES'
  >('ALL');
  const [newsUpdateRangeDays, setNewsUpdateRangeDays] = useState<'ALL' | 7 | 14 | 30>(
    'ALL'
  );

  // 수영 새소식: 전체 수영 대회(allSwimEvents) 기준 접수중 / 곧 접수 시작 / 업데이트 타임라인 산출
  const swimNewsData = useMemo(() => {
    const annotated = allSwimEvents.map((ev) => ({
      ev,
      regInfo: computeSwimRegistrationInfo(ev, todayYmd, todayMs),
      effectiveUpdateIso: getEffectiveUpdateIso(ev),
      sortKey: getEffectiveUpdateSortableKey(ev),
    }));

    // 1) 지금 등록(접수)중인 이벤트: 마감일이 빠른 순 정렬
    const openEvents = annotated
      .filter((item) => item.regInfo.status === 'REGISTRATION_OPEN')
      .sort((a, b) => {
        const endA = a.ev.registrationPeriod?.endDate || '99999999';
        const endB = b.ev.registrationPeriod?.endDate || '99999999';
        if (endA !== endB) return endA.localeCompare(endB);
        return (a.ev.startDate || '').localeCompare(b.ev.startDate || '');
      });

    // 2) 곧 등록(접수)을 시작하는 이벤트: 접수 오픈일이 빠른 순 정렬
    const upcomingEvents = annotated
      .filter((item) => item.regInfo.status === 'REGISTRATION_UPCOMING')
      .sort((a, b) => {
        const startA = a.ev.registrationPeriod?.startDate || '99999999';
        const startB = b.ev.registrationPeriod?.startDate || '99999999';
        if (startA !== startB) return startA.localeCompare(startB);
        return (a.ev.startDate || '').localeCompare(b.ev.startDate || '');
      });

    // 3) 새로 올라온 업데이트 타임라인: 최신 업데이트/공지 순 정렬 + 최근 N일 필터
    const sortedUpdates = [...annotated].sort((a, b) =>
      b.sortKey.localeCompare(a.sortKey)
    );

    const filteredUpdates = sortedUpdates.filter((item) => {
      if (newsUpdateRangeDays === 'ALL') return true;
      const ev = item.ev;
      const candidateYmds: string[] = [];
      if (ev.publishedAt && ev.publishedAt.length >= 8) {
        candidateYmds.push(ev.publishedAt.slice(0, 8));
      }
      if (ev.firstSeenAt) {
        const d = new Date(ev.firstSeenAt);
        if (!Number.isNaN(d.getTime())) {
          candidateYmds.push(
            `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
          );
        }
      }
      if (ev.updatedAt) {
        const d = new Date(ev.updatedAt);
        if (!Number.isNaN(d.getTime())) {
          candidateYmds.push(
            `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
          );
        }
      }
      const bestYmd = candidateYmds.sort().pop();
      if (!bestYmd) return false;
      const diffDays = Math.round(
        (todayMs - ymdToMs(bestYmd)) / (1000 * 60 * 60 * 24)
      );
      return diffDays <= newsUpdateRangeDays;
    });

    // 가장 최근 업데이트 시각
    const latestIso =
      sortedUpdates
        .map((x) => x.ev.updatedAt || x.ev.firstSeenAt || '')
        .filter(Boolean)
        .sort()
        .pop() || '';

    return {
      openEvents,
      upcomingEvents,
      allUpdatesCount: sortedUpdates.length,
      filteredUpdates,
      latestUpdateFormatted: formatIsoTimestampKst(latestIso) || formatYmdDotShort(todayYmd),
    };
  }, [allSwimEvents, todayYmd, todayMs, newsUpdateRangeDays]);

  const selectedPoolOnMap = useMemo(() => {
    if (!selectedPoolIdOnMap) return null;
    return (
      filteredSwimmingPools.find((p) => p.id === selectedPoolIdOnMap) ||
      swimmingPoolsWithStats.find((p) => p.id === selectedPoolIdOnMap) ||
      null
    );
  }, [selectedPoolIdOnMap, filteredSwimmingPools, swimmingPoolsWithStats]);

  // 수영장 일람 표 렌더링 (수영장 이름 | 🌐(홈페이지 아이콘) | 50m 여부 | 다이빙 | 대회 개최(올해/전체 토글) | 소재지(행정 2단계) | 비고)
  const renderPoolsTable = () => {
    const currentYrPrefix = String(todayYear);

    return (
      <div className={styles.poolTableContainer}>
        <table className={styles.poolTable}>
          <thead>
            <tr>
              <th className={styles.colPoolName}>수영장 이름</th>
              <th
                className={styles.colPoolHome}
                title="수영장 공지사항·수강신청·강좌 안내 홈페이지"
                aria-label="수영장 홈페이지"
              >
                <span className={styles.colPoolHomeHeaderIcon}>
                  <Globe size={15} />
                </span>
              </th>
              <th className={styles.colPoolCourse}>50m 여부</th>
              <th className={styles.colPoolDiving}>다이빙</th>
              <th className={styles.colPoolCount}>
                <button
                  type="button"
                  className={styles.poolCountHeaderToggleBtn}
                  onClick={() =>
                    setPoolCountMode((prev) =>
                      prev === 'THIS_YEAR' ? 'ALL' : 'THIS_YEAR'
                    )
                  }
                  title="클릭하여 대회 개최 횟수 기준을 '올해'와 '전체'로 전환합니다"
                >
                  <span>대회 개최</span>
                  <span className={styles.poolCountModeBadge}>
                    ({poolCountMode === 'THIS_YEAR' ? '올해' : '전체'})
                  </span>
                </button>
              </th>
              <th className={styles.colPoolAddr}>소재지</th>
              <th className={styles.colPoolNote}>비고</th>
            </tr>
          </thead>
          <tbody>
            {filteredSwimmingPools.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.poolEmptyTd}>
                  선택한 필터 조건(소재지·50m 여부·검색어)에 해당하는 수영장이 없습니다.
                </td>
              </tr>
            ) : (
              filteredSwimmingPools.map((pool) => {
                const isCourseOpen =
                  activePoolDetail?.poolId === pool.id &&
                  activePoolDetail.type === 'COURSE';
                const isEventsOpen =
                  activePoolDetail?.poolId === pool.id &&
                  activePoolDetail.type === 'EVENTS';
                const isAddrOpen =
                  activePoolDetail?.poolId === pool.id &&
                  activePoolDetail.type === 'ADDR';
                const isAnyDetailOpen = isCourseOpen || isEventsOpen || isAddrOpen;

                const isFullyExpanded = Boolean(fullyExpandedPoolIds[pool.id]);
                const isSelectedOnMap = selectedPoolIdOnMap === pool.id;
                const mapLinks = buildPoolMapLinks(pool);
                const oneLineSummary = buildPoolOneLineSummary(pool);
                const admin2Addr = formatPoolAdmin2Addr(pool);
                const { mainName, parenLines } = splitPoolNameAndParens(
                  pool.name,
                  pool.name2021
                );

                const normalizedHomepage = pool.homepage
                  ? pool.homepage.startsWith('http')
                    ? pool.homepage
                    : `https://${pool.homepage}`
                  : '';

                // 올해 개최 대회 vs 전체 개최 대회
                const thisYearEvents = pool.events.filter((ev) => {
                  const s = (ev.startDate || '').slice(0, 4);
                  const e = (ev.endDate || ev.startDate || '').slice(0, 4);
                  return s === currentYrPrefix || e === currentYrPrefix;
                });

                const targetEvents =
                  poolCountMode === 'THIS_YEAR' ? thisYearEvents : pool.events;
                const displayEventCount = targetEvents.length;

                const visibleEvents = isFullyExpanded
                  ? targetEvents
                  : targetEvents.slice(0, 5);
                const hasMoreEvents = targetEvents.length > 5;

                return (
                  <React.Fragment key={pool.id}>
                    <tr
                      ref={(el) => {
                        poolRowRefs.current[pool.id] = el;
                      }}
                      className={`${styles.poolTr} ${
                        isAnyDetailOpen ? styles.poolTrExpanded : ''
                      } ${isSelectedOnMap ? styles.poolTrMapSelected : ''}`}
                      onClick={() => {
                        if (isSwimmingPoolsMap) {
                          setSelectedPoolIdOnMap(pool.id);
                        }
                      }}
                    >
                      {/* 1. 수영장 이름 (기본 이름은 줄바꿈 금지, `/` 제거 후 줄바꿈, 괄호 표시는 줄바꿈하여 표시) */}
                      <td className={styles.colPoolNameTd}>
                        <div className={styles.poolMainNameNoWrap}>{mainName}</div>
                        {parenLines.map((pLine, pIdx) => (
                          <div key={pIdx} className={styles.poolParenLineNoWrap}>
                            {pLine}
                          </div>
                        ))}
                      </td>

                      {/* 2. 수영장 홈페이지 링크 (2번째 배치, 아이콘만 표시) */}
                      <td
                        className={styles.colPoolHomeTd}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {normalizedHomepage ? (
                          <a
                            href={normalizedHomepage}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.poolHomeIconOnlyBtn}
                            title={`수강신청·강좌·공지 홈페이지 (${pool.homepage})`}
                            aria-label={`${pool.name} 홈페이지`}
                          >
                            <Globe size={15} />
                          </a>
                        ) : null}
                      </td>

                      {/* 3. 50m 여부 (50m/25m만 표시하고 클릭 시 세부정보 표시) */}
                      <td className={styles.colPoolCourseTd}>
                        <button
                          type="button"
                          className={`${styles.poolDetailTriggerBtn} ${
                            pool.courseLength === '50m'
                              ? styles.courseTrigger50m
                              : styles.courseTrigger25m
                          } ${isCourseOpen ? styles.poolDetailTriggerOpen : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePoolDetail(pool.id, 'COURSE');
                          }}
                          title="클릭하여 수조 규격·시설 세부정보 보기"
                        >
                          <span>{pool.courseLength}</span>
                          {isCourseOpen ? (
                            <ChevronDown size={13} />
                          ) : (
                            <ChevronRight size={13} />
                          )}
                        </button>
                      </td>

                      {/* 4. 다이빙 여부 (별도 열 할애, 줄바꿈 금지) */}
                      <td className={styles.colPoolDivingTd}>
                        {pool.hasDivingPool ? (
                          <span
                            className={styles.divingMiniBadge}
                            title={pool.lanes || '다이빙장 보유'}
                          >
                            다이빙
                          </span>
                        ) : null}
                      </td>

                      {/* 5. 대회 개최 횟수 (올해/전체 토글 반영, 0회는 표시하지 않음) */}
                      <td className={styles.colPoolCountTd}>
                        {displayEventCount > 0 ? (
                          <button
                            type="button"
                            className={`${styles.poolCountToggleBtn} ${
                              styles.poolCountToggleBtnActive
                            } ${isEventsOpen ? styles.poolCountToggleBtnOpen : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePoolDetail(pool.id, 'EVENTS');
                            }}
                            title="클릭하여 최근 열린 대회 목록 보기"
                          >
                            <span>🏆 {displayEventCount}회</span>
                            {isEventsOpen ? (
                              <ChevronDown size={13} />
                            ) : (
                              <ChevronRight size={13} />
                            )}
                          </button>
                        ) : null}
                      </td>

                      {/* 6. 소재지 (행정 2단계까지만 표기, 클릭 시 상세주소 및 지도 링크 세부정보 표시) */}
                      <td className={styles.colPoolAddrTd}>
                        <button
                          type="button"
                          className={`${styles.poolAddrTriggerBtn} ${
                            isAddrOpen ? styles.poolAddrTriggerBtnOpen : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePoolDetail(pool.id, 'ADDR');
                          }}
                          title="클릭하여 상세주소 및 네이버·다음·구글 지도 링크 보기"
                        >
                          <span>{admin2Addr}</span>
                          {isAddrOpen ? (
                            <ChevronDown size={13} />
                          ) : (
                            <ChevronRight size={13} />
                          )}
                        </button>
                      </td>

                      {/* 7. 비고 (1줄 요약) */}
                      <td className={styles.colPoolNoteTd} title={oneLineSummary}>
                        <div className={styles.poolOneLineSummary}>
                          {oneLineSummary}
                        </div>
                      </td>
                    </tr>

                    {/* 세부정보 행 (한 번에 한 가지씩만 표시: COURSE | EVENTS | ADDR) */}
                    {isAnyDetailOpen && (
                      <tr className={styles.poolExpandTr}>
                        <td colSpan={7} className={styles.poolExpandTd}>
                          {/* A. 50m 여부 클릭 시: 수조 규격 및 시설 세부정보 */}
                          {isCourseOpen && (
                            <div className={styles.poolEventsDrawer}>
                              <div className={styles.poolEventsHeader}>
                                <span>
                                  🏊 <strong>{pool.name}</strong> 수조 규격 · 시설 세부정보
                                </span>
                                <span className={styles.poolEventsHint}>
                                  {pool.certification}
                                </span>
                              </div>
                              <div className={styles.poolDetailSpecGrid}>
                                <div className={styles.poolDetailSpecItem}>
                                  <span className={styles.poolDetailSpecLabel}>
                                    수조 규격·레인
                                  </span>
                                  <span className={styles.poolDetailSpecValue}>
                                    <strong>{pool.courseLength}</strong> · {pool.lanes}
                                    {pool.indoorOutdoor
                                      ? ` (${pool.indoorOutdoor})`
                                      : ''}
                                  </span>
                                </div>
                                {pool.hasDivingPool && (
                                  <div className={styles.poolDetailSpecItem}>
                                    <span className={styles.poolDetailSpecLabel}>
                                      다이빙장 보유
                                    </span>
                                    <span className={styles.poolDetailSpecValue}>
                                      다이빙풀 보유 ({pool.lanes})
                                    </span>
                                  </div>
                                )}
                                {(pool.builtYear ||
                                  pool.totAreaSqm ||
                                  pool.seats) && (
                                  <div className={styles.poolDetailSpecItem}>
                                    <span className={styles.poolDetailSpecLabel}>
                                      준공·규모·관람석
                                    </span>
                                    <span className={styles.poolDetailSpecValue}>
                                      {[
                                        pool.builtYear
                                          ? `준공 ${pool.builtYear}년${
                                              pool.renovYear
                                                ? ` (개보수 ${pool.renovYear}년)`
                                                : ''
                                            }`
                                          : '',
                                        pool.totAreaSqm
                                          ? `연면적 ${pool.totAreaSqm.toLocaleString()}㎡`
                                          : '',
                                        pool.seats
                                          ? `관람석 ${pool.seats.toLocaleString()}석`
                                          : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </span>
                                  </div>
                                )}
                                {(pool.manager || pool.operator || pool.owner) && (
                                  <div className={styles.poolDetailSpecItem}>
                                    <span className={styles.poolDetailSpecLabel}>
                                      소유·관리기관
                                    </span>
                                    <span className={styles.poolDetailSpecValue}>
                                      {[pool.owner, pool.operator, pool.manager]
                                        .filter(Boolean)
                                        .filter((v, i, a) => a.indexOf(v) === i)
                                        .join(' / ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* B. 대회 개최횟수 클릭 시: 최근 열린 5개 대회 + 더 확장 */}
                          {isEventsOpen && (
                            <div className={styles.poolEventsDrawer}>
                              <div className={styles.poolEventsHeader}>
                                <span>
                                  📋 <strong>{pool.name}</strong>{' '}
                                  {poolCountMode === 'THIS_YEAR'
                                    ? `${todayYear}년(올해) 개최 대회`
                                    : '전체 개최 수영대회'}{' '}
                                  (표시 {visibleEvents.length}건 / 총{' '}
                                  {targetEvents.length}건)
                                </span>
                                <span className={styles.poolEventsHint}>
                                  대회를 클릭하면 상세 요강 및 공지 원문을 볼 수 있습니다
                                </span>
                              </div>

                              {targetEvents.length === 0 ? (
                                <div className={styles.poolNoEvents}>
                                  해당 기준에 매칭된 개최 대회가 없습니다.
                                </div>
                              ) : (
                                <>
                                  <div className={styles.poolEventsList}>
                                    {visibleEvents.map((ev) => (
                                      <button
                                        key={ev.id}
                                        type="button"
                                        className={styles.poolEventRowBtn}
                                        onClick={() => onSelectEvent(ev)}
                                      >
                                        <span
                                          className={
                                            SCOPE_PILL_CLASS[ev.promoLevel]
                                          }
                                        >
                                          {PROMO_LEVEL_SHORT_LABELS[ev.promoLevel]}
                                        </span>
                                        <span className={styles.poolEventDate}>
                                          {formatYmdRange(ev.startDate, ev.endDate)}
                                        </span>
                                        <span className={styles.poolEventTitle}>
                                          {ev.title}
                                        </span>
                                        {ev.organizer && (
                                          <span className={styles.poolEventOrg}>
                                            {ev.organizer}
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                  </div>

                                  {hasMoreEvents && (
                                    <div className={styles.poolExpandMoreRow}>
                                      <button
                                        type="button"
                                        className={styles.poolExpandMoreBtn}
                                        onClick={() =>
                                          togglePoolFullExpand(pool.id)
                                        }
                                      >
                                        {isFullyExpanded
                                          ? '▲ 최근 5개 대회만 보기 (접기)'
                                          : `▼ 더 확장하여 전체 ${targetEvents.length}개 대회 모두 보기 (+${
                                              targetEvents.length - 5
                                            }개 더보기)`}
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {/* C. 소재지 클릭 시: 상세주소 및 지도 링크(네이버, 다음, 구글) */}
                          {isAddrOpen && (
                            <div className={styles.poolEventsDrawer}>
                              <div className={styles.poolEventsHeader}>
                                <span>
                                  📍 <strong>{pool.name}</strong> 상세주소 및 지도 바로가기
                                </span>
                              </div>
                              <div className={styles.poolAddrDetailBox}>
                                <div className={styles.poolFullAddressText}>
                                  <strong>[{admin2Addr}]</strong>{' '}
                                  {pool.address || admin2Addr}
                                </div>
                                <div className={styles.mapLinksGroup}>
                                  <a
                                    href={mapLinks.naver}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`${styles.mapLinkChip} ${styles.mapLinkNaver}`}
                                  >
                                    네이버 지도에서 보기
                                  </a>
                                  <a
                                    href={mapLinks.daum}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`${styles.mapLinkChip} ${styles.mapLinkDaum}`}
                                  >
                                    다음(카카오) 지도에서 보기
                                  </a>
                                  <a
                                    href={mapLinks.google}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`${styles.mapLinkChip} ${styles.mapLinkGoogle}`}
                                  >
                                    구글 지도에서 보기
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      className={
        isSwimmingPoolsList
          ? styles.page
          : isSwimmingPoolsMap || viewMode === 'MAP'
            ? styles.mapModeViewport
            : viewMode === 'CALENDAR'
              ? styles.calendarModeViewport
              : styles.page
      }
    >
      {/* 0-A. 수영장 일람(표) 보기 (viewMode === 'POOLS') */}
      {isSwimmingPoolsList && (
        <section
          className={styles.poolsSection}
          aria-label="전국 수영장 일람 및 대회 개최 현황"
        >
          {renderPoolsTable()}
        </section>
      )}

      {/* 0-B. 수영장 지도에서 보기 (viewMode === 'POOLS_MAP': 지도 위에 수영장 위치를 점으로 표시 + 범례만 지도에 표시 + 하단 일람 표 연동) */}
      {isSwimmingPoolsMap && (
        <div className={styles.specialMapLayout}>
          <section
            className={`${styles.mapTopFixedPane} ${
              isMapFullscreen ? styles.mapTopFixedPaneFullscreen : ''
            }`}
            aria-label="전국 수영장 위치 지도"
          >
            <div
              ref={mapCanvasRef}
              className={`${styles.mapCanvasWrap} ${
                isDraggingMap ? styles.mapCanvasDragging : ''
              } ${isMapFullscreen ? styles.mapCanvasWrapFullscreen : ''}`}
              onMouseDown={handleMapMouseDown}
              onMouseMove={handleMapMouseMove}
              onMouseUp={handleMapMouseUp}
              onMouseLeave={() => {
                setIsDraggingMap(false);
                setHoveredPoolOnMap(null);
              }}
            >
              {/* 좌상단 수영장 호버/선택 상세 플로팅 카드 */}
              {(hoveredPoolOnMap || selectedPoolOnMap) &&
                (() => {
                  const targetPool = hoveredPoolOnMap || selectedPoolOnMap!;
                  const tLinks = buildPoolMapLinks(targetPool);
                  const tSummary = buildPoolOneLineSummary(targetPool);
                  return (
                    <div
                      className={styles.poolMapFloatingCard}
                      data-map-ui="true"
                    >
                      <div className={styles.poolMapCardTop}>
                        <span
                          className={
                            targetPool.courseLength === '50m'
                              ? styles.courseBadge50m
                              : styles.courseBadge25m
                          }
                        >
                          {targetPool.courseLength}
                        </span>
                        <strong>{targetPool.name}</strong>
                        {targetPool.totalEventCount > 0 && (
                          <span className={styles.poolMapCardCount}>
                            🏆 {targetPool.totalEventCount}회
                          </span>
                        )}
                      </div>
                      <div className={styles.poolMapCardAddr}>
                        [{targetPool.regionName} {targetPool.sigunguName}]{' '}
                        {targetPool.address}
                      </div>
                      <div className={styles.poolMapCardSummary}>{tSummary}</div>
                      <div className={styles.mapLinksGroup}>
                        <a
                          href={tLinks.naver}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.mapLinkChip} ${styles.mapLinkNaver}`}
                        >
                          네이버지도
                        </a>
                        <a
                          href={tLinks.daum}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.mapLinkChip} ${styles.mapLinkDaum}`}
                        >
                          다음지도
                        </a>
                        <a
                          href={tLinks.google}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.mapLinkChip} ${styles.mapLinkGoogle}`}
                        >
                          구글지도
                        </a>
                      </div>
                    </div>
                  );
                })()}

              {/* 우상단 지도 확대/축소 + 범례 + 전체 화면 리모콘 */}
              <div
                className={styles.mapRemoteControl}
                data-map-ui="true"
                role="toolbar"
                aria-label="수영장 지도 리모콘"
              >
                <button
                  type="button"
                  className={`${styles.remoteIconBtn} ${
                    isMapFullscreen ? styles.remoteIconBtnActive : ''
                  }`}
                  onClick={() => setIsMapFullscreen((prev) => !prev)}
                  title={
                    isMapFullscreen ? '전체 화면 종료 (ESC)' : '전체 화면으로 보기'
                  }
                  aria-label={
                    isMapFullscreen ? '전체 화면 종료' : '전체 화면으로 보기'
                  }
                >
                  {isMapFullscreen ? (
                    <Minimize2 size={16} />
                  ) : (
                    <Maximize2 size={16} />
                  )}
                </button>
                <div className={styles.remoteDivider} />
                <button
                  type="button"
                  className={`${styles.remoteIconBtn} ${
                    showLegend ? styles.remoteIconBtnActive : ''
                  }`}
                  onClick={() => setShowLegend((prev) => !prev)}
                  title={showLegend ? '범례 숨기기' : '범례 보이기'}
                  aria-label={showLegend ? '범례 숨기기' : '범례 보이기'}
                  aria-pressed={showLegend}
                >
                  <Layers size={16} />
                </button>
                <div className={styles.remoteDivider} />
                <button
                  type="button"
                  className={styles.remoteIconBtn}
                  onClick={() => handleZoomByFactor(1.25)}
                  disabled={mapZoom >= MAX_MAP_ZOOM}
                  title="지도 확대"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  className={styles.remoteIconBtn}
                  onClick={() => handleZoomByFactor(1 / 1.25)}
                  disabled={mapZoom <= MIN_MAP_ZOOM}
                  title="지도 축소"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  className={styles.remoteIconBtn}
                  onClick={handleResetMapZoom}
                  disabled={mapZoom === 1 && mapPan.x === 0 && mapPan.y === 0}
                  title="지도 배율·위치 초기화"
                >
                  <RotateCcw size={15} />
                </button>
              </div>

              {/* 우하단 지도 내 수영장 분류 범례 */}
              {showLegend && (
                <aside
                  className={styles.poolMapLegendOverlay}
                  data-map-ui="true"
                  aria-label="수영장 분류 범례"
                >
                  <span className={styles.poolDotLegendItem}>
                    <span className={styles.poolDotSwatch50Hosted} />
                    50m 대회개최 경기장
                  </span>
                  <span className={styles.poolDotLegendItem}>
                    <span className={styles.poolDotSwatch50} />
                    50m 정규풀
                  </span>
                  <span className={styles.poolDotLegendItem}>
                    <span className={styles.poolDotSwatch25} />
                    25m 수영장
                  </span>
                </aside>
              )}

              {mapProjection && municipalitiesGeo ? (
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                  className={styles.twoLevelSvgMap}
                  role="img"
                  aria-label="전국 수영장 위치 점 표시 지도"
                >
                  <g
                    transform={`translate(${SVG_WIDTH / 2 + mapPan.x}, ${
                      SVG_HEIGHT / 2 + mapPan.y
                    }) scale(${mapZoom}) translate(${-SVG_WIDTH / 2}, ${
                      -SVG_HEIGHT / 2
                    })`}
                  >
                    {/* 2단계 시·군·구 배경 폴리곤 */}
                    <g>
                      {municipalitiesGeo.features.map((feat) => {
                        const d = mapProjection.geometryToSvgPath(feat.geometry);
                        const invScale = Math.pow(mapZoom, 0.65);
                        return (
                          <path
                            key={feat.properties.kostatCode}
                            d={d}
                            fill="#f8fafc"
                            stroke="#cbd5e1"
                            strokeWidth={0.45 / invScale}
                          />
                        );
                      })}
                    </g>

                    {/* 1단계 17개 시·도 경계선 */}
                    {provincesGeo && (
                      <g pointerEvents="none">
                        {provincesGeo.features.map((prov) => (
                          <path
                            key={`prov-pool-${prov.properties.kostatCode}`}
                            d={mapProjection.geometryToSvgPath(prov.geometry)}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth={1.0 / Math.pow(mapZoom, 0.65)}
                            strokeOpacity={0.7}
                          />
                        ))}
                      </g>
                    )}

                    {/* 수영장 위치 점(Dot) 오버레이 (25m 먼저 그리고 50m 및 대회개최 수영장을 위에 렌더링) */}
                    <g>
                      {[...filteredSwimmingPools]
                        .sort((a, b) => {
                          if (a.courseLength !== b.courseLength) {
                            return a.courseLength === '50m' ? 1 : -1;
                          }
                          return a.totalEventCount - b.totalEventCount;
                        })
                        .map((pool) => {
                          if (!pool.mapX || !pool.mapY) return null;
                          const [px, py] = mapProjection.projectPoint(
                            pool.mapX,
                            pool.mapY
                          );
                          const invScale = Math.pow(mapZoom, 0.6);
                          const isSelected = selectedPoolIdOnMap === pool.id;
                          const isHosted50m =
                            pool.courseLength === '50m' && pool.totalEventCount > 0;
                          const is50m = pool.courseLength === '50m';

                          const baseR = isSelected
                            ? 6.2
                            : isHosted50m
                              ? 4.6
                              : is50m
                                ? 3.8
                                : 2.6;
                          const fill = isHosted50m
                            ? '#dc2626'
                            : is50m
                              ? '#1d4ed8'
                              : '#059669';

                          return (
                            <circle
                              key={`dot-${pool.id}`}
                              cx={px}
                              cy={py}
                              r={baseR / invScale}
                              fill={fill}
                              fillOpacity={is50m ? 0.92 : 0.78}
                              stroke={isSelected ? '#facc15' : '#ffffff'}
                              strokeWidth={(isSelected ? 2.2 : 0.9) / invScale}
                              className={styles.poolMapDot}
                              onMouseEnter={() => setHoveredPoolOnMap(pool)}
                              onMouseLeave={() => setHoveredPoolOnMap(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPoolIdOnMap(pool.id);
                                const rowEl = poolRowRefs.current[pool.id];
                                if (rowEl) {
                                  rowEl.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center',
                                  });
                                }
                              }}
                            />
                          );
                        })}
                    </g>
                  </g>
                </svg>
              ) : (
                <div className={styles.mapLoadingText}>
                  전국 수영장 위치 지도를 불러오는 중입니다...
                </div>
              )}
            </div>
          </section>

          {/* 지도 하단: 수영장 일람 표 연동 */}
          <section
            className={styles.weeklyBottomScrollPane}
            aria-label="수영장 일람 표"
          >
            {renderPoolsTable()}
          </section>
        </div>
      )}

      {/* 0-C. 수영 새소식 대시보드 (viewMode === 'SWIM_NEWS': ① 지금 등록중인 대회 · ② 곧 등록을 시작하는 대회 · ③ 새로 올라온 업데이트 타임라인) */}
      {isSwimNewsMode && (
        <section
          className={styles.swimNewsDashboard}
          aria-label="수영 대회 새소식 및 참가접수 현황 대시보드"
        >
          {/* 상단 새소식 배너 & 빠른 섹션 필터 */}
          <div className={styles.swimNewsHeroBar}>
            <div className={styles.swimNewsHeroLeft}>
              <div className={styles.swimNewsTitleRow}>
                <span className={styles.swimNewsBellChip}>
                  <Bell size={15} />
                  <span>수영 새소식</span>
                </span>
                <h2 className={styles.swimNewsHeading}>
                  전국 수영대회 참가접수 현황 &amp; 신규 업데이트 알림판
                </h2>
              </div>
              <p className={styles.swimNewsSubDesc}>
                대한수영연맹 · 전국 17개 시도수영연맹 · 공식 밴드 · SFINDER · 50m 경기장 공지를 추적하여{' '}
                <strong>지금 등록중인 대회</strong>, <strong>곧 등록을 시작하는 대회</strong>,{' '}
                <strong>새로 올라온 업데이트 시각</strong>을 한눈에 안내합니다.
              </p>
            </div>

            <div className={styles.swimNewsSyncBox}>
              <span className={styles.swimNewsSyncLabel}>
                <Clock size={13} />
                최종 크롤링·업데이트 확인
              </span>
              <strong className={styles.swimNewsSyncTime}>
                {swimNewsData.latestUpdateFormatted}
              </strong>
            </div>
          </div>

          {/* 상단 섹션 바로가기 & 카운트 요약 탭 */}
          <div className={styles.swimNewsFilterToolbar}>
            <div className={styles.swimNewsSectionTabs} role="tablist" aria-label="새소식 섹션 필터">
              <button
                type="button"
                role="tab"
                aria-selected={newsSectionFilter === 'ALL'}
                className={`${styles.swimNewsTabBtn} ${
                  newsSectionFilter === 'ALL' ? styles.swimNewsTabBtnActive : ''
                }`}
                onClick={() => setNewsSectionFilter('ALL')}
              >
                <span>전체 대시보드 한눈에 보기</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={newsSectionFilter === 'OPEN'}
                className={`${styles.swimNewsTabBtn} ${
                  newsSectionFilter === 'OPEN' ? styles.swimNewsTabBtnOpenActive : ''
                }`}
                onClick={() => setNewsSectionFilter('OPEN')}
              >
                <span className={styles.statusDotOpen} />
                <span>지금 등록중</span>
                <span className={styles.swimNewsTabCountOpen}>
                  {swimNewsData.openEvents.length}건
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={newsSectionFilter === 'UPCOMING'}
                className={`${styles.swimNewsTabBtn} ${
                  newsSectionFilter === 'UPCOMING'
                    ? styles.swimNewsTabBtnUpcomingActive
                    : ''
                }`}
                onClick={() => setNewsSectionFilter('UPCOMING')}
              >
                <span className={styles.statusDotUpcoming} />
                <span>곧 등록 시작</span>
                <span className={styles.swimNewsTabCountUpcoming}>
                  {swimNewsData.upcomingEvents.length}건
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={newsSectionFilter === 'UPDATES'}
                className={`${styles.swimNewsTabBtn} ${
                  newsSectionFilter === 'UPDATES'
                    ? styles.swimNewsTabBtnUpdatesActive
                    : ''
                }`}
                onClick={() => setNewsSectionFilter('UPDATES')}
              >
                <span>🆕 새로 올라온 업데이트</span>
                <span className={styles.swimNewsTabCountUpdates}>
                  {swimNewsData.filteredUpdates.length}건
                </span>
              </button>
            </div>
          </div>

          {/* ① 지금 등록(접수)중인 수영 대회 섹션 */}
          {(newsSectionFilter === 'ALL' || newsSectionFilter === 'OPEN') && (
            <div className={styles.swimNewsSectionCard}>
              <div className={styles.swimNewsSectionHeader}>
                <div className={styles.swimNewsSectionTitleWrap}>
                  <span className={styles.swimNewsSectionBadgeOpen}>LIVE 접수중</span>
                  <h3 className={styles.swimNewsSectionTitle}>
                    지금 등록(참가접수)중인 수영 대회
                  </h3>
                  <span className={styles.swimNewsSectionCount}>
                    {swimNewsData.openEvents.length}건
                  </span>
                </div>
                <span className={styles.swimNewsSectionHint}>
                  선착순 마감 대회는 정원 도달 시 조기 마감될 수 있습니다
                </span>
              </div>

              {swimNewsData.openEvents.length === 0 ? (
                <div className={styles.swimNewsEmptyBox}>
                  현재 참가접수가 진행중인 수영 대회가 없습니다.
                </div>
              ) : (
                <div className={styles.swimNewsGrid}>
                  {swimNewsData.openEvents.map(({ ev, regInfo }) => {
                    const specificLinks = (ev.links || []).filter((lnk) =>
                      isSpecificEventLink(lnk.url, lnk.label)
                    );
                    const updatedStr = formatIsoTimestampKst(
                      ev.updatedAt || ev.firstSeenAt
                    );
                    const publishedStr = formatYmdDotShort(ev.publishedAt);

                    return (
                      <article
                        key={`open-${ev.id}`}
                        className={`${styles.swimNewsItemCard} ${styles.swimNewsItemCardOpen}`}
                        onClick={() => onSelectEvent(ev)}
                      >
                        <div className={styles.swimNewsCardTopRow}>
                          <div className={styles.swimNewsBadgeGroup}>
                            <span className={styles.regBadgeOpen}>
                              🟢 {regInfo.badgeText}
                            </span>
                            {regInfo.dDayText && (
                              <span className={styles.dDayChipOpen}>
                                ⏰ {regInfo.dDayText}
                              </span>
                            )}
                            <span className={SCOPE_PILL_CLASS[ev.promoLevel]}>
                              {PROMO_LEVEL_SHORT_LABELS[ev.promoLevel]}
                            </span>
                            {regInfo.quotaNote && (
                              <span className={styles.quotaChip}>
                                👥 {regInfo.quotaNote}
                              </span>
                            )}
                          </div>
                          {updatedStr && (
                            <span className={styles.updateTimeChip}>
                              업데이트 {updatedStr}
                            </span>
                          )}
                        </div>

                        <h4 className={styles.swimNewsCardTitle}>{ev.title}</h4>

                        {/* 접수기간 · 접수방법 강조 박스 */}
                        <div className={styles.regHighlightBoxOpen}>
                          <div className={styles.regHighlightRow}>
                            <span className={styles.regHighlightLabel}>접수기간</span>
                            <strong className={styles.regHighlightValue}>
                              {regInfo.periodDisplay}
                            </strong>
                          </div>
                          {regInfo.methodNote && (
                            <div className={styles.regHighlightRow}>
                              <span className={styles.regHighlightLabel}>접수방법</span>
                              <span className={styles.regHighlightMethod}>
                                {regInfo.methodNote}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className={styles.swimNewsCardFooter}>
                          <div className={styles.metaGroup}>
                            <span className={styles.metaItem}>
                              <Calendar size={13} />
                              <span>
                                대회일: <strong>{formatYmdRange(ev.startDate, ev.endDate)}</strong>
                              </span>
                            </span>
                            <span className={styles.metaItem}>
                              <MapPin size={13} />
                              <span>
                                <strong>[{getEventCityShortName(ev)}]</strong>{' '}
                                {ev.addr1 || `${ev.regionName} ${ev.sigunguName}`}
                              </span>
                            </span>
                            {publishedStr && (
                              <span className={styles.metaItem}>
                                <span>공지일: {publishedStr}</span>
                              </span>
                            )}
                          </div>

                          <div
                            className={styles.swimNewsActionLinks}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {regInfo.registrationUrl && (
                              <a
                                href={regInfo.registrationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.regDirectBtnOpen}
                              >
                                <span>신청·공지 바로가기</span>
                                <ExternalLink size={13} />
                              </a>
                            )}
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
                                    isRedAttachment ? styles.linkIconBtnRed : ''
                                  }`}
                                  title={lnk.label}
                                  aria-label={lnk.label}
                                >
                                  {renderLinkIcon(lnk)}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ② 곧 등록(접수)을 시작하는 수영 대회 섹션 */}
          {(newsSectionFilter === 'ALL' || newsSectionFilter === 'UPCOMING') && (
            <div className={styles.swimNewsSectionCard}>
              <div className={styles.swimNewsSectionHeader}>
                <div className={styles.swimNewsSectionTitleWrap}>
                  <span className={styles.swimNewsSectionBadgeUpcoming}>
                    오픈 예정
                  </span>
                  <h3 className={styles.swimNewsSectionTitle}>
                    곧 등록(참가접수)을 시작하는 수영 대회
                  </h3>
                  <span className={styles.swimNewsSectionCount}>
                    {swimNewsData.upcomingEvents.length}건
                  </span>
                </div>
                <span className={styles.swimNewsSectionHint}>
                  접수 시작 시각과 사전 준비사항(밴드 가입·신청서 양식 등)을 미리 확인하세요
                </span>
              </div>

              {swimNewsData.upcomingEvents.length === 0 ? (
                <div className={styles.swimNewsEmptyBox}>
                  현재 접수 시작 예정인 수영 대회가 없습니다.
                </div>
              ) : (
                <div className={styles.swimNewsGrid}>
                  {swimNewsData.upcomingEvents.map(({ ev, regInfo }) => {
                    const specificLinks = (ev.links || []).filter((lnk) =>
                      isSpecificEventLink(lnk.url, lnk.label)
                    );
                    const updatedStr = formatIsoTimestampKst(
                      ev.updatedAt || ev.firstSeenAt
                    );
                    const publishedStr = formatYmdDotShort(ev.publishedAt);

                    return (
                      <article
                        key={`upcoming-${ev.id}`}
                        className={`${styles.swimNewsItemCard} ${styles.swimNewsItemCardUpcoming}`}
                        onClick={() => onSelectEvent(ev)}
                      >
                        <div className={styles.swimNewsCardTopRow}>
                          <div className={styles.swimNewsBadgeGroup}>
                            <span className={styles.regBadgeUpcoming}>
                              🟡 {regInfo.badgeText}
                            </span>
                            {regInfo.dDayText && (
                              <span className={styles.dDayChipUpcoming}>
                                ⏳ {regInfo.dDayText}
                              </span>
                            )}
                            <span className={SCOPE_PILL_CLASS[ev.promoLevel]}>
                              {PROMO_LEVEL_SHORT_LABELS[ev.promoLevel]}
                            </span>
                            {regInfo.quotaNote && (
                              <span className={styles.quotaChip}>
                                👥 {regInfo.quotaNote}
                              </span>
                            )}
                          </div>
                          {updatedStr && (
                            <span className={styles.updateTimeChip}>
                              업데이트 {updatedStr}
                            </span>
                          )}
                        </div>

                        <h4 className={styles.swimNewsCardTitle}>{ev.title}</h4>

                        {/* 접수기간 · 접수방법 강조 박스 */}
                        <div className={styles.regHighlightBoxUpcoming}>
                          <div className={styles.regHighlightRow}>
                            <span className={styles.regHighlightLabel}>접수오픈</span>
                            <strong className={styles.regHighlightValue}>
                              {regInfo.periodDisplay}
                            </strong>
                          </div>
                          {regInfo.methodNote && (
                            <div className={styles.regHighlightRow}>
                              <span className={styles.regHighlightLabel}>접수방법</span>
                              <span className={styles.regHighlightMethod}>
                                {regInfo.methodNote}
                              </span>
                            </div>
                          )}
                        </div>

                        {ev.updateSummary && (
                          <p className={styles.swimNewsUpdateNote}>
                            💡 {ev.updateSummary}
                          </p>
                        )}

                        <div className={styles.swimNewsCardFooter}>
                          <div className={styles.metaGroup}>
                            <span className={styles.metaItem}>
                              <Calendar size={13} />
                              <span>
                                대회일: <strong>{formatYmdRange(ev.startDate, ev.endDate)}</strong>
                              </span>
                            </span>
                            <span className={styles.metaItem}>
                              <MapPin size={13} />
                              <span>
                                <strong>[{getEventCityShortName(ev)}]</strong>{' '}
                                {ev.addr1 || `${ev.regionName} ${ev.sigunguName}`}
                              </span>
                            </span>
                            {publishedStr && (
                              <span className={styles.metaItem}>
                                <span>공지일: {publishedStr}</span>
                              </span>
                            )}
                          </div>

                          <div
                            className={styles.swimNewsActionLinks}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {regInfo.registrationUrl && (
                              <a
                                href={regInfo.registrationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.regDirectBtnUpcoming}
                              >
                                <span>공지·밴드 바로가기</span>
                                <ExternalLink size={13} />
                              </a>
                            )}
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
                                    isRedAttachment ? styles.linkIconBtnRed : ''
                                  }`}
                                  title={lnk.label}
                                  aria-label={lnk.label}
                                >
                                  {renderLinkIcon(lnk)}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ③ 새로 올라온 업데이트 & 공지 타임라인 섹션 */}
          {(newsSectionFilter === 'ALL' || newsSectionFilter === 'UPDATES') && (
            <div className={styles.swimNewsSectionCard}>
              <div className={styles.swimNewsSectionHeader}>
                <div className={styles.swimNewsSectionTitleWrap}>
                  <span className={styles.swimNewsSectionBadgeUpdates}>
                    NEW 업데이트 기록
                  </span>
                  <h3 className={styles.swimNewsSectionTitle}>
                    새로 올라온 수영 대회 업데이트 · 공지 타임라인
                  </h3>
                  <span className={styles.swimNewsSectionCount}>
                    {swimNewsData.filteredUpdates.length}건
                  </span>
                </div>

                {/* 기간 필터 버튼: 전체 최신순 | 최근 7일 | 최근 14일 | 최근 30일 */}
                <div
                  className={styles.updateRangeFilterGroup}
                  role="group"
                  aria-label="업데이트 기간 필터"
                >
                  {(
                    [
                      { key: 'ALL', label: '전체 최신순' },
                      { key: 7, label: '최근 7일' },
                      { key: 14, label: '최근 14일' },
                      { key: 30, label: '최근 30일' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={String(opt.key)}
                      type="button"
                      className={`${styles.updateRangeBtn} ${
                        newsUpdateRangeDays === opt.key
                          ? styles.updateRangeBtnActive
                          : ''
                      }`}
                      onClick={() => setNewsUpdateRangeDays(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {swimNewsData.filteredUpdates.length === 0 ? (
                <div className={styles.swimNewsEmptyBox}>
                  선택한 기간(최근 {newsUpdateRangeDays}일) 내에 새로 업데이트된 수영 대회가 없습니다.{' '}
                  <button
                    type="button"
                    className={styles.inlineResetLinkBtn}
                    onClick={() => setNewsUpdateRangeDays('ALL')}
                  >
                    전체 최신순 보기
                  </button>
                </div>
              ) : (
                <div className={styles.swimUpdateTimelineList}>
                  {swimNewsData.filteredUpdates.map(({ ev, regInfo }) => {
                    const specificLinks = (ev.links || []).filter((lnk) =>
                      isSpecificEventLink(lnk.url, lnk.label)
                    );
                    const firstSeenStr = formatIsoTimestampKst(ev.firstSeenAt);
                    const updatedStr = formatIsoTimestampKst(ev.updatedAt);
                    const publishedStr = formatYmdDotShort(ev.publishedAt);

                    return (
                      <article
                        key={`upd-${ev.id}`}
                        className={styles.swimTimelineCard}
                        onClick={() => onSelectEvent(ev)}
                      >
                        <div className={styles.swimTimelineLeftMeta}>
                          <span className={styles.timelineTimestampPrimary}>
                            <Clock size={12} />
                            {updatedStr || firstSeenStr || publishedStr || '수집 완료'}
                          </span>
                          {firstSeenStr && firstSeenStr !== updatedStr && (
                            <span className={styles.timelineTimestampSub}>
                              최초 수집: {firstSeenStr}
                            </span>
                          )}
                          {publishedStr && (
                            <span className={styles.timelineTimestampSub}>
                              원문 공지일: {publishedStr}
                            </span>
                          )}
                        </div>

                        <div className={styles.swimTimelineMainBody}>
                          <div className={styles.swimNewsBadgeGroup}>
                            <span className={SCOPE_PILL_CLASS[ev.promoLevel]}>
                              {PROMO_LEVEL_SHORT_LABELS[ev.promoLevel]}
                            </span>
                            {regInfo.status === 'REGISTRATION_OPEN' && (
                              <span className={styles.regBadgeOpen}>
                                🟢 {regInfo.badgeText}
                                {regInfo.dDayText ? ` (${regInfo.dDayText})` : ''}
                              </span>
                            )}
                            {regInfo.status === 'REGISTRATION_UPCOMING' && (
                              <span className={styles.regBadgeUpcoming}>
                                🟡 {regInfo.badgeText}
                                {regInfo.dDayText ? ` (${regInfo.dDayText})` : ''}
                              </span>
                            )}
                            {regInfo.status === 'REGISTRATION_CLOSED' && (
                              <span className={styles.regBadgeClosed}>
                                ⚪ {regInfo.badgeText}
                              </span>
                            )}
                            {ev.organizer && (
                              <span className={styles.timelineOrganizerText}>
                                {ev.organizer}
                              </span>
                            )}
                          </div>

                          <h4 className={styles.swimTimelineTitle}>{ev.title}</h4>

                          <p className={styles.swimTimelineSummary}>
                            {ev.updateSummary || ev.invitation || ev.summary}
                          </p>

                          <div className={styles.metaGroup}>
                            <span className={styles.metaItem}>
                              <Calendar size={13} />
                              <span>
                                대회일: <strong>{formatYmdRange(ev.startDate, ev.endDate)}</strong>
                              </span>
                            </span>
                            <span className={styles.metaItem}>
                              <MapPin size={13} />
                              <span>
                                <strong>[{getEventCityShortName(ev)}]</strong>{' '}
                                {ev.addr1 || `${ev.regionName} ${ev.sigunguName}`}
                              </span>
                            </span>
                            {regInfo.periodDisplay && (
                              <span className={styles.metaItem}>
                                <span>
                                  접수기간: <strong>{regInfo.periodDisplay}</strong>
                                </span>
                              </span>
                            )}
                          </div>
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
                                    isRedAttachment ? styles.linkIconBtnRed : ''
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
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 1. 목록보기 ("세계/대한연맹", "광역시도", "시군구", "동네" 클릭 시 펼치기/접기 애니메이션) */}
      {!isSpecialSwimSubView && viewMode === 'LIST' && (
        <>
          {scopeGroups.length === 0 ? (
            <div className={styles.emptyState}>
              현재 선택한 필터 조건에 해당하는 {sportLabel} 대회가 없습니다. (상단 필터에서 범위·연도·월 선택을 확인해 보세요)
            </div>
          ) : (
            scopeGroups.map((group) => {
              const isExpanded = expandedScopes[group.level];
              return (
                <section
                  key={group.level}
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
                            const formatLabels = getSpecialPromoFormatShortLabels(
                              sport,
                              ev
                            );
                            const swimRegInfo =
                              sport === 'SWIMMING'
                                ? computeSwimRegistrationInfo(ev, todayYmd, todayMs)
                                : null;
                            const swimUpdatedStr =
                              sport === 'SWIMMING'
                                ? formatIsoTimestampKst(
                                    ev.updatedAt || ev.firstSeenAt
                                  ) || formatYmdDotShort(ev.publishedAt)
                                : '';

                            return (
                              <article
                                key={ev.id}
                                className={`${styles.card} ${SCOPE_CARD_CLASS[ev.promoLevel]}`}
                                onClick={() => onSelectEvent(ev)}
                              >
                                {/* 1행: 범위 배지 + 행사 형태 배지 + 참가접수 배지(수영) + 제목 <---> 주최 */}
                                <div className={styles.rowBetween}>
                                  <div className={styles.titleRow}>
                                    <span className={SCOPE_PILL_CLASS[ev.promoLevel]}>
                                      {PROMO_LEVEL_SHORT_LABELS[ev.promoLevel]}
                                    </span>
                                    {formatLabels.map((fmtLabel) => (
                                      <span
                                        key={fmtLabel}
                                        className={styles.formatBadge}
                                      >
                                        {fmtLabel}
                                      </span>
                                    ))}
                                    {swimRegInfo?.status === 'REGISTRATION_OPEN' && (
                                      <span className={styles.regBadgeOpen}>
                                        🟢 {swimRegInfo.badgeText}
                                        {swimRegInfo.dDayText
                                          ? ` (${swimRegInfo.dDayText})`
                                          : ''}
                                      </span>
                                    )}
                                    {swimRegInfo?.status ===
                                      'REGISTRATION_UPCOMING' && (
                                      <span className={styles.regBadgeUpcoming}>
                                        🟡 {swimRegInfo.badgeText}
                                        {swimRegInfo.dDayText
                                          ? ` (${swimRegInfo.dDayText})`
                                          : ''}
                                      </span>
                                    )}
                                    {swimRegInfo?.status ===
                                      'REGISTRATION_CLOSED' && (
                                      <span className={styles.regBadgeClosed}>
                                        ⚪ {swimRegInfo.badgeText}
                                      </span>
                                    )}
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

                                {/* 3행: 위치/날짜/접수기간/업데이트시각 <---> 구체적 이벤트 공지·홍보 링크 & 붉은색 모집공고(PDF/HWP) 아이콘 */}
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
                                    {swimRegInfo?.periodDisplay && (
                                      <span className={styles.metaItem}>
                                        <span>
                                          접수: <strong>{swimRegInfo.periodDisplay}</strong>
                                        </span>
                                      </span>
                                    )}
                                    {swimUpdatedStr && (
                                      <span className={styles.metaItem}>
                                        <Clock size={12} />
                                        <span>업데이트: {swimUpdatedStr}</span>
                                      </span>
                                    )}
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
              );
            })
          )}
        </>
      )}

      {/* 2. 달력보기: 기존의 달력보기(일 ~ 월, EventCalendarView) 그대로 표시 */}
      {!isSpecialSwimSubView && viewMode === 'CALENDAR' && (
        <EventCalendarView
          events={sportEvents}
          displayOptions={calendarOptions}
          targetYear={activeCalendarYear}
          onSelectEvent={onSelectEvent}
          onChangeDisplayOptions={onChangeCalendarOptions}
        />
      )}

      {/* 3. 지도보기: 상단 고정 2단계 전국 행정지도 + 하단 주차별 보기 리스트 (1열: 주차, 2열: 행사) */}
      {!isSpecialSwimSubView && viewMode === 'MAP' && (
        <div className={styles.specialMapLayout}>
          {/* 상단 고정: 전국 2단계 시·군·구(250개) + 1단계 시·도(17개) 행정지도 */}
          <section
            className={`${styles.mapTopFixedPane} ${
              isMapFullscreen ? styles.mapTopFixedPaneFullscreen : ''
            }`}
            aria-label="전국 2단계 행정지도"
          >
            <div className={styles.mapTopBarInfo}>
              <div className={styles.activeWeekBanner}>
                <span className={styles.activeWeekPill}>
                  {activeWeekRow ? activeWeekRow.label : ''}
                </span>
                {activeWeekRow?.containsToday && (
                  <span className={styles.todayWeekTag}>오늘 포함 주</span>
                )}
                <span className={styles.keyGuideText}>
                  ⌨️ 키보드 <strong>↑ / ↓ 방향키</strong>로 주차 이동 · 🖱️ 지도{' '}
                  <strong>위/아래 스크롤</strong>로 확대/축소 · 드래그로 이동
                </span>
              </div>

              <div className={styles.zoomStatusBadge}>
                배율 <strong>{Math.round(mapZoom * 100)}%</strong>
              </div>
            </div>

            <div
              ref={mapCanvasRef}
              className={`${styles.mapCanvasWrap} ${
                isDraggingMap ? styles.mapCanvasDragging : ''
              } ${isMapFullscreen ? styles.mapCanvasWrapFullscreen : ''}`}
              onMouseDown={handleMapMouseDown}
              onMouseMove={handleMapMouseMove}
              onMouseUp={handleMapMouseUp}
              onMouseLeave={() => {
                setIsDraggingMap(false);
                setHoveredFeature(null);
              }}
            >
              {/* 좌상단 호버 툴팁 */}
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
                      return <span>표시 설정된 전후 3주 내 {sportLabel} 대회 없음</span>;
                    }
                    return (
                      <>
                        <span className={styles.tooltipDiffTag}>
                          기준 표시: {getDiffBadgeText(info.diff, legendConfigs)}
                        </span>
                        <span>대표 대회: {info.primaryEvent.title}</span>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 우상단 지도 리모콘: 전체 화면 + 범례 보이기/숨기기 + 확대/축소/초기화 */}
              <div
                className={styles.mapRemoteControl}
                data-map-ui="true"
                role="toolbar"
                aria-label="지도 리모콘"
              >
                <button
                  type="button"
                  className={`${styles.remoteIconBtn} ${
                    isMapFullscreen ? styles.remoteIconBtnActive : ''
                  }`}
                  onClick={() => setIsMapFullscreen((prev) => !prev)}
                  title={
                    isMapFullscreen ? '전체 화면 종료 (ESC)' : '전체 화면으로 보기'
                  }
                  aria-label={
                    isMapFullscreen ? '전체 화면 종료' : '전체 화면으로 보기'
                  }
                >
                  {isMapFullscreen ? (
                    <Minimize2 size={16} />
                  ) : (
                    <Maximize2 size={16} />
                  )}
                </button>
                <div className={styles.remoteDivider} />
                <button
                  type="button"
                  className={`${styles.remoteIconBtn} ${
                    showLegend ? styles.remoteIconBtnActive : ''
                  }`}
                  onClick={() => setShowLegend((prev) => !prev)}
                  title={showLegend ? '범례 숨기기' : '범례 보이기'}
                  aria-label={showLegend ? '범례 숨기기' : '범례 보이기'}
                  aria-pressed={showLegend}
                >
                  <Layers size={16} />
                </button>
                <div className={styles.remoteDivider} />
                <button
                  type="button"
                  className={styles.remoteIconBtn}
                  onClick={() => handleZoomByFactor(1.25)}
                  disabled={mapZoom >= MAX_MAP_ZOOM}
                  title="지도 확대 (마우스 휠 위로 스크롤)"
                  aria-label="지도 확대"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  className={styles.remoteIconBtn}
                  onClick={() => handleZoomByFactor(1 / 1.25)}
                  disabled={mapZoom <= MIN_MAP_ZOOM}
                  title="지도 축소 (마우스 휠 아래로 스크롤)"
                  aria-label="지도 축소"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  className={styles.remoteIconBtn}
                  onClick={handleResetMapZoom}
                  disabled={mapZoom === 1 && mapPan.x === 0 && mapPan.y === 0}
                  title="지도 배율·위치 초기화 (100%)"
                  aria-label="지도 배율·위치 초기화"
                >
                  <RotateCcw size={15} />
                </button>
              </div>

              {/* 우하단 범례: 3주전, 2주전, 1주전, 이번주, 1주후, 2주후, 3주후 표시여부 및 % 조절 */}
              {showLegend && (
                <aside
                  className={styles.mapLegendFloatingBox}
                  data-map-ui="true"
                  aria-label="주차별 표시 및 농도 범례"
                >
                  <div className={styles.legendBoxHeader}>
                    <span className={styles.legendBoxTitle}>주차별 범례 (표시 · %)</span>
                    <button
                      type="button"
                      className={styles.legendResetBtn}
                      onClick={resetLegendConfigs}
                      title="범례 표시여부 및 % 기본값 복원"
                    >
                      초기화
                    </button>
                  </div>

                  <div className={styles.legendRowsList}>
                    {WEEK_DIFF_ORDER.map((diff) => {
                      const item = legendConfigs[diff];
                      const swatchBg = item.enabled
                        ? getDiffFillColor(diff, legendConfigs)
                        : '#f1f5f9';

                      return (
                        <div
                          key={diff}
                          className={`${styles.legendItemRow} ${
                            !item.enabled ? styles.legendItemRowDisabled : ''
                          } ${diff === 0 ? styles.legendItemRowCurrent : ''}`}
                        >
                          <label className={styles.legendCheckLabel}>
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              onChange={() => toggleLegendDiffEnabled(diff)}
                              className={styles.legendCheckbox}
                            />
                            <span
                              className={styles.legendColorSwatch}
                              style={{
                                background: swatchBg,
                                borderColor:
                                  item.colorTone === 'red' ? '#dc2626' : '#2563eb',
                              }}
                            />
                            <span className={styles.legendDiffName}>{item.label}</span>
                          </label>

                          <div className={styles.legendPctControls}>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={item.opacityPct}
                              disabled={!item.enabled}
                              onChange={(e) =>
                                updateLegendDiffOpacity(diff, Number(e.target.value))
                              }
                              className={styles.legendRangeInput}
                              aria-label={`${item.label} 농도 슬라이더`}
                            />
                            <div className={styles.legendPctNumberWrap}>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={5}
                                value={item.opacityPct}
                                disabled={!item.enabled}
                                onChange={(e) =>
                                  updateLegendDiffOpacity(diff, Number(e.target.value))
                                }
                                className={styles.legendPctNumberInput}
                                aria-label={`${item.label} 농도 퍼센트`}
                              />
                              <span className={styles.legendPctUnit}>%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              )}

              {mapProjection && municipalitiesGeo ? (
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                  className={styles.twoLevelSvgMap}
                  role="img"
                  aria-label="전국 2단계 시군구 행정지도"
                >
                  <g
                    transform={`translate(${SVG_WIDTH / 2 + mapPan.x}, ${
                      SVG_HEIGHT / 2 + mapPan.y
                    }) scale(${mapZoom}) translate(${-SVG_WIDTH / 2}, ${
                      -SVG_HEIGHT / 2
                    })`}
                  >
                    {/* 2단계 전국 250개 시·군·구 폴리곤 한번에 렌더링 */}
                    <g>
                      {municipalitiesGeo.features.map((feat) => {
                        const info = muniHighlightByKostatCode.get(
                          feat.properties.kostatCode
                        );
                        const fill = info
                          ? getDiffFillColor(info.diff, legendConfigs)
                          : '#f8fafc';
                        const isCurrentWeekRed = info?.diff === 0;
                        const d = mapProjection.geometryToSvgPath(feat.geometry);
                        const invScale = Math.pow(mapZoom, 0.65);

                        return (
                          <path
                            key={feat.properties.kostatCode}
                            d={d}
                            fill={fill}
                            stroke={isCurrentWeekRed ? '#991b1b' : '#cbd5e1'}
                            strokeWidth={(isCurrentWeekRed ? 1.3 : 0.45) / invScale}
                            className={styles.muniPolygon}
                            onMouseEnter={() => setHoveredFeature(feat)}
                            onMouseLeave={() => setHoveredFeature(null)}
                            onClick={() => {
                              if (dragStartRef.current?.moved) return;
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
                            strokeWidth={1.1 / Math.pow(mapZoom, 0.65)}
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
                        const invTextScale = Math.pow(mapZoom, 0.55);

                        return (
                          <text
                            key={`lbl-${feat.properties.kostatCode}`}
                            x={cx}
                            y={cy}
                            style={{
                              fontSize: `${(info.diff === 0 ? 9.5 : 8) / invTextScale}px`,
                              strokeWidth: `${(info.diff === 0 ? 2.8 : 2.2) / invTextScale}px`,
                            }}
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
                                이번주 (빨강 {legendConfigs[0].opacityPct}%)
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
                                {diff > 0
                                  ? `${diff}주후 (${legendConfigs[diff as WeekDiffOffset]?.opacityPct ?? 0}%)`
                                  : `${Math.abs(diff)}주전 (${legendConfigs[diff as WeekDiffOffset]?.opacityPct ?? 0}%)`}
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
