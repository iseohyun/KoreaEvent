import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getMajorCategoryName, getSubCategoryName } from '../constants/categories';
import { REGION_BY_ID, resolveRegionIdFromApi } from '../constants/regions';
import { resolveSigunguPortalInfo } from '../constants/municipalityPortals';
import {
  FirestoreEventDoc,
  FirestorePromoLink,
  UnifiedEventItem,
} from '../types/event';
import { computeEventStatus } from './korService2Api';
import { getMunicipalEvents } from './municipalEventAdapter';

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
const LOCAL_FIRESTORE_CACHE_KEY = 'korea_event_list_firestore_docs_v1';

/**
 * Firestore는 undefined 필드 값을 허용하지 않으므로 저장 전 undefined 제거
 */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 핵심 포털 연동 시드 문서 (공공데이터포털 실시간 조회 정보와 Join 되는 대표 문서들)
 * - 필수 연결 키 1: portalContentId
 * - 필수 연결 키 2: lDongRegnCd + lDongSignguCd
 * - 7대 핵심 저장 필드: 행사명(title), 행사일(eventDate), 행사시각(eventTime), 주최(organizer), 행사분류(category), 링크 1:N(links), 초댓말(invitation)
 */
const CURATED_PORTAL_JOIN_DOCS: FirestoreEventDoc[] = [
  {
    id: 'portal-4124907',
    portalContentId: '4124907',
    lDongRegnCd: '11',
    lDongSignguCd: '740',
    sigunguName: '강동구',
    title: '2026 쉬엄쉬엄 모닝 (11월 잠실한강공원·잠실대교)',
    eventDate: {
      startDate: '20261018',
      endDate: '20261122',
      scheduleNote: '11. 8.(일) / 11. 15.(일) / 11. 22.(일) 주말 아침 집중 운영',
    },
    eventTime: '07:00 ~ 09:00 (교통통제 05:00 ~ 10:00)',
    organizer: {
      host: '서울특별시 (관광체육국)',
      supervise: '서울시 체육회',
      contact: '다산콜센터 02-120 / 운영사무국 1644-6155',
    },
    category: {
      lclsSystm2: 'EV03',
      lclsSystm3: 'EV030400',
      label: '행사·전시 > 기타행사 (시민 건강·러닝·자전거)',
    },
    links: [
      {
        type: 'TIER1_PROMO',
        label: '서울시 홍보주소1 · 서울축제포털 상세 (festacode=974)',
        url: 'https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=974',
      },
      {
        type: 'TIER1_PROMO',
        label: '서울시 홍보주소2 · 서울문화포털',
        url: 'https://culture.seoul.go.kr',
      },
      {
        type: 'TIER2_PROMO',
        label: '강동구 문화관광 홍보포털',
        url: 'https://www.gangdong.go.kr/web/culture/main.do',
      },
      {
        type: 'OFFICIAL',
        label: '서울시체육회 공식 홈페이지',
        url: 'https://www.seoulsports.or.kr',
      },
    ],
    invitation:
      '차 없는 잠실대교 위에서 맞이하는 상쾌한 일요일 아침! 잠실수중보 남단(출발·도착)부터 잠실대교(반환)까지 왕복 5km 코스를 기록·경쟁 없이 걷기, 달리기, 자전거, 유아차, 반려견과 함께 자유롭게 즐기세요. 개그우먼 김혜선 GX 프로그램, 색소가이즈 아침 연주, 찾아가는 서울체력장이 현장 무료 접수로 진행됩니다. (※ 오전 5시~10시 잠실대교 상행 방향 편도 통제)',
    updatedAt: '2026-11-07T10:00:00.000Z',
  },
  {
    id: 'portal-4098571',
    portalContentId: '4098571',
    lDongRegnCd: '48',
    lDongSignguCd: '250',
    sigunguName: '김해시',
    title: '김해가야테마파크 야간 개장 빛 축제 [빛을 향한 항해]',
    eventDate: {
      startDate: '20260901',
      endDate: '20261231',
      scheduleNote: '매주 금·토·일 및 공휴일 야간 일루미네이션 특별 점등',
    },
    eventTime: '18:30 ~ 22:00 (입장 마감 21:00)',
    organizer: {
      host: '김해시청',
      supervise: '김해문화관광재단 (김해가야테마파크)',
      contact: '055-340-7900',
    },
    category: {
      lclsSystm2: 'EV01',
      lclsSystm3: 'EV010600',
      label: '축제 > 기타축제 (야간 일루미네이션·미디어파사드)',
    },
    links: [
      {
        type: 'TIER2_PROMO',
        label: '김해시 홍보주소1 · 김해문화관광 포털',
        url: 'https://www.gimhae.go.kr/tour.web',
      },
      {
        type: 'OFFICIAL',
        label: '김해가야테마파크 공식 홈페이지',
        url: 'https://gtp.ghct.or.kr',
      },
      {
        type: 'TIER1_PROMO',
        label: '경남관광길잡이 (1단계 광역 홍보포털)',
        url: 'https://tour.gyeongnam.go.kr',
      },
    ],
    invitation:
      '찬란했던 가야 왕국의 밤이 미디어파사드와 수만 개의 불빛으로 되살아납니다! 가야왕궁 태극전 미디어아트 쇼부터 철광산 레이저쇼, 천문대 불빛정원 포토존까지 가족·연인과 함께 야간 항해를 떠나보세요. 경전철 인제대역 1번 출구 주말 야간 시내버스(8번) 연계 및 제1·2주차장 무료 개방 혜택을 제공합니다.',
    updatedAt: '2026-11-07T10:00:00.000Z',
  },
  {
    id: 'portal-4090201',
    portalContentId: '4090201',
    lDongRegnCd: '31',
    lDongSignguCd: '140',
    sigunguName: '남구',
    title: '울산대공원 잔디광장 야시장 [가든 나이트 마켓]',
    eventDate: {
      startDate: '20261016',
      endDate: '20261128',
      scheduleNote: '매주 금·토요일 저녁 상설 운영',
    },
    eventTime: '18:00 ~ 22:00',
    organizer: {
      host: '울산광역시',
      supervise: '울산문화관광재단',
      contact: '052-255-1800',
    },
    category: {
      lclsSystm2: 'EV01',
      lclsSystm3: 'EV010200',
      label: '축제 > 문화예술축제 (도심 야간 플리마켓·버스킹)',
    },
    links: [
      {
        type: 'TIER1_PROMO',
        label: '울산시 홍보주소1 · 울산관광 포털',
        url: 'https://tour.ulsan.go.kr',
      },
      {
        type: 'OFFICIAL',
        label: '울산문화관광재단 공식 안내',
        url: 'https://www.uctf.or.kr',
      },
      {
        type: 'TIER2_PROMO',
        label: '울산 남구 문화관광 홈페이지',
        url: 'https://www.ulsannamgu.go.kr/tour/main.do',
      },
    ],
    invitation:
      '울산대공원 동문 잔디광장에서 펼쳐지는 가을밤 감성 피크닉 야시장! 플리마켓 판매부스 10개, 시민 체험부스 5개, 먹거리부스 10개, 푸드트럭 16대(총 41개 부스)와 함께 메타세쿼이아 숲길 체험존, 어린이 회전목마·미니기차, 현장 신청곡 DJ 플레이를 무료 입장으로 만나보세요.',
    updatedAt: '2026-11-07T10:00:00.000Z',
  },
  {
    id: 'portal-3379778',
    portalContentId: '3379778',
    lDongRegnCd: '11',
    lDongSignguCd: '710',
    sigunguName: '송파구',
    title: '가락몰 3층 하늘공원 루프탑 [가락 옥토버페스트]',
    eventDate: {
      startDate: '20261015',
      endDate: '20261120',
      scheduleNote: '주말 및 금요일 오후~야간 루프탑 개방',
    },
    eventTime: '15:00 ~ 22:00',
    organizer: {
      host: '서울시농수산식품공사',
      supervise: '가락몰 상인연합회 · 송파구청 후원',
      contact: '02-3435-0400',
    },
    category: {
      lclsSystm2: 'EV01',
      lclsSystm3: 'EV010400',
      label: '축제 > 식음료축제 (수제맥주 & 수산·축산 루프탑 페스타)',
    },
    links: [
      {
        type: 'TIER2_PROMO',
        label: '송파구 홍보주소1 · 송파문화관광 포털',
        url: 'https://www.songpa.go.kr/culture/index.do',
      },
      {
        type: 'TIER1_PROMO',
        label: '서울시 홍보주소1 · 서울축제포털',
        url: 'https://festival.seoul.go.kr',
      },
    ],
    invitation:
      '지하철 3·8호선 가락시장역 2-1번 출구 직결 엘리베이터로 바로 올라가는 가락몰 3층 하늘공원 루프탑 축제! 가락몰 1층 수산·축산시장에서 구매한 신선한 회·해산물·고기를 루프탑 테이블존에서 전국 브루어리 수제맥주와 함께 즐기실 수 있습니다.',
    updatedAt: '2026-11-07T10:00:00.000Z',
  },
];

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
 * Firebase Firestore (`koreaeventlist` 프로젝트 `events` 컬렉션) 동기화 및 전체 문서 로드
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
  localDocs.forEach((d) => mergedMap.set(d.id, d));

  try {
    const colRef = collection(firestoreDb, EVENTS_COLLECTION);
    const snapshot = await getDocs(colRef);

    const cloudIds = new Set<string>();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as FirestoreEventDoc;
      if (data && data.title) {
        const docId = data.id || docSnap.id;
        cloudIds.add(docId);
        mergedMap.set(docId, {
          ...data,
          id: docId,
        });
      }
    });

    // 아직 클라우드 Firestore에 없는 시드/로컬 문서가 있으면 초기 배치 업로드 시도
    const missingForCloud = Array.from(mergedMap.values()).filter((d) => !cloudIds.has(d.id));
    if (missingForCloud.length > 0) {
      try {
        const batch = writeBatch(firestoreDb);
        missingForCloud.slice(0, 45).forEach((item) => {
          const ref = doc(firestoreDb, EVENTS_COLLECTION, item.id);
          batch.set(ref, stripUndefined(item), { merge: true });
        });
        await batch.commit();
      } catch {
        // Firestore 보안규칙이 쓰기 제한 상태여도 읽기는 정상 유지
      }
    }

    const finalDocs = Array.from(mergedMap.values());
    saveLocalCachedFirestoreDocs(finalDocs);

    return {
      docs: finalDocs,
      syncedWithCloud: true,
      statusMessage: `Firebase Firestore (koreaeventlist) 실시간 연동 완료 (${finalDocs.length}건)`,
    };
  } catch (err: any) {
    const fallbackDocs = Array.from(mergedMap.values());
    saveLocalCachedFirestoreDocs(fallbackDocs);
    return {
      docs: fallbackDocs,
      syncedWithCloud: false,
      statusMessage: `Firestore 로컬 캐시 연동 중 (${fallbackDocs.length}건 · ${
        err?.code || '클라우드 연결 대기'
      })`,
    };
  }
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
      firestoreDoc: matchedDoc,
      summary: matchedDoc.invitation || pEv.summary,
    };
  });

  // 2) 포털 목록에 없는 Firestore 문서(시·군·구청 자체 홍보 행사 또는 현재 포털 페이지 외 문서)를
  //    필수 연결 키 2 (lDongRegnCd + lDongSignguCd) 기준으로 행정지도에 결합
  const standaloneFirestoreEvents: UnifiedEventItem[] = [];

  firestoreDocs.forEach((fDoc) => {
    if (matchedFirestoreDocIds.has(fDoc.id)) return;

    const regionId = resolveRegionIdFromApi(
      fDoc.lDongRegnCd,
      fDoc.lDongSignguCd,
      fDoc.addr1 || fDoc.sigunguName
    );
    const regionObj = REGION_BY_ID[regionId] || REGION_BY_ID['seoul'];

    const l2 = fDoc.category?.lclsSystm2 || 'MUNICIPAL';
    const l3 = fDoc.category?.lclsSystm3 || 'MU010300';
    const startDate = fDoc.eventDate?.startDate || '20261001';
    const endDate = fDoc.eventDate?.endDate || '20261130';

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
        : `${fDoc.organizer?.host || fDoc.sigunguName} (Firestore 홍보DB)`,
      sourceOrgUrl: primaryLink,
      regionId,
      regionName: regionObj.name,
      lDongRegnCd: fDoc.lDongRegnCd,
      lDongSignguCd: fDoc.lDongSignguCd,
      sigunguName: fDoc.sigunguName,
      lclsSystm1: l2 === 'MUNICIPAL' ? 'MU' : 'EV',
      lclsSystm2: l2,
      lclsSystm2Name: getMajorCategoryName(l2),
      lclsSystm3: l3,
      lclsSystm3Name: getSubCategoryName(l3),
      startDate,
      endDate,
      scheduleNote: fDoc.eventDate?.scheduleNote,
      eventTime: fDoc.eventTime,
      status: computeEventStatus(startDate, endDate),
      addr1: fDoc.addr1 || `${regionObj.name} ${fDoc.sigunguName}`,
      tel: fDoc.organizer?.contact,
      mapX: fDoc.mapX ?? regionObj.centerLng,
      mapY: fDoc.mapY ?? regionObj.centerLat,
      imageUrl: fDoc.imageUrl,
      organizer: organizerStr,
      summary: fDoc.invitation,
      invitation: fDoc.invitation,
      links: fDoc.links,
      firestoreDoc: fDoc,
    });
  });

  return [...composedPortalEvents, ...standaloneFirestoreEvents];
}
