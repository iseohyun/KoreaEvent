import React, { useEffect, useMemo, useRef } from 'react';
import { CalendarCheck } from 'lucide-react';
import { CalendarDisplayOptions, UnifiedEventItem } from '../types/event';
import styles from './EventCalendarView.module.css';

interface EventCalendarViewProps {
  events: UnifiedEventItem[];
  displayOptions: CalendarDisplayOptions;
  targetYear?: number;
  onSelectEvent: (event: UnifiedEventItem) => void;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const EventCalendarView: React.FC<EventCalendarViewProps> = ({
  events,
  displayOptions,
  targetYear,
  onSelectEvent,
}) => {
  const now = new Date();
  const currentYear = targetYear || now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();
  const todayYmd = `${now.getFullYear()}${pad2(todayMonth)}${pad2(todayDay)}`;

  const todayCellRef = useRef<HTMLDivElement | null>(null);
  const monthRefs = useRef<Record<number, HTMLElement | null>>({});

  // 달력 화면 진입 시 오늘 날짜 셀로 자동 스크롤
  useEffect(() => {
    const timer = setTimeout(() => {
      if (todayCellRef.current) {
        todayCellRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } else if (monthRefs.current[todayMonth]) {
        monthRefs.current[todayMonth]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [todayMonth]);

  const scrollToToday = () => {
    if (todayCellRef.current) {
      todayCellRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    } else if (monthRefs.current[todayMonth]) {
      monthRefs.current[todayMonth]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const scrollToMonth = (m: number) => {
    monthRefs.current[m]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  // 날짜(YYYYMMDD)별 진행 행사 인덱싱
  const eventsByDateMap = useMemo(() => {
    const map = new Map<string, UnifiedEventItem[]>();

    events.forEach((ev) => {
      // 일정 미확인(연도만 아는) 행사는 매일 표시되지 않도록 달력에서 제외
      if (ev.dateUnknown) return;
      const start = ev.startDate?.slice(0, 8);
      const end = (ev.endDate || ev.startDate)?.slice(0, 8);
      if (!start || start.length < 8) return;

      const clampedStart = start < `${currentYear}0101` ? `${currentYear}0101` : start;
      const clampedEnd = end > `${currentYear}1231` ? `${currentYear}1231` : end;
      if (clampedStart > `${currentYear}1231` || clampedEnd < `${currentYear}0101`) {
        return;
      }

      const sy = Number(clampedStart.slice(0, 4));
      const sm = Number(clampedStart.slice(4, 6)) - 1;
      const sd = Number(clampedStart.slice(6, 8));

      const ey = Number(clampedEnd.slice(0, 4));
      const em = Number(clampedEnd.slice(4, 6)) - 1;
      const ed = Number(clampedEnd.slice(6, 8));

      const cur = new Date(sy, sm, sd);
      const endDt = new Date(ey, em, ed);

      // 장기 상설 행사가 모든 칸을 과도하게 채우지 않도록 시작일 및 주요 일자 중심 매핑 (최대 45일 범위 내 일별 표시)
      let safetyCount = 0;
      while (cur <= endDt && safetyCount < 60) {
        const ymd = `${cur.getFullYear()}${pad2(cur.getMonth() + 1)}${pad2(
          cur.getDate()
        )}`;
        const arr = map.get(ymd) || [];
        arr.push(ev);
        map.set(ymd, arr);
        cur.setDate(cur.getDate() + 1);
        safetyCount += 1;
      }
    });

    // 당일 시작하는 행사를 우선 정렬
    map.forEach((list, ymd) => {
      list.sort((a, b) => {
        const aStartsToday = a.startDate === ymd ? 0 : 1;
        const bStartsToday = b.startDate === ymd ? 0 : 1;
        return aStartsToday - bStartsToday;
      });
    });

    return map;
  }, [events, currentYear]);

  const getCatChipClass = (l2: UnifiedEventItem['lclsSystm2']) => {
    switch (l2) {
      case 'EV01':
        return styles.chipCatEV01;
      case 'EV02':
        return styles.chipCatEV02;
      case 'EV03':
        return styles.chipCatEV03;
      case 'MUNICIPAL':
        return styles.chipCatMUNICIPAL;
      default:
        return styles.chipCatEV01;
    }
  };

  const getStatusLabel = (status: UnifiedEventItem['status']) => {
    switch (status) {
      case 'ONGOING':
        return '진행중';
      case 'UPCOMING':
        return '예정';
      case 'ENDED':
        return '종료';
      default:
        return '안내';
    }
  };

  return (
    <div className={styles.calendarPage}>
      {/* 상단 1~12월 빠른 이동 바 & 오늘 날짜 이동 버튼 */}
      <div className={styles.monthNavBar}>
        <div className={styles.monthJumpList}>
          {MONTHS.map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.monthJumpBtn} ${
                m === todayMonth ? styles.monthJumpBtnCurrent : ''
              }`}
              onClick={() => scrollToMonth(m)}
            >
              {m}월
            </button>
          ))}
        </div>

        <button type="button" className={styles.todayBtn} onClick={scrollToToday}>
          <CalendarCheck size={15} />
          <span>오늘 날짜로 이동 ({todayMonth}월 {todayDay}일)</span>
        </button>
      </div>

      {/* 1년(1월~12월) 연속 스크롤 달력 */}
      <div className={styles.yearStack}>
        {MONTHS.map((month) => {
          const firstDayOfWeek = new Date(currentYear, month - 1, 1).getDay();
          const daysInMonth = new Date(currentYear, month, 0).getDate();

          const cells: Array<{ day: number | null; ymd: string }> = [];
          for (let i = 0; i < firstDayOfWeek; i += 1) {
            cells.push({ day: null, ymd: `empty-start-${month}-${i}` });
          }
          for (let d = 1; d <= daysInMonth; d += 1) {
            cells.push({
              day: d,
              ymd: `${currentYear}${pad2(month)}${pad2(d)}`,
            });
          }
          while (cells.length % 7 !== 0) {
            cells.push({ day: null, ymd: `empty-end-${month}-${cells.length}` });
          }

          // 해당 월에 걸친 고유 행사 수 집계
          const monthPrefix = `${currentYear}${pad2(month)}`;
          const monthUniqueEvents = events.filter(
            (e) =>
              !e.dateUnknown &&
              e.startDate.slice(0, 6) <= monthPrefix &&
              (e.endDate || e.startDate).slice(0, 6) >= monthPrefix
          );

          return (
            <section
              key={month}
              ref={(el) => {
                monthRefs.current[month] = el;
              }}
              className={styles.monthCard}
            >
              <div className={styles.monthHeader}>
                <h2 className={styles.monthTitle}>
                  {currentYear}년 {month}월
                </h2>
                <span className={styles.monthCount}>
                  이달의 행사 <strong>{monthUniqueEvents.length}건</strong>
                </span>
              </div>

              <div className={styles.weekdayRow}>
                {WEEKDAYS.map((w, idx) => (
                  <div
                    key={w}
                    className={`${styles.weekdayCell} ${
                      idx === 0
                        ? styles.weekdaySun
                        : idx === 6
                          ? styles.weekdaySat
                          : ''
                    }`}
                  >
                    {w}요일
                  </div>
                ))}
              </div>

              <div className={styles.daysGrid}>
                {cells.map((cell, idx) => {
                  if (cell.day === null) {
                    return (
                      <div
                        key={cell.ymd}
                        className={`${styles.dayCell} ${styles.dayCellEmpty}`}
                      />
                    );
                  }

                  const isToday = cell.ymd === todayYmd;
                  const dayOfWeek = idx % 7;
                  const dayEvents = eventsByDateMap.get(cell.ymd) || [];

                  return (
                    <div
                      key={cell.ymd}
                      ref={isToday ? todayCellRef : undefined}
                      data-date={cell.ymd}
                      className={`${styles.dayCell} ${
                        isToday ? styles.dayCellToday : ''
                      }`}
                    >
                      <div className={styles.dayTopRow}>
                        <span
                          className={`${styles.dayNumber} ${
                            dayOfWeek === 0
                              ? styles.daySun
                              : dayOfWeek === 6
                                ? styles.daySat
                                : ''
                          }`}
                        >
                          {cell.day}
                        </span>
                        {isToday && <span className={styles.todayBadge}>오늘</span>}
                      </div>

                      <div className={styles.dayEventsList}>
                        {dayEvents.map((ev) => (
                          <button
                            key={`${cell.ymd}-${ev.id}`}
                            type="button"
                            className={styles.eventItemChip}
                            onClick={() => onSelectEvent(ev)}
                          >
                            {(displayOptions.showCategoryBadge ||
                              displayOptions.showStatusBadge) && (
                              <div className={styles.chipTopMeta}>
                                {displayOptions.showCategoryBadge && (
                                  <span className={getCatChipClass(ev.lclsSystm2)}>
                                    {ev.lclsSystm2Name}
                                  </span>
                                )}
                                {displayOptions.showStatusBadge && (
                                  <span className={styles.chipStatus}>
                                    {getStatusLabel(ev.status)}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className={styles.chipMainRow}>
                              {displayOptions.showRegion && (
                                <span className={styles.chipRegion}>
                                  {ev.sigunguName || ev.regionName}
                                </span>
                              )}
                              <span className={styles.chipTitle}>{ev.title}</span>
                            </div>

                            {displayOptions.showEventTime && ev.eventTime && (
                              <span className={styles.chipSubLine}>
                                🕒 {ev.eventTime}
                              </span>
                            )}

                            {displayOptions.showOrganizer && ev.organizer && (
                              <span className={styles.chipSubLine}>
                                🏛️ {ev.organizer}
                              </span>
                            )}

                            {displayOptions.showInvitation && ev.invitation && (
                              <span className={styles.chipInvitation}>
                                💌 {ev.invitation}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
