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

const DAY_MS = 1000 * 60 * 60 * 24;

function getDaysRemainingUntilStart(
  startDateYmd: string,
  todayMidnightMs: number
): number {
  const clean = String(startDateYmd || '').replace(/\D/g, '');
  if (clean.length < 8) return 30;
  const y = Number(clean.slice(0, 4));
  const m = Number(clean.slice(4, 6)) - 1;
  const d = Number(clean.slice(6, 8));
  const startMs = new Date(y, m, d).getTime();
  if (Number.isNaN(startMs)) return 30;
  return Math.max(0, Math.round((startMs - todayMidnightMs) / DAY_MS));
}

/**
 * 지도로 보기 상단 노출 점수 계산
 * - "공공포털": 100점
 * - "시도 단위": 80점
 * - "시군구 단위": 60점
 * - "진행중": +20점
 * - "예정": +(21 - 남은일수)점 (남은 일당 1점 감점)
 * - "종료": -50점
 * - 같은 점수라면 무작위 순위
 */
function computeMapExposureScore(
  ev: UnifiedEventItem,
  todayMidnightMs: number
): number {
  let score = 0;

  // 1) 출처 및 행정단위 점수 ("공공포털" 100점 / 시도 단위 80점 / 시군구 단위 60점)
  if (ev.source === 'PUBLIC_PORTAL') {
    score += 100;
  } else if (
    (ev.promoLevel ?? 0) >= 2 ||
    ev.lDongSignguCd === '000' ||
    ev.sigunguName === '본청' ||
    ev.sigunguName === '전체'
  ) {
    score += 80;
  } else if ((ev.promoLevel ?? 0) === 1 || ev.source === 'MUNICIPAL_WEB') {
    score += 60;
  }

  // 2) 진행 상태 점수 ("진행중" 20점 / "예정" 21점 - 남은일당 감점 / "종료" -50점)
  if (ev.status === 'ONGOING') {
    score += 20;
  } else if (ev.status === 'UPCOMING') {
    const daysLeft = getDaysRemainingUntilStart(ev.startDate, todayMidnightMs);
    score += 21 - daysLeft;
  } else if (ev.status === 'ENDED') {
    score -= 50;
  } else if (ev.dateUnknown) {
    score -= 30;
  }

  return score;
}

export const EventCardGrid: React.FC<EventCardGridProps> = ({
  events,
  selectedRegionId,
  selectedSigunguCode,
  selectedSigunguName,
  loading,
  onSelectEvent,
}) => {
  const sortedEvents = useMemo(() => {
    const now = new Date();
    const todayMidnightMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    const scored = events.map((ev) => ({
      ev,
      score: computeMapExposureScore(ev, todayMidnightMs),
      tieBreaker: Math.random(),
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.tieBreaker - b.tieBreaker;
    });

    return scored.map((item) => item.ev);
  }, [events]);

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
          {sortedEvents.map((ev) => {
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
