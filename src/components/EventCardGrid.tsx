import React, { useMemo } from 'react';
import { Calendar, Clock, Landmark, Link2, MapPin, Phone } from 'lucide-react';
import { REGION_BY_ID } from '../constants/regions';
import { findDeepPromoMatch } from '../services/promoEnrichmentService';
import { UnifiedEventItem } from '../types/event';
import styles from './EventCardGrid.module.css';

interface EventCardGridProps {
  events: UnifiedEventItem[];
  selectedRegionId: string;
  selectedSigunguCode: string;
  loading: boolean;
  onSelectEvent: (event: UnifiedEventItem) => void;
}

function formatDateStr(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}`;
}

export const EventCardGrid: React.FC<EventCardGridProps> = ({
  events,
  selectedRegionId,
  selectedSigunguCode,
  loading,
  onSelectEvent,
}) => {
  const categoryCounts = useMemo(() => {
    const counts = { EV01: 0, EV02: 0, EV03: 0, MUNICIPAL: 0 };
    events.forEach((ev) => {
      if (counts[ev.lclsSystm2] !== undefined) {
        counts[ev.lclsSystm2] += 1;
      }
    });
    return counts;
  }, [events]);

  const regionTitle =
    selectedRegionId === 'ALL'
      ? '전국 17개 시·도'
      : REGION_BY_ID[selectedRegionId]?.name || '선택 구역';

  const getStatusInfo = (status: UnifiedEventItem['status']) => {
    switch (status) {
      case 'ONGOING':
        return { label: '진행중', cls: styles.statusOngoing };
      case 'UPCOMING':
        return { label: '개최예정', cls: styles.statusUpcoming };
      case 'ENDED':
        return { label: '종료', cls: styles.statusEnded };
      default:
        return { label: '상시/안내', cls: styles.statusUpcoming };
    }
  };

  const getCategoryClass = (l2: UnifiedEventItem['lclsSystm2']) => {
    switch (l2) {
      case 'EV01':
        return styles.catEV01;
      case 'EV02':
        return styles.catEV02;
      case 'EV03':
        return styles.catEV03;
      case 'MUNICIPAL':
        return styles.catMUNICIPAL;
      default:
        return styles.catEV01;
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.summaryBar}>
        <div className={styles.summaryText}>
          <span>{regionTitle}</span>
          {selectedSigunguCode !== 'ALL' && <span> · 시군구({selectedSigunguCode})</span>}
          <span> 분류 결과 총 </span>
          <span className={styles.summaryHighlight}>{events.length}건</span>
        </div>

        <div className={styles.categoryBreakdown}>
          <span className={styles.breakdownBadge}>축제(EV01): {categoryCounts.EV01}건</span>
          <span className={styles.breakdownBadge}>공연(EV02): {categoryCounts.EV02}건</span>
          <span className={styles.breakdownBadge}>행사·전시(EV03): {categoryCounts.EV03}건</span>
          <span className={styles.breakdownBadge}>
            지자체 행정·시민참여: {categoryCounts.MUNICIPAL}건
          </span>
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>
            공공데이터포털 KorService2 및 Firebase Firestore 행사 데이터를 불러오는 중입니다...
          </strong>
          <span>
            필수 연결 키 2종(portalContentId · 법정동 코드) 기준으로 실시간 조합합니다.
          </span>
        </div>
      ) : events.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>현재 선택한 행정구역 및 필터 조건에 해당하는 행사가 없습니다.</strong>
          <span>다른 시·도 구역을 클릭하거나 분류·기간 필터를 넓혀보세요.</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {events.map((ev) => {
            const statusInfo = getStatusInfo(ev.status);
            const isPortal = ev.source === 'PUBLIC_PORTAL';
            const deepMatch = findDeepPromoMatch(ev.contentId, ev.title);
            const hasFirestore = Boolean(ev.firestoreDoc);
            const linkCount = ev.links?.length || 0;

            return (
              <article
                key={ev.id}
                className={styles.card}
                onClick={() => onSelectEvent(ev)}
              >
                <div className={styles.thumbWrap}>
                  {ev.imageUrl || ev.thumbnailUrl ? (
                    <img
                      src={ev.imageUrl || ev.thumbnailUrl}
                      alt={ev.title}
                      className={styles.thumbImg}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.thumbFallback}>
                      <Landmark size={28} color="#2563eb" />
                      <span className={styles.fallbackOrg}>{ev.sourceLabel}</span>
                      <span style={{ fontSize: '0.73rem' }}>
                        {ev.regionName} · {ev.sigunguName}
                      </span>
                    </div>
                  )}

                  <div className={styles.topBadges}>
                    <span
                      className={
                        isPortal ? styles.sourceBadgePortal : styles.sourceBadgeLocal
                      }
                    >
                      {isPortal ? '공공데이터포털' : '행정홈페이지·DB'}
                    </span>
                    <span className={`${styles.statusBadge} ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.metaTags}>
                    <span className={styles.regionTag}>
                      {ev.regionName} · {ev.sigunguName}
                    </span>
                    <span className={`${styles.categoryTag} ${getCategoryClass(ev.lclsSystm2)}`}>
                      {ev.lclsSystm2Name} · {ev.lclsSystm3Name}
                    </span>
                    {(hasFirestore || deepMatch) && (
                      <span className={styles.promoMatchedTag}>
                        🔥 Firestore 조합 · 1:N 링크({linkCount || 3})
                      </span>
                    )}
                  </div>

                  <h3 className={styles.cardTitle}>{ev.title}</h3>

                  {ev.invitation ? (
                    <div className={styles.promoPreviewBanner}>
                      💌 <strong>초댓말:</strong>{' '}
                      {ev.invitation.length > 84
                        ? `${ev.invitation.slice(0, 84)}...`
                        : ev.invitation}
                    </div>
                  ) : (
                    deepMatch && (
                      <div className={styles.promoPreviewBanner}>
                        🏛️ <strong>{deepMatch.promoPortalName}</strong> 매칭 요약 및 별도 링크 결합됨
                      </div>
                    )
                  )}

                  <div className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <Calendar size={13} />
                      <span className={styles.infoText}>
                        {formatDateStr(ev.startDate)} ~ {formatDateStr(ev.endDate)}
                      </span>
                    </div>
                    {ev.eventTime && (
                      <div className={styles.infoRow}>
                        <Clock size={13} />
                        <span className={styles.infoText}>{ev.eventTime}</span>
                      </div>
                    )}
                    <div className={styles.infoRow}>
                      <MapPin size={13} />
                      <span className={styles.infoText}>{ev.addr1 || ev.regionName}</span>
                    </div>
                    {linkCount > 0 ? (
                      <div className={styles.infoRow}>
                        <Link2 size={13} />
                        <span className={styles.infoText}>
                          1:N 홍보링크 {linkCount}건 ({ev.links?.[0]?.label})
                        </span>
                      </div>
                    ) : (
                      ev.tel && (
                        <div className={styles.infoRow}>
                          <Phone size={13} />
                          <span className={styles.infoText}>{ev.tel}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <span>{ev.organizer || ev.sourceLabel}</span>
                  <span className={styles.detailTrigger}>상세·초댓말 보기 →</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
