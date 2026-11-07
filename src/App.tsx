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
  EventFilterState,
  FirestoreEventDoc,
  ResponseFormatMode,
  SigunguItem,
  UnifiedEventItem,
} from './types/event';
import { HeaderBar } from './components/HeaderBar';
import { KoreaAdminMap } from './components/KoreaAdminMap';
import { FilterPanel } from './components/FilterPanel';
import { EventCardGrid } from './components/EventCardGrid';
import { EventDetailModal } from './components/EventDetailModal';
import { MunicipalAdapterModal } from './components/MunicipalAdapterModal';
import { PromoRegistryModal } from './components/PromoRegistryModal';
import styles from './App.module.css';

export const App: React.FC = () => {
  const [filters, setFilters] = useState<EventFilterState>({
    regionId: 'ALL',
    sigunguCode: 'ALL',
    source: 'ALL',
    majorCategory: 'ALL',
    subCategory: 'ALL',
    status: 'ALL',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    keyword: '',
    arrange: 'C',
    formatMode: 'JSON',
  });

  const [portalEvents, setPortalEvents] = useState<UnifiedEventItem[]>([]);
  const [firestoreDocs, setFirestoreDocs] = useState<FirestoreEventDoc[]>(() =>
    buildInitialSeedFirestoreDocs()
  );
  const [firestoreCloudSynced, setFirestoreCloudSynced] = useState(false);
  const [firestoreStatusMsg, setFirestoreStatusMsg] = useState(
    'Firebase Firestore (koreaeventlist) 초기화 중...'
  );

  const [promoRegistry, setPromoRegistry] = useState<AdminPromoRegistryData | null>(null);
  const [sigunguList, setSigunguList] = useState<SigunguItem[]>([]);
  const [sigunguLoading, setSigunguLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<'JSON' | 'XML'>('JSON');
  const [lastRequestUrl, setLastRequestUrl] = useState<string>(
    'https://apis.data.go.kr/B551011/KorService2/searchFestival2'
  );
  const [apiTotalCount, setApiTotalCount] = useState<number>(0);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [municipalModalOpen, setMunicipalModalOpen] = useState(false);
  const [registryModalOpen, setRegistryModalOpen] = useState(false);

  // 1) 1·2단계 267개 지자체 행정·홍보 페이지 마스터 DB 로드
  useEffect(() => {
    loadAdminPromoRegistry()
      .then((data) => setPromoRegistry(data))
      .catch((err) => console.error('Failed to load promo registry:', err));
  }, []);

  // 2) Firebase Firestore (`koreaeventlist` 프로젝트 `events` 컬렉션) 동기화
  const loadFirestoreData = useCallback(async () => {
    const res = await syncAndLoadFirestoreEvents();
    setFirestoreDocs(res.docs);
    setFirestoreCloudSynced(res.syncedWithCloud);
    setFirestoreStatusMsg(res.statusMessage);
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

  // 3) 공공데이터포털 KorService2 행사 데이터 실시간 조회
  const loadPortalData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const startYmd = filters.startDate.replace(/-/g, '') || '20260101';
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
      setLastRequestUrl(res.requestUrl);
      setApiTotalCount(res.totalCount);
    } catch (err: any) {
      setErrorMsg(err?.message || '공공데이터포털 API 호출 중 오류가 발생했습니다.');
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

  // 시도 선택 시 KorService2 ldongCode2로 하위 시·군·구 코드 목록 조회
  useEffect(() => {
    if (filters.regionId === 'ALL') {
      setSigunguList([]);
      return;
    }
    const regionObj = REGION_BY_ID[filters.regionId];
    if (!regionObj) return;

    setSigunguLoading(true);
    fetchSigunguCodes(regionObj.lDongRegnCd, filters.formatMode)
      .then((list) => setSigunguList(list))
      .catch(() => setSigunguList([]))
      .finally(() => setSigunguLoading(false));
  }, [filters.regionId, filters.formatMode]);

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

  // Firestore 문서 추가/수정 핸들러 (실시간 조합 즉시 갱신)
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

  // [핵심] 공공데이터포털 실시간 조회 데이터 + Firebase Firestore 문서 실시간 조합(Composition)
  const allCombinedEvents = useMemo(() => {
    return composeEventsWithFirestore(portalEvents, firestoreDocs);
  }, [portalEvents, firestoreDocs]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return allCombinedEvents.find((e) => e.id === selectedEventId) || null;
  }, [allCombinedEvents, selectedEventId]);

  // 현재 선택된 행정구역(시도/시군구) 기준 출처별 건수
  const regionalSourceCounts = useMemo(() => {
    const regionScoped = allCombinedEvents.filter((ev) => {
      if (filters.regionId !== 'ALL' && ev.regionId !== filters.regionId) return false;
      if (filters.sigunguCode !== 'ALL' && ev.lDongSignguCd !== filters.sigunguCode) {
        return false;
      }
      return true;
    });

    const portal = regionScoped.filter((e) => e.source === 'PUBLIC_PORTAL').length;
    const municipal = regionScoped.filter((e) => e.source === 'MUNICIPAL_WEB').length;
    return {
      all: regionScoped.length,
      portal,
      municipal,
    };
  }, [allCombinedEvents, filters.regionId, filters.sigunguCode]);

  // 모든 필터 조건(행정구역 + 출처 + 분류체계 + 상태 + 키워드 + 날짜) 적용
  const filteredEvents = useMemo(() => {
    const startYmd = filters.startDate.replace(/-/g, '');
    const endYmd = filters.endDate.replace(/-/g, '');
    const kw = filters.keyword.trim().toLowerCase();

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
      if (filters.majorCategory !== 'ALL' && ev.lclsSystm2 !== filters.majorCategory) {
        return false;
      }
      if (filters.subCategory !== 'ALL' && ev.lclsSystm3 !== filters.subCategory) {
        return false;
      }
      if (filters.status !== 'ALL' && ev.status !== filters.status) {
        return false;
      }
      if (startYmd && ev.endDate && ev.endDate < startYmd) {
        return false;
      }
      if (endYmd && ev.startDate && ev.startDate > endYmd) {
        return false;
      }
      if (kw) {
        const hay =
          `${ev.title} ${ev.addr1} ${ev.regionName} ${ev.sigunguName} ${ev.lclsSystm3Name} ${ev.sourceLabel} ${ev.invitation || ''} ${ev.organizer || ''}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [allCombinedEvents, filters]);

  const handleRefreshAll = useCallback(() => {
    loadPortalData();
    loadFirestoreData();
  }, [loadPortalData, loadFirestoreData]);

  return (
    <div className={styles.appShell}>
      <HeaderBar
        formatMode={filters.formatMode}
        detectedFormat={detectedFormat}
        loading={loading}
        totalPortalCount={portalEvents.length}
        totalFirestoreCount={firestoreDocs.length}
        firestoreCloudSynced={firestoreCloudSynced}
        onFormatModeChange={handleFormatModeChange}
        onRefresh={handleRefreshAll}
        onOpenMunicipalModal={() => setMunicipalModalOpen(true)}
        onOpenRegistryModal={() => setRegistryModalOpen(true)}
      />

      <main className={styles.mainContainer}>
        {/* 좌측: 대한민국 17개 시·도 행정지도 + 250개 시·군·구 정식 확대지도 + API & Firestore 인스펙터 */}
        <aside className={styles.leftColumn}>
          <KoreaAdminMap
            selectedRegionId={filters.regionId}
            selectedSigunguCode={filters.sigunguCode}
            sigunguList={sigunguList}
            sigunguLoading={sigunguLoading}
            allEvents={allCombinedEvents}
            filteredEvents={filteredEvents}
            onSelectRegion={handleSelectRegion}
            onSelectSigungu={handleSelectSigungu}
            onSelectEvent={(ev) => setSelectedEventId(ev.id)}
          />

          <div className={styles.apiInspectorCard}>
            <div className={styles.inspectorTitle}>
              <span>🔌 KorService2 + 🔥 Firebase (`koreaeventlist`) 조합 상태</span>
              <span>
                포털 총건수: <strong>{apiTotalCount.toLocaleString()}건</strong>
              </span>
            </div>
            <span>· {firestoreStatusMsg}</span>
            <span>
              · 필수 연결키: <strong>portalContentId</strong> +{' '}
              <strong>lDongRegnCd/lDongSignguCd</strong> · 응답포맷:{' '}
              <strong>{detectedFormat}</strong>
            </span>
            <code className={styles.endpointCode}>{lastRequestUrl}</code>
          </div>
        </aside>

        {/* 우측: 통합 분류 필터 패널 + 행사 카드 그리드 */}
        <div className={styles.rightColumn}>
          {errorMsg && <div className={styles.errorBanner}>⚠️ {errorMsg}</div>}

          <FilterPanel
            filters={filters}
            counts={regionalSourceCounts}
            onUpdateFilter={updateFilter}
          />

          <EventCardGrid
            events={filteredEvents}
            selectedRegionId={filters.regionId}
            selectedSigunguCode={filters.sigunguCode}
            loading={loading}
            onSelectEvent={(ev) => setSelectedEventId(ev.id)}
          />
        </div>
      </main>

      <EventDetailModal
        event={selectedEvent}
        registry={promoRegistry}
        formatMode={filters.formatMode}
        onClose={() => setSelectedEventId(null)}
        onSaveFirestoreDoc={handleSaveFirestoreDoc}
      />

      <MunicipalAdapterModal
        open={municipalModalOpen}
        defaultRegionId={filters.regionId}
        onClose={() => setMunicipalModalOpen(false)}
        onAddFirestoreDoc={handleSaveFirestoreDoc}
      />

      <PromoRegistryModal
        open={registryModalOpen}
        registry={promoRegistry}
        onClose={() => setRegistryModalOpen(false)}
      />
    </div>
  );
};
