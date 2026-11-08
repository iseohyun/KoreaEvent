import React, { useMemo } from 'react';
import { Calendar, Clock, Landmark, Link2, MapPin, Phone } from 'lucide-react';
import { REGION_BY_ID } from '../constants/regions';
import { UnifiedEventItem } from '../types/event';
import styles from './EventCardGrid.module.css';
import { formatYmd } from '../shared/dateFormat';

interface EventCardGridProps {
  events: UnifiedEventItem[];
  selectedRegionId: string;
  selectedSigunguCode: string;
  selectedSigunguName?: string;
  loading: boolean;
  onSelectEvent: (event: UnifiedEventItem) => void;
}

export const EventCardGrid: React.FC<EventCardGridProps> = ({
  events,
  selectedRegionId,
  selectedSigunguCode,
  selectedSigunguName,
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
      ? '전국'
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
          {selectedSigunguCode !== 'ALL' && (
            <span> · {selectedSigunguName || selectedSigunguCode}</span>
          )}
          <span> 행사 </span>
          <span className={styles.summaryHighlight}>{events.length}건</span>
        </div>

        <div className={styles.categoryBreakdown}>
          <span className={styles.breakdownBadge}>축제 {categoryCounts.EV01}</span>
          <span className={styles.breakdownBadge}>공연 {categoryCounts.EV02}</span>
          <span className={styles.breakdownBadge}>행사·전시 {categoryCounts.EV03}</span>
          <span className={styles.breakdownBadge}>지자체행사 {categoryCounts.MUNICIPAL}</span>
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>행사 정보를 불러오는 중입니다...</strong>
        </div>
      ) : events.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>현재 선택한 구역 및 검색 조건에 해당하는 행사가 없습니다.</strong>
          <span>상단에서 다른 시·도나 기간 필터를 선택해 보세요.</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {events.map((ev) => {
            const statusInfo = getStatusInfo(ev.status);
            const isPortal = ev.source === 'PUBLIC_PORTAL';
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
                      <span className={styles.fallbackOrg}>
                        {ev.organizer || ev.sourceLabel}
                      </span>
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
                      {isPortal ? '공공포털' : '지자체홍보'}
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
                    {ev.edition && (
                      <span className={styles.editionTag}>제{ev.edition}회</span>
                    )}
                    {ev.seriesHistory && ev.seriesHistory.length >= 2 && (
                      <span className={styles.seriesLinkTag}>
                        🔄 역대 {ev.seriesHistory.length}회차 연결
                      </span>
                    )}
                  </div>

                  <h3 className={styles.cardTitle}>{ev.title}</h3>

                  {ev.invitation && (
                    <div className={styles.promoPreviewBanner}>
                      💌{' '}
                      {ev.invitation.length > 80
                        ? `${ev.invitation.slice(0, 80)}...`
                        : ev.invitation}
                    </div>
                  )}

                  <div className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <Calendar size={13} />
                      <span className={styles.infoText}>
                        {ev.dateUnknown
                          ? `일정 미정 (${ev.startDate.slice(0, 4)}년 · 홍보 페이지 참조)`
                          : `${formatYmd(ev.startDate)} ~ ${formatYmd(ev.endDate)}`}
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
                          관련 홍보링크 {linkCount}개
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
                  <span className={styles.detailTrigger}>상세보기 →</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
