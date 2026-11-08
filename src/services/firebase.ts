import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore';
import { getMajorCategoryName, getSubCategoryName } from '../constants/categories';
import {
  computeDefaultPromoLevel,
  REGION_BY_ID,
  resolveRegionIdFromApi,
} from '../constants/regions';
import { resolveSigunguPortalInfo } from '../constants/municipalityPortals';
import {
  FirestoreEventDoc,
  FirestorePromoLink,
  UnifiedEventItem,
} from '../types/event';
import { computeEventStatus } from './korService2Api';
import { getMunicipalEvents } from './municipalEventAdapter';
import { normalizeEventDoc } from '../shared/promoPolicy';

/** Firestore 보조 동기화 대기 한도 (이 시간을 넘기면 정적 JSON만으로 표시) */
const FIRESTORE_TIMEOUT_MS = 2000;

// 사용자의 Firebase 웹앱 설정 (projectId: "koreaeventlist")
export const firebaseConfig = {
  apiKey: 'AIzaSyDwEWu2_OKbqZC9UIsmb6sW2_pUizdA5Ys',
  authDomain: 'koreaeventlist.firebaseapp.com',
  projectId: 'koreaeventlist',
  storageBucket: 'koreaeventlist.firebasestorage.app',
  messagingSenderId: '603041792508',
  appId: '1:603041792508:web:666141167d411a7d797279',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firestoreDb = getFirestore(firebaseApp);

export const EVENTS_COLLECTION = 'events';
// v3: 스포츠 대회 범위(세계/대한연맹·광역시도·시군구·동네) 및 지자체 코드 정규화 반영을 위해 구 캐시 무효화
const LOCAL_FIRESTORE_CACHE_KEY = 'korea_event_list_firestore_docs_v3';
const LEGACY_CACHE_KEYS = [
  'korea_event_list_firestore_docs_v1',
  'korea_event_list_firestore_docs_v2',
];
try {
  LEGACY_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
} catch {
  // localStorage 접근 불가 환경(시크릿 모드 등)에서는 정리 생략
}

/**
 * Firestore는 undefined 필드 값을 허용하지 않으므로 저장 전 undefined 제거
 */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 핵심 포털 연동 시드 문서
 * - 하드코딩된 시드/예시 데이터는 정책(project_architecture.md §4.1)에 따라 두지 않으며,
 *   사실확인된 포털·지자체 데이터는 모두 `public/data/auto-crawled-events.json`에서 단일 관리한다.
 */
const CURATED_PORTAL_JOIN_DOCS: FirestoreEventDoc[] = [];

/**
 * 기존 지자체 행정·홍보 홈페이지 이벤트들을 FirestoreEventDoc 스키마로 변환하여 초기 시드 생성
 */
export function buildInitialSeedFirestoreDocs(): FirestoreEventDoc[] {
  const muniItems = getMunicipalEvents();
  const convertedMuniDocs: FirestoreEventDoc[] = muniItems.map((ev) => {
    const regionObj = REGION_BY_ID[ev.regionId] || REGION_BY_ID['seoul'];
    const portalInfo = resolveSigunguPortalInfo(
      ev.regionId,
      ev.lDongRegnCd,
      ev.lDongSignguCd,
      ev.sigunguName
    );

    const links: FirestorePromoLink[] = [
      {
        type: 'TIER2_PROMO',
        label: `${ev.sigunguName} 홍보포털 (${portalInfo.promoName})`,
        url: ev.sourceOrgUrl || portalInfo.promoUrl,
      },
      {
        type: 'OFFICIAL',
        label: `${portalInfo.hallName} 공식 행정홈페이지`,
        url: portalInfo.hallUrl,
      },
    ];

    if (regionObj.municipalPortalUrl && regionObj.municipalPortalUrl !== portalInfo.promoUrl) {
      links.push({
        type: 'TIER1_PROMO',
        label: `${regionObj.shortName} 광역 홍보포털 (${regionObj.municipalPortalName})`,
        url: regionObj.municipalPortalUrl,
      });
    }

    return {
      id: ev.id,
      lDongRegnCd: ev.lDongRegnCd,
      lDongSignguCd: ev.lDongSignguCd,
      sigunguName: ev.sigunguName,
      title: ev.title,
      eventDate: {
        startDate: ev.startDate,
        endDate: ev.endDate,
        scheduleNote: '기간 내 상시 및 주말 집중 프로그램 운영',
      },
      eventTime: '10:00 ~ 18:00 (야간·공연 프로그램은 21:00까지)',
      organizer: {
        host: ev.organizer || portalInfo.hallName,
        supervise: `${ev.sigunguName} 문화관광 담당부서`,
        contact: ev.tel || '해당 시·군·구청 대표전화 문의',
      },
      category: {
        lclsSystm2: ev.lclsSystm2,
        lclsSystm3: ev.lclsSystm3,
        label: `${ev.lclsSystm2Name} > ${ev.lclsSystm3Name}`,
      },
      links,
      invitation:
        ev.summary ||
        `${regionObj.name} ${ev.sigunguName} 공식 홍보 홈페이지에서 안내하는 지역 대표 행사입니다. 가족·이웃과 함께 방문하셔서 다채로운 현장 체험과 문화 프로그램을 즐겨보세요!`,
      promoLevel: computeDefaultPromoLevel({
        explicitLevel: ev.promoLevel,
        title: ev.title,
        invitation: ev.summary,
        organizer: ev.organizer,
        regionId: ev.regionId,
        lDongRegnCd: ev.lDongRegnCd,
        addr1: ev.addr1,
      }),
      addr1: ev.addr1,
      mapX: ev.mapX,
      mapY: ev.mapY,
      updatedAt: '2026-11-07T10:00:00.000Z',
    };
  });

  const map = new Map<string, FirestoreEventDoc>();
  CURATED_PORTAL_JOIN_DOCS.forEach((d) => map.set(d.id, d));
  convertedMuniDocs.forEach((d) => {
    if (!map.has(d.id)) {
      map.set(d.id, d);
    }
  });

  return Array.from(map.values());
}

function loadLocalCachedFirestoreDocs(): FirestoreEventDoc[] {
  try {
    const raw = localStorage.getItem(LOCAL_FIRESTORE_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCachedFirestoreDocs(docs: FirestoreEventDoc[]) {
  try {
    localStorage.setItem(LOCAL_FIRESTORE_CACHE_KEY, JSON.stringify(docs));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * 정적 크롤링 JSON(`public/data/auto-crawled-events.json`)을 기본(Primary) 데이터로 즉시 로드하고,
 * 로컬 캐시 및 Firebase Firestore(`koreaeventlist` 프로젝트 `events` 컬렉션)는 보조(Secondary)로 병합
 */
export async function syncAndLoadFirestoreEvents(): Promise<{
  docs: FirestoreEventDoc[];
  syncedWithCloud: boolean;
  statusMessage: string;
}> {
  const seedDocs = buildInitialSeedFirestoreDocs();
  const localDocs = loadLocalCachedFirestoreDocs();

  const mergedMap = new Map<string, FirestoreEventDoc>();
  seedDocs.forEach((d) => mergedMap.set(d.id, d));

  // [Primary] 전국 267개 지자체 + 과거 전체 기간 크롤링 JSON 스냅샷(`auto-crawled-events.json`) 로드
  let staticCrawledCount = 0;
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const snapRes = await fetch(`${baseUrl}data/auto-crawled-events.json`);
    if (snapRes.ok) {
      const snapJson = await snapRes.json();
      if (Array.isArray(snapJson?.events)) {
        snapJson.events.forEach((d: FirestoreEventDoc) => {
          if (d && d.id && d.title) {
            mergedMap.set(d.id, d);
            staticCrawledCount++;
          }
        });
      }
    }
  } catch (err) {
    // 정적 스냅샷이 없거나 오프라인이면 행사 목록이 비므로 원인 추적을 위해 콘솔에 남긴다
    console.error('[events] auto-crawled-events.json 로드 실패:', err);
  }

  // 사용자가 브라우저에서 직접 편집(manualEdited)한 로컬 문서 반영
  localDocs.forEach((d) => {
    if (d.manualEdited || !mergedMap.has(d.id)) {
      mergedMap.set(d.id, d);
    }
  });

  // [Secondary] 클라우드 Firestore 보조 동기화 (2초 타임아웃으로 UI 블로킹 방지)
  // - 클라우드에는 크롤러가 올린 과거 스냅샷도 섞여 있으므로, 수동 편집 문서이거나 정적 JSON에 없는 문서만 반영한다.
  let syncedWithCloud = false;
  try {
    const colRef = collection(firestoreDb, EVENTS_COLLECTION);
    const snapshot = await Promise.race([
      getDocs(colRef),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore timeout')), FIRESTORE_TIMEOUT_MS)
      ),
    ]);

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as FirestoreEventDoc;
      if (data && data.title) {
        const docId = data.id || docSnap.id;
        if (data.manualEdited || !mergedMap.has(docId)) {
          mergedMap.set(docId, {
            ...mergedMap.get(docId),
            ...data,
            id: docId,
          });
        }
      }
    });
    syncedWithCloud = true;
  } catch (err) {
    // 정적 JSON이 Primary이므로 클라우드 미연결 시에도 정상 동작
    console.warn('[events] Firestore 보조 동기화 건너뜀:', err);
  }

  // 공용 정규화(normalizeEventDoc) 적용: 더미 일정 제외/표시, 지자체 코드·범위 동기화
  // (회차 시리즈 링크는 크롤러가 미리 계산해 JSON에 저장하므로 프런트에서 다시 계산하지 않음)
  const finalDocs: FirestoreEventDoc[] = [];
  mergedMap.forEach((d) => {
    const normalized = normalizeEventDoc(d);
    if (normalized) finalDocs.push(normalized);
  });

  // localStorage 용량 초과 방지를 위해 수동 편집 문서 위주로만 로컬 캐시 저장
  const manualOnly = finalDocs.filter((d) => d.manualEdited);
  if (manualOnly.length > 0) {
    saveLocalCachedFirestoreDocs(manualOnly);
  }

  return {
    docs: finalDocs,
    syncedWithCloud,
    statusMessage: `정적 크롤링 JSON 기본 로드 완료 (${finalDocs.length}건 · 지자체/포털 스냅샷 ${staticCrawledCount}건)`,
  };
}

/**
 * 단일 행사 문서를 Firebase Firestore `events` 컬렉션 및 로컬 캐시에 저장/업데이트
 */
export async function upsertFirestoreEventDoc(docData: FirestoreEventDoc): Promise<{
  savedDoc: FirestoreEventDoc;
  syncedWithCloud: boolean;
}> {
  const normalized: FirestoreEventDoc = {
    ...docData,
    updatedAt: new Date().toISOString(),
  };

  // 로컬 캐시 즉시 반영
  const existing = loadLocalCachedFirestoreDocs();
  const map = new Map<string, FirestoreEventDoc>();
  buildInitialSeedFirestoreDocs().forEach((d) => map.set(d.id, d));
  existing.forEach((d) => map.set(d.id, d));
  map.set(normalized.id, normalized);
  saveLocalCachedFirestoreDocs(Array.from(map.values()));

  try {
    const docRef = doc(firestoreDb, EVENTS_COLLECTION, normalized.id);
    await setDoc(docRef, stripUndefined(normalized), { merge: true });
    return {
      savedDoc: normalized,
      syncedWithCloud: true,
    };
  } catch {
    return {
      savedDoc: normalized,
      syncedWithCloud: false,
    };
  }
}

/**
 * [핵심 엔진] 공공데이터포털(KorService2) 실시간 조회 데이터와
 * Firebase Firestore(`events` 컬렉션) 문서를 필수 연결 키 2종으로 실시간 조합(Composition)
 *
 * - 연결 키 1 (`portalContentId`): 포털의 좌표(mapX, mapY), 도로명주소(addr1), 썸네일(imageUrl) 위에
 *   Firestore의 7대 핵심 필드(행사명, 행사일, 행사시각, 주최, 행사분류, 1:N 링크, 초댓말)를 결합
 * - 연결 키 2 (`lDongRegnCd` + `lDongSignguCd`): 포털에 없는 순수 시·군·구청 홍보 홈페이지 행사도
 *   정식 2단계 행정지도 폴리곤(17개 시·도 / 250개 시·군·구)에 100% 정확하게 매핑
 */
export function composeEventsWithFirestore(
  portalEvents: UnifiedEventItem[],
  firestoreDocs: FirestoreEventDoc[]
): UnifiedEventItem[] {
  const byPortalId = new Map<string, FirestoreEventDoc>();
  const byRegionAndTitle = new Map<string, FirestoreEventDoc>();

  firestoreDocs.forEach((fDoc) => {
    if (fDoc.portalContentId) {
      byPortalId.set(String(fDoc.portalContentId).trim(), fDoc);
    }
    const cleanTitle = fDoc.title.replace(/\s+/g, '').toLowerCase();
    const regKey = `${fDoc.lDongRegnCd}-${fDoc.lDongSignguCd}-${cleanTitle}`;
    byRegionAndTitle.set(regKey, fDoc);
  });

  const matchedFirestoreDocIds = new Set<string>();

  // 1) 공공데이터포털 이벤트에 Firestore 큐레이션 필드(7대 항목) 실시간 조합
  const composedPortalEvents: UnifiedEventItem[] = portalEvents.map((pEv) => {
    const cleanTitle = pEv.title.replace(/\s+/g, '').toLowerCase();
    const regKey = `${pEv.lDongRegnCd}-${pEv.lDongSignguCd}-${cleanTitle}`;

    const matchedDoc =
      (pEv.contentId ? byPortalId.get(String(pEv.contentId).trim()) : undefined) ||
      byRegionAndTitle.get(regKey);

    if (!matchedDoc) {
      return pEv;
    }

    matchedFirestoreDocIds.add(matchedDoc.id);

    const startDate = matchedDoc.eventDate?.startDate || pEv.startDate;
    const endDate = matchedDoc.eventDate?.endDate || pEv.endDate;
    const l2 = matchedDoc.category?.lclsSystm2 || pEv.lclsSystm2;
    const l3 = matchedDoc.category?.lclsSystm3 || pEv.lclsSystm3;

    const organizerStr = [
      matchedDoc.organizer?.host,
      matchedDoc.organizer?.supervise,
      matchedDoc.organizer?.contact ? `문의: ${matchedDoc.organizer.contact}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      ...pEv,
      title: matchedDoc.title || pEv.title,
      lDongRegnCd: matchedDoc.lDongRegnCd || pEv.lDongRegnCd,
      lDongSignguCd: matchedDoc.lDongSignguCd || pEv.lDongSignguCd,
      sigunguName: matchedDoc.sigunguName || pEv.sigunguName,
      startDate,
      endDate,
      scheduleNote: matchedDoc.eventDate?.scheduleNote,
      eventTime: matchedDoc.eventTime,
      status: computeEventStatus(startDate, endDate),
      lclsSystm2: l2,
      lclsSystm2Name: getMajorCategoryName(l2),
      lclsSystm3: l3,
      lclsSystm3Name: getSubCategoryName(l3),
      organizer: organizerStr || pEv.organizer,
      invitation: matchedDoc.invitation,
      links: matchedDoc.links,
      promoLevel: computeDefaultPromoLevel({
        explicitLevel: matchedDoc.promoLevel ?? pEv.promoLevel,
        title: matchedDoc.title || pEv.title,
        invitation: matchedDoc.invitation,
        summary: pEv.summary,
        organizer: organizerStr || pEv.organizer,
        regionId: pEv.regionId,
        lDongRegnCd: matchedDoc.lDongRegnCd || pEv.lDongRegnCd,
        addr1: pEv.addr1,
      }),
      firestoreDoc: matchedDoc,
      summary: matchedDoc.invitation || pEv.summary,
      seriesId: matchedDoc.seriesId,
      seriesName: matchedDoc.seriesName,
      edition: matchedDoc.edition,
      eventYear: matchedDoc.eventYear,
      prevEventId: matchedDoc.prevEventId,
      nextEventId: matchedDoc.nextEventId,
      seriesHistory: matchedDoc.seriesHistory,
    };
  });

  // 2) 포털 목록에 없는 Firestore 문서(시·군·구청 자체 홍보 행사 또는 현재 포털 페이지 외 문서)를
  //    필수 연결 키 2 (lDongRegnCd + lDongSignguCd) 기준으로 행정지도에 결합
  const standaloneFirestoreEvents: UnifiedEventItem[] = [];

  firestoreDocs.forEach((fDoc) => {
    if (matchedFirestoreDocIds.has(fDoc.id)) return;

    // 지자체 코드·범위·더미 일정은 로드 단계(normalizeEventDoc)에서 이미 정규화됨
    const finalRegnCd = fDoc.lDongRegnCd;
    const finalSignguCd = fDoc.lDongSignguCd;
    const finalSigunguName = fDoc.sigunguName;

    const regionId = resolveRegionIdFromApi(
      finalRegnCd,
      finalSignguCd,
      fDoc.addr1 || finalSigunguName
    );
    const regionObj = REGION_BY_ID[regionId] || REGION_BY_ID['seoul'];

    const l2 = fDoc.category?.lclsSystm2 || 'MUNICIPAL';
    const l3 = fDoc.category?.lclsSystm3 || 'MU010300';
    // 일정이 없는 문서에 임의 날짜를 채우지 않는다 (상태는 UNKNOWN, 달력에는 표시되지 않음)
    const startDate = fDoc.eventDate?.startDate || '';
    const endDate = fDoc.eventDate?.endDate || startDate;
    const dateUnknown = Boolean(fDoc.eventDate?.dateUnknown) || !startDate;

    const isPortalLinked = Boolean(fDoc.portalContentId);
    const primaryLink = fDoc.links?.[0]?.url || regionObj.municipalPortalUrl;

    const organizerStr = [
      fDoc.organizer?.host,
      fDoc.organizer?.supervise,
      fDoc.organizer?.contact ? `문의: ${fDoc.organizer.contact}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ');

    standaloneFirestoreEvents.push({
      id: fDoc.id,
      contentId: fDoc.portalContentId,
      contentTypeId: '15',
      title: fDoc.title,
      source: isPortalLinked ? 'PUBLIC_PORTAL' : 'MUNICIPAL_WEB',
      sourceLabel: isPortalLinked
        ? '공공데이터포털 + Firestore 조합'
        : `${fDoc.organizer?.host || finalSigunguName} (Firestore 홍보DB)`,
      sourceOrgUrl: primaryLink,
      regionId,
      regionName: regionObj.name,
      lDongRegnCd: finalRegnCd,
      lDongSignguCd: finalSignguCd,
      sigunguName: finalSigunguName,
      lclsSystm1: l2 === 'MUNICIPAL' ? 'MU' : 'EV',
      lclsSystm2: l2,
      lclsSystm2Name: getMajorCategoryName(l2),
      lclsSystm3: l3,
      lclsSystm3Name: getSubCategoryName(l3),
      startDate,
      endDate,
      dateUnknown,
      scheduleNote: fDoc.eventDate?.scheduleNote || (dateUnknown ? '일정 미정 (홍보 페이지 참조)' : undefined),
      eventTime: fDoc.eventTime,
      status: dateUnknown ? 'UNKNOWN' : computeEventStatus(startDate, endDate),
      addr1: fDoc.addr1 || `${regionObj.name} ${finalSigunguName}`,
      tel: fDoc.organizer?.contact,
      mapX: fDoc.mapX ?? regionObj.centerLng,
      mapY: fDoc.mapY ?? regionObj.centerLat,
      imageUrl: fDoc.imageUrl,
      organizer: organizerStr,
      summary: fDoc.invitation,
      invitation: fDoc.invitation,
      links: fDoc.links,
      promoLevel: computeDefaultPromoLevel({
        explicitLevel: fDoc.promoLevel,
        title: fDoc.title,
        invitation: fDoc.invitation,
        organizer: organizerStr,
        regionId,
        lDongRegnCd: finalRegnCd,
        addr1: fDoc.addr1,
      }),
      firestoreDoc: fDoc,
      seriesId: fDoc.seriesId,
      seriesName: fDoc.seriesName,
      edition: fDoc.edition,
      eventYear: fDoc.eventYear,
      prevEventId: fDoc.prevEventId,
      nextEventId: fDoc.nextEventId,
      seriesHistory: fDoc.seriesHistory,
    });
  });

  return [...composedPortalEvents, ...standaloneFirestoreEvents];
}
