import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildDefaultSpecialPromoFormats,
  classifySpecialPromoEventFormats,
  isSpecialPromoFormatCode,
  matchesSpecialPromoMultiFormats,
  SPECIAL_PROMO_EVENT_FORMATS,
} from './constants/categories';
import { REGION_BY_ID } from './constants/regions';
import { matchesSportCategory } from './shared/promoPolicy';
import {
  buildInitialSeedFirestoreDocs,
  composeEventsWithFirestore,
  syncAndLoadFirestoreEvents,
  upsertFirestoreEventDoc,
} from './services/firebase';
import {
  fetchPortalFestivals,
  fetchSigunguCodes,
} from './services/korService2Api';
import {
  AdminPromoRegistryData,
  loadAdminPromoRegistry,
} from './services/promoEnrichmentService';
import {
  CalendarDisplayOptions,
  DbCrawlTabCategory,
  EventFilterState,
  FirestoreEventDoc,
  ListColumnVisibility,
  MainMenuView,
  MonthPeriodFilter,
  PoolFilterState,
  PromoLevel,
  ResponseFormatMode,
  SigunguItem,
  SpecialPromoSport,
  ViewMode,
  UnifiedEventItem,
} from './types/event';
import { getMergedSwimmingPoolsCatalog } from './constants/swimmingPools';
import { HeaderBar } from './components/HeaderBar';
import { SidebarDrawer } from './components/SidebarDrawer';
import { GeoFeature, KoreaAdminMap } from './components/KoreaAdminMap';
import { EventCardGrid } from './components/EventCardGrid';
import { EventCalendarView } from './components/EventCalendarView';
import { EventTableView } from './components/EventTableView';
import { PromoDirectoryView } from './components/PromoDirectoryView';
import { EventRegistrationView } from './components/EventRegistrationView';
import { SpecialPromoView } from './components/SpecialPromoView';
import { SettingsView } from './components/SettingsView';
import { SiteAboutView } from './components/SiteAboutView';
import { EventDetailModal } from './components/EventDetailModal';
import { MunicipalAdapterModal } from './components/MunicipalAdapterModal';
import {
  AbbreviationSettings,
  applyAbbreviation,
  loadAbbreviationSettings,
  saveAbbreviationSettings,
} from './shared/abbreviation';
import styles from './App.module.css';

/** 올해 1월 1일 ~ 12월 31일 (YYYY-MM-DD) */
function currentYearRange(): { startDate: string; endDate: string } {
  const y = new Date().getFullYear();
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

/**
 * 월/기간 선택(전체, 상반기, 하반기, 1~4분기, 1~12월)에 따른 시작월~종료월(1~12) 범위 반환
 */
function getMonthRangeFromPeriod(period: MonthPeriodFilter): [number, number] {
  switch (period) {
    case 'H1':
      return [1, 6];
    case 'H2':
      return [7, 12];
    case 'Q1':
      return [1, 3];
    case 'Q2':
      return [4, 6];
    case 'Q3':
      return [7, 9];
    case 'Q4':
      return [10, 12];
    case 'M01':
      return [1, 1];
    case 'M02':
      return [2, 2];
    case 'M03':
      return [3, 3];
    case 'M04':
      return [4, 4];
    case 'M05':
      return [5, 5];
    case 'M06':
      return [6, 6];
    case 'M07':
      return [7, 7];
    case 'M08':
      return [8, 8];
    case 'M09':
      return [9, 9];
    case 'M10':
      return [10, 10];
    case 'M11':
      return [11, 11];
    case 'M12':
      return [12, 12];
    case 'ALL':
    default:
      return [1, 12];
  }
}

/**
 * 행사 일정(startDate ~ endDate, YYYYMMDD)이 선택한 연도(selectedYear) 및 월/기간(selectedMonthPeriod)과 겹치는지 판별
 */
function matchesYearAndMonthFilter(
  startYmd: string,
  endYmd: string,
  selectedYear: string,
  selectedMonthPeriod: MonthPeriodFilter
): boolean {
  const s = (startYmd || '').replace(/[^0-9]/g, '').slice(0, 8);
  const e = (endYmd || s).replace(/[^0-9]/g, '').slice(0, 8);
  if (s.length < 8) return true;

  const sy = Number(s.slice(0, 4));
  const sm = Number(s.slice(4, 6));
  const ey = Number((e.length >= 8 ? e : s).slice(0, 4));
  const em = Number((e.length >= 8 ? e : s).slice(4, 6));

  const [targetMStart, targetMEnd] = getMonthRangeFromPeriod(selectedMonthPeriod);

  if (selectedYear !== 'ALL') {
    const targetYr = Number(selectedYear);
    if (sy > targetYr || ey < targetYr) {
      return false;
    }
    if (selectedMonthPeriod === 'ALL') {
      return true;
    }
    const effStartM = sy < targetYr ? 1 : sm;
    const effEndM = ey > targetYr ? 12 : em;
    return effStartM <= targetMEnd && effEndM >= targetMStart;
  }

  // 연도가 '전체(ALL)'이고 특정 월/반기/분기가 선택된 경우
  if (selectedMonthPeriod !== 'ALL') {
    if (ey > sy) {
      return true;
    }
    return sm <= targetMEnd && em >= targetMStart;
  }

  return true;
}

const REGION_SHORT_ALIAS_MAP: Record<string, string> = {
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  경기: '경기도',
  강원: '강원특별자치도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전북특별자치도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주특별자치도',
};

function parseUrlInitialState(): {
  menu: MainMenuView;
  sport: SpecialPromoSport;
  dbTab: DbCrawlTabCategory;
  specialViewMode: ViewMode;
  poolFilters: PoolFilterState;
  year?: string;
  month?: MonthPeriodFilter;
  regionId?: string;
  sigunguCode?: string;
  majorCategory?: EventFilterState['majorCategory'];
  subCategory?: string;
  statusLevels?: EventFilterState['statusLevels'];
  source?: EventFilterState['source'];
  scopeLevels?: Record<PromoLevel, boolean>;
  keyword?: string;
} {
  const params = new URLSearchParams(window.location.search);

  const rawMenu = (params.get('menu') || '').trim().toUpperCase();
  const rawSport = (params.get('sport') || '').trim().toUpperCase();
  const rawDbTab = (params.get('dbTab') || '').trim().toUpperCase();
  const rawView = (params.get('view') || '').trim().toUpperCase();
  const rawCourse = (params.get('course') || '').trim();
  const rawRegion = (params.get('region') || '').trim();
  const rawSigungu = (params.get('sigungu') || '').trim();
  const rawQ = (params.get('q') || params.get('keyword') || '').trim();

  let sport: SpecialPromoSport = 'SWIMMING';
  if (rawSport === 'RUNNING' || rawSport === 'MARATHON' || rawSport === '러닝' || rawSport === '마라톤') {
    sport = 'RUNNING';
  } else if (rawSport === 'CYCLING' || rawSport === 'BICYCLE' || rawSport === '자전거') {
    sport = 'CYCLING';
  } else if (rawSport === 'TRIATHLON' || rawSport === '철인' || rawSport === '철인3종') {
    sport = 'TRIATHLON';
  } else if (rawSport === 'SWIMMING' || rawSport === '수영') {
    sport = 'SWIMMING';
  }

  let dbTab: DbCrawlTabCategory = 'ALL';
  if (
    rawDbTab === 'MUNICIPAL' ||
    rawDbTab === 'SWIMMING' ||
    rawDbTab === 'RUNNING' ||
    rawDbTab === 'CYCLING' ||
    rawDbTab === 'TRIATHLON'
  ) {
    dbTab = rawDbTab;
  }

  let specialViewMode: ViewMode = 'CALENDAR';
  if (
    rawView === 'POOLS_MAP' ||
    rawView === 'POOL_MAP' ||
    rawView === '수영장지도' ||
    rawView === '수영장_지도'
  ) {
    specialViewMode = 'POOLS_MAP';
  } else if (
    rawView === 'POOLS' ||
    rawView === 'POOL' ||
    rawView === '수영장' ||
    rawView === '수영장일람'
  ) {
    specialViewMode = 'POOLS';
  } else if (rawView === 'MAP' || rawView === '지도') {
    specialViewMode = 'MAP';
  } else if (rawView === 'LIST' || rawView === '목록' || rawView === '일람') {
    specialViewMode = 'LIST';
  } else if (rawView === 'CALENDAR' || rawView === '달력') {
    specialViewMode = 'CALENDAR';
  }

  let menu: MainMenuView = 'MAP';
  if (
    rawMenu === 'SPECIAL_PROMO' ||
    rawMenu === 'SPECIAL' ||
    rawMenu === 'PROMO' ||
    rawMenu === '특별홍보관' ||
    rawSport !== '' ||
    specialViewMode === 'POOLS' ||
    specialViewMode === 'POOLS_MAP' ||
    rawCourse !== ''
  ) {
    menu = 'SPECIAL_PROMO';
  } else if (rawMenu === 'CALENDAR' || rawView === 'CALENDAR') {
    menu = 'CALENDAR';
  } else if (rawMenu === 'LIST' || rawView === 'LIST') {
    menu = 'LIST';
  } else if (rawMenu === 'PROMO_DIRECTORY') {
    menu = 'PROMO_DIRECTORY';
  } else if (rawMenu === 'EVENT_REGISTER' || rawMenu === 'EVENT_REGISTRATION') {
    menu = 'EVENT_REGISTER';
  } else if (rawMenu === 'SETTINGS') {
    menu = 'SETTINGS';
  } else if (rawMenu === 'ABOUT' || rawMenu === 'SITE_ABOUT') {
    menu = 'ABOUT';
  }

  let courses: PoolFilterState['courses'] = { '50m': true, '25m': true };
  const upperCourse = rawCourse.toUpperCase();
  if (upperCourse === 'NONE') {
    courses = { '50m': false, '25m': false };
  } else if (upperCourse && upperCourse !== 'ALL') {
    const has50 = upperCourse.includes('50');
    const has25 = upperCourse.includes('25');
    if (has50 || has25) {
      courses = { '50m': has50, '25m': has25 };
    }
  }

  const normalizedPoolRegion = rawRegion
    ? REGION_SHORT_ALIAS_MAP[rawRegion] || rawRegion
    : 'ALL';

  const rawScopes = (params.get('scopes') || '').trim();
  let scopeLevels: Record<PromoLevel, boolean> | undefined;
  if (rawScopes) {
    const parts = new Set(rawScopes.split(',').map((s) => Number(s.trim())));
    scopeLevels = {
      3: parts.has(3),
      2: parts.has(2),
      1: parts.has(1),
      0: parts.has(0),
    };
  }

  const rawStatus = (params.get('status') || '').trim().toUpperCase();
  let statusLevels: EventFilterState['statusLevels'] | undefined;
  if (rawStatus && rawStatus !== 'ALL') {
    if (rawStatus === 'NONE') {
      statusLevels = { ONGOING: false, UPCOMING: false, ENDED: false };
    } else {
      const parts = new Set(rawStatus.split(',').map((s) => s.trim()));
      statusLevels = {
        ONGOING: parts.has('ONGOING'),
        UPCOMING: parts.has('UPCOMING'),
        ENDED: parts.has('ENDED'),
      };
    }
  }

  return {
    menu,
    sport,
    dbTab,
    specialViewMode,
    poolFilters: {
      regionName: normalizedPoolRegion || 'ALL',
      sigunguName: rawSigungu || 'ALL',
      courses,
      keyword: rawQ,
    },
    year: params.get('year') || undefined,
    month: (params.get('month') as MonthPeriodFilter) || undefined,
    regionId: params.get('regionId') || undefined,
    sigunguCode: params.get('sigunguCode') || undefined,
    majorCategory: (params.get('cat') as EventFilterState['majorCategory']) || undefined,
    subCategory: params.get('subCat') || undefined,
    statusLevels,
    source: (params.get('source') as EventFilterState['source']) || undefined,
    scopeLevels,
    keyword: rawQ || undefined,
  };
}

export const App: React.FC = () => {
  const initialUrlState = useMemo(() => parseUrlInitialState(), []);

  const [activeMenu, setActiveMenu] = useState<MainMenuView>(initialUrlState.menu);
  const [previousMenu, setPreviousMenu] = useState<MainMenuView>(initialUrlState.menu);
  const [activeSport, setActiveSport] = useState<SpecialPromoSport>(
    initialUrlState.sport
  );
  const [activeDbTab, setActiveDbTab] = useState<DbCrawlTabCategory>(
    initialUrlState.dbTab
  );
  const [specialPromoViewMode, setSpecialPromoViewMode] = useState<ViewMode>(
    initialUrlState.specialViewMode
  );
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const [abbrSettings, setAbbrSettings] = useState<AbbreviationSettings>(() =>
    loadAbbreviationSettings()
  );

  const handleChangeAbbrSettings = useCallback((next: AbbreviationSettings) => {
    setAbbrSettings(next);
    saveAbbreviationSettings(next);
  }, []);

  const handleToggleAbbreviation = useCallback(() => {
    setAbbrSettings((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      saveAbbreviationSettings(next);
      return next;
    });
  }, []);

  const handleSelectMenuWithHistory = useCallback(
    (nextMenu: MainMenuView) => {
      if (nextMenu === 'SETTINGS' && activeMenu !== 'SETTINGS') {
        setPreviousMenu(activeMenu);
      }
      setActiveMenu(nextMenu);
    },
    [activeMenu]
  );

  const activeAbbreviationRuleCount = useMemo(() => {
    return (
      abbrSettings.regexRules.filter((r) => r.enabled).length +
      abbrSettings.wordRules.filter((w) => w.enabled).length
    );
  }, [abbrSettings]);

  const [filters, setFilters] = useState<EventFilterState>({
    regionId: initialUrlState.regionId || 'ALL',
    sigunguCode: initialUrlState.sigunguCode || 'ALL',
    source: initialUrlState.source || 'ALL',
    majorCategory: initialUrlState.majorCategory || 'ALL',
    subCategory: initialUrlState.subCategory || 'ALL',
    specialPromoFormats: buildDefaultSpecialPromoFormats(),
    status: 'ALL',
    statusLevels: initialUrlState.statusLevels || {
      ONGOING: true,
      UPCOMING: true,
      ENDED: true,
    },
    scopeLevels: initialUrlState.scopeLevels || {
      3: true,
      2: true,
      1: true,
      0: true,
    },
    selectedYear: initialUrlState.year || String(new Date().getFullYear()),
    selectedMonthPeriod: initialUrlState.month || 'ALL',
    ...currentYearRange(),
    quickPeriod: '1Y',
    keyword: initialUrlState.keyword || '',
    detailKeyword: initialUrlState.keyword || '',
    detailSearchTargets: {
      organizer: true,
      content: true,
      title: true,
      place: true,
    },
    organizerKeyword: '',
    contentKeyword: '',
    arrange: 'C',
    formatMode: 'JSON',
  });

  // 달력에 표시할 내용 체크 상태 (기본: 월 구분 없이 1년치 이어서 보기 + 빈 주간 축약 + 소재지와 행사명 표시)
  const [calendarOptions, setCalendarOptions] = useState<CalendarDisplayOptions>({
    continuousYearView: true,
    collapseEmptyWeeks: true,
    showRegion: true,
    showCategoryBadge: false,
    showEventTime: false,
    showOrganizer: false,
    showInvitation: false,
    showStatusBadge: false,
  });

  // 리스트(테이블)에 표시할 열 체크 상태
  const [listColumns, setListColumns] = useState<ListColumnVisibility>({
    region: true,
    category: true,
    title: true,
    eventDate: true,
    eventTime: true,
    organizer: true,
    invitation: true,
    links: true,
    addr: false,
    status: true,
  });

  // 수영장 보기(일람 / 지도) 전용 필터 상태 (URL 쿼리 파라미터 초기값 반영)
  const [poolFilters, setPoolFilters] = useState<PoolFilterState>(
    initialUrlState.poolFilters
  );

  // 현재 메뉴·종목·뷰모드·필터 상태를 브라우저 주소창 URL 쿼리 파라미터와 실시간 동기화 (공유용 딥링크 지원)
  useEffect(() => {
    const params = new URLSearchParams();
    const defaultYearStr = String(new Date().getFullYear());
    const isPoolMode =
      activeMenu === 'SPECIAL_PROMO' &&
      activeSport === 'SWIMMING' &&
      (specialPromoViewMode === 'POOLS' || specialPromoViewMode === 'POOLS_MAP');

    if (activeMenu === 'SPECIAL_PROMO') {
      params.set('menu', 'SPECIAL_PROMO');
      params.set('sport', activeSport);
      params.set('view', specialPromoViewMode);
    } else if (activeMenu !== 'MAP') {
      params.set('menu', activeMenu);
    }

    if (isPoolMode) {
      const c50 = poolFilters.courses['50m'];
      const c25 = poolFilters.courses['25m'];
      if (c50 && !c25) {
        params.set('course', '50m');
      } else if (!c50 && c25) {
        params.set('course', '25m');
      } else if (!c50 && !c25) {
        params.set('course', 'none');
      }
      if (poolFilters.regionName !== 'ALL') {
        params.set('region', poolFilters.regionName);
      }
      if (poolFilters.sigunguName !== 'ALL') {
        params.set('sigungu', poolFilters.sigunguName);
      }
      if (poolFilters.keyword.trim()) {
        params.set('q', poolFilters.keyword.trim());
      }
    } else {
      if (activeMenu === 'PROMO_DIRECTORY' && activeDbTab !== 'ALL') {
        params.set('dbTab', activeDbTab);
      }
      if (filters.regionId !== 'ALL') {
        params.set('regionId', filters.regionId);
      }
      if (filters.sigunguCode !== 'ALL') {
        params.set('sigunguCode', filters.sigunguCode);
      }
      if (filters.selectedYear && filters.selectedYear !== defaultYearStr) {
        params.set('year', filters.selectedYear);
      }
      if (filters.selectedMonthPeriod && filters.selectedMonthPeriod !== 'ALL') {
        params.set('month', filters.selectedMonthPeriod);
      }
      if (filters.majorCategory !== 'ALL') {
        params.set('cat', filters.majorCategory);
      }
      if (filters.subCategory !== 'ALL') {
        params.set('subCat', filters.subCategory);
      }
      const stLevels = filters.statusLevels || {
        ONGOING: true,
        UPCOMING: true,
        ENDED: true,
      };
      if (!stLevels.ONGOING || !stLevels.UPCOMING || !stLevels.ENDED) {
        const activeStatuses = (
          ['ONGOING', 'UPCOMING', 'ENDED'] as const
        ).filter((st) => stLevels[st]);
        params.set(
          'status',
          activeStatuses.length > 0 ? activeStatuses.join(',') : 'none'
        );
      }
      if (filters.source !== 'ALL') {
        params.set('source', filters.source);
      }
      const sc = filters.scopeLevels;
      if (sc && (!sc[3] || !sc[2] || !sc[1] || !sc[0])) {
        const activeScopes = ([3, 2, 1, 0] as PromoLevel[]).filter((lv) => sc[lv]);
        params.set('scopes', activeScopes.join(','));
      }
      const kw = (filters.detailKeyword || filters.keyword || '').trim();
      if (kw) {
        params.set('q', kw);
      }
    }

    const queryStr = params.toString();
    const nextUrl = queryStr
      ? `${window.location.pathname}?${queryStr}`
      : window.location.pathname;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [activeMenu, activeSport, activeDbTab, specialPromoViewMode, poolFilters, filters]);

  const allMergedPools = useMemo(() => getMergedSwimmingPoolsCatalog(), []);

  const poolRegionOptions = useMemo(() => {
    const set = new Set<string>();
    allMergedPools.forEach((p) => {
      if (p.regionName) set.add(p.regionName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [allMergedPools]);

  const poolSigunguOptions = useMemo(() => {
    if (poolFilters.regionName === 'ALL') return [];
    const set = new Set<string>();
    allMergedPools.forEach((p) => {
      if (p.regionName === poolFilters.regionName && p.sigunguName) {
        set.add(p.sigunguName);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [allMergedPools, poolFilters.regionName]);

  const updatePoolFilter = useCallback(
    <K extends keyof PoolFilterState>(key: K, value: PoolFilterState[K]) => {
      setPoolFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleResetPoolFilters = useCallback(() => {
    setPoolFilters({
      regionName: 'ALL',
      sigunguName: 'ALL',
      courses: { '50m': true, '25m': true },
      keyword: '',
    });
  }, []);

  const [portalEvents, setPortalEvents] = useState<UnifiedEventItem[]>([]);
  const [firestoreDocs, setFirestoreDocs] = useState<FirestoreEventDoc[]>(() =>
    buildInitialSeedFirestoreDocs()
  );
  const [firestoreCloudSynced, setFirestoreCloudSynced] = useState(false);

  const [promoRegistry, setPromoRegistry] = useState<AdminPromoRegistryData | null>(
    null
  );
  const [muniGeoFeatures, setMuniGeoFeatures] = useState<GeoFeature[]>([]);
  const [sigunguList, setSigunguList] = useState<SigunguItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<'JSON' | 'XML'>('JSON');
  const [apiTotalCount, setApiTotalCount] = useState<number>(0);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [municipalModalOpen, setMunicipalModalOpen] = useState(false);

  // 1) 1·2단계 267개 지자체 행정·홍보 페이지 마스터 DB 로드
  useEffect(() => {
    loadAdminPromoRegistry()
      .then((data) => setPromoRegistry(data))
      .catch((err) => console.error('Failed to load promo registry:', err));
  }, []);

  // 2) Firebase Firestore (`koreaeventlist` 프로젝트 `events` 컬렉션) 및 정적 크롤링 JSON 동기화
  const loadFirestoreData = useCallback(async () => {
    const res = await syncAndLoadFirestoreEvents();
    setFirestoreDocs(res.docs);
    setFirestoreCloudSynced(res.syncedWithCloud);
  }, []);

  useEffect(() => {
    loadFirestoreData();
  }, [loadFirestoreData]);

  const updateFilter = useCallback(
    <K extends keyof EventFilterState>(key: K, value: EventFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleResetFilters = useCallback(() => {
    setActiveDbTab('ALL');
    setFilters((prev) => ({
      ...prev,
      regionId: 'ALL',
      sigunguCode: 'ALL',
      source: 'ALL',
      majorCategory: 'ALL',
      subCategory: 'ALL',
      specialPromoFormats: buildDefaultSpecialPromoFormats(),
      status: 'ALL',
      statusLevels: {
        ONGOING: true,
        UPCOMING: true,
        ENDED: true,
      },
      scopeLevels: {
        3: true,
        2: true,
        1: true,
        0: true,
      },
      selectedYear: String(new Date().getFullYear()),
      selectedMonthPeriod: 'ALL',
      ...currentYearRange(),
      quickPeriod: '1Y',
      keyword: '',
      detailKeyword: '',
      detailSearchTargets: {
        organizer: true,
        content: true,
        title: true,
        place: true,
      },
      organizerKeyword: '',
      contentKeyword: '',
    }));
  }, []);

  // 상단 메뉴바의 보기 방식 아이콘(목록보기 / 달력보기 / 지도보기 | 수영장 일람보기 / 수영장 지도보기) 클릭 핸들러
  const headerViewMode: ViewMode = useMemo(() => {
    if (activeMenu === 'SPECIAL_PROMO') {
      if (
        (specialPromoViewMode === 'POOLS' || specialPromoViewMode === 'POOLS_MAP') &&
        activeSport !== 'SWIMMING'
      ) {
        return 'CALENDAR';
      }
      return specialPromoViewMode;
    }
    if (activeMenu === 'CALENDAR') return 'CALENDAR';
    if (activeMenu === 'LIST') return 'LIST';
    return 'MAP';
  }, [activeMenu, activeSport, specialPromoViewMode]);

  const handleChangeViewMode = useCallback(
    (mode: ViewMode) => {
      if (activeMenu === 'SPECIAL_PROMO') {
        setSpecialPromoViewMode(mode);
      } else if (mode !== 'POOLS' && mode !== 'POOLS_MAP') {
        setActiveMenu(mode);
      }
    },
    [activeMenu]
  );

  // 3) 공공데이터포털 KorService2 행사 데이터 보조 조회 (Primary는 정적 크롤링 JSON)
  const loadPortalData = useCallback(async () => {
    setErrorMsg(null);
    try {
      const startYmd =
        filters.startDate.replace(/-/g, '') ||
        currentYearRange().startDate.replace(/-/g, '');
      const endYmd = filters.endDate ? filters.endDate.replace(/-/g, '') : undefined;

      const selectedRegObj =
        filters.regionId !== 'ALL' ? REGION_BY_ID[filters.regionId] : undefined;

      const res = await fetchPortalFestivals({
        eventStartDate: startYmd,
        eventEndDate: endYmd,
        lDongRegnCd: selectedRegObj ? selectedRegObj.lDongRegnCd : undefined,
        arrange: filters.arrange,
        numOfRows: selectedRegObj ? 200 : 150,
        pageNo: 1,
        formatMode: filters.formatMode,
      });

      setPortalEvents((prev) => {
        if (!selectedRegObj) {
          return res.events;
        }
        const map = new Map<string, UnifiedEventItem>();
        prev.forEach((item) => map.set(item.id, item));
        res.events.forEach((item) => map.set(item.id, item));
        return Array.from(map.values());
      });

      setDetectedFormat(res.detectedFormat);
      setApiTotalCount(res.totalCount);
    } catch {
      // 정적 크롤링 JSON(auto-crawled-events.json)이 기본(Primary) 데이터이므로 보조 API 실패 시 에러 배너 생략
    } finally {
      setLoading(false);
    }
  }, [
    filters.startDate,
    filters.endDate,
    filters.regionId,
    filters.arrange,
    filters.formatMode,
  ]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // 시도 선택 시 KorService2 ldongCode2로 하위 시·군·구 코드 목록 보조 조회
  useEffect(() => {
    if (filters.regionId === 'ALL') {
      setSigunguList([]);
      return;
    }
    const regionObj = REGION_BY_ID[filters.regionId];
    if (!regionObj) return;

    fetchSigunguCodes(regionObj.lDongRegnCd, filters.formatMode)
      .then((list) => setSigunguList(list))
      .catch(() => setSigunguList([]));
  }, [filters.regionId, filters.formatMode]);

  // 필터의 "지역 > 시·군·구" 드롭다운용 옵션 목록 (선택된 시도에 맞춰 즉시 갱신)
  const sigunguOptions = useMemo(() => {
    if (filters.regionId === 'ALL') return [];

    const map = new Map<string, string>();

    if (promoRegistry?.municipalities) {
      Object.values(promoRegistry.municipalities).forEach((m) => {
        if (m.regionId === filters.regionId && m.lDongSignguCd) {
          map.set(m.lDongSignguCd, m.name);
        }
      });
    }

    muniGeoFeatures.forEach((f) => {
      if (
        f.properties.regionId === filters.regionId &&
        f.properties.lDongSignguCd &&
        !map.has(f.properties.lDongSignguCd)
      ) {
        map.set(f.properties.lDongSignguCd, f.properties.name);
      }
    });

    sigunguList.forEach((s) => {
      if (s.code && !map.has(s.code)) {
        map.set(s.code, s.name);
      }
    });

    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [filters.regionId, promoRegistry, muniGeoFeatures, sigunguList]);

  const selectedSigunguName = useMemo(() => {
    if (filters.sigunguCode === 'ALL') return undefined;
    return sigunguOptions.find((s) => s.code === filters.sigunguCode)?.name;
  }, [filters.sigunguCode, sigunguOptions]);

  const handleSelectRegion = useCallback((regionId: string) => {
    setFilters((prev) => ({
      ...prev,
      regionId,
      sigunguCode: 'ALL',
    }));
  }, []);

  const handleSelectSigungu = useCallback((sigunguCode: string) => {
    setFilters((prev) => ({
      ...prev,
      sigunguCode,
    }));
  }, []);

  const handleFormatModeChange = useCallback((mode: ResponseFormatMode) => {
    setFilters((prev) => ({
      ...prev,
      formatMode: mode,
    }));
  }, []);

  // Firestore 문서 추가/수정 핸들러
  const handleSaveFirestoreDoc = useCallback(async (docData: FirestoreEventDoc) => {
    const { savedDoc, syncedWithCloud } = await upsertFirestoreEventDoc(docData);
    setFirestoreDocs((prev) => {
      const map = new Map<string, FirestoreEventDoc>();
      prev.forEach((d) => map.set(d.id, d));
      map.set(savedDoc.id, savedDoc);
      return Array.from(map.values());
    });
    setFirestoreCloudSynced(syncedWithCloud);
    return syncedWithCloud;
  }, []);

  // 공공데이터포털 실시간 조회 데이터 + Firebase Firestore 문서 실시간 조합
  const allCombinedEvents = useMemo(() => {
    return composeEventsWithFirestore(portalEvents, firestoreDocs);
  }, [portalEvents, firestoreDocs]);

  // DB에 존재하는 최초 연도 ~ 최후 연도 목록 추출 (내림차순)
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([new Date().getFullYear(), 2026, 2025, 2024]);
    allCombinedEvents.forEach((ev) => {
      const sy = Number((ev.startDate || '').slice(0, 4));
      const ey = Number((ev.endDate || '').slice(0, 4));
      if (sy >= 1990 && sy <= 2035) yearSet.add(sy);
      if (ey >= 1990 && ey <= 2035) yearSet.add(ey);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [allCombinedEvents]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return allCombinedEvents.find((e) => e.id === selectedEventId) || null;
  }, [allCombinedEvents, selectedEventId]);

  // 공통 기본 필터 조건(지역, 시군구, 출처, 상태, 연도/월, 세부검색) 검사 헬퍼
  const matchesCommonFilters = useCallback(
    (ev: UnifiedEventItem): boolean => {
      const detailKw = (filters.detailKeyword || filters.keyword || '')
        .trim()
        .toLowerCase();
      const targets = filters.detailSearchTargets || {
        organizer: true,
        content: true,
        title: true,
        place: true,
      };
      const selYear = filters.selectedYear || 'ALL';
      const selMonthPeriod = filters.selectedMonthPeriod || 'ALL';

      if (filters.regionId !== 'ALL' && ev.regionId !== filters.regionId) {
        return false;
      }
      if (filters.sigunguCode !== 'ALL' && ev.lDongSignguCd !== filters.sigunguCode) {
        return false;
      }
      if (filters.source !== 'ALL' && ev.source !== filters.source) {
        return false;
      }
      const statusLevels = filters.statusLevels || {
        ONGOING: true,
        UPCOMING: true,
        ENDED: true,
      };
      if (!statusLevels.ONGOING && !statusLevels.UPCOMING && !statusLevels.ENDED) {
        return false;
      }
      if (
        (ev.status === 'ONGOING' ||
          ev.status === 'UPCOMING' ||
          ev.status === 'ENDED') &&
        !statusLevels[ev.status]
      ) {
        return false;
      }
      if (
        !matchesYearAndMonthFilter(
          ev.startDate,
          ev.endDate,
          selYear,
          selMonthPeriod
        )
      ) {
        return false;
      }
      if (detailKw) {
        const chunks: string[] = [];
        if (targets.organizer) {
          chunks.push(ev.organizer || '', ev.sourceLabel || '');
        }
        if (targets.content) {
          chunks.push(
            ev.invitation || '',
            ev.summary || '',
            ev.lclsSystm2Name || '',
            ev.lclsSystm3Name || ''
          );
        }
        if (targets.title) {
          chunks.push(ev.title || '', applyAbbreviation(ev.title, abbrSettings));
        }
        if (targets.place) {
          chunks.push(
            ev.regionName || '',
            ev.sigunguName || '',
            ev.addr1 || '',
            ev.addr2 || ''
          );
        }
        const combinedHay = chunks.join(' ').toLowerCase();
        if (!combinedHay.includes(detailKw)) {
          return false;
        }
      }
      return true;
    },
    [filters, abbrSettings]
  );

  // 모든 필터 조건(지역 + 연도/월 + 범위 + 행사형태 + 행사상태 + 세부검색) 적용
  const filteredEvents = useMemo(() => {
    const scopeLevels = filters.scopeLevels || {
      3: true,
      2: true,
      1: true,
      0: true,
    };

    return allCombinedEvents.filter((ev) => {
      if (!matchesCommonFilters(ev)) {
        return false;
      }
      if (!scopeLevels[ev.promoLevel ?? 0]) {
        return false;
      }
      if (activeMenu === 'SPECIAL_PROMO') {
        if (!matchesSpecialPromoMultiFormats(activeSport, ev, filters.specialPromoFormats)) {
          return false;
        }
      } else {
        if (filters.majorCategory !== 'ALL' && ev.lclsSystm2 !== filters.majorCategory) {
          return false;
        }
        if (
          filters.subCategory !== 'ALL' &&
          !isSpecialPromoFormatCode(filters.subCategory) &&
          ev.lclsSystm3 !== filters.subCategory
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allCombinedEvents, matchesCommonFilters, filters, activeMenu, activeSport]);

  // 범위(3/2/1/0) 각 버튼에 표시할 이벤트 수 배지 계산
  const scopeEventCounts = useMemo<Record<PromoLevel, number>>(() => {
    const counts: Record<PromoLevel, number> = { 3: 0, 2: 0, 1: 0, 0: 0 };
    allCombinedEvents.forEach((ev) => {
      if (!matchesCommonFilters(ev)) return;
      if (activeMenu === 'SPECIAL_PROMO') {
        const hay = `${ev.title} ${ev.invitation || ''} ${ev.summary || ''} ${ev.organizer || ''}`;
        if (!matchesSportCategory(hay, activeSport)) return;
        if (!matchesSpecialPromoMultiFormats(activeSport, ev, filters.specialPromoFormats)) {
          return;
        }
      } else {
        if (filters.majorCategory !== 'ALL' && ev.lclsSystm2 !== filters.majorCategory) {
          return;
        }
        if (
          filters.subCategory !== 'ALL' &&
          !isSpecialPromoFormatCode(filters.subCategory) &&
          ev.lclsSystm3 !== filters.subCategory
        ) {
          return;
        }
      }
      const lv = (ev.promoLevel ?? 0) as PromoLevel;
      counts[lv] = (counts[lv] || 0) + 1;
    });
    return counts;
  }, [allCombinedEvents, matchesCommonFilters, filters, activeMenu, activeSport]);

  // 특별 홍보관 행사 형태 각 버튼에 표시할 이벤트 수 배지 계산
  const specialPromoFormatCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    const defs = SPECIAL_PROMO_EVENT_FORMATS[activeSport] || [];
    defs.forEach((d) => {
      counts[d.code] = 0;
    });

    const scopeLevels = filters.scopeLevels || {
      3: true,
      2: true,
      1: true,
      0: true,
    };

    allCombinedEvents.forEach((ev) => {
      if (!matchesCommonFilters(ev)) return;
      if (!scopeLevels[ev.promoLevel ?? 0]) return;
      const hay = `${ev.title} ${ev.invitation || ''} ${ev.summary || ''} ${ev.organizer || ''}`;
      if (!matchesSportCategory(hay, activeSport)) return;

      const codes = classifySpecialPromoEventFormats(activeSport, ev);
      codes.forEach((code) => {
        if (code in counts) {
          counts[code] += 1;
        }
      });
    });

    return counts;
  }, [allCombinedEvents, matchesCommonFilters, filters.scopeLevels, activeSport]);

  const handleRefreshAll = useCallback(() => {
    loadPortalData();
    loadFirestoreData();
  }, [loadPortalData, loadFirestoreData]);

  const activeCalendarTargetYear = useMemo(() => {
    if (filters.selectedYear !== 'ALL') {
      const parsed = Number(filters.selectedYear);
      if (!Number.isNaN(parsed) && parsed >= 1990) return parsed;
    }
    return new Date().getFullYear();
  }, [filters.selectedYear]);

  // 축약보기가 활성화된 경우 표시용 이벤트 목록 생성 (원본 제목은 rawTitle에 보존)
  const displayFilteredEvents = useMemo(() => {
    if (!abbrSettings.enabled) return filteredEvents;
    return filteredEvents.map((ev) => ({
      ...ev,
      rawTitle: ev.rawTitle || ev.title,
      title: applyAbbreviation(ev.title, abbrSettings),
      organizer: ev.organizer
        ? applyAbbreviation(ev.organizer, abbrSettings)
        : ev.organizer,
    }));
  }, [filteredEvents, abbrSettings]);

  const displayAllCombinedEvents = useMemo(() => {
    if (!abbrSettings.enabled) return allCombinedEvents;
    return allCombinedEvents.map((ev) => ({
      ...ev,
      rawTitle: ev.rawTitle || ev.title,
      title: applyAbbreviation(ev.title, abbrSettings),
      organizer: ev.organizer
        ? applyAbbreviation(ev.organizer, abbrSettings)
        : ev.organizer,
    }));
  }, [allCombinedEvents, abbrSettings]);

  return (
    <div className={styles.appShell}>
      {/* 상단 메뉴바: 삼선 메뉴 + 제목 + (목록보기/달력보기/지도보기 택1 아이콘 | 수영장 일람/지도 아이콘) + 필터 아이콘 + 표시항목 아이콘 */}
      <HeaderBar
        activeMenu={activeMenu}
        activeSport={activeSport}
        activeDbTab={activeDbTab}
        viewMode={headerViewMode}
        filters={filters}
        poolFilters={poolFilters}
        poolRegionOptions={poolRegionOptions}
        poolSigunguOptions={poolSigunguOptions}
        scopeEventCounts={scopeEventCounts}
        specialPromoFormatCounts={specialPromoFormatCounts}
        availableYears={availableYears}
        sigunguOptions={sigunguOptions}
        calendarOptions={calendarOptions}
        listColumns={listColumns}
        abbreviationEnabled={abbrSettings.enabled}
        activeAbbreviationRuleCount={activeAbbreviationRuleCount}
        onToggleSidebar={() => setSidebarOpen(true)}
        onChangeViewMode={handleChangeViewMode}
        onChangeDbTab={setActiveDbTab}
        onUpdateFilter={updateFilter}
        onResetFilters={handleResetFilters}
        onUpdatePoolFilter={updatePoolFilter}
        onResetPoolFilters={handleResetPoolFilters}
        onChangeCalendarOptions={setCalendarOptions}
        onChangeListColumns={setListColumns}
        onToggleAbbreviation={handleToggleAbbreviation}
        onOpenSettings={() => handleSelectMenuWithHistory('SETTINGS')}
      />

      {/* 좌측 사이드바 드로어: 지도로 보기 / 달력으로 보기 / 행사 리스트 / 지자체 사이트 / 특별 홍보관(수영·러닝·자전거·철인) */}
      <SidebarDrawer
        open={sidebarOpen}
        activeMenu={activeMenu}
        activeSport={activeSport}
        onSelectMenu={handleSelectMenuWithHistory}
        onSelectSport={(sport) => {
          setActiveSport(sport);
          handleSelectMenuWithHistory('SPECIAL_PROMO');
        }}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 1. 지도로 행사보기 뷰 */}
      {activeMenu === 'MAP' && (
        <main className={styles.mainContainer}>
          <aside className={styles.leftColumn}>
            <KoreaAdminMap
              selectedRegionId={filters.regionId}
              selectedSigunguCode={filters.sigunguCode}
              allEvents={allCombinedEvents}
              filteredEvents={displayFilteredEvents}
              onSelectRegion={handleSelectRegion}
              onSelectSigungu={handleSelectSigungu}
              onSelectEvent={(ev) => setSelectedEventId(ev.id)}
              onMunicipalitiesLoaded={setMuniGeoFeatures}
            />
          </aside>

          <div className={styles.rightColumn}>
            {errorMsg && <div className={styles.errorBanner}>⚠️ {errorMsg}</div>}

            <EventCardGrid
              events={displayFilteredEvents}
              selectedRegionId={filters.regionId}
              selectedSigunguCode={filters.sigunguCode}
              selectedSigunguName={selectedSigunguName}
              loading={loading}
              onSelectEvent={(ev) => setSelectedEventId(ev.id)}
            />
          </div>
        </main>
      )}

      {/* 2. 달력으로 행사보기 뷰 (일 ~ 월, 1년 연속 스크롤 + 오늘 날짜 자동 이동) */}
      {activeMenu === 'CALENDAR' && (
        <EventCalendarView
          events={displayFilteredEvents}
          displayOptions={calendarOptions}
          targetYear={activeCalendarTargetYear}
          onSelectEvent={(ev) => setSelectedEventId(ev.id)}
          onChangeDisplayOptions={setCalendarOptions}
        />
      )}

      {/* 3. 행사 리스트 뷰 (열 선택 지원 테이블) */}
      {activeMenu === 'LIST' && (
        <EventTableView
          events={displayFilteredEvents}
          columns={listColumns}
          onSelectEvent={(ev) => setSelectedEventId(ev.id)}
        />
      )}

      {/* 4. 행사 등록 메뉴 뷰 (사전안내 동의 · 주소 기반 지역/코드 자동 분류 · 2채널/도메인/언론노출 검증) */}
      {activeMenu === 'EVENT_REGISTER' && (
        <EventRegistrationView
          registry={promoRegistry}
          onRegisterEventDoc={handleSaveFirestoreDoc}
        />
      )}

      {/* 5. 크롤링 대상 사이트 DB 뷰 (전국/광역시도/시군구/기타 펼치기·접기 및 종목별 필터) */}
      {activeMenu === 'PROMO_DIRECTORY' && (
        <PromoDirectoryView
          registry={promoRegistry}
          activeDbTab={activeDbTab}
          onChangeDbTab={setActiveDbTab}
          selectedRegionId={filters.regionId}
          selectedSigunguCode={filters.sigunguCode}
          scopeLevels={
            filters.scopeLevels || { 3: true, 2: true, 1: true, 0: true }
          }
          keyword={filters.detailKeyword || filters.keyword}
        />
      )}

      {/* 5. 특별 홍보관 > 수영 · 러닝 · 자전거 · 철인 (목록보기 / 달력보기 / 지도보기 | 수영장 일람 / 수영장 지도) */}
      {activeMenu === 'SPECIAL_PROMO' && (
        <SpecialPromoView
          sport={activeSport}
          viewMode={specialPromoViewMode}
          events={displayFilteredEvents}
          allEvents={displayAllCombinedEvents}
          calendarOptions={calendarOptions}
          targetYear={activeCalendarTargetYear}
          poolFilters={poolFilters}
          onUpdatePoolFilter={updatePoolFilter}
          onResetPoolFilters={handleResetPoolFilters}
          onSelectEvent={(ev) => setSelectedEventId(ev.id)}
          onChangeCalendarOptions={setCalendarOptions}
        />
      )}

      {/* 6. 세팅 > 축약보기 정규식 및 4글자 이상 단어 JSON 사전 관리 */}
      {activeMenu === 'SETTINGS' && (
        <SettingsView
          settings={abbrSettings}
          onChangeSettings={handleChangeAbbrSettings}
          onBack={() =>
            setActiveMenu(previousMenu === 'SETTINGS' ? 'MAP' : previousMenu)
          }
        />
      )}

      {/* 하단 메뉴: 사이트 소개 및 시스템 구성 */}
      {activeMenu === 'ABOUT' && (
        <SiteAboutView
          formatMode={filters.formatMode}
          detectedFormat={detectedFormat}
          loading={loading}
          totalPortalCount={portalEvents.length}
          apiTotalCount={apiTotalCount}
          totalFirestoreCount={firestoreDocs.length}
          firestoreCloudSynced={firestoreCloudSynced}
          onFormatModeChange={handleFormatModeChange}
          onRefresh={handleRefreshAll}
          onOpenMunicipalModal={() => setMunicipalModalOpen(true)}
        />
      )}

      {/* 행사 상세 모달 */}
      <EventDetailModal
        event={selectedEvent}
        allEvents={allCombinedEvents}
        registry={promoRegistry}
        formatMode={filters.formatMode}
        onClose={() => setSelectedEventId(null)}
        onSelectEventById={(id) => setSelectedEventId(id)}
        onSaveFirestoreDoc={handleSaveFirestoreDoc}
      />

      {/* 신규 행사 등록 모달 (사이트 소개 메뉴에서 호출) */}
      <MunicipalAdapterModal
        open={municipalModalOpen}
        defaultRegionId={filters.regionId}
        onClose={() => setMunicipalModalOpen(false)}
        onAddFirestoreDoc={handleSaveFirestoreDoc}
      />
    </div>
  );
};
