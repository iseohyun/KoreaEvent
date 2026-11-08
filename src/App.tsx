import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { REGION_BY_ID } from './constants/regions';
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
  EventFilterState,
  FirestoreEventDoc,
  ListColumnVisibility,
  MainMenuView,
  MonthPeriodFilter,
  ResponseFormatMode,
  SigunguItem,
  SpecialPromoSport,
  ViewMode,
  UnifiedEventItem,
} from './types/event';
import { HeaderBar } from './components/HeaderBar';
import { SidebarDrawer } from './components/SidebarDrawer';
import { GeoFeature, KoreaAdminMap } from './components/KoreaAdminMap';
import { EventCardGrid } from './components/EventCardGrid';
import { EventCalendarView } from './components/EventCalendarView';
import { EventTableView } from './components/EventTableView';
import { PromoDirectoryView } from './components/PromoDirectoryView';
import { SpecialPromoView } from './components/SpecialPromoView';
import { SiteAboutView } from './components/SiteAboutView';
import { EventDetailModal } from './components/EventDetailModal';
import { MunicipalAdapterModal } from './components/MunicipalAdapterModal';
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

export const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<MainMenuView>('MAP');
  const [activeSport, setActiveSport] = useState<SpecialPromoSport>('SWIMMING');
  const [specialPromoViewMode, setSpecialPromoViewMode] =
    useState<ViewMode>('LIST');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const [filters, setFilters] = useState<EventFilterState>({
    regionId: 'ALL',
    sigunguCode: 'ALL',
    source: 'ALL',
    majorCategory: 'ALL',
    subCategory: 'ALL',
    status: 'ALL',
    scopeLevels: {
      3: true,
      2: true,
      1: true,
      0: true,
    },
    selectedYear: 'ALL',
    selectedMonthPeriod: 'ALL',
    ...currentYearRange(),
    quickPeriod: 'ALL_YEARS',
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
    arrange: 'C',
    formatMode: 'JSON',
  });

  // 달력에 표시할 내용 체크 상태
  const [calendarOptions, setCalendarOptions] = useState<CalendarDisplayOptions>({
    showRegion: true,
    showCategoryBadge: true,
    showEventTime: true,
    showOrganizer: false,
    showInvitation: true,
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
    setFilters((prev) => ({
      ...prev,
      regionId: 'ALL',
      sigunguCode: 'ALL',
      source: 'ALL',
      majorCategory: 'ALL',
      subCategory: 'ALL',
      status: 'ALL',
      scopeLevels: {
        3: true,
        2: true,
        1: true,
        0: true,
      },
      selectedYear: 'ALL',
      selectedMonthPeriod: 'ALL',
      ...currentYearRange(),
      quickPeriod: 'ALL_YEARS',
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

  // 상단 메뉴바의 보기 방식 아이콘(목록보기 / 달력보기 / 지도보기) 클릭 핸들러
  const headerViewMode: ViewMode = useMemo(() => {
    if (activeMenu === 'SPECIAL_PROMO') {
      return specialPromoViewMode;
    }
    if (activeMenu === 'CALENDAR') return 'CALENDAR';
    if (activeMenu === 'LIST') return 'LIST';
    return 'MAP';
  }, [activeMenu, specialPromoViewMode]);

  const handleChangeViewMode = useCallback(
    (mode: ViewMode) => {
      if (activeMenu === 'SPECIAL_PROMO') {
        setSpecialPromoViewMode(mode);
      } else {
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

  // 모든 필터 조건(지역 + 연도/월 + 범위 + 행사형태 + 행사상태 + 세부검색) 적용
  const filteredEvents = useMemo(() => {
    const detailKw = (filters.detailKeyword || filters.keyword || '').trim().toLowerCase();
    const targets = filters.detailSearchTargets || {
      organizer: true,
      content: true,
      title: true,
      place: true,
    };
    const scopeLevels = filters.scopeLevels || {
      3: true,
      2: true,
      1: true,
      0: true,
    };
    const selYear = filters.selectedYear || 'ALL';
    const selMonthPeriod = filters.selectedMonthPeriod || 'ALL';

    return allCombinedEvents.filter((ev) => {
      if (filters.regionId !== 'ALL' && ev.regionId !== filters.regionId) {
        return false;
      }
      if (filters.sigunguCode !== 'ALL' && ev.lDongSignguCd !== filters.sigunguCode) {
        return false;
      }
      if (filters.source !== 'ALL' && ev.source !== filters.source) {
        return false;
      }
      if (!scopeLevels[ev.promoLevel ?? 0]) {
        return false;
      }
      if (filters.majorCategory !== 'ALL' && ev.lclsSystm2 !== filters.majorCategory) {
        return false;
      }
      if (filters.subCategory !== 'ALL' && ev.lclsSystm3 !== filters.subCategory) {
        return false;
      }
      if (filters.status !== 'ALL' && ev.status !== filters.status) {
        return false;
      }

      // 날짜 필터: 연도 선택(DB 최초~최후, 기본=전체) + 월 선택(전체, 상반기, 하반기, 1~4분기, 1~12월)
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

      // 세부 검색: 선택된 검색위치(주최기관, 초댓말/내용, 행사명, 장소/주소) 기준 매칭
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
          chunks.push(ev.title || '');
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
    });
  }, [allCombinedEvents, filters]);

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

  return (
    <div className={styles.appShell}>
      {/* 상단 메뉴바: 삼선 메뉴 + 제목 + (목록보기/달력보기/지도보기 택1 아이콘) + 필터 아이콘 + 표시항목 아이콘 */}
      <HeaderBar
        activeMenu={activeMenu}
        activeSport={activeSport}
        viewMode={headerViewMode}
        filters={filters}
        availableYears={availableYears}
        sigunguOptions={sigunguOptions}
        calendarOptions={calendarOptions}
        listColumns={listColumns}
        onToggleSidebar={() => setSidebarOpen(true)}
        onChangeViewMode={handleChangeViewMode}
        onUpdateFilter={updateFilter}
        onResetFilters={handleResetFilters}
        onChangeCalendarOptions={setCalendarOptions}
        onChangeListColumns={setListColumns}
      />

      {/* 좌측 사이드바 드로어: 지도로 보기 / 달력으로 보기 / 행사 리스트 / 지자체 사이트 / 특별 홍보관(수영·러닝·자전거·철인) */}
      <SidebarDrawer
        open={sidebarOpen}
        activeMenu={activeMenu}
        activeSport={activeSport}
        onSelectMenu={setActiveMenu}
        onSelectSport={(sport) => {
          setActiveSport(sport);
          setActiveMenu('SPECIAL_PROMO');
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
              filteredEvents={filteredEvents}
              onSelectRegion={handleSelectRegion}
              onSelectSigungu={handleSelectSigungu}
              onSelectEvent={(ev) => setSelectedEventId(ev.id)}
              onMunicipalitiesLoaded={setMuniGeoFeatures}
            />
          </aside>

          <div className={styles.rightColumn}>
            {errorMsg && <div className={styles.errorBanner}>⚠️ {errorMsg}</div>}

            <EventCardGrid
              events={filteredEvents}
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
          events={filteredEvents}
          displayOptions={calendarOptions}
          targetYear={activeCalendarTargetYear}
          onSelectEvent={(ev) => setSelectedEventId(ev.id)}
        />
      )}

      {/* 3. 행사 리스트 뷰 (열 선택 지원 테이블) */}
      {activeMenu === 'LIST' && (
        <EventTableView
          events={filteredEvents}
          columns={listColumns}
          onSelectEvent={(ev) => setSelectedEventId(ev.id)}
        />
      )}

      {/* 4. 지자체 홈페이지 홍보 리스트 뷰 */}
      {activeMenu === 'PROMO_DIRECTORY' && (
        <PromoDirectoryView
          registry={promoRegistry}
          selectedRegionId={filters.regionId}
          selectedSigunguCode={filters.sigunguCode}
          keyword={filters.detailKeyword || filters.keyword}
        />
      )}

      {/* 5. 특별 홍보관 > 수영 · 러닝 · 자전거 · 철인 (목록보기 / 달력보기 / 지도보기) */}
      {activeMenu === 'SPECIAL_PROMO' && (
        <SpecialPromoView
          sport={activeSport}
          viewMode={specialPromoViewMode}
          events={filteredEvents}
          calendarOptions={calendarOptions}
          targetYear={activeCalendarTargetYear}
          onSelectEvent={(ev) => setSelectedEventId(ev.id)}
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
