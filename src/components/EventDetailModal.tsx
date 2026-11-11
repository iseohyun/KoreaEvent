import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  History,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  getMajorCategoryName,
  getOperatingDisciplinesForEvent,
  getSubCategoryName,
  SUB_CATEGORIES,
} from '../constants/categories';
import {
  buildNaverMapSearchUrl,
  findMatchingSwimmingPool,
} from '../constants/swimmingPools';
import { fetchEventDetail } from '../services/korService2Api';
import {
  AdminPromoRegistryData,
  analyzeOrganizerAndMatchPromo,
} from '../services/promoEnrichmentService';
import {
  EventDetailInfo,
  FirestoreEventDoc,
  FirestorePromoLink,
  PromoLevel,
  PromoLinkType,
  ResponseFormatMode,
  UnifiedEventItem,
} from '../types/event';
import styles from './EventDetailModal.module.css';
import { formatYmd } from '../shared/dateFormat';

interface EventDetailModalProps {
  event: UnifiedEventItem | null;
  allEvents?: UnifiedEventItem[];
  registry: AdminPromoRegistryData | null;
  formatMode: ResponseFormatMode;
  onClose: () => void;
  onSelectEventById?: (id: string) => void;
  onSaveFirestoreDoc: (docData: FirestoreEventDoc) => Promise<boolean>;
}

function cleanScheduleNoteText(note?: string): string {
  if (!note) return '';
  return note
    .replace(/\(?\s*대회\s*요강\s*및\s*세부\s*경기\s*일정\s*참조\s*\)?/g, '')
    .replace(/기간\s*내\s*상시\s*및\s*주말\s*운영/g, '')
    .trim();
}

function formatEventDateSingleOrRange(
  startYmd?: string,
  endYmd?: string,
  scheduleNote?: string
): string {
  const s = (startYmd || '').replace(/[^0-9]/g, '').slice(0, 8);
  const e = (endYmd || '').replace(/[^0-9]/g, '').slice(0, 8);
  if (!s) return '-';
  const dateStr = !e || s === e ? formatYmd(s) : `${formatYmd(s)} ~ ${formatYmd(e)}`;
  const cleanNote = cleanScheduleNoteText(scheduleNote);
  return cleanNote ? `${dateStr} (${cleanNote})` : dateStr;
}

function cleanEventTimeDisplay(raw?: string): string {
  if (!raw) return '09:00 ~ 18:00';
  const cleaned = raw
    .replace(/\(?\s*부별\s*워밍업\s*및\s*경기시간\s*요강\s*참조\s*\)?/g, '')
    .trim();
  return cleaned || '09:00 ~ 18:00';
}

function stripOrganizerDummyText(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/\(?\s*공식\s*홈페이지\s*요강\s*참조\s*\)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOrganizerLines(
  host?: string,
  supervise?: string,
  fallbackOrganizer?: string
): string[] {
  const rawSources = [host || '', supervise || '', fallbackOrganizer || '']
    .map(stripOrganizerDummyText)
    .filter(Boolean);

  const lines: string[] = [];
  for (const src of rawSources) {
    src
      .split(/\s*(?:·|\/|,|\||;| 및 )\s*/g)
      .map((token) => stripOrganizerDummyText(token))
      .filter(Boolean)
      .forEach((token) => {
        if (!lines.includes(token)) {
          lines.push(token);
        }
      });
  }
  return lines;
}

function formatCrawlTimestampKst(iso?: string): string {
  if (!iso) return '-';
  const trimmed = iso.trim();
  if (/^\d{8}$/.test(trimmed)) {
    return formatYmd(trimmed);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  allEvents = [],
  registry,
  formatMode,
  onClose,
  onSelectEventById,
  onSaveFirestoreDoc,
}) => {
  const [detail, setDetail] = useState<EventDetailInfo | null>(null);

  // 편집 모드 상태
  const [isEditingFirestore, setIsEditingFirestore] = useState(false);
  const [savingFirestore, setSavingFirestore] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editScheduleNote, setEditScheduleNote] = useState('');
  const [editEventTime, setEditEventTime] = useState('');
  const [editHost, setEditHost] = useState('');
  const [editSupervise, setEditSupervise] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editCat2, setEditCat2] = useState<'EV01' | 'EV02' | 'EV03' | 'MUNICIPAL'>('EV01');
  const [editCat3, setEditCat3] = useState('EV010200');
  const [editPromoLevel, setEditPromoLevel] = useState<PromoLevel>(0);
  const [editInvitation, setEditInvitation] = useState('');
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [posterLoadFailed, setPosterLoadFailed] = useState(false);
  const [editLinks, setEditLinks] = useState<FirestorePromoLink[]>([]);

  useEffect(() => {
    setIsEditingFirestore(false);
    setSaveNotice(null);
    if (!event) return;
    if (event.source === 'PUBLIC_PORTAL' && event.contentId) {
      fetchEventDetail(event.contentId, event.contentTypeId || '15', formatMode)
        .then((res) => setDetail(res))
        .catch(() => setDetail(null));
    } else {
      setDetail(null);
    }
  }, [event, formatMode]);

  const promoAnalysis = useMemo(() => {
    if (!event) return null;
    return analyzeOrganizerAndMatchPromo(event, detail, registry);
  }, [event, detail, registry]);

  useEffect(() => {
    if (!event || !promoAnalysis) return;

    const fDoc = event.firestoreDoc;
    const deep = promoAnalysis.deepEnrichment;

    setEditTitle(fDoc?.title || event.title);
    setEditStartDate(fDoc?.eventDate?.startDate || event.startDate);
    setEditEndDate(fDoc?.eventDate?.endDate || event.endDate);
    setEditScheduleNote(
      cleanScheduleNoteText(
        fDoc?.eventDate?.scheduleNote || deep?.scheduleOrCourseDetail || ''
      )
    );
    setEditEventTime(
      cleanEventTimeDisplay(
        fDoc?.eventTime || detail?.playtime || deep?.scheduleOrCourseDetail || '09:00 ~ 18:00'
      )
    );
    setEditHost(
      stripOrganizerDummyText(
        fDoc?.organizer?.host ||
          detail?.sponsor1 ||
          event.organizer ||
          promoAnalysis.tier2Municipality.hallName
      )
    );
    setEditSupervise(
      stripOrganizerDummyText(
        fDoc?.organizer?.supervise || detail?.sponsor2 || ''
      )
    );
    setEditContact(
      stripOrganizerDummyText(
        fDoc?.organizer?.contact || detail?.tel || event.tel || detail?.telName || ''
      )
    );
    setEditCat2(fDoc?.category?.lclsSystm2 || event.lclsSystm2);
    setEditCat3(fDoc?.category?.lclsSystm3 || event.lclsSystm3);
    setEditPromoLevel(fDoc?.promoLevel ?? event.promoLevel ?? 0);

    const defaultInvitation =
      fDoc?.invitation ||
      (deep
        ? [
            ...deep.summaryPoints,
            deep.trafficOrSafetyNotice ? `(${deep.trafficOrSafetyNotice})` : '',
          ]
            .filter(Boolean)
            .join(' ')
        : event.summary || detail?.overview || '');

    setEditInvitation(defaultInvitation);
    const initialPoster =
      fDoc?.posterUrl ||
      fDoc?.imageUrl ||
      event.posterUrl ||
      event.imageUrl ||
      '';
    setEditPosterUrl(initialPoster);
    setPosterLoadFailed(false);

    if (fDoc?.links && fDoc.links.length > 0) {
      setEditLinks(fDoc.links);
    } else if (event.links && event.links.length > 0) {
      setEditLinks(event.links);
    } else {
      const defaultLinks: FirestorePromoLink[] = [];
      if (deep?.deepArticleUrl) {
        defaultLinks.push({
          type:
            deep.matchedTier === 'TIER1_PROVINCE' ? 'TIER1_PROMO' : 'TIER2_PROMO',
          label: `${deep.promoPortalName} 상세`,
          url: deep.deepArticleUrl,
        });
      }
      defaultLinks.push({
        type: 'TIER1_PROMO',
        label: `${promoAnalysis.tier1Province.promo1Name}`,
        url: promoAnalysis.tier1Province.promo1Url,
      });
      defaultLinks.push({
        type: 'TIER2_PROMO',
        label: `${promoAnalysis.tier2Municipality.promo1Name}`,
        url: promoAnalysis.tier2Municipality.promo1Url,
      });
      setEditLinks(defaultLinks);
    }
  }, [event, detail, promoAnalysis]);

  // 1) 행사지역 (행정구역)
  const regionAdminText = useMemo(() => {
    if (!event) return '-';
    const r = (event.regionName || '').trim();
    const s = (event.sigunguName || '').trim();
    if (!s || r === s || (r.includes('세종') && s.includes('세종'))) {
      return r || s || '-';
    }
    return `${r} ${s}`;
  }, [event]);

  // 2) 행사위치 (수영장이 있다면 수영장 이름만 노출 + 네이버 지도 검색 링크 아이콘 동봉, 그 외에는 결집지/장소 + 네이버 지도 검색 링크 아이콘)
  const venueInfo = useMemo(() => {
    if (!event) {
      return {
        isSwimmingPool: false,
        displayName: '-',
        naverMapUrl: 'https://map.naver.com',
      };
    }
    const matchedPool = findMatchingSwimmingPool(event);
    const poolName = matchedPool?.name || event.venuePoolName;
    if (poolName) {
      const naverQuery = `${event.regionName || ''} ${event.sigunguName || ''} ${poolName}`.trim();
      return {
        isSwimmingPool: true,
        displayName: poolName,
        naverMapUrl: buildNaverMapSearchUrl(naverQuery),
      };
    }

    const rawAddr = [event.addr1, event.addr2 || detail?.eventPlace]
      .filter(Boolean)
      .join(' ')
      .trim();
    const displayPlace = rawAddr || `${regionAdminText} 일원`;
    const naverQuery = rawAddr
      ? `${event.regionName || ''} ${rawAddr}`.trim()
      : `${regionAdminText} ${event.title}`.trim();

    return {
      isSwimmingPool: false,
      displayName: displayPlace,
      naverMapUrl: buildNaverMapSearchUrl(naverQuery),
    };
  }, [event, detail?.eventPlace, regionAdminText]);

  // 3) 주최 (주최기관이 많으면 줄 바꿔서 표시, '공식 홈페이지 요강 참조' 삭제)
  const organizerLines = useMemo(() => {
    if (!event) return [];
    return parseOrganizerLines(editHost, editSupervise, event.organizer);
  }, [event, editHost, editSupervise]);

  // 4) 참가비 및 *(붉은색) 각주
  const feeDisplayInfo = useMemo(() => {
    if (!event) {
      return { feeText: '-', specialNote: null };
    }
    const rawFee =
      event.feeText ||
      detail?.useTimeFestival ||
      event.feeInfo ||
      '무료 (일부 체험·부대프로그램 유료)';
    const specialNote = (event.feeSpecialNote || '').trim();
    return {
      feeText: rawFee,
      specialNote: specialNote || null,
    };
  }, [event, detail?.useTimeFestival]);

  // 5) 연락처 (별도 항목, '공식 홈페이지 요강 참조' 제거)
  const contactText = useMemo(() => {
    if (!event) return '-';
    const cleaned = stripOrganizerDummyText(
      editContact || detail?.tel || event.tel || ''
    );
    return cleaned || '-';
  }, [event, editContact, detail?.tel]);

  // 6) 종목 (운영종목만 하이라이트, 비운영 음영)
  const disciplineInfo = useMemo(() => {
    if (!event) {
      return {
        group: 'SWIMMING' as const,
        catalog: [] as string[],
        activeSet: new Set<string>(),
      };
    }
    return getOperatingDisciplinesForEvent(event);
  }, [event]);

  // 7) 모집일
  const registrationPeriodText = useMemo(() => {
    if (!event) return '-';
    const reg = event.registrationPeriod;
    if (!reg || (!reg.startDate && !reg.endDate)) {
      return '상시 또는 현장 참여 (별도 사전 모집 없음)';
    }
    const s = (reg.startDate || '').replace(/[^0-9]/g, '').slice(0, 8);
    const e = (reg.endDate || '').replace(/[^0-9]/g, '').slice(0, 8);
    const dateRange =
      !e || s === e
        ? `${formatYmd(s)}${reg.openTime ? ` ${reg.openTime}` : ''}`
        : `${formatYmd(s)}${reg.openTime ? ` ${reg.openTime}` : ''} ~ ${formatYmd(e)}${
            reg.closeTime ? ` ${reg.closeTime}` : ''
          }`;

    const extras = [reg.quotaNote, reg.methodNote].filter(Boolean).join(' · ');
    return extras ? `${dateRange} (${extras})` : dateRange;
  }, [event]);

  if (!event || !promoAnalysis) return null;

  const isPortal = event.source === 'PUBLIC_PORTAL';

  const handleAddLinkRow = () => {
    setEditLinks((prev) => [
      ...prev,
      {
        type: 'OFFICIAL',
        label: '추가 홍보/예매 링크',
        url: 'https://',
      },
    ]);
  };

  const handleRemoveLinkRow = (idx: number) => {
    setEditLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateLinkRow = (
    idx: number,
    key: keyof FirestorePromoLink,
    val: string
  ) => {
    setEditLinks((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: val } : item))
    );
  };

  const handleSaveToFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFirestore(true);
    setSaveNotice(null);

    const docToSave: FirestoreEventDoc = {
      id: event.firestoreDoc?.id || event.id,
      portalContentId: event.contentId || event.firestoreDoc?.portalContentId,
      lDongRegnCd: event.lDongRegnCd,
      lDongSignguCd: event.lDongSignguCd,
      sigunguName: event.sigunguName,
      title: editTitle.trim() || event.title,
      eventDate: {
        startDate: editStartDate.replace(/[^0-9]/g, '').slice(0, 8) || event.startDate,
        endDate: editEndDate.replace(/[^0-9]/g, '').slice(0, 8) || event.endDate,
        scheduleNote: cleanScheduleNoteText(editScheduleNote) || undefined,
      },
      eventTime: cleanEventTimeDisplay(editEventTime),
      organizer: {
        host: stripOrganizerDummyText(editHost) || promoAnalysis.tier2Municipality.hallName,
        supervise: stripOrganizerDummyText(editSupervise) || undefined,
        contact: stripOrganizerDummyText(editContact) || undefined,
      },
      category: {
        lclsSystm2: editCat2,
        lclsSystm3: editCat3,
        label: `${getMajorCategoryName(editCat2)} > ${getSubCategoryName(editCat3)}`,
      },
      links: editLinks.filter((l) => l.url && l.url.trim().length > 4),
      invitation: editInvitation.trim(),
      promoLevel: editPromoLevel,
      manualEdited: true,
      addr1: event.addr1,
      mapX: event.mapX,
      mapY: event.mapY,
      imageUrl: editPosterUrl.trim() || event.imageUrl,
      posterUrl: editPosterUrl.trim() || undefined,
      seriesId: event.seriesId,
      seriesName: event.seriesName,
      edition: event.edition,
      eventYear: event.eventYear,
      prevEventId: event.prevEventId,
      nextEventId: event.nextEventId,
      seriesHistory: event.seriesHistory,
      sportDisciplineGroup: event.sportDisciplineGroup,
      operatingDisciplines: event.operatingDisciplines,
      feeText: event.feeText,
      feeSpecialNote: event.feeSpecialNote,
      preOpenDate: event.preOpenDate,
      venuePoolId: event.venuePoolId,
      venuePoolName: event.venuePoolName,
      updatedAt: new Date().toISOString(),
    };

    const synced = await onSaveFirestoreDoc(docToSave);
    setSavingFirestore(false);
    setIsEditingFirestore(false);
    setSaveNotice(
      synced
        ? '✅ Firebase Firestore 클라우드 DB에 저장되었습니다!'
        : '✅ 로컬 캐시에 저장되었습니다!'
    );
  };

  const subCategoriesForEdit = Object.values(SUB_CATEGORIES).filter(
    (s) => s.parentCode === editCat2
  );

  // 역대 시리즈 타임라인 및 이전/다음 회차 계산
  const seriesTimeline = event.seriesHistory || [];
  const hasMultiSeries = seriesTimeline.length >= 2;
  const prevEditionItem = event.prevEventId
    ? seriesTimeline.find((h) => h.id === event.prevEventId) ||
      allEvents.find((ev) => ev.id === event.prevEventId)
    : undefined;
  const nextEditionItem = event.nextEventId
    ? seriesTimeline.find((h) => h.id === event.nextEventId) ||
      allEvents.find((ev) => ev.id === event.nextEventId)
    : undefined;

  const preOpenDateText = event.preOpenDate || '-';
  const crawledDateText = formatCrawlTimestampKst(
    event.firstSeenAt || event.updatedAt
  );
  const publishedDateText = event.publishedAt
    ? formatYmd(event.publishedAt.slice(0, 8))
    : '-';

  const rawPosterLink = (editPosterUrl || '').trim();
  const baseUrl = import.meta.env.BASE_URL || '/';
  const resolvedPosterSrc = rawPosterLink
    ? /^https?:\/\//i.test(rawPosterLink) || rawPosterLink.startsWith('data:')
      ? rawPosterLink
      : `${baseUrl}${rawPosterLink.replace(/^\/+/, '')}`
    : '';

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.badgeRow}>
              <span className={isPortal ? styles.portalBadge : styles.localBadge}>
                {event.sourceLabel}
              </span>
              {event.edition && (
                <span className={styles.editionBadge}>
                  🏆 제{event.edition}회 ({event.eventYear || event.startDate.slice(0, 4)}년)
                </span>
              )}
              {hasMultiSeries && (
                <span className={styles.seriesBadge}>
                  🔄 역대 {seriesTimeline.length}개 회차 연결됨
                </span>
              )}
              <span className={styles.catBadge}>{regionAdminText}</span>
              <span className={styles.catBadge}>
                {getMajorCategoryName(editCat2)} &gt; {getSubCategoryName(editCat3)}
              </span>
            </div>
            <h2 className={styles.title}>{event.title}</h2>
          </div>

          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {/* 행사 배포 포스터 영역 (링크 참조 방식: 미등록 시 안내, 링크 삭제/만료 시 대체 그래픽 표시) */}
          <div className={styles.posterSectionBox}>
            <div className={styles.posterSectionHeader}>
              <span className={styles.posterSectionLabel}>🖼️ 행사 배포 포스터</span>
              {resolvedPosterSrc && !posterLoadFailed && (
                <a
                  href={resolvedPosterSrc}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.posterOriginalLink}
                >
                  <span>포스터 원본 열기</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            {!resolvedPosterSrc ? (
              <div className={styles.posterMissingPlaceholder}>
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 48 48"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="6"
                    y="8"
                    width="36"
                    height="32"
                    rx="6"
                    stroke="#94a3b8"
                    strokeWidth="2.2"
                    strokeDasharray="4 3"
                    fill="#f8fafc"
                  />
                  <circle cx="18" cy="19" r="3.5" fill="#cbd5e1" />
                  <path
                    d="M11 34L20 25L27 31L33 26L38 34H11Z"
                    fill="#cbd5e1"
                  />
                </svg>
                <span className={styles.posterPlaceholderTitle}>
                  포스터가 등록되지 않았습니다.
                </span>
              </div>
            ) : posterLoadFailed ? (
              <div
                className={styles.posterDeletedGraphic}
                role="img"
                aria-label="이미지가 삭제되었습니다."
              >
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 64 64"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="8"
                    y="10"
                    width="48"
                    height="44"
                    rx="8"
                    fill="#fef2f2"
                    stroke="#f87171"
                    strokeWidth="2.2"
                  />
                  <path
                    d="M16 44L26 33L34 40L42 31L50 44H16Z"
                    fill="#fecaca"
                  />
                  <circle cx="24" cy="23" r="4" fill="#fca5a5" />
                  <line
                    x1="14"
                    y1="14"
                    x2="50"
                    y2="50"
                    stroke="#dc2626"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                <strong className={styles.posterDeletedTitle}>
                  이미지가 삭제되었습니다.
                </strong>
                <span className={styles.posterDeletedSub}>
                  원본 포스터 링크({rawPosterLink})가 만료되었거나 삭제되었습니다.
                </span>
              </div>
            ) : (
              <div className={styles.posterPreviewWrap}>
                <img
                  src={resolvedPosterSrc}
                  alt={`${event.title} 포스터`}
                  className={styles.posterPreviewImg}
                  onError={() => setPosterLoadFailed(true)}
                />
              </div>
            )}
          </div>

          {/* 0. 역대 대회·행사 시리즈 회차 연결 패널 */}
          {(hasMultiSeries || prevEditionItem || nextEditionItem) && (
            <div className={styles.seriesHistoryBox}>
              <div className={styles.seriesHeader}>
                <span className={styles.seriesTitle}>
                  <History size={17} color="#7c3aed" />
                  <span>
                    역대 대회·행사 시리즈 연결 ({event.seriesName || event.title})
                  </span>
                </span>
                <span className={styles.seriesCountTag}>
                  총 {seriesTimeline.length}개 연도/회차 데이터 연동
                </span>
              </div>

              {(prevEditionItem || nextEditionItem) && (
                <div className={styles.seriesNavRow}>
                  {prevEditionItem ? (
                    <button
                      type="button"
                      className={styles.seriesNavBtn}
                      onClick={() => onSelectEventById?.(prevEditionItem.id)}
                    >
                      <ArrowLeft size={14} />
                      <div className={styles.seriesNavText}>
                        <span className={styles.seriesNavDir}>
                          이전 회차 바로가기
                          {'edition' in prevEditionItem && prevEditionItem.edition
                            ? ` (제${prevEditionItem.edition}회)`
                            : ''}
                        </span>
                        <strong>{prevEditionItem.title}</strong>
                      </div>
                    </button>
                  ) : (
                    <div className={styles.seriesNavPlaceholder}>
                      가장 이른 수록 회차입니다
                    </div>
                  )}

                  {nextEditionItem ? (
                    <button
                      type="button"
                      className={`${styles.seriesNavBtn} ${styles.seriesNavBtnRight}`}
                      onClick={() => onSelectEventById?.(nextEditionItem.id)}
                    >
                      <div className={styles.seriesNavText}>
                        <span className={styles.seriesNavDir}>
                          다음 회차 바로가기
                          {'edition' in nextEditionItem && nextEditionItem.edition
                            ? ` (제${nextEditionItem.edition}회)`
                            : ''}
                        </span>
                        <strong>{nextEditionItem.title}</strong>
                      </div>
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <div className={styles.seriesNavPlaceholder}>
                      가장 최신 수록 회차입니다
                    </div>
                  )}
                </div>
              )}

              {seriesTimeline.length > 0 && (
                <div className={styles.seriesTimelineList}>
                  {seriesTimeline.map((item) => {
                    const isCurrent = item.id === event.id;
                    const singleDay =
                      !item.endDate || item.startDate === item.endDate;
                    return (
                      <div
                        key={item.id}
                        className={`${styles.seriesTimelineItem} ${
                          isCurrent ? styles.seriesTimelineCurrent : ''
                        }`}
                      >
                        <div
                          className={styles.seriesItemLeft}
                          onClick={() => {
                            if (!isCurrent) onSelectEventById?.(item.id);
                          }}
                        >
                          <span className={styles.seriesYearPill}>
                            {item.year || item.startDate?.slice(0, 4)}년
                            {item.edition ? ` · 제${item.edition}회` : ''}
                          </span>
                          <span className={styles.seriesItemTitle}>{item.title}</span>
                          <span className={styles.seriesItemDate}>
                            (
                            {singleDay
                              ? formatYmd(item.startDate)
                              : `${formatYmd(item.startDate)} ~ ${formatYmd(
                                  item.endDate
                                )}`}
                            )
                          </span>
                          {isCurrent && (
                            <span className={styles.currentViewingTag}>
                              현재 보고 있는 회차
                            </span>
                          )}
                        </div>
                        <div className={styles.seriesItemActions}>
                          {!isCurrent && onSelectEventById && (
                            <button
                              type="button"
                              className={styles.switchEditionBtn}
                              onClick={() => onSelectEventById(item.id)}
                            >
                              이 회차 상세보기
                            </button>
                          )}
                          {item.primaryUrl && (
                            <a
                              href={item.primaryUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.seriesExternalLink}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>홍보원문</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 1. 세부정보 표준 표 (16개 항목 지정 순서) */}
          <div className={styles.firestoreBox}>
            <div className={styles.firestoreHeader}>
              <span className={styles.firestoreTitle}>
                <Database size={17} color="#d97706" />
                <span>행사 세부정보</span>
              </span>
              <button
                type="button"
                className={styles.editToggleBtn}
                onClick={() => setIsEditingFirestore((prev) => !prev)}
              >
                <Edit3
                  size={13}
                  style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }}
                />
                {isEditingFirestore ? '편집 닫기' : '세부정보 편집'}
              </button>
            </div>

            {saveNotice && <div className={styles.saveStatusMsg}>{saveNotice}</div>}

            {/* 초댓말 / 요약 안내 */}
            {editInvitation && (
              <div className={styles.invitationCard}>
                <span className={styles.invitationLabel}>💌 행사 요약 안내</span>
                <div>{editInvitation}</div>
              </div>
            )}

            {!isEditingFirestore ? (
              <>
                <div className={styles.detailTableWrap}>
                  <table className={styles.detailSpecTable}>
                    <tbody>
                      {/* 1. 행사명 */}
                      <tr>
                        <th scope="row">행사명</th>
                        <td className={styles.detailTitleCell}>{editTitle}</td>
                      </tr>

                      {/* 2. 행사일 (하루인 경우 시작날짜만 노출, 대회 요강 참조 문구 미노출) */}
                      <tr>
                        <th scope="row">행사일</th>
                        <td>
                          {formatEventDateSingleOrRange(
                            editStartDate,
                            editEndDate,
                            editScheduleNote
                          )}
                        </td>
                      </tr>

                      {/* 3. 행사시각 (부별 워밍업 및 경기시간 요강 참조 문구 미노출) */}
                      <tr>
                        <th scope="row">행사시각</th>
                        <td>{cleanEventTimeDisplay(editEventTime)}</td>
                      </tr>

                      {/* 4. 행사지역 (행정구역) */}
                      <tr>
                        <th scope="row">행사지역</th>
                        <td>{regionAdminText}</td>
                      </tr>

                      {/* 5. 행사위치 (수영장이 있다면 수영장 이름만 노출 + 네이버 지도 검색링크 아이콘 동봉) */}
                      <tr>
                        <th scope="row">행사위치</th>
                        <td>
                          <div className={styles.venueLocationRow}>
                            <span className={styles.venueLocationName}>
                              {venueInfo.displayName}
                            </span>
                            <a
                              href={venueInfo.naverMapUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.venueMapIconLink}
                              title={`${venueInfo.displayName} 네이버 지도 검색`}
                              aria-label={`${venueInfo.displayName} 네이버 지도 검색`}
                            >
                              <MapPin size={13} />
                              <span>네이버 지도</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </td>
                      </tr>

                      {/* 6. 주최 (주최기관이 많으면 줄 바꿔서 표시, 공식 홈페이지 요강 참조 삭제) */}
                      <tr>
                        <th scope="row">주최</th>
                        <td>
                          {organizerLines.length === 0 ? (
                            '-'
                          ) : (
                            <div className={styles.organizerMultiLineList}>
                              {organizerLines.map((line, idx) => (
                                <div key={idx} className={styles.organizerLineItem}>
                                  {line}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* 7. 행사 분류 (행사 코드는 노출하지 않음) */}
                      <tr>
                        <th scope="row">행사 분류</th>
                        <td>
                          {getMajorCategoryName(editCat2)} &gt;{' '}
                          {getSubCategoryName(editCat3)}
                        </td>
                      </tr>

                      {/* 8. 행사 범위 */}
                      <tr>
                        <th scope="row">행사 범위</th>
                        <td>
                          {editPromoLevel === 3
                            ? '세계/대한연맹'
                            : editPromoLevel === 2
                              ? '광역시도'
                              : editPromoLevel === 1
                                ? '시군구'
                                : '동네'}
                        </td>
                      </tr>

                      {/* 9. 참가비 (일반 참가비 외 특별한 내용이 있다면 붉은색 * 표시 후 표 아래에 덧붙임) */}
                      <tr>
                        <th scope="row">참가비</th>
                        <td>
                          <span>{feeDisplayInfo.feeText}</span>
                          {feeDisplayInfo.specialNote && (
                            <span
                              className={styles.feeAsterisk}
                              title={feeDisplayInfo.specialNote}
                            >
                              *
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* 10. 연락처 (별도 항목) */}
                      <tr>
                        <th scope="row">연락처</th>
                        <td>{contactText}</td>
                      </tr>

                      {/* 11. 종목 (운영종목만 하이라이트, 비운영 음영) */}
                      <tr>
                        <th scope="row">종목</th>
                        <td>
                          <div className={styles.disciplineGroupWrap}>
                            <div className={styles.disciplineChipList}>
                              {disciplineInfo.catalog.map((disc) => {
                                const isActive =
                                  disciplineInfo.activeSet.has(disc);
                                return (
                                  <span
                                    key={disc}
                                    className={
                                      isActive
                                        ? styles.disciplineChipActive
                                        : styles.disciplineChipInactive
                                    }
                                  >
                                    {disc}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* 12. 사전개방일 */}
                      <tr>
                        <th scope="row">사전개방일</th>
                        <td>{preOpenDateText}</td>
                      </tr>

                      {/* 13. 수집일(크롤링) */}
                      <tr>
                        <th scope="row">수집일(크롤링)</th>
                        <td>{crawledDateText}</td>
                      </tr>

                      {/* 14. 수집된 링크 (복수가능 · 대회 일정 원문은 실제 게시글 클릭 주소 표시) */}
                      <tr>
                        <th scope="row">수집된 링크</th>
                        <td>
                          {editLinks.length === 0 ? (
                            '-'
                          ) : (
                            <div className={styles.collectedLinksList}>
                              {editLinks.map((lnk, idx) => {
                                const isAttachment =
                                  lnk.type === 'ATTACHMENT' ||
                                  /\.(pdf|hwp|hwpx|doc|docx|xls|xlsx|zip)(\?|$)/i.test(
                                    lnk.url
                                  );
                                return (
                                  <a
                                    key={`${lnk.url}-${idx}`}
                                    href={lnk.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={
                                      isAttachment
                                        ? styles.collectedLinkChipAttachment
                                        : styles.collectedLinkChip
                                    }
                                    title={lnk.url}
                                  >
                                    <div className={styles.collectedLinkTopRow}>
                                      {isAttachment ? (
                                        <FileText size={13} />
                                      ) : (
                                        <Globe size={13} />
                                      )}
                                      <span className={styles.collectedLinkLabel}>
                                        {lnk.label || lnk.url}
                                      </span>
                                      <ExternalLink size={12} />
                                    </div>
                                    {!isAttachment && lnk.url && (
                                      <span className={styles.collectedLinkActualUrl}>
                                        {lnk.url}
                                      </span>
                                    )}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* 15. 최초공지일 */}
                      <tr>
                        <th scope="row">최초공지일</th>
                        <td>{publishedDateText}</td>
                      </tr>

                      {/* 16. 모집일 */}
                      <tr>
                        <th scope="row">모집일</th>
                        <td>{registrationPeriodText}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 참가비 특별 내용(할인·부별 요금·단체 규정 등) 문서(표) 하단 각주 표시 */}
                {feeDisplayInfo.specialNote && (
                  <div className={styles.feeFootnoteBox}>
                    <span className={styles.feeAsterisk}>*</span>
                    <span>{feeDisplayInfo.specialNote}</span>
                  </div>
                )}
              </>
            ) : (
              /* 편집 폼 (영문 병기 제거) */
              <form className={styles.editorForm} onSubmit={handleSaveToFirestore}>
                <div className={styles.editorField}>
                  <label>행사명</label>
                  <input
                    type="text"
                    className={styles.editorInput}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.editorRow2}>
                  <div className={styles.editorField}>
                    <label>시작일 (YYYYMMDD)</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.editorField}>
                    <label>종료일 (YYYYMMDD)</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.editorRow2}>
                  <div className={styles.editorField}>
                    <label>행사 일정 메모</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editScheduleNote}
                      onChange={(e) => setEditScheduleNote(e.target.value)}
                      placeholder="예: 매주 일요일 운영"
                    />
                  </div>
                  <div className={styles.editorField}>
                    <label>행사시각</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editEventTime}
                      onChange={(e) => setEditEventTime(e.target.value)}
                      placeholder="예: 08:30 ~ 18:00"
                    />
                  </div>
                </div>

                <div className={styles.editorRow2}>
                  <div className={styles.editorField}>
                    <label>주최기관</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editHost}
                      onChange={(e) => setEditHost(e.target.value)}
                    />
                  </div>
                  <div className={styles.editorField}>
                    <label>주관기관</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editSupervise}
                      onChange={(e) => setEditSupervise(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.editorRow2}>
                  <div className={styles.editorField}>
                    <label>연락처</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editContact}
                      onChange={(e) => setEditContact(e.target.value)}
                      placeholder="예: 055-267-0019 / 공식 이메일"
                    />
                  </div>
                  <div className={styles.editorField}>
                    <label>행사 범위</label>
                    <select
                      className={styles.editorSelect}
                      value={editPromoLevel}
                      onChange={(e) =>
                        setEditPromoLevel(Number(e.target.value) as PromoLevel)
                      }
                    >
                      <option value={3}>세계/대한연맹</option>
                      <option value={2}>광역시도</option>
                      <option value={1}>시군구</option>
                      <option value={0}>동네</option>
                    </select>
                  </div>
                </div>

                <div className={styles.editorRow2}>
                  <div className={styles.editorField}>
                    <label>중분류</label>
                    <select
                      className={styles.editorSelect}
                      value={editCat2}
                      onChange={(e) => {
                        const next = e.target.value as
                          | 'EV01'
                          | 'EV02'
                          | 'EV03'
                          | 'MUNICIPAL';
                        setEditCat2(next);
                        const firstSub = Object.values(SUB_CATEGORIES).find(
                          (s) => s.parentCode === next
                        );
                        if (firstSub) setEditCat3(firstSub.code);
                      }}
                    >
                      <option value="EV01">축제</option>
                      <option value="EV02">공연</option>
                      <option value="EV03">행사·전시</option>
                      <option value="MUNICIPAL">지자체 행정·시민참여</option>
                    </select>
                  </div>
                  <div className={styles.editorField}>
                    <label>소분류</label>
                    <select
                      className={styles.editorSelect}
                      value={editCat3}
                      onChange={(e) => setEditCat3(e.target.value)}
                    >
                      {subCategoriesForEdit.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.editorField}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <label>수집된 링크</label>
                    <button
                      type="button"
                      className={styles.smallBtn}
                      onClick={handleAddLinkRow}
                    >
                      <Plus size={12} style={{ verticalAlign: 'middle' }} /> 링크 추가
                    </button>
                  </div>

                  <div className={styles.linksEditorList}>
                    {editLinks.map((lnk, idx) => (
                      <div key={idx} className={styles.linkEditRow}>
                        <select
                          className={styles.editorSelect}
                          value={lnk.type}
                          onChange={(e) =>
                            handleUpdateLinkRow(
                              idx,
                              'type',
                              e.target.value as PromoLinkType
                            )
                          }
                        >
                          <option value="OFFICIAL">공식 공지/홈페이지</option>
                          <option value="ATTACHMENT">첨부문서(요강)</option>
                          <option value="TICKET">사전접수/신청</option>
                          <option value="SNS">공식 밴드/SNS</option>
                          <option value="TIER1_PROMO">광역 홍보관</option>
                          <option value="TIER2_PROMO">시군구 홍보관</option>
                        </select>
                        <input
                          type="text"
                          className={styles.editorInput}
                          value={lnk.label}
                          onChange={(e) =>
                            handleUpdateLinkRow(idx, 'label', e.target.value)
                          }
                          placeholder="링크 이름"
                        />
                        <input
                          type="text"
                          className={styles.editorInput}
                          value={lnk.url}
                          onChange={(e) =>
                            handleUpdateLinkRow(idx, 'url', e.target.value)
                          }
                          placeholder="https://..."
                        />
                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => handleRemoveLinkRow(idx)}
                          title="링크 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.editorField}>
                  <label>포스터 이미지 링크 (URL)</label>
                  <input
                    type="text"
                    className={styles.editorInput}
                    value={editPosterUrl}
                    onChange={(e) => {
                      setEditPosterUrl(e.target.value);
                      setPosterLoadFailed(false);
                    }}
                    placeholder="https://... (비워두면 '포스터가 등록되지 않았습니다.' 표시)"
                  />
                </div>

                <div className={styles.editorField}>
                  <label>행사 요약 안내</label>
                  <textarea
                    className={styles.editorTextarea}
                    value={editInvitation}
                    onChange={(e) => setEditInvitation(e.target.value)}
                    placeholder="행사 핵심 요약 안내를 입력하세요."
                  />
                </div>

                <button
                  type="submit"
                  className={styles.saveFirestoreBtn}
                  disabled={savingFirestore}
                >
                  <Save
                    size={14}
                    style={{ marginRight: 5, display: 'inline', verticalAlign: 'middle' }}
                  />
                  {savingFirestore ? '저장 중...' : '저장하기'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            행사지: <strong>{regionAdminText} · {venueInfo.displayName}</strong>
          </span>

          <a
            href={venueInfo.naverMapUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.linkBtn}
          >
            <MapPin size={14} />
            <span>네이버 지도에서 행사위치 보기</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};
