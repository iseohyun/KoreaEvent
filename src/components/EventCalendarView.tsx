import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { CalendarDisplayOptions, UnifiedEventItem } from '../types/event';
import { getKoreanHolidaysForYear } from '../shared/krHolidays';
import styles from './EventCalendarView.module.css';

interface EventCalendarViewProps {
  events: UnifiedEventItem[];
  displayOptions: CalendarDisplayOptions;
  targetYear?: number;
  onSelectEvent: (event: UnifiedEventItem) => void;
  onChangeDisplayOptions?: (next: CalendarDisplayOptions) => void;
}

interface CalendarCellData {
  day: number | null;
  month: number | null;
  ymd: string;
}

interface CalendarWeekData {
  weekKey: string;
  cells: CalendarCellData[];
  firstValidYmd: string;
  lastValidYmd: string;
  firstMonth: number;
  firstDay: number;
  lastMonth: number;
  lastDay: number;
  eventCount: number;
  containsToday: boolean;
  monthsStartingInWeek: number[];
  holidaysInWeek: Array<{ ymd: string; label: string }>;
}

type WeekRenderBlock =
  | {
      type: 'WEEK';
      week: CalendarWeekData;
    }
  | {
      type: 'EMPTY_GROUP';
      groupKey: string;
      weeks: CalendarWeekData[];
      firstMonth: number;
      firstDay: number;
      lastMonth: number;
      lastDay: number;
      monthsStartingInGroup: number[];
      holidaysInGroup: Array<{ ymd: string; label: string }>;
    };

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function groupWeeksForRendering(
  weeks: CalendarWeekData[],
  collapseEmptyWeeks: boolean
): WeekRenderBlock[] {
  if (!collapseEmptyWeeks) {
    return weeks.map((week) => ({ type: 'WEEK', week }));
  }

  const blocks: WeekRenderBlock[] = [];
  let emptyBuffer: CalendarWeekData[] = [];

  const flushBuffer = () => {
    if (emptyBuffer.length === 0) return;
    const firstW = emptyBuffer[0];
    const lastW = emptyBuffer[emptyBuffer.length - 1];
    const monthsStartingInGroup: number[] = [];
    const holidaysInGroup: Array<{ ymd: string; label: string }> = [];

    for (const w of emptyBuffer) {
      for (const m of w.monthsStartingInWeek) {
        if (!monthsStartingInGroup.includes(m)) {
          monthsStartingInGroup.push(m);
        }
      }
      holidaysInGroup.push(...w.holidaysInWeek);
    }

    blocks.push({
      type: 'EMPTY_GROUP',
      groupKey: `empty-group-${firstW.weekKey}-${lastW.weekKey}`,
      weeks: [...emptyBuffer],
      firstMonth: firstW.firstMonth,
      firstDay: firstW.firstDay,
      lastMonth: lastW.lastMonth,
      lastDay: lastW.lastDay,
      monthsStartingInGroup,
      holidaysInGroup,
    });
    emptyBuffer = [];
  };

  for (const week of weeks) {
    if (week.eventCount === 0 && !week.containsToday) {
      emptyBuffer.push(week);
    } else {
      flushBuffer();
      blocks.push({ type: 'WEEK', week });
    }
  }
  flushBuffer();

  return blocks;
}

export const EventCalendarView: React.FC<EventCalendarViewProps> = ({
  events,
  displayOptions,
  targetYear,
  onSelectEvent,
  onChangeDisplayOptions,
}) => {
  const now = new Date();
  const currentYear = targetYear || now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();
  const todayYmd = `${now.getFullYear()}${pad2(todayMonth)}${pad2(todayDay)}`;

  // 부모에서 onChangeDisplayOptions를 전달하지 않는 경우를 대비한 로컬 오버라이드 지원
  const [localContinuousOverride, setLocalContinuousOverride] = useState<
    boolean | null
  >(null);
  const [localCollapseOverride, setLocalCollapseOverride] = useState<boolean | null>(
    null
  );
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>(
    {}
  );

  const continuousYearView =
    localContinuousOverride !== null
      ? localContinuousOverride
      : (displayOptions.continuousYearView ?? true);
  const collapseEmptyWeeks =
    localCollapseOverride !== null
      ? localCollapseOverride
      : (displayOptions.collapseEmptyWeeks ?? true);

  const handleToggleContinuous = (checked: boolean) => {
    if (onChangeDisplayOptions) {
      onChangeDisplayOptions({
        ...displayOptions,
        continuousYearView: checked,
      });
    } else {
      setLocalContinuousOverride(checked);
    }
  };

  const handleToggleCollapseEmpty = (checked: boolean) => {
    if (onChangeDisplayOptions) {
      onChangeDisplayOptions({
        ...displayOptions,
        collapseEmptyWeeks: checked,
      });
    } else {
      setLocalCollapseOverride(checked);
    }
  };

  const toggleGroupExpand = (groupKey: string) => {
    setExpandedGroupKeys((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const todayCellRef = useRef<HTMLDivElement | null>(null);
  const monthRefs = useRef<Record<number, HTMLElement | null>>({});

  // 대한민국 법정공휴일 · 대체공휴일 · 선거일 · 임시공휴일 맵
  const holidaysMap = useMemo(() => {
    return getKoreanHolidaysForYear(currentYear);
  }, [currentYear]);

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
  }, [todayMonth, continuousYearView]);

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

  // 1년 연속 보기용 전체 주간(Week) 데이터 생성
  const continuousYearWeeks = useMemo<CalendarWeekData[]>(() => {
    const jan1Dow = new Date(currentYear, 0, 1).getDay();
    const allCells: CalendarCellData[] = [];

    for (let i = 0; i < jan1Dow; i += 1) {
      allCells.push({
        day: null,
        month: null,
        ymd: `empty-year-start-${i}`,
      });
    }

    const cur = new Date(currentYear, 0, 1);
    const dec31 = new Date(currentYear, 11, 31);
    while (cur <= dec31) {
      const m = cur.getMonth() + 1;
      const d = cur.getDate();
      allCells.push({
        day: d,
        month: m,
        ymd: `${currentYear}${pad2(m)}${pad2(d)}`,
      });
      cur.setDate(cur.getDate() + 1);
    }

    while (allCells.length % 7 !== 0) {
      allCells.push({
        day: null,
        month: null,
        ymd: `empty-year-end-${allCells.length}`,
      });
    }

    const weeks: CalendarWeekData[] = [];
    for (let i = 0; i < allCells.length; i += 7) {
      const slice = allCells.slice(i, i + 7);
      const validCells = slice.filter((c) => c.day !== null && c.month !== null);
      const firstValid = validCells[0];
      const lastValid = validCells[validCells.length - 1];

      let eventCount = 0;
      let containsToday = false;
      const monthsStartingInWeek: number[] = [];
      const holidaysInWeek: Array<{ ymd: string; label: string }> = [];

      for (const cell of validCells) {
        const evs = eventsByDateMap.get(cell.ymd) || [];
        eventCount += evs.length;
        if (cell.ymd === todayYmd) {
          containsToday = true;
        }
        if (cell.day === 1 && cell.month !== null) {
          monthsStartingInWeek.push(cell.month);
        }
        const hNames = holidaysMap.get(cell.ymd);
        if (hNames && hNames.length > 0 && cell.month !== null && cell.day !== null) {
          holidaysInWeek.push({
            ymd: cell.ymd,
            label: `${cell.month}/${cell.day} ${hNames.join('·')}`,
          });
        }
      }

      weeks.push({
        weekKey: `yr-${currentYear}-w-${i / 7}`,
        cells: slice,
        firstValidYmd: firstValid?.ymd || '',
        lastValidYmd: lastValid?.ymd || '',
        firstMonth: firstValid?.month || 1,
        firstDay: firstValid?.day || 1,
        lastMonth: lastValid?.month || 12,
        lastDay: lastValid?.day || 31,
        eventCount,
        containsToday,
        monthsStartingInWeek,
        holidaysInWeek,
      });
    }

    return weeks;
  }, [currentYear, eventsByDateMap, holidaysMap, todayYmd]);

  const continuousRenderBlocks = useMemo(() => {
    return groupWeeksForRendering(continuousYearWeeks, collapseEmptyWeeks);
  }, [continuousYearWeeks, collapseEmptyWeeks]);

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

  const renderDayCell = (
    cell: CalendarCellData,
    dayOfWeek: number,
    showMonthBadgeOnDay1: boolean,
    forceShowMonthOnFirstValidCell = false
  ) => {
    if (cell.day === null || cell.month === null) {
      return (
        <div
          key={cell.ymd}
          className={`${styles.dayCell} ${styles.dayCellEmpty}`}
        />
      );
    }

    const isToday = cell.ymd === todayYmd;
    const dayEvents = eventsByDateMap.get(cell.ymd) || [];
    const holidayNames = holidaysMap.get(cell.ymd) || [];
    const isHoliday = holidayNames.length > 0;
    const showMonthPill =
      showMonthBadgeOnDay1 && (cell.day === 1 || forceShowMonthOnFirstValidCell);

    return (
      <div
        key={cell.ymd}
        ref={(el) => {
          if (isToday) {
            todayCellRef.current = el;
          }
          if (continuousYearView && cell.day === 1 && cell.month !== null && el) {
            monthRefs.current[cell.month] = el;
          }
        }}
        data-date={cell.ymd}
        className={`${styles.dayCell} ${
          isHoliday ? styles.dayCellHoliday : ''
        } ${isToday ? styles.dayCellToday : ''}`}
      >
        <div className={styles.dayTopRow}>
          <div className={styles.dayTopLeft}>
            {showMonthPill && (
              <span className={styles.monthStartBadge}>{cell.month}월</span>
            )}
            <span
              className={`${styles.dayNumber} ${
                dayOfWeek === 0 || isHoliday
                  ? styles.daySun
                  : dayOfWeek === 6
                    ? styles.daySat
                    : ''
              }`}
            >
              {cell.day}
            </span>
            {isHoliday && (
              <span
                className={styles.holidayBadge}
                title={holidayNames.join(' · ')}
              >
                {holidayNames.join(' · ')}
              </span>
            )}
          </div>
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
                <div className={styles.chipSubMeta}>🕒 {ev.eventTime}</div>
              )}
              {displayOptions.showOrganizer && ev.organizer && (
                <div className={styles.chipSubMeta}>🏛️ {ev.organizer}</div>
              )}
              {displayOptions.showInvitation && ev.invitation && (
                <div className={styles.chipInvitation}>{ev.invitation}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderWeekBlocks = (
    blocks: WeekRenderBlock[],
    showMonthBadgeOnDay1: boolean
  ) => {
    return blocks.map((block) => {
      if (block.type === 'WEEK') {
        const firstValidIdx = block.week.cells.findIndex((c) => c.day !== null);
        return (
          <div key={block.week.weekKey} className={styles.daysGrid}>
            {block.week.cells.map((cell, idx) =>
              renderDayCell(
                cell,
                idx % 7,
                showMonthBadgeOnDay1,
                showMonthBadgeOnDay1 && idx === firstValidIdx && cell.day === 1
              )
            )}
          </div>
        );
      }

      const isExpanded = Boolean(expandedGroupKeys[block.groupKey]);
      const rangeText =
        block.firstMonth === block.lastMonth
          ? `${block.firstMonth}월 ${block.firstDay}일 ~ ${block.lastDay}일`
          : `${block.firstMonth}월 ${block.firstDay}일 ~ ${block.lastMonth}월 ${block.lastDay}일`;

      return (
        <div
          key={block.groupKey}
          ref={(el) => {
            if (continuousYearView && el) {
              for (const m of block.monthsStartingInGroup) {
                if (!isExpanded) {
                  monthRefs.current[m] = el;
                }
              }
            }
          }}
          className={styles.collapsedWeeksWrap}
        >
          <button
            type="button"
            className={`${styles.collapsedWeeksBtn} ${
              isExpanded ? styles.collapsedWeeksBtnExpanded : ''
            }`}
            onClick={() => toggleGroupExpand(block.groupKey)}
          >
            <div className={styles.collapsedLeft}>
              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <span className={styles.collapsedRangeBadge}>{rangeText}</span>
              <span className={styles.collapsedSummaryText}>
                행사가 없는 {block.weeks.length}주 묶음 축약
              </span>
              {block.holidaysInGroup.length > 0 && (
                <span className={styles.collapsedHolidaysHint}>
                  (공휴일: {block.holidaysInGroup.map((h) => h.label).join(', ')})
                </span>
              )}
            </div>
            <span className={styles.collapsedActionHint}>
              {isExpanded ? '다시 접기' : '클릭하여 주간 달력 펼치기'}
            </span>
          </button>

          {isExpanded && (
            <div className={styles.expandedEmptyWeeksBody}>
              {block.weeks.map((week) => (
                <div key={week.weekKey} className={styles.daysGrid}>
                  {week.cells.map((cell, idx) =>
                    renderDayCell(cell, idx % 7, showMonthBadgeOnDay1)
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className={styles.calendarPage}>
      {/* 상단 1~12월 빠른 이동 바 + 연속보기/빈주축약 체크박스 + 오늘 날짜 이동 버튼 */}
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

        <div className={styles.navRightControls}>
          <label className={styles.inlineOptionCheck}>
            <input
              type="checkbox"
              checked={continuousYearView}
              onChange={(e) => handleToggleContinuous(e.target.checked)}
            />
            <span>월 구분 없이 1년치 이어보기</span>
          </label>

          <label className={styles.inlineOptionCheck}>
            <input
              type="checkbox"
              checked={collapseEmptyWeeks}
              onChange={(e) => handleToggleCollapseEmpty(e.target.checked)}
            />
            <span>행사 없는 주 묶어서 축약</span>
          </label>

          <button type="button" className={styles.todayBtn} onClick={scrollToToday}>
            <CalendarCheck size={15} />
            <span>
              오늘 날짜로 이동 ({todayMonth}월 {todayDay}일)
            </span>
          </button>
        </div>
      </div>

      {/* (A) 월 구분 없이 1년치를 이어서 보는 연속 달력 모드 */}
      {continuousYearView ? (
        <section className={styles.monthCard} aria-label={`${currentYear}년 연간 연속 달력`}>
          <div className={styles.monthHeader}>
            <div className={styles.monthTitleGroup}>
              <h2 className={styles.monthTitle}>
                {currentYear}년 연간 연속 달력 (1월 ~ 12월)
              </h2>
              <span className={styles.continuousModeBadge}>
                월 구분 없이 1년치 이어보기
              </span>
            </div>
            <span className={styles.monthCount}>
              표시 행사 <strong>{events.filter((e) => !e.dateUnknown).length}건</strong>
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

          <div className={styles.continuousWeeksContainer}>
            {renderWeekBlocks(continuousRenderBlocks, true)}
          </div>
        </section>
      ) : (
        /* (B) 기존 월별 카드 분리 달력 모드 */
        <div className={styles.yearStack}>
          {MONTHS.map((month) => {
            const firstDayOfWeek = new Date(currentYear, month - 1, 1).getDay();
            const daysInMonth = new Date(currentYear, month, 0).getDate();

            const cells: CalendarCellData[] = [];
            for (let i = 0; i < firstDayOfWeek; i += 1) {
              cells.push({
                day: null,
                month: null,
                ymd: `empty-start-${month}-${i}`,
              });
            }
            for (let d = 1; d <= daysInMonth; d += 1) {
              cells.push({
                day: d,
                month,
                ymd: `${currentYear}${pad2(month)}${pad2(d)}`,
              });
            }
            while (cells.length % 7 !== 0) {
              cells.push({
                day: null,
                month: null,
                ymd: `empty-end-${month}-${cells.length}`,
              });
            }

            const monthWeeks: CalendarWeekData[] = [];
            for (let i = 0; i < cells.length; i += 7) {
              const slice = cells.slice(i, i + 7);
              const validCells = slice.filter(
                (c) => c.day !== null && c.month !== null
              );
              const firstValid = validCells[0];
              const lastValid = validCells[validCells.length - 1];
              let eventCount = 0;
              let containsToday = false;
              const holidaysInWeek: Array<{ ymd: string; label: string }> = [];

              for (const cell of validCells) {
                eventCount += (eventsByDateMap.get(cell.ymd) || []).length;
                if (cell.ymd === todayYmd) containsToday = true;
                const hNames = holidaysMap.get(cell.ymd);
                if (hNames && hNames.length > 0 && cell.day !== null) {
                  holidaysInWeek.push({
                    ymd: cell.ymd,
                    label: `${month}/${cell.day} ${hNames.join('·')}`,
                  });
                }
              }

              monthWeeks.push({
                weekKey: `m-${month}-w-${i / 7}`,
                cells: slice,
                firstValidYmd: firstValid?.ymd || '',
                lastValidYmd: lastValid?.ymd || '',
                firstMonth: month,
                firstDay: firstValid?.day || 1,
                lastMonth: month,
                lastDay: lastValid?.day || daysInMonth,
                eventCount,
                containsToday,
                monthsStartingInWeek: i === 0 ? [month] : [],
                holidaysInWeek,
              });
            }

            const monthBlocks = groupWeeksForRendering(
              monthWeeks,
              collapseEmptyWeeks
            );

            // 해당 월에 걸친 고유 행사 수 집계
            const monthPrefix = `${currentYear}${pad2(month)}`;
            const monthUniqueEvents = events.filter(
              (e) =>
                !e.dateUnknown &&
                e.startDate.slice(0, 6) <= monthPrefix &&
                (e.endDate || e.startDate).slice(0, 6) >= monthPrefix
            );

            // 해당 월의 공휴일 요약 목록
            const monthHolidayItems = Array.from(holidaysMap.entries())
              .filter(([ymd]) => ymd.startsWith(monthPrefix))
              .map(([ymd, names]) => ({
                ymd,
                day: Number(ymd.slice(6, 8)),
                label: names.join('·'),
              }));

            return (
              <section
                key={month}
                ref={(el) => {
                  monthRefs.current[month] = el;
                }}
                className={styles.monthCard}
              >
                <div className={styles.monthHeader}>
                  <div className={styles.monthTitleGroup}>
                    <h2 className={styles.monthTitle}>
                      {currentYear}년 {month}월
                    </h2>
                    {monthHolidayItems.length > 0 && (
                      <div className={styles.monthHolidayPills}>
                        {monthHolidayItems.map((h) => (
                          <span key={h.ymd} className={styles.monthHolidayPill}>
                            {month}/{h.day} {h.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
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

                <div className={styles.continuousWeeksContainer}>
                  {renderWeekBlocks(monthBlocks, false)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
