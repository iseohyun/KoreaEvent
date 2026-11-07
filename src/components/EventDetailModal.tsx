import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Database,
  Edit3,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { getMajorCategoryName, getSubCategoryName, SUB_CATEGORIES } from '../constants/categories';
import { fetchEventDetail } from '../services/korService2Api';
import {
  AdminPromoRegistryData,
  analyzeOrganizerAndMatchPromo,
} from '../services/promoEnrichmentService';
import {
  EventDetailInfo,
  FirestoreEventDoc,
  FirestorePromoLink,
  PromoLinkType,
  ResponseFormatMode,
  UnifiedEventItem,
} from '../types/event';
import styles from './EventDetailModal.module.css';

interface EventDetailModalProps {
  event: UnifiedEventItem | null;
  registry: AdminPromoRegistryData | null;
  formatMode: ResponseFormatMode;
  onClose: () => void;
  onSaveFirestoreDoc: (docData: FirestoreEventDoc) => Promise<boolean>;
}

function formatDate(d: string): string {
  if (!d || d.length < 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

function extractHrefFromHtml(html?: string): string | undefined {
  if (!html) return undefined;
  const match = html.match(/href=["']([^"']+)["']/i);
  if (match && match[1]) return match[1];
  const urlMatch = html.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch && urlMatch[0]) return urlMatch[0];
  return undefined;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  registry,
  formatMode,
  onClose,
  onSaveFirestoreDoc,
}) => {
  const [detail, setDetail] = useState<EventDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // 실시간 지자체 홍보 페이지 파싱 결과 상태
  const [customTargetUrl, setCustomTargetUrl] = useState('');
  const [liveScrapeResult, setLiveScrapeResult] = useState<{
    pageTitle: string;
    highlights: string[];
    trafficNotice: string | null;
    sourceUrl: string;
  } | null>(null);
  const [liveScraping, setLiveScraping] = useState(false);

  // Firebase Firestore 7대 핵심 항목 편집 모드 상태
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
  const [editInvitation, setEditInvitation] = useState('');
  const [editLinks, setEditLinks] = useState<FirestorePromoLink[]>([]);

  useEffect(() => {
    setLiveScrapeResult(null);
    setIsEditingFirestore(false);
    setSaveNotice(null);
    if (!event) return;
    if (event.source === 'PUBLIC_PORTAL' && event.contentId) {
      setLoading(true);
      fetchEventDetail(event.contentId, event.contentTypeId || '15', formatMode)
        .then((res) => setDetail(res))
        .catch(() => setDetail(null))
        .finally(() => setLoading(false));
    } else {
      setDetail(null);
    }
  }, [event, formatMode]);

  const promoAnalysis = useMemo(() => {
    if (!event) return null;
    return analyzeOrganizerAndMatchPromo(event, detail, registry);
  }, [event, detail, registry]);

  // 현재 이벤트 + KorService2 상세 + 홍보DB 매칭 결과를 기반으로 Firestore 스키마 초기값 세팅
  useEffect(() => {
    if (!event || !promoAnalysis) return;

    const fDoc = event.firestoreDoc;
    const deep = promoAnalysis.deepEnrichment;

    setCustomTargetUrl(
      fDoc?.links?.[0]?.url || deep?.deepArticleUrl || promoAnalysis.primaryPromoUrl
    );

    setEditTitle(fDoc?.title || event.title);
    setEditStartDate(fDoc?.eventDate?.startDate || event.startDate);
    setEditEndDate(fDoc?.eventDate?.endDate || event.endDate);
    setEditScheduleNote(
      fDoc?.eventDate?.scheduleNote ||
        deep?.scheduleOrCourseDetail ||
        '기간 내 상시 및 주말 운영'
    );
    setEditEventTime(
      fDoc?.eventTime || detail?.playtime || deep?.scheduleOrCourseDetail || '10:00 ~ 18:00'
    );
    setEditHost(
      fDoc?.organizer?.host ||
        detail?.sponsor1 ||
        event.organizer ||
        promoAnalysis.tier2Municipality.hallName
    );
    setEditSupervise(
      fDoc?.organizer?.supervise ||
        detail?.sponsor2 ||
        promoAnalysis.tier1Province.name
    );
    setEditContact(
      fDoc?.organizer?.contact || detail?.tel || event.tel || detail?.telName || ''
    );
    setEditCat2(fDoc?.category?.lclsSystm2 || event.lclsSystm2);
    setEditCat3(fDoc?.category?.lclsSystm3 || event.lclsSystm3);

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

    if (fDoc?.links && fDoc.links.length > 0) {
      setEditLinks(fDoc.links);
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
        label: `1단계 홍보주소1 (${promoAnalysis.tier1Province.promo1Name})`,
        url: promoAnalysis.tier1Province.promo1Url,
      });
      defaultLinks.push({
        type: 'TIER2_PROMO',
        label: `2단계 홍보주소1 (${promoAnalysis.tier2Municipality.promo1Name})`,
        url: promoAnalysis.tier2Municipality.promo1Url,
      });
      setEditLinks(defaultLinks);
    }
  }, [event, detail, promoAnalysis]);

  if (!event || !promoAnalysis) return null;

  const isPortal = event.source === 'PUBLIC_PORTAL';
  const externalUrl =
    extractHrefFromHtml(detail?.homepageHtml) || event.sourceOrgUrl;

  const handleLiveScrape = async () => {
    if (!customTargetUrl.trim()) return;
    setLiveScraping(true);
    try {
      const res = await fetch(
        `/api/municipal-enrich?url=${encodeURIComponent(customTargetUrl.trim())}`
      );
      const data = await res.json();
      if (res.ok && data.highlights) {
        setLiveScrapeResult(data);
        const scrapedInvitation = [
          ...data.highlights.slice(0, 4),
          data.trafficNotice ? `(${data.trafficNotice})` : '',
        ]
          .filter(Boolean)
          .join(' / ');
        setEditInvitation(scrapedInvitation);
      }
    } catch {
      // ignore
    } finally {
      setLiveScraping(false);
    }
  };

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
        scheduleNote: editScheduleNote.trim() || undefined,
      },
      eventTime: editEventTime.trim() || '상시 운영',
      organizer: {
        host: editHost.trim() || promoAnalysis.tier2Municipality.hallName,
        supervise: editSupervise.trim() || undefined,
        contact: editContact.trim() || undefined,
      },
      category: {
        lclsSystm2: editCat2,
        lclsSystm3: editCat3,
        label: `${getMajorCategoryName(editCat2)} > ${getSubCategoryName(editCat3)}`,
      },
      links: editLinks.filter((l) => l.url && l.url.trim().length > 4),
      invitation: editInvitation.trim(),
      addr1: event.addr1,
      mapX: event.mapX,
      mapY: event.mapY,
      imageUrl: event.imageUrl,
      updatedAt: new Date().toISOString(),
    };

    const synced = await onSaveFirestoreDoc(docToSave);
    setSavingFirestore(false);
    setIsEditingFirestore(false);
    setSaveNotice(
      synced
        ? '✅ Firebase Firestore (koreaeventlist) 클라우드 DB에 저장 및 실시간 조합이 반영되었습니다!'
        : '✅ 로컬 Firestore 캐시에 저장 및 실시간 조합이 반영되었습니다!'
    );
  };

  const deep = promoAnalysis.deepEnrichment;
  const subCategoriesForEdit = Object.values(SUB_CATEGORIES).filter(
    (s) => s.parentCode === editCat2
  );

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.badgeRow}>
              <span className={isPortal ? styles.portalBadge : styles.localBadge}>
                {event.sourceLabel}
              </span>
              {event.firestoreDoc && (
                <span className={styles.firestoreBadge}>
                  🔥 Firebase Firestore (koreaeventlist) 조합됨
                </span>
              )}
              <span className={styles.catBadge}>
                {event.regionName} · {event.sigunguName} (법정동 {event.lDongRegnCd}-
                {event.lDongSignguCd})
              </span>
              <span className={styles.catBadge}>
                {event.lclsSystm2Name} &gt; {event.lclsSystm3Name} ({event.lclsSystm3})
              </span>
            </div>
            <h2 className={styles.title}>{event.title}</h2>
          </div>

          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {event.imageUrl && (
            <img src={event.imageUrl} alt={event.title} className={styles.heroImg} />
          )}

          {/* 1. Firebase Firestore 7대 핵심 스키마 & 필수 연결 키 2종 실시간 조합 패널 */}
          <div className={styles.firestoreBox}>
            <div className={styles.firestoreHeader}>
              <span className={styles.firestoreTitle}>
                <Database size={17} color="#d97706" />
                <span>
                  Firebase Firestore (`koreaeventlist`) 7대 핵심 필드 & 실시간 조회 조합
                </span>
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
                {isEditingFirestore ? '편집 닫기' : 'DB 초댓말 · 1:N 링크 · 스키마 편집'}
              </button>
            </div>

            {/* 필수 연결 키 2가지 표시 */}
            <div className={styles.joinKeyRow}>
              <span className={styles.joinKeyTag}>
                🔑 연결키1 (portalContentId):{' '}
                {event.contentId || event.firestoreDoc?.portalContentId || '없음 (순수 지자체 행사)'}
              </span>
              <span className={styles.joinKeyTag}>
                🗺️ 연결키2 (법정동 시도-시군구): {event.lDongRegnCd}-{event.lDongSignguCd} (
                {event.regionName} {event.sigunguName})
              </span>
            </div>

            {saveNotice && <div className={styles.saveStatusMsg}>{saveNotice}</div>}

            {/* 초댓말 (Invitation) 하이라이트 카드 */}
            <div className={styles.invitationCard}>
              <span className={styles.invitationLabel}>
                💌 초댓말 (invitation · 지자체 홍보 페이지 요약 초대글)
              </span>
              <div>
                {editInvitation ||
                  '등록된 초댓말이 없습니다. 우측 상단 편집 버튼이나 홍보원문 실시간 파싱으로 초댓말을 저장할 수 있습니다.'}
              </div>
            </div>

            {/* 7대 핵심 필드 요약 그리드 (비편집 시) */}
            {!isEditingFirestore ? (
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>1. 행사명 (title)</span>
                  <span className={styles.infoVal}>{editTitle}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>2. 행사일 (eventDate)</span>
                  <span className={styles.infoVal}>
                    {formatDate(editStartDate)} ~ {formatDate(editEndDate)}
                    {editScheduleNote ? ` (${editScheduleNote})` : ''}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>3. 행사시각 (eventTime)</span>
                  <span className={styles.infoVal}>{editEventTime}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>4. 주최 / 주관 / 문의 (organizer)</span>
                  <span className={styles.infoVal}>
                    {[editHost, editSupervise, editContact].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>5. 행사분류 (category)</span>
                  <span className={styles.infoVal}>
                    {getMajorCategoryName(editCat2)} &gt; {getSubCategoryName(editCat3)} (
                    {editCat3})
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>6. 연결된 홍보·공식 링크 (1:N)</span>
                  <span className={styles.infoVal}>총 {editLinks.length}개 채널 연결됨</span>
                </div>
              </div>
            ) : (
              /* Firestore 7대 핵심 필드 직접 편집 폼 */
              <form className={styles.editorForm} onSubmit={handleSaveToFirestore}>
                <div className={styles.editorField}>
                  <label>1. 행사명 (title)</label>
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
                    <label>2-1. 시작일 (YYYYMMDD)</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.editorField}>
                    <label>2-2. 종료일 (YYYYMMDD)</label>
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
                    <label>2-3. 행사 회차/요일 메모 (scheduleNote)</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editScheduleNote}
                      onChange={(e) => setEditScheduleNote(e.target.value)}
                      placeholder="예: 11.8 ~ 11.22 매주 일요일"
                    />
                  </div>
                  <div className={styles.editorField}>
                    <label>3. 행사시각 (eventTime)</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editEventTime}
                      onChange={(e) => setEditEventTime(e.target.value)}
                      placeholder="예: 07:00 ~ 09:00"
                    />
                  </div>
                </div>

                <div className={styles.editorRow2}>
                  <div className={styles.editorField}>
                    <label>4-1. 주최기관 (organizer.host - 홍보사이트 매칭 힌트)</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editHost}
                      onChange={(e) => setEditHost(e.target.value)}
                    />
                  </div>
                  <div className={styles.editorField}>
                    <label>4-2. 주관기관 / 문의처 (supervise / contact)</label>
                    <input
                      type="text"
                      className={styles.editorInput}
                      value={editSupervise}
                      onChange={(e) => setEditSupervise(e.target.value)}
                      placeholder="예: 서울시 체육회"
                    />
                  </div>
                </div>

                <div className={styles.editorRow2}>
                  <div className={styles.editorField}>
                    <label>5-1. 중분류 (category.lclsSystm2)</label>
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
                      <option value="EV01">축제 (EV01)</option>
                      <option value="EV02">공연 (EV02)</option>
                      <option value="EV03">행사·전시 (EV03)</option>
                      <option value="MUNICIPAL">지자체 행정·시민참여 (MUNICIPAL)</option>
                    </select>
                  </div>
                  <div className={styles.editorField}>
                    <label>5-2. 소분류 (category.lclsSystm3)</label>
                    <select
                      className={styles.editorSelect}
                      value={editCat3}
                      onChange={(e) => setEditCat3(e.target.value)}
                    >
                      {subCategoriesForEdit.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name} ({s.code})
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
                    <label>6. 링크 (1:N 다중 링크 배열 · links)</label>
                    <button
                      type="button"
                      className={styles.smallBtn}
                      onClick={handleAddLinkRow}
                    >
                      <Plus size={12} style={{ verticalAlign: 'middle' }} /> 1:N 링크 추가
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
                          <option value="TIER1_PROMO">1단계 광역홍보</option>
                          <option value="TIER2_PROMO">2단계 시군구홍보</option>
                          <option value="OFFICIAL">공식 홈페이지</option>
                          <option value="TICKET">사전예약/티켓</option>
                          <option value="SNS">공식 SNS</option>
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
                  <label>7. 초댓말 (invitation · 소비자 맞춤형 핵심 요약 및 초대 문구)</label>
                  <textarea
                    className={styles.editorTextarea}
                    value={editInvitation}
                    onChange={(e) => setEditInvitation(e.target.value)}
                    placeholder="지자체 홍보 사이트에서 추출한 세부 코스, 프로그램, 교통 통제 안내, 초대글을 입력하세요."
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
                  {savingFirestore
                    ? 'Firebase Firestore에 저장 중...'
                    : 'Firebase Firestore에 저장 및 실시간 조합 반영'}
                </button>
              </form>
            )}

            {/* 1:N 링크 버튼 바로가기 렌더링 */}
            <div className={styles.promoLinksRow}>
              {editLinks.map((lnk, idx) => (
                <a
                  key={idx}
                  href={lnk.url}
                  target="_blank"
                  rel="noreferrer"
                  className={idx === 0 ? styles.deepLinkBtn : styles.subPromoLinkBtn}
                >
                  {idx === 0 ? <Globe size={14} /> : <Building2 size={13} />}
                  <span>
                    [{lnk.type}] {lnk.label}
                  </span>
                  <ExternalLink size={12} />
                </a>
              ))}
            </div>
          </div>

          {/* 2. 공공데이터포털에서 실시간 조합된 위치·연락처 정보 */}
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>개최 주소 / 장소 (실시간 조합)</span>
              <span className={styles.infoVal}>
                {event.addr1} {event.addr2 || detail?.eventPlace || ''}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>GPS 좌표 (WGS84 실시간 조합)</span>
              <span className={styles.infoVal}>
                {event.mapY && event.mapX
                  ? `위도 ${event.mapY.toFixed(5)}, 경도 ${event.mapX.toFixed(5)}`
                  : '행정구역 중심점 매핑'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>이용요금 / 연락처</span>
              <span className={styles.infoVal}>
                {detail?.useTimeFestival || event.feeInfo || '상세 안내 참조'}
                {event.tel ? ` (${event.tel})` : ''}
              </span>
            </div>
          </div>

          {/* 3. 주최기관 힌트 기반 1·2단계 지자체 홍보 페이지 매칭·요약 및 실시간 파서 */}
          <div className={styles.promoEnrichBox}>
            <div className={styles.promoHeader}>
              <span className={styles.promoTitle}>
                <Sparkles size={17} color="#2563eb" />
                <span>주최기관 힌트 기반 지자체 공식 홍보 페이지 탐색 & 실시간 요약기</span>
              </span>
              <span className={styles.tierBadge}>
                {promoAnalysis.matchedTier === 'TIER1_PROVINCE'
                  ? '1단계 광역지자체 홍보DB 매칭'
                  : '2단계 기초지자체(시군구) 홍보DB 매칭'}
              </span>
            </div>

            <div className={styles.hintExplain}>
              💡 <strong>주최기관 라우팅 분석:</strong> {promoAnalysis.routingExplanation}
            </div>

            {deep && (
              <div className={styles.deepCard}>
                <div className={styles.deepTitle}>
                  📌 [{deep.promoPortalName}] {deep.deepArticleTitle}
                </div>

                <ul className={styles.bulletList}>
                  {deep.summaryPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>

                {deep.trafficOrSafetyNotice && (
                  <div className={styles.trafficAlert}>{deep.trafficOrSafetyNotice}</div>
                )}

                {deep.historySummary && deep.historySummary.length > 0 && (
                  <div className={styles.historyBox}>
                    <strong>📅 지자체 홍보 페이지 수록 회차별 히스토리:</strong>
                    {deep.historySummary.map((h, idx) => (
                      <span key={idx}>· {h}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 실시간 지자체 홍보 페이지 파싱 결과 표시 */}
            {liveScrapeResult && (
              <div className={styles.deepCard} style={{ borderColor: '#0f766e' }}>
                <div className={styles.deepTitle} style={{ color: '#0f766e' }}>
                  ⚡ 실시간 홍보 사이트 파싱 요약 완료 (초댓말 자동 반영됨):{' '}
                  {liveScrapeResult.pageTitle}
                </div>
                <ul className={styles.bulletList}>
                  {liveScrapeResult.highlights.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
                {liveScrapeResult.trafficNotice && (
                  <div className={styles.trafficAlert}>
                    {liveScrapeResult.trafficNotice}
                  </div>
                )}
              </div>
            )}

            {/* 실시간 지자체 홍보 URL 원문 수집·요약 실행 바 */}
            <div className={styles.liveScraperBar}>
              <input
                type="text"
                className={styles.liveUrlInput}
                value={customTargetUrl}
                onChange={(e) => setCustomTargetUrl(e.target.value)}
                placeholder="지자체 홍보 상세 URL 입력 (예: https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=974)"
              />
              <button
                type="button"
                className={styles.liveScrapeBtn}
                onClick={handleLiveScrape}
                disabled={liveScraping}
              >
                <RefreshCw
                  size={12}
                  style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }}
                />
                {liveScraping ? '실시간 요약 중...' : '홍보원문 실시간 파싱·요약'}
              </button>
            </div>
          </div>

          {/* 4. 공공데이터포털 기본 개요 */}
          <div className={styles.sectionBox}>
            <h3 className={styles.sectionTitle}>
              {isPortal
                ? '공공데이터포털 (KorService2 detailCommon2) 실시간 조회 기본 개요'
                : '지자체 행정 홈페이지 기본 안내'}
            </h3>
            <div className={styles.overviewText}>
              {loading
                ? 'KorService2 detailCommon2 / detailIntro2 상세 정보를 조회하는 중입니다...'
                : detail?.overview ||
                  event.summary ||
                  '해당 행사의 기본 일정 및 위치 정보가 제공됩니다.'}
            </div>
          </div>

          {detail?.program && (
            <div className={styles.sectionBox}>
              <h3 className={styles.sectionTitle}>
                공공데이터포털 (KorService2 detailIntro2) 실시간 조회 프로그램 정보
              </h3>
              <div className={styles.overviewText}>{detail.program}</div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
            Firestore 문서 ID: <strong>{event.firestoreDoc?.id || event.id}</strong>
            {event.contentId ? ` · KorService2 contentId: ${event.contentId}` : ''}
          </span>

          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.linkBtn}
            >
              <span>행사 개별 공식 홈페이지 바로가기</span>
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
