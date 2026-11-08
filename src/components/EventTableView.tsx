import React, { useMemo, useState } from 'react';
import { ArrowUpDown, ExternalLink } from 'lucide-react';
import { ListColumnVisibility, UnifiedEventItem } from '../types/event';
import styles from './EventTableView.module.css';
import { formatYmd } from '../shared/dateFormat';

interface EventTableViewProps {
  events: UnifiedEventItem[];
  columns: ListColumnVisibility;
  onSelectEvent: (event: UnifiedEventItem) => void;
}

type SortField = 'region' | 'category' | 'title' | 'startDate' | 'status';

export const EventTableView: React.FC<EventTableViewProps> = ({
  events,
  columns,
  onSelectEvent,
}) => {
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedEvents = useMemo(() => {
    const list = [...events];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'region') {
        cmp = `${a.regionName} ${a.sigunguName}`.localeCompare(
          `${b.regionName} ${b.sigunguName}`,
          'ko'
        );
      } else if (sortField === 'category') {
        cmp = `${a.lclsSystm2Name} ${a.lclsSystm3Name}`.localeCompare(
          `${b.lclsSystm2Name} ${b.lclsSystm3Name}`,
          'ko'
        );
      } else if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title, 'ko');
      } else if (sortField === 'startDate') {
        cmp = (a.startDate || '').localeCompare(b.startDate || '');
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [events, sortField, sortAsc]);

  const getCatClass = (l2: UnifiedEventItem['lclsSystm2']) => {
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

  const getStatusInfo = (status: UnifiedEventItem['status']) => {
    switch (status) {
      case 'ONGOING':
        return { label: '진행중', cls: styles.statusOngoing };
      case 'UPCOMING':
        return { label: '개최예정', cls: styles.statusUpcoming };
      case 'ENDED':
        return { label: '종료', cls: styles.statusEnded };
      default:
        return { label: '안내', cls: styles.statusUpcoming };
    }
  };

  return (
    <div className={styles.listPage}>
      <div className={styles.summaryRow}>
        <span className={styles.summaryText}>
          검색 결과 총 <strong>{sortedEvents.length}건</strong>
        </span>
        <span className={styles.summaryHint}>
          상단 우측 [표시 열] 버튼에서 테이블에 표시할 열(Column)을 자유롭게 켜고 끌 수 있습니다.
        </span>
      </div>

      <div className={styles.tableCard}>
        {sortedEvents.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>조건에 해당하는 행사가 없습니다.</strong>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.region && (
                  <th
                    className={styles.sortableTh}
                    onClick={() => handleSort('region')}
                  >
                    행정구역 <ArrowUpDown size={12} style={{ verticalAlign: 'middle' }} />
                  </th>
                )}
                {columns.category && (
                  <th
                    className={styles.sortableTh}
                    onClick={() => handleSort('category')}
                  >
                    행사분류 <ArrowUpDown size={12} style={{ verticalAlign: 'middle' }} />
                  </th>
                )}
                {columns.title && (
                  <th
                    className={styles.sortableTh}
                    onClick={() => handleSort('title')}
                  >
                    행사명 <ArrowUpDown size={12} style={{ verticalAlign: 'middle' }} />
                  </th>
                )}
                {columns.eventDate && (
                  <th
                    className={styles.sortableTh}
                    onClick={() => handleSort('startDate')}
                  >
                    행사일 (기간) <ArrowUpDown size={12} style={{ verticalAlign: 'middle' }} />
                  </th>
                )}
                {columns.eventTime && <th>행사시각</th>}
                {columns.organizer && <th>주최기관</th>}
                {columns.invitation && <th>초댓말 요약</th>}
                {columns.links && <th>홍보·공식 링크 (1:N)</th>}
                {columns.addr && <th>장소 / 주소</th>}
                {columns.status && (
                  <th
                    className={styles.sortableTh}
                    onClick={() => handleSort('status')}
                  >
                    진행상태 <ArrowUpDown size={12} style={{ verticalAlign: 'middle' }} />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((ev) => {
                const statusInfo = getStatusInfo(ev.status);
                return (
                  <tr
                    key={ev.id}
                    className={styles.row}
                    onClick={() => onSelectEvent(ev)}
                  >
                    {columns.region && (
                      <td>
                        <span className={styles.regionPill}>
                          {ev.regionName} · {ev.sigunguName}
                        </span>
                      </td>
                    )}

                    {columns.category && (
                      <td>
                        <span className={`${styles.catBadge} ${getCatClass(ev.lclsSystm2)}`}>
                          {ev.lclsSystm2Name} · {ev.lclsSystm3Name}
                        </span>
                      </td>
                    )}

                    {columns.title && (
                      <td className={styles.titleCell}>
                        <div>{ev.title}</div>
                        {((ev.seriesHistory && ev.seriesHistory.length >= 2) ||
                          ev.edition) && (
                          <div className={styles.seriesBadgeRow}>
                            {ev.edition && (
                              <span className={styles.editionMiniBadge}>
                                제{ev.edition}회
                              </span>
                            )}
                            {ev.seriesHistory && ev.seriesHistory.length >= 2 && (
                              <span className={styles.seriesMiniBadge}>
                                🔄 역대 {ev.seriesHistory.length}회차 연결
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    )}

                    {columns.eventDate && (
                      <td className={styles.dateCell}>
                        {ev.dateUnknown
                          ? `일정 미정 (${ev.startDate.slice(0, 4)}년)`
                          : `${formatYmd(ev.startDate)} ~ ${formatYmd(ev.endDate)}`}
                      </td>
                    )}

                    {columns.eventTime && (
                      <td className={styles.dateCell}>
                        {ev.eventTime || '상세 안내 참조'}
                      </td>
                    )}

                    {columns.organizer && (
                      <td>{ev.organizer || ev.sourceLabel}</td>
                    )}

                    {columns.invitation && (
                      <td className={styles.invitationCell}>
                        {ev.invitation
                          ? ev.invitation.length > 90
                            ? `${ev.invitation.slice(0, 90)}...`
                            : ev.invitation
                          : ev.summary || '-'}
                      </td>
                    )}

                    {columns.links && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className={styles.linksGroup}>
                          {ev.links && ev.links.length > 0 ? (
                            ev.links.slice(0, 2).map((lnk, idx) => (
                              <a
                                key={idx}
                                href={lnk.url}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.linkBtn}
                              >
                                <span>{lnk.label.slice(0, 14)}</span>
                                <ExternalLink size={11} />
                              </a>
                            ))
                          ) : ev.sourceOrgUrl ? (
                            <a
                              href={ev.sourceOrgUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.linkBtn}
                            >
                              <span>공식/홍보링크</span>
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                    )}

                    {columns.addr && <td>{ev.addr1 || ev.regionName}</td>}

                    {columns.status && (
                      <td>
                        <span className={`${styles.statusBadge} ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
