import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { ADMIN_REGIONS, REGION_BY_ID } from '../constants/regions';
import {
  EVENT_DISCIPLINE_CATALOG,
  getMajorCategoryName,
  getSubCategoryName,
} from '../constants/categories';
import { AdminPromoRegistryData } from '../services/promoEnrichmentService';
import {
  ADMIN_EMAIL,
  AUTH_CHANGE_EVENT,
  firebaseAuth,
  getStoredGoogleUser,
  loadEventRegistrationRequests,
  LoggedInGoogleUser,
  onAuthStateChanged,
  setStoredGoogleUser,
  submitEventRegistrationRequest,
  updateEventRegistrationRequestStatus,
} from '../services/firebase';
import {
  EventDisciplineGroup,
  EventRegistrationRequestItem,
  EventRegistrationRequestMethod,
  FirestoreEventDoc,
  PromoLevel,
} from '../types/event';
import styles from './EventRegistrationView.module.css';

interface EventRegistrationViewProps {
  registry: AdminPromoRegistryData | null;
  onRegisterEventDoc: (doc: FirestoreEventDoc) => Promise<boolean>;
}

const SPORT_GROUP_OPTIONS: Array<{
  value: EventDisciplineGroup;
  label: string;
  majorCat: 'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL';
  subCat: string;
}> = [
  { value: 'SWIMMING', label: '수영 (경영·마스터즈·오픈워터·핀수영)', majorCat: 'EV03', subCat: 'EV0301' },
  { value: 'RUNNING', label: '러닝 / 마라톤 / 트레일러닝', majorCat: 'EV03', subCat: 'EV0301' },
  { value: 'CYCLING', label: '자전거 / 그란폰도 / MTB', majorCat: 'EV03', subCat: 'EV0301' },
  { value: 'TRIATHLON', label: '철인3종 / 듀애슬론 / 아쿠아슬론', majorCat: 'EV03', subCat: 'EV0301' },
  { value: 'FESTIVAL', label: '문화관광축제 / 지역축제', majorCat: 'EV01', subCat: 'EV0106' },
  { value: 'PERFORMANCE', label: '공연 / 콘서트 / 음악제', majorCat: 'EV02', subCat: 'EV0207' },
  { value: 'EXHIBITION_MUNICIPAL', label: '전시 / 박람회 / 지자체 시민참여', majorCat: 'EV03', subCat: 'EV0304' },
];

const SIDO_ALIAS_TO_REGION_ID: Array<{ re: RegExp; regionId: string }> = [
  { re: /^(?:서울특별시|서울시|서울)\b/, regionId: 'seoul' },
  { re: /^(?:부산광역시|부산시|부산)\b/, regionId: 'busan' },
  { re: /^(?:대구광역시|대구시|대구)\b/, regionId: 'daegu' },
  { re: /^(?:인천광역시|인천시|인천)\b/, regionId: 'incheon' },
  { re: /^(?:광주광역시|광주시|광주)\b/, regionId: 'gwangju' },
  { re: /^(?:대전광역시|대전시|대전)\b/, regionId: 'daejeon' },
  { re: /^(?:울산광역시|울산시|울산)\b/, regionId: 'ulsan' },
  { re: /^(?:세종특별자치시|세종시|세종)\b/, regionId: 'sejong' },
  { re: /^(?:경기도|경기)\b/, regionId: 'gyeonggi' },
  { re: /^(?:강원특별자치도|강원도|강원)\b/, regionId: 'gangwon' },
  { re: /^(?:충청북도|충북)\b/, regionId: 'chungbuk' },
  { re: /^(?:충청남도|충남)\b/, regionId: 'chungnam' },
  { re: /^(?:전북특별자치도|전라북도|전북)\b/, regionId: 'jeonbuk' },
  { re: /^(?:전라남도|전남)\b/, regionId: 'jeonnam' },
  { re: /^(?:경상북도|경북)\b/, regionId: 'gyeongbuk' },
  { re: /^(?:경상남도|경남)\b/, regionId: 'gyeongnam' },
  { re: /^(?:제주특별자치도|제주도|제주)\b/, regionId: 'jeju' },
];

function inferRegionFromText(
  addressOrVenue: string,
  fallbackRegionId: string,
  registry: AdminPromoRegistryData | null
) {
  const trimmed = (addressOrVenue || '').trim();
  let matchedRegionId = fallbackRegionId || 'seoul';
  for (const item of SIDO_ALIAS_TO_REGION_ID) {
    if (item.re.test(trimmed)) {
      matchedRegionId = item.regionId;
      break;
    }
  }
  const regObj = REGION_BY_ID[matchedRegionId] || ADMIN_REGIONS[0];
  let sigunguName = regObj.shortName;
  let lDongSignguCd = '110';

  if (registry?.municipalities) {
    for (const m of Object.values(registry.municipalities)) {
      if (m.regionId === matchedRegionId && m.name && trimmed.includes(m.name)) {
        sigunguName = m.name;
        lDongSignguCd = m.lDongSignguCd || '110';
        break;
      }
    }
  }

  return {
    regionId: regObj.id,
    regionName: regObj.name,
    lDongRegnCd: regObj.lDongRegnCd,
    sigunguName,
    lDongSignguCd,
  };
}

function isValidUrlFormat(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidDateYmdDash(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

function isDigitsOnly(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return /^\d+$/.test(trimmed);
}

/**
 * 포스터 미리보기 컴포넌트:
 * - 링크가 비어 있으면: "포스터가 등록되지 않았습니다."
 * - 이미지 로드 실패(삭제/만료) 시: "이미지가 삭제되었습니다." 그림(SVG) 대체 표시
 * - 정상 로드 시: 포스터 이미지 표시
 */
const PosterPreviewBox: React.FC<{
  posterUrl?: string;
  title?: string;
  compact?: boolean;
}> = ({ posterUrl, title, compact = false }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const trimmed = (posterUrl || '').trim();
  const isBroken = Boolean(trimmed && failedUrl === trimmed);

  if (!trimmed) {
    return (
      <div className={`${styles.posterEmptyBox} ${compact ? styles.posterBoxCompact : ''}`}>
        <ImageIcon size={compact ? 18 : 24} />
        <span>포스터가 등록되지 않았습니다.</span>
      </div>
    );
  }

  if (isBroken) {
    return (
      <div
        className={`${styles.posterDeletedBox} ${compact ? styles.posterBoxCompact : ''}`}
        role="img"
        aria-label="이미지가 삭제되었습니다."
      >
        <svg
          width={compact ? 56 : 72}
          height={compact ? 56 : 72}
          viewBox="0 0 84 84"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="6"
            y="10"
            width="72"
            height="64"
            rx="10"
            fill="#F1F5F9"
            stroke="#94A3B8"
            strokeWidth="2.5"
            strokeDasharray="5 4"
          />
          <path d="M18 58L33 43L45 54L55 44L66 58H18Z" fill="#CBD5E1" />
          <circle cx="30" cy="30" r="6" fill="#CBD5E1" />
          <line
            x1="16"
            y1="18"
            x2="68"
            y2="66"
            stroke="#EF4444"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <strong className={styles.posterDeletedTitle}>이미지가 삭제되었습니다.</strong>
        <span className={styles.posterDeletedSub}>
          원본 포스터 링크({trimmed})가 만료되었거나 삭제되어 표시할 수 없습니다.
        </span>
      </div>
    );
  }

  return (
    <div className={`${styles.posterImageFrame} ${compact ? styles.posterBoxCompact : ''}`}>
      <img
        src={trimmed}
        alt={title ? `${title} 포스터` : '행사 포스터 미리보기'}
        className={styles.posterPreviewImg}
        onError={() => setFailedUrl(trimmed)}
      />
    </div>
  );
};

export const EventRegistrationView: React.FC<EventRegistrationViewProps> = ({
  registry,
  onRegisterEventDoc,
}) => {
  // 상단 메뉴바(HeaderBar)의 구글 로그인 아이콘 상태와 실시간 동기화
  const [currentUser, setCurrentUser] = useState<LoggedInGoogleUser | null>(() =>
    getStoredGoogleUser()
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (fbUser) => {
      if (fbUser && fbUser.email) {
        const u: LoggedInGoogleUser = {
          email: fbUser.email.toLowerCase(),
          displayName: fbUser.displayName || fbUser.email.split('@')[0],
          photoURL: fbUser.photoURL || undefined,
        };
        setCurrentUser(u);
        setStoredGoogleUser(u);
      }
    });
    const handleCustomAuth = () => {
      setCurrentUser(getStoredGoogleUser());
    };
    window.addEventListener(AUTH_CHANGE_EVENT, handleCustomAuth);
    return () => {
      unsub();
      window.removeEventListener(AUTH_CHANGE_EVENT, handleCustomAuth);
    };
  }, []);

  const isAdmin = useMemo(() => {
    return (
      Boolean(currentUser?.email) &&
      currentUser!.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
  }, [currentUser]);

  // STEP 1: 프로세스 고지 (등록 --- 확인 --- 적용 [ ] 확인하였습니다.)
  const [step1Confirmed, setStep1Confirmed] = useState<boolean>(false);
  const [step1Error, setStep1Error] = useState<boolean>(false);

  // STEP 2: 3가지 등록방식 중 하나 선택 ('POSTER' | 'URL' | 'DETAILED')
  const [selectedMethod, setSelectedMethod] =
    useState<EventRegistrationRequestMethod>('POSTER');

  // 제출 시도 여부 (필수항목 * 및 형식 오류 붉은색 표시 트리거)
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);

  // --- 방식 1: 포스터로 등록 상태 ---
  const [posterModeUrl, setPosterModeUrl] = useState('');
  const [posterModeTitleHint, setPosterModeTitleHint] = useState('');
  const [posterModeNote, setPosterModeNote] = useState('');

  // --- 방식 2: URL로 등록 상태 ---
  const [urlModeNoticeUrl, setUrlModeNoticeUrl] = useState('');
  const [urlModePosterUrl, setUrlModePosterUrl] = useState('');
  const [urlModeTitleHint, setUrlModeTitleHint] = useState('');
  const [urlModeNote, setUrlModeNote] = useState('');

  // --- 방식 3: 직접 입력 등록 상태 (모든 필드 1행 `항목 - 입력` 구성) ---
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailSportGroup, setDetailSportGroup] =
    useState<EventDisciplineGroup>('SWIMMING');
  const [detailOperatingDisciplines, setDetailOperatingDisciplines] = useState<
    string[]
  >(() => [...EVENT_DISCIPLINE_CATALOG.SWIMMING]);
  const [detailPromoLevel, setDetailPromoLevel] = useState<PromoLevel>(2);
  const [detailRegionId, setDetailRegionId] = useState<string>('gyeongnam');
  const [detailVenueName, setDetailVenueName] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [detailStartDate, setDetailStartDate] = useState('2026-12-20');
  const [detailStartTime, setDetailStartTime] = useState('09:00');
  const [detailEndDate, setDetailEndDate] = useState('2026-12-20');
  const [detailEndTime, setDetailEndTime] = useState('18:00');
  const [detailScheduleNote, setDetailScheduleNote] = useState('');
  const [detailRegStartDate, setDetailRegStartDate] = useState('2026-11-30');
  const [detailRegEndDate, setDetailRegEndDate] = useState('2026-12-06');
  const [detailAdultCount, setDetailAdultCount] = useState('1000');
  const [detailStudentCount, setDetailStudentCount] = useState('0');
  const [detailRegMethodNote, setDetailRegMethodNote] = useState('');
  const [detailHost, setDetailHost] = useState('');
  const [detailContact, setDetailContact] = useState('');
  const [detailFeeText, setDetailFeeText] = useState('');
  const [detailFeeSpecialNote, setDetailFeeSpecialNote] = useState('');
  const [detailPreOpenDate, setDetailPreOpenDate] = useState('');
  const [detailPublishedAt, setDetailPublishedAt] = useState('');
  const [detailNoticeUrl, setDetailNoticeUrl] = useState('');
  const [detailPosterUrl, setDetailPosterUrl] = useState('');
  const [detailAdditionalNote, setDetailAdditionalNote] = useState('');

  // 종목 변경 시 기본 세부종목 세팅
  const handleChangeSportGroup = (nextGroup: EventDisciplineGroup) => {
    setDetailSportGroup(nextGroup);
    setDetailOperatingDisciplines([...(EVENT_DISCIPLINE_CATALOG[nextGroup] || [])]);
  };

  const toggleOperatingDiscipline = (disc: string) => {
    setDetailOperatingDisciplines((prev) =>
      prev.includes(disc) ? prev.filter((x) => x !== disc) : [...prev, disc]
    );
  };

  // 제출 배너 및 관리자 요청 리스트 상태
  const [submitBanner, setSubmitBanner] = useState<{
    type: 'SUCCESS' | 'ERROR';
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [requestsList, setRequestsList] = useState<EventRegistrationRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [adminStatusFilter, setAdminStatusFilter] = useState<
    'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
  >('PENDING');

  const refreshRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const list = await loadEventRegistrationRequests();
      setRequestsList(list);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    refreshRequests();
  }, [refreshRequests]);

  const pendingCount = useMemo(
    () => requestsList.filter((r) => r.status === 'PENDING').length,
    [requestsList]
  );

  const filteredAdminRequests = useMemo(() => {
    if (adminStatusFilter === 'ALL') return requestsList;
    return requestsList.filter((r) => r.status === adminStatusFilter);
  }, [requestsList, adminStatusFilter]);

  // --- 실시간 형식 및 필수항목 검증 (틀리면 붉은색 표시) ---
  const posterUrlInvalid =
    (submitAttempted || posterModeUrl.length > 0) &&
    !isValidUrlFormat(posterModeUrl);

  const noticeUrlInvalid =
    (submitAttempted || urlModeNoticeUrl.length > 0) &&
    !isValidUrlFormat(urlModeNoticeUrl);
  const urlOptionalPosterInvalid =
    urlModePosterUrl.trim().length > 0 && !isValidUrlFormat(urlModePosterUrl);

  const detailTitleInvalid = submitAttempted && !detailTitle.trim();
  const detailVenueInvalid = submitAttempted && !detailVenueName.trim();
  const detailHostInvalid = submitAttempted && !detailHost.trim();
  const detailFeeInvalid = submitAttempted && !detailFeeText.trim();
  const detailStartDateInvalid =
    (submitAttempted || detailStartDate.length > 0) &&
    !isValidDateYmdDash(detailStartDate);
  const detailEndDateInvalid =
    (submitAttempted || detailEndDate.length > 0) &&
    (!isValidDateYmdDash(detailEndDate) ||
      (isValidDateYmdDash(detailStartDate) && detailEndDate < detailStartDate));
  const detailRegStartInvalid =
    (submitAttempted || detailRegStartDate.length > 0) &&
    !isValidDateYmdDash(detailRegStartDate);
  const detailRegEndInvalid =
    (submitAttempted || detailRegEndDate.length > 0) &&
    (!isValidDateYmdDash(detailRegEndDate) ||
      (isValidDateYmdDash(detailRegStartDate) &&
        detailRegEndDate < detailRegStartDate));
  const detailAdultInvalid =
    (submitAttempted || detailAdultCount.length > 0) &&
    !isDigitsOnly(detailAdultCount);
  const detailStudentInvalid =
    (submitAttempted || detailStudentCount.length > 0) &&
    !isDigitsOnly(detailStudentCount);
  const detailNoticeUrlInvalid =
    detailNoticeUrl.trim().length > 0 && !isValidUrlFormat(detailNoticeUrl);
  const detailPosterUrlInvalid =
    detailPosterUrl.trim().length > 0 && !isValidUrlFormat(detailPosterUrl);

  const buildQuotaSummaryText = (adultStr: string, studentStr: string): string => {
    const a = Number(adultStr) || 0;
    const s = Number(studentStr) || 0;
    const parts: string[] = [];
    if (a > 0) parts.push(`성인 ${a.toLocaleString()}명`);
    if (s > 0) parts.push(`학생 ${s.toLocaleString()}명`);
    if (parts.length === 0) return '성인 0명 · 학생 0명';
    return parts.join(' · ');
  };

  // 1) 포스터로 등록 제출
  const handleSubmitPosterRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!step1Confirmed) {
      setStep1Error(true);
      setSubmitBanner({
        type: 'ERROR',
        message: 'STEP 1 프로세스 고지의 [확인하였습니다.]에 체크해 주세요.',
      });
      return;
    }
    if (!isValidUrlFormat(posterModeUrl)) {
      setSubmitBanner({
        type: 'ERROR',
        message: '필수 항목(*)인 포스터 이미지 URL 형식이 올바르지 않습니다.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const item: EventRegistrationRequestItem = {
        id: `req-poster-${Date.now()}`,
        method: 'POSTER',
        status: 'PENDING',
        createdAt: nowIso,
        createdByEmail: currentUser?.email || '비로그인 사용자',
        createdByName: currentUser?.displayName || '익명 요청자',
        posterUrl: posterModeUrl.trim(),
        title: posterModeTitleHint.trim() || '포스터 등록 요청',
        additionalNotes: posterModeNote.trim() || undefined,
      };
      await submitEventRegistrationRequest(item);
      await refreshRequests();
      setPosterModeUrl('');
      setPosterModeTitleHint('');
      setPosterModeNote('');
      setSubmitAttempted(false);
      setSubmitBanner({
        type: 'SUCCESS',
        message:
          '포스터 등록이 접수되었습니다. 관리자가 확인 후 이벤트에 적용합니다.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 2) URL로 등록 제출
  const handleSubmitUrlRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!step1Confirmed) {
      setStep1Error(true);
      setSubmitBanner({
        type: 'ERROR',
        message: 'STEP 1 프로세스 고지의 [확인하였습니다.]에 체크해 주세요.',
      });
      return;
    }
    if (!isValidUrlFormat(urlModeNoticeUrl) || urlOptionalPosterInvalid) {
      setSubmitBanner({
        type: 'ERROR',
        message: '붉은색으로 표시된 URL 항목의 형식을 확인해 주세요.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const item: EventRegistrationRequestItem = {
        id: `req-url-${Date.now()}`,
        method: 'URL',
        status: 'PENDING',
        createdAt: nowIso,
        createdByEmail: currentUser?.email || '비로그인 사용자',
        createdByName: currentUser?.displayName || '익명 요청자',
        noticeUrl: urlModeNoticeUrl.trim(),
        posterUrl: urlModePosterUrl.trim() || undefined,
        title: urlModeTitleHint.trim() || 'URL 등록 요청',
        additionalNotes: urlModeNote.trim() || undefined,
      };
      await submitEventRegistrationRequest(item);
      await refreshRequests();
      setUrlModeNoticeUrl('');
      setUrlModePosterUrl('');
      setUrlModeTitleHint('');
      setUrlModeNote('');
      setSubmitAttempted(false);
      setSubmitBanner({
        type: 'SUCCESS',
        message:
          'URL 등록이 접수되었습니다. 관리자가 원문 공지를 확인 후 이벤트에 적용합니다.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 3) 직접 입력 등록 제출
  const handleSubmitDetailedRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!step1Confirmed) {
      setStep1Error(true);
      setSubmitBanner({
        type: 'ERROR',
        message: 'STEP 1 프로세스 고지의 [확인하였습니다.]에 체크해 주세요.',
      });
      return;
    }

    if (
      !detailTitle.trim() ||
      !detailVenueName.trim() ||
      !detailHost.trim() ||
      !detailFeeText.trim() ||
      detailStartDateInvalid ||
      detailEndDateInvalid ||
      detailRegStartInvalid ||
      detailRegEndInvalid ||
      detailAdultInvalid ||
      detailStudentInvalid ||
      detailNoticeUrlInvalid ||
      detailPosterUrlInvalid
    ) {
      setSubmitBanner({
        type: 'ERROR',
        message: '붉은색으로 표시된 필수 항목(*) 또는 입력 형식을 확인해 주세요.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const regMeta = REGION_BY_ID[detailRegionId] || ADMIN_REGIONS[0];
      const item: EventRegistrationRequestItem = {
        id: `req-detail-${Date.now()}`,
        method: 'DETAILED',
        status: 'PENDING',
        createdAt: nowIso,
        createdByEmail: currentUser?.email || '비로그인 사용자',
        createdByName: currentUser?.displayName || '익명 요청자',
        title: detailTitle.trim(),
        sportGroup: detailSportGroup,
        operatingDisciplines: detailOperatingDisciplines,
        promoLevel: detailPromoLevel,
        regionId: regMeta.id,
        lDongRegnCd: regMeta.lDongRegnCd,
        sigunguName: regMeta.shortName,
        venuePoolName: detailVenueName.trim(),
        addr1: detailAddress.trim() || undefined,
        startDate: detailStartDate.replace(/-/g, ''),
        endDate: detailEndDate.replace(/-/g, ''),
        scheduleNote: detailScheduleNote.trim() || undefined,
        eventTime: `${detailStartTime} ~ ${detailEndTime}`,
        regStartDate: detailRegStartDate.replace(/-/g, ''),
        regEndDate: detailRegEndDate.replace(/-/g, ''),
        adultParticipantCount: Number(detailAdultCount),
        studentParticipantCount: Number(detailStudentCount),
        regMethodNote: detailRegMethodNote.trim() || undefined,
        host: detailHost.trim(),
        contact: detailContact.trim() || undefined,
        feeText: detailFeeText.trim(),
        feeSpecialNote: detailFeeSpecialNote.trim() || undefined,
        preOpenDate: detailPreOpenDate.trim() || undefined,
        publishedAt: detailPublishedAt.replace(/-/g, '') || undefined,
        noticeUrl: detailNoticeUrl.trim() || undefined,
        posterUrl: detailPosterUrl.trim() || undefined,
        additionalNotes: detailAdditionalNote.trim() || undefined,
      };
      await submitEventRegistrationRequest(item);
      await refreshRequests();
      setSubmitAttempted(false);
      setSubmitBanner({
        type: 'SUCCESS',
        message:
          '직접 입력 행사 등록이 접수되었습니다. 관리자 확인 후 정식 이벤트로 적용됩니다.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 관리자: 미확인 요청 항목을 불러와 직접 입력 폼에 채우기
  const handleLoadRequestIntoForm = (req: EventRegistrationRequestItem) => {
    setStep1Confirmed(true);
    setStep1Error(false);
    setSelectedMethod('DETAILED');
    setEditingRequestId(req.id);
    setDetailTitle(
      req.title &&
        req.title !== '포스터 등록 요청' &&
        req.title !== 'URL 등록 요청' &&
        req.title !== '포스터 기반 행사 등록 요청' &&
        req.title !== '인터넷 공지(URL) 기반 행사 등록 요청'
        ? req.title
        : ''
    );
    if (req.sportGroup && req.sportGroup in EVENT_DISCIPLINE_CATALOG) {
      const grp = req.sportGroup;
      setDetailSportGroup(grp);
      setDetailOperatingDisciplines(
        req.operatingDisciplines && req.operatingDisciplines.length > 0
          ? req.operatingDisciplines
          : [...EVENT_DISCIPLINE_CATALOG[grp]]
      );
    }
    if (req.promoLevel !== undefined) setDetailPromoLevel(req.promoLevel);
    if (req.regionId) setDetailRegionId(req.regionId);
    if (req.venuePoolName) setDetailVenueName(req.venuePoolName);
    if (req.addr1) setDetailAddress(req.addr1);
    if (req.startDate && req.startDate.length === 8) {
      setDetailStartDate(
        `${req.startDate.slice(0, 4)}-${req.startDate.slice(4, 6)}-${req.startDate.slice(6, 8)}`
      );
    }
    if (req.endDate && req.endDate.length === 8) {
      setDetailEndDate(
        `${req.endDate.slice(0, 4)}-${req.endDate.slice(4, 6)}-${req.endDate.slice(6, 8)}`
      );
    }
    if (req.scheduleNote !== undefined) setDetailScheduleNote(req.scheduleNote);
    if (req.regStartDate && req.regStartDate.length === 8) {
      setDetailRegStartDate(
        `${req.regStartDate.slice(0, 4)}-${req.regStartDate.slice(4, 6)}-${req.regStartDate.slice(6, 8)}`
      );
    }
    if (req.regEndDate && req.regEndDate.length === 8) {
      setDetailRegEndDate(
        `${req.regEndDate.slice(0, 4)}-${req.regEndDate.slice(4, 6)}-${req.regEndDate.slice(6, 8)}`
      );
    }
    if (req.adultParticipantCount !== undefined) {
      setDetailAdultCount(String(req.adultParticipantCount));
    }
    if (req.studentParticipantCount !== undefined) {
      setDetailStudentCount(String(req.studentParticipantCount));
    }
    if (req.regMethodNote) setDetailRegMethodNote(req.regMethodNote);
    if (req.host) setDetailHost(req.host);
    if (req.contact) setDetailContact(req.contact);
    if (req.feeText) setDetailFeeText(req.feeText);
    if (req.feeSpecialNote) setDetailFeeSpecialNote(req.feeSpecialNote);
    if (req.preOpenDate) setDetailPreOpenDate(req.preOpenDate);
    if (req.publishedAt && req.publishedAt.length === 8) {
      setDetailPublishedAt(
        `${req.publishedAt.slice(0, 4)}-${req.publishedAt.slice(4, 6)}-${req.publishedAt.slice(6, 8)}`
      );
    }
    if (req.noticeUrl) setDetailNoticeUrl(req.noticeUrl);
    if (req.posterUrl) setDetailPosterUrl(req.posterUrl);
    if (req.additionalNotes) setDetailAdditionalNote(req.additionalNotes);
  };

  // 관리자 전용: 현재 폼 데이터를 실제 이벤트(`FirestoreEventDoc`)로 승인·적용
  const handleAdminApproveAndCreateEvent = async () => {
    setSubmitAttempted(true);
    if (!detailTitle.trim() || !detailVenueName.trim() || !detailHost.trim()) {
      setSubmitBanner({
        type: 'ERROR',
        message: '승인·적용을 위해 필수 항목(* 표시된 행사명, 행사위치, 주최)을 확인해 주세요.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const startYmd =
        detailStartDate.replace(/[^0-9]/g, '').slice(0, 8) || '20261220';
      const endYmd =
        (detailEndDate || detailStartDate).replace(/[^0-9]/g, '').slice(0, 8) ||
        startYmd;
      const geo = inferRegionFromText(
        `${detailAddress} ${detailVenueName}`,
        detailRegionId,
        registry
      );
      const sportOpt =
        SPORT_GROUP_OPTIONS.find((o) => o.value === detailSportGroup) ||
        SPORT_GROUP_OPTIONS[0];

      const links = [];
      if (detailNoticeUrl.trim()) {
        links.push({
          label: `${detailTitle.trim()} 원문 공지`,
          url: detailNoticeUrl.trim(),
          type: 'OFFICIAL' as const,
        });
      }

      const regStartYmd = detailRegStartDate.replace(/[^0-9]/g, '').slice(0, 8);
      const regEndYmd = detailRegEndDate.replace(/[^0-9]/g, '').slice(0, 8);
      const quotaSummary = buildQuotaSummaryText(detailAdultCount, detailStudentCount);

      const newDoc: FirestoreEventDoc = {
        id: `fs-approved-${Date.now()}`,
        lDongRegnCd: geo.lDongRegnCd,
        lDongSignguCd: geo.lDongSignguCd,
        sigunguName: geo.sigunguName,
        title: detailTitle.trim(),
        category: {
          lclsSystm2: sportOpt.majorCat,
          lclsSystm3: sportOpt.subCat,
          label: `${getMajorCategoryName(sportOpt.majorCat)} > ${getSubCategoryName(sportOpt.subCat)}`,
        },
        eventDate: {
          startDate: startYmd,
          endDate: endYmd,
          scheduleNote: detailScheduleNote.trim() || undefined,
        },
        eventTime: `${detailStartTime || '09:00'} ~ ${detailEndTime || '18:00'}`,
        organizer: {
          host: detailHost.trim() || `${geo.regionName} 행사 주최기관`,
          contact: detailContact.trim() || undefined,
        },
        invitation:
          detailAdditionalNote.trim() ||
          `${detailTitle.trim()} (${detailVenueName || geo.regionName})`,
        links,
        promoLevel: detailPromoLevel,
        addr1:
          detailAddress.trim() ||
          detailVenueName.trim() ||
          `${geo.regionName} ${geo.sigunguName}`,
        mapX: 127.0,
        mapY: 37.5,
        venuePoolName: detailVenueName.trim() || undefined,
        sportDisciplineGroup: detailSportGroup,
        operatingDisciplines: detailOperatingDisciplines,
        feeText: detailFeeText.trim() || '무료',
        feeSpecialNote: detailFeeSpecialNote.trim() || undefined,
        preOpenDate: detailPreOpenDate.trim() || undefined,
        publishedAt:
          detailPublishedAt.replace(/[^0-9]/g, '').slice(0, 8) ||
          nowIso.slice(0, 10).replace(/-/g, ''),
        firstSeenAt: nowIso,
        updatedAt: nowIso,
        updateSummary: '관리자 확인 및 적용 완료 (신규 등록)',
        posterUrl: detailPosterUrl.trim() || undefined,
        manualEdited: true,
        registrationPeriod: regStartYmd
          ? {
              startDate: regStartYmd,
              endDate: regEndYmd || regStartYmd,
              quotaNote: quotaSummary,
              methodNote: detailRegMethodNote.trim() || undefined,
              registrationUrl: detailNoticeUrl.trim() || undefined,
            }
          : undefined,
      };

      await onRegisterEventDoc(newDoc);

      if (editingRequestId) {
        await updateEventRegistrationRequestStatus(editingRequestId, {
          status: 'APPROVED',
          approvedEventId: newDoc.id,
          reviewedAt: nowIso,
          reviewedByEmail: currentUser?.email || ADMIN_EMAIL,
        });
        setEditingRequestId(null);
        await refreshRequests();
      }

      setSubmitAttempted(false);
      setSubmitBanner({
        type: 'SUCCESS',
        message: `✅ [${newDoc.title}] 행사가 확인·적용되어 전체 이벤트 DB 및 새소식 탭에 반영되었습니다!`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    await updateEventRegistrationRequestStatus(requestId, {
      status: 'REJECTED',
      reviewedAt: new Date().toISOString(),
      reviewedByEmail: currentUser?.email || ADMIN_EMAIL,
    });
    if (editingRequestId === requestId) {
      setEditingRequestId(null);
    }
    await refreshRequests();
  };

  return (
    <main className={styles.pageContainer}>
      {/* 관리자(iseohyun@hanmail.net) 로그인 시 표시되는 서버 미확인 요청 리스트 */}
      {isAdmin && (
        <section
          className={styles.adminPendingPanel}
          aria-label="관리자 전용 미확인 행사 등록 요청 리스트"
        >
          <div className={styles.adminPanelHeader}>
            <div className={styles.adminPanelTitleWrap}>
              <span className={styles.adminShieldBadge}>
                <ShieldCheck size={15} />
                <span>관리자 승인 모드 ({ADMIN_EMAIL})</span>
              </span>
              <h3 className={styles.adminPanelTitle}>
                서버 미확인 행사 등록 요청 리스트
              </h3>
              <span className={styles.adminPendingCountBadge}>
                미확인 {pendingCount}건
              </span>
            </div>

            <div className={styles.adminHeaderControls}>
              <div className={styles.adminStatusTabs}>
                {(
                  [
                    { key: 'PENDING', label: `미확인 (${pendingCount})` },
                    { key: 'APPROVED', label: '적용완료' },
                    { key: 'REJECTED', label: '반려됨' },
                    { key: 'ALL', label: `전체 (${requestsList.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`${styles.adminStatusTabBtn} ${
                      adminStatusFilter === tab.key
                        ? styles.adminStatusTabBtnActive
                        : ''
                    }`}
                    onClick={() => setAdminStatusFilter(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={styles.refreshQueueBtn}
                onClick={refreshRequests}
                disabled={loadingRequests}
              >
                <RefreshCw size={14} />
                <span>새로고침</span>
              </button>
            </div>
          </div>

          {filteredAdminRequests.length === 0 ? (
            <div className={styles.adminEmptyBox}>
              현재 해당 상태({adminStatusFilter})의 등록 요청이 없습니다.
            </div>
          ) : (
            <div className={styles.adminRequestsGrid}>
              {filteredAdminRequests.map((req) => {
                const methodLabel =
                  req.method === 'POSTER'
                    ? '포스터로 등록'
                    : req.method === 'URL'
                      ? 'URL로 등록'
                      : '직접 입력 등록';
                return (
                  <article key={req.id} className={styles.adminRequestCard}>
                    <div className={styles.adminReqTopBar}>
                      <div className={styles.adminReqBadges}>
                        <span className={styles.methodTag}>{methodLabel}</span>
                        <span
                          className={
                            req.status === 'PENDING'
                              ? styles.statusPendingTag
                              : req.status === 'APPROVED'
                                ? styles.statusApprovedTag
                                : styles.statusRejectedTag
                          }
                        >
                          {req.status === 'PENDING'
                            ? '⏳ 확인 대기'
                            : req.status === 'APPROVED'
                              ? '✅ 적용됨'
                              : '❌ 반려됨'}
                        </span>
                      </div>
                      <span className={styles.adminReqTime}>
                        <Clock size={12} />
                        {req.createdAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>

                    <h4 className={styles.adminReqTitle}>
                      {req.title || '(제목 미입력 요청)'}
                    </h4>

                    <div className={styles.adminReqMetaList}>
                      <div>
                        <strong>요청자:</strong> {req.createdByEmail || '익명'}
                      </div>
                      {req.noticeUrl && (
                        <div className={styles.adminReqLinkRow}>
                          <strong>원문 URL:</strong>{' '}
                          <a
                            href={req.noticeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.adminExternalLink}
                          >
                            <span>{req.noticeUrl}</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                      {req.posterUrl && (
                        <div className={styles.adminReqLinkRow}>
                          <strong>포스터 URL:</strong>{' '}
                          <a
                            href={req.posterUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.adminExternalLink}
                          >
                            <span>{req.posterUrl}</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                      {req.venuePoolName && (
                        <div>
                          <strong>행사위치:</strong> {req.venuePoolName}{' '}
                          {req.addr1 ? `(${req.addr1})` : ''}
                        </div>
                      )}
                      {req.startDate && (
                        <div>
                          <strong>행사기간:</strong> {req.startDate} ~{' '}
                          {req.endDate || req.startDate}
                        </div>
                      )}
                      {(req.adultParticipantCount !== undefined ||
                        req.studentParticipantCount !== undefined) && (
                        <div>
                          <strong>참가인원:</strong> 성인{' '}
                          {req.adultParticipantCount ?? 0}명 / 학생{' '}
                          {req.studentParticipantCount ?? 0}명
                        </div>
                      )}
                      {req.additionalNotes && (
                        <div className={styles.adminReqNotes}>
                          <strong>추가사항:</strong> {req.additionalNotes}
                        </div>
                      )}
                    </div>

                    {req.posterUrl && (
                      <div className={styles.adminPosterPreviewWrap}>
                        <PosterPreviewBox
                          posterUrl={req.posterUrl}
                          title={req.title}
                          compact
                        />
                      </div>
                    )}

                    {req.status === 'PENDING' && (
                      <div className={styles.adminReqActionRow}>
                        <button
                          type="button"
                          className={styles.adminInspectApproveBtn}
                          onClick={() => handleLoadRequestIntoForm(req)}
                        >
                          <CheckCircle2 size={14} />
                          <span>확인 및 적용 폼으로 불러오기</span>
                        </button>
                        <button
                          type="button"
                          className={styles.adminRejectBtn}
                          onClick={() => handleRejectRequest(req.id)}
                        >
                          <XCircle size={14} />
                          <span>반려</span>
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          STEP 1: 프로세스 고지 (O --- O --- O 등록 · 확인 · 적용 + [ ] 확인하였습니다.)
         ===================================================================== */}
      <section
        className={`${styles.stepCard} ${
          step1Error && !step1Confirmed ? styles.stepCardInvalid : ''
        }`}
        aria-label="STEP 1 프로세스 고지"
      >
        <div className={styles.stepHeaderRow}>
          <span className={styles.stepBadge}>STEP 1</span>
          <h2 className={styles.stepTitle}>프로세스 고지</h2>
        </div>

        {/* O --- O --- O 형식의 그래픽: 등록 --- 확인 --- 적용 */}
        <div
          className={styles.processGraphicWrap}
          role="img"
          aria-label="행사 등록 프로세스: 등록, 확인, 적용"
        >
          <div className={styles.processNode}>
            <div className={styles.processCircle}>등록</div>
            <span className={styles.processNodeCaption}>
              포스터·URL·직접 입력 중 선택하여 등록
            </span>
          </div>

          <div className={styles.processConnectorLine} aria-hidden="true" />

          <div className={styles.processNode}>
            <div className={styles.processCircle}>확인</div>
            <span className={styles.processNodeCaption}>
              관리자가 제출된 원문·포스터·일정 확인
            </span>
          </div>

          <div className={styles.processConnectorLine} aria-hidden="true" />

          <div className={styles.processNode}>
            <div className={styles.processCircle}>적용</div>
            <span className={styles.processNodeCaption}>
              전체 행사 리스트 및 새소식 탭에 정식 반영
            </span>
          </div>
        </div>

        {/* [ ] 확인하였습니다. */}
        <div className={styles.step1ConfirmBar}>
          <label
            className={`${styles.confirmCheckLabel} ${
              step1Error && !step1Confirmed ? styles.confirmCheckLabelInvalid : ''
            }`}
          >
            <input
              type="checkbox"
              checked={step1Confirmed}
              onChange={(e) => {
                setStep1Confirmed(e.target.checked);
                if (e.target.checked) setStep1Error(false);
              }}
              className={styles.confirmCheckbox}
            />
            <span>확인하였습니다. *</span>
          </label>
          {step1Error && !step1Confirmed && (
            <span className={styles.fieldErrorMsg}>
              프로세스 고지 내용을 확인하고 체크해 주세요.
            </span>
          )}
        </div>
      </section>

      {/* =====================================================================
          STEP 2: 3가지 등록방식 중 하나 선택 (포스터로 등록 / URL로 등록 / 직접 입력 등록)
         ===================================================================== */}
      <section className={styles.stepCard} aria-label="STEP 2 등록방식 선택 및 입력">
        <div className={styles.stepHeaderRow}>
          <span className={styles.stepBadge}>STEP 2</span>
          <h2 className={styles.stepTitle}>등록방식 선택</h2>
        </div>

        <div
          className={styles.methodTabsRow}
          role="tablist"
          aria-label="3가지 등록방식 중 하나 선택"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedMethod === 'POSTER'}
            className={`${styles.methodTabBtn} ${
              selectedMethod === 'POSTER' ? styles.methodTabBtnActive : ''
            }`}
            onClick={() => {
              setSelectedMethod('POSTER');
              setSubmitAttempted(false);
              setSubmitBanner(null);
            }}
          >
            <ImageIcon size={18} />
            <span>포스터로 등록</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedMethod === 'URL'}
            className={`${styles.methodTabBtn} ${
              selectedMethod === 'URL' ? styles.methodTabBtnActive : ''
            }`}
            onClick={() => {
              setSelectedMethod('URL');
              setSubmitAttempted(false);
              setSubmitBanner(null);
            }}
          >
            <Link2 size={18} />
            <span>URL로 등록</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedMethod === 'DETAILED'}
            className={`${styles.methodTabBtn} ${
              selectedMethod === 'DETAILED' ? styles.methodTabBtnActive : ''
            }`}
            onClick={() => {
              setSelectedMethod('DETAILED');
              setSubmitAttempted(false);
              setSubmitBanner(null);
            }}
          >
            <FileText size={18} />
            <span>직접 입력 등록</span>
          </button>
        </div>

        {/* 제출 결과 배너 */}
        {submitBanner && (
          <div
            className={`${styles.submitBanner} ${
              submitBanner.type === 'SUCCESS'
                ? styles.submitBannerSuccess
                : styles.submitBannerError
            }`}
          >
            <span>{submitBanner.message}</span>
            <button
              type="button"
              className={styles.bannerCloseBtn}
              onClick={() => setSubmitBanner(null)}
            >
              닫기
            </button>
          </div>
        )}

        {/* -----------------------------------------------------------------
            2-1. 포스터로 등록 Form (`항목 - 입력` 1행씩 위에서 아래로 진행)
           ----------------------------------------------------------------- */}
        {selectedMethod === 'POSTER' && (
          <form onSubmit={handleSubmitPosterRequest} noValidate className={styles.singleRowFormList}>
            <div
              className={`${styles.itemInputRow} ${
                posterUrlInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="poster-url-input">
                포스터 이미지 URL <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="poster-url-input"
                  type="url"
                  value={posterModeUrl}
                  onChange={(e) => setPosterModeUrl(e.target.value)}
                  placeholder="https://.../poster.jpg (http:// 또는 https:// 시작 주소)"
                  className={`${styles.rowInput} ${
                    posterUrlInvalid ? styles.inputInvalid : ''
                  }`}
                />
                <div className={styles.sampleHelperRow}>
                  <button
                    type="button"
                    className={styles.sampleMiniBtn}
                    onClick={() => {
                      const base = import.meta.env.BASE_URL || '/';
                      setPosterModeUrl(
                        `${base}images/posters/swim-gyeongnam-masters-2026.jpg`
                      );
                      setPosterModeTitleHint(
                        '2026 경남수영연맹 회장배 전국 마스터즈 수영대회'
                      );
                    }}
                  >
                    샘플 포스터 불러오기
                  </button>
                  <button
                    type="button"
                    className={styles.sampleMiniBtn}
                    onClick={() =>
                      setPosterModeUrl('https://invalid.example.com/deleted-poster.jpg')
                    }
                  >
                    삭제된 이미지 링크 대체 테스트
                  </button>
                </div>
                {posterUrlInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    올바른 포스터 이미지 URL(http:// 또는 https://)을 입력해 주세요.
                  </span>
                )}
              </div>
            </div>

            <div className={styles.itemInputRow}>
              <span className={styles.rowLabel}>포스터 미리보기</span>
              <div className={styles.rowInputWrap}>
                <PosterPreviewBox
                  posterUrl={posterModeUrl}
                  title={posterModeTitleHint}
                  compact
                />
              </div>
            </div>

            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="poster-title-input">
                행사명
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="poster-title-input"
                  type="text"
                  value={posterModeTitleHint}
                  onChange={(e) => setPosterModeTitleHint(e.target.value)}
                  placeholder="예: 2026 경남수영연맹 회장배 전국 마스터즈 수영대회 (선택)"
                  className={styles.rowInput}
                />
              </div>
            </div>

            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="poster-note-input">
                추가사항
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="poster-note-input"
                  type="text"
                  value={posterModeNote}
                  onChange={(e) => setPosterModeNote(e.target.value)}
                  placeholder="관리자가 참고할 출처나 메모가 있다면 입력해 주세요 (선택)"
                  className={styles.rowInput}
                />
              </div>
            </div>

            <div className={styles.formSubmitRow}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.primarySubmitBtn}
              >
                <Send size={16} />
                <span>행사 등록하기</span>
              </button>
            </div>
          </form>
        )}

        {/* -----------------------------------------------------------------
            2-2. URL로 등록 Form (`항목 - 입력` 1행씩 위에서 아래로 진행)
           ----------------------------------------------------------------- */}
        {selectedMethod === 'URL' && (
          <form onSubmit={handleSubmitUrlRequest} noValidate className={styles.singleRowFormList}>
            <div
              className={`${styles.itemInputRow} ${
                noticeUrlInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="url-notice-input">
                공지 게시글 URL <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="url-notice-input"
                  type="url"
                  value={urlModeNoticeUrl}
                  onChange={(e) => setUrlModeNoticeUrl(e.target.value)}
                  placeholder="예: http://www.gswimming.com/34/1525090 (실제 게시글 클릭 주소)"
                  className={`${styles.rowInput} ${
                    noticeUrlInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {noticeUrlInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    올바른 인터넷 공지 URL(http:// 또는 https://)을 입력해 주세요.
                  </span>
                )}
              </div>
            </div>

            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="url-title-input">
                행사명
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="url-title-input"
                  type="text"
                  value={urlModeTitleHint}
                  onChange={(e) => setUrlModeTitleHint(e.target.value)}
                  placeholder="예: 2026 경기도수영연맹회장배 마스터즈 수영대회 (선택)"
                  className={styles.rowInput}
                />
              </div>
            </div>

            <div
              className={`${styles.itemInputRow} ${
                urlOptionalPosterInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="url-poster-input">
                포스터 이미지 URL
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="url-poster-input"
                  type="url"
                  value={urlModePosterUrl}
                  onChange={(e) => setUrlModePosterUrl(e.target.value)}
                  placeholder="포스터 이미지 링크가 있다면 함께 입력해 주세요 (선택)"
                  className={`${styles.rowInput} ${
                    urlOptionalPosterInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {urlOptionalPosterInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    포스터 URL 형식이 올바르지 않습니다 (http:// 또는 https://).
                  </span>
                )}
              </div>
            </div>

            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="url-note-input">
                추가사항
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="url-note-input"
                  type="text"
                  value={urlModeNote}
                  onChange={(e) => setUrlModeNote(e.target.value)}
                  placeholder="관리자에게 전달할 참고사항이 있다면 입력해 주세요 (선택)"
                  className={styles.rowInput}
                />
              </div>
            </div>

            <div className={styles.formSubmitRow}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.primarySubmitBtn}
              >
                <Send size={16} />
                <span>행사 등록하기</span>
              </button>
            </div>
          </form>
        )}

        {/* -----------------------------------------------------------------
            2-3. 직접 입력 등록 Form (`항목 - 입력` 1행씩 위에서 아래로만 진행)
           ----------------------------------------------------------------- */}
        {selectedMethod === 'DETAILED' && (
          <form
            onSubmit={handleSubmitDetailedRequest}
            noValidate
            className={styles.singleRowFormList}
          >
            {/* 1. 행사명 * */}
            <div
              className={`${styles.itemInputRow} ${
                detailTitleInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-title">
                행사명 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-title"
                  type="text"
                  value={detailTitle}
                  onChange={(e) => setDetailTitle(e.target.value)}
                  placeholder="예: 2026 경남수영연맹 회장배 전국 마스터즈 수영대회"
                  className={`${styles.rowInput} ${
                    detailTitleInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {detailTitleInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    필수 항목입니다. 행사명을 입력해 주세요.
                  </span>
                )}
              </div>
            </div>

            {/* 2. 행사 분류 * */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-sport-group">
                행사 분류 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <select
                  id="detail-sport-group"
                  value={detailSportGroup}
                  onChange={(e) =>
                    handleChangeSportGroup(e.target.value as EventDisciplineGroup)
                  }
                  className={styles.rowSelect}
                >
                  {SPORT_GROUP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. 행사 범위 * */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-promo-level">
                행사 범위 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <select
                  id="detail-promo-level"
                  value={detailPromoLevel}
                  onChange={(e) =>
                    setDetailPromoLevel(Number(e.target.value) as PromoLevel)
                  }
                  className={styles.rowSelect}
                >
                  <option value={3}>세계/대한연맹 (전국 규모)</option>
                  <option value={2}>광역시도</option>
                  <option value={1}>시군구</option>
                  <option value={0}>동네/클럽</option>
                </select>
              </div>
            </div>

            {/* 4. 종목 * */}
            <div className={styles.itemInputRow}>
              <span className={styles.rowLabel}>
                종목 <span className={styles.reqStar}>*</span>
              </span>
              <div className={styles.rowInputWrap}>
                <div className={styles.disciplineChipsWrap}>
                  {(EVENT_DISCIPLINE_CATALOG[detailSportGroup] || []).map(
                    (disc: string) => {
                      const active = detailOperatingDisciplines.includes(disc);
                      return (
                        <button
                          key={disc}
                          type="button"
                          className={`${styles.discToggleChip} ${
                            active
                              ? styles.discToggleChipActive
                              : styles.discToggleChipDimmed
                          }`}
                          onClick={() => toggleOperatingDiscipline(disc)}
                        >
                          {disc}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            {/* 5. 행사 시작 * */}
            <div
              className={`${styles.itemInputRow} ${
                detailStartDateInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-start-date">
                행사 시작 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <div className={styles.inlineDateAndTime}>
                  <input
                    id="detail-start-date"
                    type="date"
                    value={detailStartDate}
                    onChange={(e) => {
                      setDetailStartDate(e.target.value);
                      if (!detailEndDate || detailEndDate < e.target.value) {
                        setDetailEndDate(e.target.value);
                      }
                    }}
                    className={`${styles.rowInput} ${
                      detailStartDateInvalid ? styles.inputInvalid : ''
                    }`}
                  />
                  <input
                    type="time"
                    aria-label="행사 시작 시각"
                    value={detailStartTime}
                    onChange={(e) => setDetailStartTime(e.target.value)}
                    className={styles.rowTimeInput}
                  />
                </div>
                {detailStartDateInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    행사 시작 날짜를 올바른 형식(YYYY-MM-DD)으로 입력해 주세요.
                  </span>
                )}
              </div>
            </div>

            {/* 6. 행사 종료 * */}
            <div
              className={`${styles.itemInputRow} ${
                detailEndDateInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-end-date">
                행사 종료 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <div className={styles.inlineDateAndTime}>
                  <input
                    id="detail-end-date"
                    type="date"
                    value={detailEndDate}
                    onChange={(e) => setDetailEndDate(e.target.value)}
                    className={`${styles.rowInput} ${
                      detailEndDateInvalid ? styles.inputInvalid : ''
                    }`}
                  />
                  <input
                    type="time"
                    aria-label="행사 종료 시각"
                    value={detailEndTime}
                    onChange={(e) => setDetailEndTime(e.target.value)}
                    className={styles.rowTimeInput}
                  />
                </div>
                {detailEndDateInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    행사 종료일은 행사 시작일 이후여야 하며 올바른 날짜 형식이어야 합니다.
                  </span>
                )}
              </div>
            </div>

            {/* 7. 일정 비고 (참가인원과 분리된 독립 1행) */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-schedule-note">
                일정 비고
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-schedule-note"
                  type="text"
                  value={detailScheduleNote}
                  onChange={(e) => setDetailScheduleNote(e.target.value)}
                  placeholder="예: 우천 시 순연 / 개회식 10:00 시작"
                  className={styles.rowInput}
                />
              </div>
            </div>

            {/* 8. 사전개방일 */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-preopen">
                사전개방일
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-preopen"
                  type="text"
                  value={detailPreOpenDate}
                  onChange={(e) => setDetailPreOpenDate(e.target.value)}
                  placeholder="예: 2026.12.20 07:30 ~ 08:40 당일 워밍업 사전개방"
                  className={styles.rowInput}
                />
              </div>
            </div>

            {/* 9. 모집 시작 * */}
            <div
              className={`${styles.itemInputRow} ${
                detailRegStartInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-reg-start">
                모집 시작 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-reg-start"
                  type="date"
                  value={detailRegStartDate}
                  onChange={(e) => {
                    setDetailRegStartDate(e.target.value);
                    if (!detailRegEndDate || detailRegEndDate < e.target.value) {
                      setDetailRegEndDate(e.target.value);
                    }
                  }}
                  className={`${styles.rowInput} ${
                    detailRegStartInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {detailRegStartInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    모집 시작 날짜를 올바른 형식(YYYY-MM-DD)으로 입력해 주세요.
                  </span>
                )}
              </div>
            </div>

            {/* 10. 모집 종료 * */}
            <div
              className={`${styles.itemInputRow} ${
                detailRegEndInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-reg-end">
                모집 종료 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-reg-end"
                  type="date"
                  value={detailRegEndDate}
                  onChange={(e) => setDetailRegEndDate(e.target.value)}
                  className={`${styles.rowInput} ${
                    detailRegEndInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {detailRegEndInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    모집 종료일은 모집 시작일 이후여야 하며 올바른 날짜 형식이어야 합니다.
                  </span>
                )}
              </div>
            </div>

            {/* 11. 참가 인원 (성인) * - 숫자로만 입력 */}
            <div
              className={`${styles.itemInputRow} ${
                detailAdultInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-adult-count">
                참가 인원 (성인) <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <div className={styles.numberUnitWrap}>
                  <input
                    id="detail-adult-count"
                    type="text"
                    inputMode="numeric"
                    value={detailAdultCount}
                    onChange={(e) => setDetailAdultCount(e.target.value)}
                    placeholder="숫자만 입력 (예: 1000)"
                    className={`${styles.rowInput} ${
                      detailAdultInvalid ? styles.inputInvalid : ''
                    }`}
                  />
                  <span className={styles.unitSuffix}>명</span>
                </div>
                {detailAdultInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    성인 참가 인원은 숫자로만 입력해 주세요 (예: 500, 없으면 0).
                  </span>
                )}
              </div>
            </div>

            {/* 12. 참가 인원 (학생) * - 숫자로만 입력 */}
            <div
              className={`${styles.itemInputRow} ${
                detailStudentInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-student-count">
                참가 인원 (학생) <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <div className={styles.numberUnitWrap}>
                  <input
                    id="detail-student-count"
                    type="text"
                    inputMode="numeric"
                    value={detailStudentCount}
                    onChange={(e) => setDetailStudentCount(e.target.value)}
                    placeholder="숫자만 입력 (예: 200, 없으면 0)"
                    className={`${styles.rowInput} ${
                      detailStudentInvalid ? styles.inputInvalid : ''
                    }`}
                  />
                  <span className={styles.unitSuffix}>명</span>
                </div>
                {detailStudentInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    학생 참가 인원은 숫자로만 입력해 주세요 (예: 200, 없으면 0).
                  </span>
                )}
              </div>
            </div>

            {/* 13. 접수 방법 */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-reg-method">
                접수 방법
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-reg-method"
                  type="text"
                  value={detailRegMethodNote}
                  onChange={(e) => setDetailRegMethodNote(e.target.value)}
                  placeholder="예: 공식 밴드 가입 후 신청서 이메일 접수 / 홈페이지 온라인 접수"
                  className={styles.rowInput}
                />
              </div>
            </div>

            {/* 14. 행사지역 (행정구역) * */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-region">
                행사지역 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <select
                  id="detail-region"
                  value={detailRegionId}
                  onChange={(e) => setDetailRegionId(e.target.value)}
                  className={styles.rowSelect}
                >
                  {ADMIN_REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 15. 행사위치 (수영장 위치 또는 결집지) * */}
            <div
              className={`${styles.itemInputRow} ${
                detailVenueInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-venue">
                행사위치 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-venue"
                  type="text"
                  value={detailVenueName}
                  onChange={(e) => setDetailVenueName(e.target.value)}
                  placeholder="예: 창원실내수영장 / 여의도 한강공원 이벤트광장"
                  className={`${styles.rowInput} ${
                    detailVenueInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {detailVenueInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    필수 항목입니다. 수영장 이름 또는 결집지(행사장)를 입력해 주세요.
                  </span>
                )}
              </div>
            </div>

            {/* 16. 상세 주소 */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-address">
                상세 주소
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-address"
                  type="text"
                  value={detailAddress}
                  onChange={(e) => setDetailAddress(e.target.value)}
                  placeholder="예: 경상남도 창원시 성산구 원이대로 450"
                  className={styles.rowInput}
                />
              </div>
            </div>

            {/* 17. 주최 * */}
            <div
              className={`${styles.itemInputRow} ${
                detailHostInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-host">
                주최 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-host"
                  type="text"
                  value={detailHost}
                  onChange={(e) => setDetailHost(e.target.value)}
                  placeholder="예: 경상남도수영연맹, 경상남도체육회"
                  className={`${styles.rowInput} ${
                    detailHostInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {detailHostInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    필수 항목입니다. 주최/주관 기관명을 입력해 주세요.
                  </span>
                )}
              </div>
            </div>

            {/* 18. 연락처 */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-contact">
                연락처
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-contact"
                  type="text"
                  value={detailContact}
                  onChange={(e) => setDetailContact(e.target.value)}
                  placeholder="예: gn_aquatics@naver.com / 055-266-1234"
                  className={styles.rowInput}
                />
              </div>
            </div>

            {/* 19. 참가비 * */}
            <div
              className={`${styles.itemInputRow} ${
                detailFeeInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-fee">
                참가비 <span className={styles.reqStar}>*</span>
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-fee"
                  type="text"
                  value={detailFeeText}
                  onChange={(e) => setDetailFeeText(e.target.value)}
                  placeholder="예: 1인당 30,000원 (무료인 경우 '무료' 입력)"
                  className={`${styles.rowInput} ${
                    detailFeeInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {detailFeeInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    필수 항목입니다. 참가비(또는 무료)를 입력해 주세요.
                  </span>
                )}
              </div>
            </div>

            {/* 20. 참가비 특이사항 (* 각주) */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-fee-note">
                참가비 특이사항
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-fee-note"
                  type="text"
                  value={detailFeeSpecialNote}
                  onChange={(e) => setDetailFeeSpecialNote(e.target.value)}
                  placeholder="예: 단체/얼리버드 할인 안내 등 (상세보기 하단 붉은색 * 각주로 표시됨)"
                  className={styles.rowInput}
                />
              </div>
            </div>

            {/* 21. 최초공지일 */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-published-at">
                최초공지일
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-published-at"
                  type="date"
                  value={detailPublishedAt}
                  onChange={(e) => setDetailPublishedAt(e.target.value)}
                  className={styles.rowInput}
                />
              </div>
            </div>

            {/* 22. 원문 공지 URL */}
            <div
              className={`${styles.itemInputRow} ${
                detailNoticeUrlInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-notice-url">
                원문 공지 URL
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-notice-url"
                  type="url"
                  value={detailNoticeUrl}
                  onChange={(e) => setDetailNoticeUrl(e.target.value)}
                  placeholder="예: https://band.us/n/a0aeb0K2u0552 (실제 게시글 클릭 주소)"
                  className={`${styles.rowInput} ${
                    detailNoticeUrlInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {detailNoticeUrlInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    URL 형식이 올바르지 않습니다 (http:// 또는 https://).
                  </span>
                )}
              </div>
            </div>

            {/* 23. 포스터 이미지 URL */}
            <div
              className={`${styles.itemInputRow} ${
                detailPosterUrlInvalid ? styles.itemInputRowInvalid : ''
              }`}
            >
              <label className={styles.rowLabel} htmlFor="detail-poster-url">
                포스터 이미지 URL
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-poster-url"
                  type="url"
                  value={detailPosterUrl}
                  onChange={(e) => setDetailPosterUrl(e.target.value)}
                  placeholder="예: https://.../poster.jpg"
                  className={`${styles.rowInput} ${
                    detailPosterUrlInvalid ? styles.inputInvalid : ''
                  }`}
                />
                {detailPosterUrlInvalid && (
                  <span className={styles.fieldErrorMsg}>
                    포스터 URL 형식이 올바르지 않습니다 (http:// 또는 https://).
                  </span>
                )}
              </div>
            </div>

            {/* 24. 포스터 미리보기 */}
            <div className={styles.itemInputRow}>
              <span className={styles.rowLabel}>포스터 미리보기</span>
              <div className={styles.rowInputWrap}>
                <PosterPreviewBox
                  posterUrl={detailPosterUrl}
                  title={detailTitle}
                  compact
                />
              </div>
            </div>

            {/* 25. 추가사항 */}
            <div className={styles.itemInputRow}>
              <label className={styles.rowLabel} htmlFor="detail-additional-note">
                추가사항
              </label>
              <div className={styles.rowInputWrap}>
                <input
                  id="detail-additional-note"
                  type="text"
                  value={detailAdditionalNote}
                  onChange={(e) => setDetailAdditionalNote(e.target.value)}
                  placeholder="시상 내역, 참가 자격 등 추가사항을 입력해 주세요"
                  className={styles.rowInput}
                />
              </div>
            </div>

            <div className={styles.formSubmitRow}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.primarySubmitBtn}
              >
                <Send size={16} />
                <span>행사 등록하기</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  disabled={submitting}
                  className={styles.adminApproveDirectBtn}
                  onClick={handleAdminApproveAndCreateEvent}
                >
                  <ShieldCheck size={16} />
                  <span>
                    {editingRequestId
                      ? '확인 및 이벤트 DB에 즉시 적용'
                      : '관리자 권한으로 즉시 적용'}
                  </span>
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </main>
  );
};
