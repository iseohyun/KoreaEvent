import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  CalendarPlus,
  Check,
  Columns,
  Database,
  List,
  Map as MapIcon,
  Menu,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Waves,
  X,
} from 'lucide-react';
import { ADMIN_REGIONS } from '../constants/regions';
import {
  buildDefaultSpecialPromoFormats,
  MAJOR_CATEGORIES,
  SPECIAL_PROMO_EVENT_FORMATS,
  SUB_CATEGORIES,
} from '../constants/categories';
import {
  ACTIVE_PROMO_LEVELS,
  PROMO_LEVEL_SHORT_LABELS,
  SPORT_LABELS,
} from '../shared/promoPolicy';
import {
  CalendarDisplayOptions,
  DbCrawlTabCategory,
  DetailSearchTargets,
  EventFilterState,
  ListColumnKey,
  ListColumnVisibility,
  MainMenuView,
  MonthPeriodFilter,
  PoolFilterState,
  PromoLevel,
  SpecialPromoSport,
  ViewMode,
} from '../types/event';
import {
  KoreaGovEventIcon,
  OlympicSportPictogram,
} from './BrandAndSportIcons';
import styles from './HeaderBar.module.css';

interface HeaderBarProps {
  activeMenu: MainMenuView;
  activeSport: SpecialPromoSport;
  activeDbTab: DbCrawlTabCategory;
  viewMode: ViewMode;
  filters: EventFilterState;
  poolFilters?: PoolFilterState;
  poolRegionOptions?: string[];
  poolSigunguOptions?: string[];
  scopeEventCounts: Record<PromoLevel, number>;
  specialPromoFormatCounts: Record<string, number>;
  availableYears: number[];
  sigunguOptions: Array<{ code: string; name: string }>;
  calendarOptions: CalendarDisplayOptions;
  listColumns: ListColumnVisibility;
  abbreviationEnabled: boolean;
  activeAbbreviationRuleCount: number;
  swimNewsBadgeCount?: number;
  onToggleSidebar: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onChangeDbTab: (tab: DbCrawlTabCategory) => void;
  onUpdateFilter: <K extends keyof EventFilterState>(
    key: K,
    value: EventFilterState[K]
  ) => void;
  onResetFilters: () => void;
  onUpdatePoolFilter?: <K extends keyof PoolFilterState>(
    key: K,
    value: PoolFilterState[K]
  ) => void;
  onResetPoolFilters?: () => void;
  onChangeCalendarOptions: (next: CalendarDisplayOptions) => void;
  onChangeListColumns: (next: ListColumnVisibility) => void;
  onToggleAbbreviation: () => void;
  onOpenSettings: () => void;
}

const MENU_PAGE_TITLES: Record<MainMenuView, string> = {
  MAP: '지도로 보기',
  CALENDAR: '달력으로 보기',
  LIST: '행사 리스트',
  EVENT_REGISTER: '행사 등록',
  PROMO_DIRECTORY: 'DB',
  SPECIAL_PROMO: '특별 홍보관',
  SETTINGS: '세팅 · 축약보기 관리',
  ABOUT: '사이트 소개',
};

const DB_CRAWL_TABS: Array<{
  id: DbCrawlTabCategory;
  label: string;
  sport?: SpecialPromoSport;
}> = [
  { id: 'ALL', label: '전체' },
  { id: 'MUNICIPAL', label: '지자체·행정' },
  { id: 'SWIMMING', label: '수영', sport: 'SWIMMING' },
  { id: 'RUNNING', label: '러닝', sport: 'RUNNING' },
  { id: 'CYCLING', label: '자전거', sport: 'CYCLING' },
  { id: 'TRIATHLON', label: '철인', sport: 'TRIATHLON' },
];

const DB_SCOPE_LABELS: Record<PromoLevel, string> = {
  3: '전국',
  2: '광역시도',
  1: '시군구',
  0: '기타',
};

const MONTH_PERIOD_OPTIONS: Array<{ value: MonthPeriodFilter; label: string }> = [
  { value: 'ALL', label: '전체 (연중)' },
  { value: 'H1', label: '상반기 (1~6월)' },
  { value: 'H2', label: '하반기 (7~12월)' },
  { value: 'Q1', label: '1분기 (1~3월)' },
  { value: 'Q2', label: '2분기 (4~6월)' },
  { value: 'Q3', label: '3분기 (7~9월)' },
  { value: 'Q4', label: '4분기 (10~12월)' },
  { value: 'M01', label: '1월' },
  { value: 'M02', label: '2월' },
  { value: 'M03', label: '3월' },
  { value: 'M04', label: '4월' },
  { value: 'M05', label: '5월' },
  { value: 'M06', label: '6월' },
  { value: 'M07', label: '7월' },
  { value: 'M08', label: '8월' },
  { value: 'M09', label: '9월' },
  { value: 'M10', label: '10월' },
  { value: 'M11', label: '11월' },
  { value: 'M12', label: '12월' },
];

const LIST_COLUMN_LABELS: Array<{ key: ListColumnKey; label: string }> = [
  { key: 'region', label: '행정구역' },
  { key: 'category', label: '행사분류' },
  { key: 'title', label: '행사명' },
  { key: 'eventDate', label: '행사일' },
  { key: 'eventTime', label: '행사시각' },
  { key: 'organizer', label: '주최기관' },
  { key: 'invitation', label: '초댓말 요약' },
  { key: 'links', label: '홍보링크 (1:N)' },
  { key: 'addr', label: '장소/주소' },
  { key: 'status', label: '진행상태' },
];

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeMenu,
  activeSport,
  activeDbTab,
  viewMode,
  filters,
  poolFilters,
  poolRegionOptions = [],
  poolSigunguOptions = [],
  scopeEventCounts,
  specialPromoFormatCounts,
  availableYears,
  sigunguOptions,
  calendarOptions,
  listColumns,
  abbreviationEnabled,
  activeAbbreviationRuleCount,
  swimNewsBadgeCount = 0,
  onToggleSidebar,
  onChangeViewMode,
  onChangeDbTab,
  onUpdateFilter,
  onUpdatePoolFilter,
  onChangeCalendarOptions,
  onChangeListColumns,
  onToggleAbbreviation,
  onOpenSettings,
}) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const shareTimerRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const handleShareCurrentUrl = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setShareCopied(true);
      if (shareTimerRef.current) {
        window.clearTimeout(shareTimerRef.current);
      }
      shareTimerRef.current = window.setTimeout(() => {
        setShareCopied(false);
      }, 2200);
    } catch (err) {
      console.error('Failed to copy share URL:', err);
    }
  };

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const updateOffset = () => {
      document.documentElement.style.setProperty(
        '--sticky-header-offset',
        `${el.offsetHeight}px`
      );
    };
    updateOffset();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateOffset);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [filterOpen, activeMenu]);

  useEffect(() => {
    setDisplayMenuOpen(false);
  }, [activeMenu, viewMode]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDisplayMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const showFilterToolbar =
    activeMenu !== 'ABOUT' &&
    activeMenu !== 'EVENT_REGISTER' &&
    activeMenu !== 'SETTINGS';
  const showViewModeIcons =
    activeMenu === 'SPECIAL_PROMO' ||
    activeMenu === 'MAP' ||
    activeMenu === 'CALENDAR' ||
    activeMenu === 'LIST';

  const isCalendarDisplayActive =
    activeMenu === 'CALENDAR' ||
    (activeMenu === 'SPECIAL_PROMO' && viewMode === 'CALENDAR');
  const isListDisplayActive = activeMenu === 'LIST';
  const showDisplayOptionsBtn = isCalendarDisplayActive || isListDisplayActive;

  const safeScopeLevels = filters.scopeLevels || {
    3: true,
    2: true,
    1: true,
    0: true,
  };
  const safeStatusLevels = filters.statusLevels || {
    ONGOING: true,
    UPCOMING: true,
    ENDED: true,
  };
  const safePoolCourses = poolFilters?.courses || {
    '50m': true,
    '25m': true,
  };
  const safeSpecialPromoFormats =
    filters.specialPromoFormats || buildDefaultSpecialPromoFormats();
  const safeDetailKeyword = filters.detailKeyword ?? filters.keyword ?? '';
  const safeDetailTargets = filters.detailSearchTargets || {
    organizer: true,
    content: true,
    title: true,
    place: true,
  };
  const safeSelectedYear = filters.selectedYear || 'ALL';
  const safeSelectedMonthPeriod = filters.selectedMonthPeriod || 'ALL';

  const isScopeFiltered =
    !safeScopeLevels[3] ||
    !safeScopeLevels[2] ||
    !safeScopeLevels[1] ||
    !safeScopeLevels[0];

  const isStatusFiltered =
    !safeStatusLevels.ONGOING ||
    !safeStatusLevels.UPCOMING ||
    !safeStatusLevels.ENDED;

  const isSpecialPromoFormatFiltered =
    activeMenu === 'SPECIAL_PROMO' &&
    (SPECIAL_PROMO_EVENT_FORMATS[activeSport] || []).some(
      (fmt) => safeSpecialPromoFormats[fmt.code] === false
    );

  const isPoolViewActive =
    activeMenu === 'SPECIAL_PROMO' &&
    activeSport === 'SWIMMING' &&
    (viewMode === 'POOLS' || viewMode === 'POOLS_MAP');

  const hasActivePoolFilters = Boolean(
    poolFilters &&
      (poolFilters.regionName !== 'ALL' ||
        poolFilters.sigunguName !== 'ALL' ||
        !safePoolCourses['50m'] ||
        !safePoolCourses['25m'] ||
        Boolean(poolFilters.keyword.trim()))
  );

  const defaultYearStr = String(new Date().getFullYear());
  const hasActiveDetailFilters = isPoolViewActive
    ? hasActivePoolFilters
    : filters.regionId !== 'ALL' ||
      filters.sigunguCode !== 'ALL' ||
      (activeMenu === 'PROMO_DIRECTORY' && activeDbTab !== 'ALL') ||
      (safeSelectedYear !== defaultYearStr && safeSelectedYear !== 'ALL') ||
      safeSelectedMonthPeriod !== 'ALL' ||
      filters.majorCategory !== 'ALL' ||
      filters.subCategory !== 'ALL' ||
      isSpecialPromoFormatFiltered ||
      isStatusFiltered ||
      filters.source !== 'ALL' ||
      isScopeFiltered ||
      Boolean(safeDetailKeyword.trim());

  const availableSubCategories = Object.values(SUB_CATEGORIES).filter(
    (sub) =>
      filters.majorCategory === 'ALL' || sub.parentCode === filters.majorCategory
  );

  const pageTitle =
    activeMenu === 'SPECIAL_PROMO'
      ? `특별 홍보관 · ${SPORT_LABELS[activeSport] || '수영'}`
      : MENU_PAGE_TITLES[activeMenu];

  const minYear =
    availableYears.length > 0 ? availableYears[availableYears.length - 1] : 2005;
  const maxYear = availableYears.length > 0 ? availableYears[0] : 2026;

  const handleToggleSearchTarget = (targetKey: keyof DetailSearchTargets) => {
    const nextTargets: DetailSearchTargets = {
      ...safeDetailTargets,
      [targetKey]: !safeDetailTargets[targetKey],
    };
    if (
      !nextTargets.organizer &&
      !nextTargets.content &&
      !nextTargets.title &&
      !nextTargets.place
    ) {
      return;
    }
    onUpdateFilter('detailSearchTargets', nextTargets);
  };

  const handleToggleScope = (level: PromoLevel) => {
    const nextScope = {
      ...safeScopeLevels,
      [level]: !safeScopeLevels[level],
    };
    onUpdateFilter('scopeLevels', nextScope);
  };

  const handleToggleSpecialPromoFormat = (formatCode: string) => {
    const currentChecked = safeSpecialPromoFormats[formatCode] !== false;
    const nextFormats = {
      ...safeSpecialPromoFormats,
      [formatCode]: !currentChecked,
    };
    onUpdateFilter('specialPromoFormats', nextFormats);
  };

  const handleTogglePoolCourse = (courseKey: '50m' | '25m') => {
    if (!onUpdatePoolFilter) return;
    const nextCourses = {
      ...safePoolCourses,
      [courseKey]: !safePoolCourses[courseKey],
    };
    onUpdatePoolFilter('courses', nextCourses);
  };

  const handleToggleStatusLevel = (
    statusKey: 'ONGOING' | 'UPCOMING' | 'ENDED'
  ) => {
    const nextStatusLevels = {
      ...safeStatusLevels,
      [statusKey]: !safeStatusLevels[statusKey],
    };
    onUpdateFilter('statusLevels', nextStatusLevels);
  };

  return (
    <header ref={headerRef} className={styles.header}>
      {/* 상단 메뉴바: 좌측(메뉴·아이콘·제목) / 우측(목록보기·달력보기·지도보기 택1 아이콘 + 필터 아이콘 + 표시항목 아이콘) */}
      <div className={styles.topBar}>
        <div className={styles.leftSection}>
          <button
            type="button"
            className={styles.hamburgerBtn}
            onClick={onToggleSidebar}
            title="메뉴 열기"
            aria-label="메뉴 열기"
          >
            <Menu size={19} />
          </button>

          <div className={styles.koreaMapIconWrap} title={pageTitle}>
            {activeMenu === 'SPECIAL_PROMO' ? (
              <OlympicSportPictogram sport={activeSport} size={26} withBadge />
            ) : activeMenu === 'PROMO_DIRECTORY' ? (
              <Database size={22} color="#1d4ed8" />
            ) : activeMenu === 'EVENT_REGISTER' ? (
              <CalendarPlus size={22} color="#1d4ed8" />
            ) : activeMenu === 'SETTINGS' ? (
              <Settings size={22} color="#1d4ed8" />
            ) : (
              <KoreaGovEventIcon size={26} />
            )}
          </div>

          <h1 className={styles.pageTitle}>{pageTitle}</h1>
        </div>

        <div className={styles.toolbarSection}>
          {showFilterToolbar && (
            <>
              {/* 상단 메뉴바 보기 모드 아이콘 그룹 (목록보기 / 달력보기 / 지도보기 택1, 하이라이트) */}
            {showViewModeIcons && (
              <div
                className={styles.viewModeIconGroup}
                role="group"
                aria-label="보기 방식 선택 (목록보기, 달력보기, 지도보기)"
              >
                <button
                  type="button"
                  className={`${styles.iconOnlyBtn} ${
                    viewMode === 'LIST' ? styles.iconOnlyBtnActive : ''
                  }`}
                  onClick={() => onChangeViewMode('LIST')}
                  title="목록보기"
                  aria-label="목록보기"
                  aria-pressed={viewMode === 'LIST'}
                >
                  <List size={17} />
                </button>

                <button
                  type="button"
                  className={`${styles.iconOnlyBtn} ${
                    viewMode === 'CALENDAR' ? styles.iconOnlyBtnActive : ''
                  }`}
                  onClick={() => onChangeViewMode('CALENDAR')}
                  title="달력보기"
                  aria-label="달력보기"
                  aria-pressed={viewMode === 'CALENDAR'}
                >
                  <Calendar size={17} />
                </button>

                <button
                  type="button"
                  className={`${styles.iconOnlyBtn} ${
                    viewMode === 'MAP' ? styles.iconOnlyBtnActive : ''
                  }`}
                  onClick={() => onChangeViewMode('MAP')}
                  title="지도보기"
                  aria-label="지도보기"
                  aria-pressed={viewMode === 'MAP'}
                >
                  <MapIcon size={17} />
                </button>
              </div>
            )}

            {/* 특별 홍보관 > 수영 전용: 기존 수영 이벤트 보기 아이콘과 분리된 「수영장 보기(일람 · 지도)」 아이콘 그룹 및 「🔔 새소식」 독립 버튼 */}
            {activeMenu === 'SPECIAL_PROMO' && activeSport === 'SWIMMING' && (
              <>
                <div
                  className={`${styles.poolModeIconGroup} ${
                    isPoolViewActive ? styles.poolModeIconGroupActive : ''
                  }`}
                  role="group"
                  aria-label="수영장 보기 방식 선택 (수영장 일람 표, 수영장 위치 지도)"
                >
                  <span className={styles.poolGroupLabel}>수영장</span>
                  <button
                    type="button"
                    className={`${styles.iconOnlyBtn} ${
                      viewMode === 'POOLS' ? styles.iconOnlyBtnActive : ''
                    }`}
                    onClick={() => onChangeViewMode('POOLS')}
                    title="수영장 일람(표) 보기"
                    aria-label="수영장 일람 보기"
                    aria-pressed={viewMode === 'POOLS'}
                  >
                    <Waves size={17} />
                  </button>

                  <button
                    type="button"
                    className={`${styles.iconOnlyBtn} ${
                      viewMode === 'POOLS_MAP' ? styles.iconOnlyBtnActive : ''
                    }`}
                    onClick={() => onChangeViewMode('POOLS_MAP')}
                    title="수영장 지도에서 보기 (점 표시)"
                    aria-label="수영장 지도 보기"
                    aria-pressed={viewMode === 'POOLS_MAP'}
                  >
                    <MapIcon size={17} />
                  </button>
                </div>

                <button
                  type="button"
                  className={`${styles.swimNewsBtn} ${
                    viewMode === 'SWIM_NEWS' ? styles.swimNewsBtnActive : ''
                  }`}
                  onClick={() => onChangeViewMode('SWIM_NEWS')}
                  title="수영 대회 새소식 (지금 등록중 · 곧 등록 시작 · 새로 올라온 업데이트)"
                  aria-label="수영 대회 새소식"
                  aria-pressed={viewMode === 'SWIM_NEWS'}
                >
                  <Bell size={15} />
                  <span className={styles.swimNewsBtnLabel}>새소식</span>
                  {swimNewsBadgeCount > 0 && (
                    <span className={styles.swimNewsCountBadge}>
                      {swimNewsBadgeCount}
                    </span>
                  )}
                </button>
              </>
            )}

            {/* 필터 아이콘 버튼 */}
            <button
              type="button"
              className={`${styles.iconOnlyBtn} ${
                filterOpen || hasActiveDetailFilters ? styles.iconOnlyBtnActive : ''
              }`}
              onClick={() => setFilterOpen((prev) => !prev)}
              title="필터 펼치기/접기"
              aria-label="필터 펼치기/접기"
            >
              <SlidersHorizontal size={17} />
              {hasActiveDetailFilters && <span className={styles.filterBadgeDot} />}
            </button>

            {/* 달력 / 리스트 표시 방식 아이콘 버튼 */}
            {showDisplayOptionsBtn && (
              <div className={styles.iconBtnWrap} ref={dropdownRef}>
                <button
                  type="button"
                  className={`${styles.iconOnlyBtn} ${
                    displayMenuOpen ? styles.iconOnlyBtnActive : ''
                  }`}
                  onClick={() => setDisplayMenuOpen((prev) => !prev)}
                  title={
                    isCalendarDisplayActive
                      ? '달력 표시 항목 선택'
                      : '리스트 표시 열 선택'
                  }
                  aria-label="표시 항목 선택"
                >
                  <Columns size={17} />
                </button>

                {displayMenuOpen && (
                  <div className={styles.displayDropdown}>
                    <div className={styles.dropdownHeader}>
                      <span>
                        {isCalendarDisplayActive
                          ? '달력 표시 내용'
                          : '리스트 표시 열'}
                      </span>
                      <button
                        type="button"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: '#64748b',
                        }}
                        onClick={() => setDisplayMenuOpen(false)}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {isCalendarDisplayActive ? (
                      <>
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={calendarOptions.continuousYearView}
                            onChange={(e) =>
                              onChangeCalendarOptions({
                                ...calendarOptions,
                                continuousYearView: e.target.checked,
                              })
                            }
                          />
                          <span>월 구분 없이 1년치 이어보기</span>
                        </label>
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={calendarOptions.collapseEmptyWeeks}
                            onChange={(e) =>
                              onChangeCalendarOptions({
                                ...calendarOptions,
                                collapseEmptyWeeks: e.target.checked,
                              })
                            }
                          />
                          <span>행사 없는 주 묶어서 축약</span>
                        </label>
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={calendarOptions.showRegion}
                            onChange={(e) =>
                              onChangeCalendarOptions({
                                ...calendarOptions,
                                showRegion: e.target.checked,
                              })
                            }
                          />
                          <span>소재지</span>
                        </label>
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={calendarOptions.showCategoryBadge}
                            onChange={(e) =>
                              onChangeCalendarOptions({
                                ...calendarOptions,
                                showCategoryBadge: e.target.checked,
                              })
                            }
                          />
                          <span>행사분류 배지</span>
                        </label>
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={calendarOptions.showEventTime}
                            onChange={(e) =>
                              onChangeCalendarOptions({
                                ...calendarOptions,
                                showEventTime: e.target.checked,
                              })
                            }
                          />
                          <span>행사시각</span>
                        </label>
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={calendarOptions.showOrganizer}
                            onChange={(e) =>
                              onChangeCalendarOptions({
                                ...calendarOptions,
                                showOrganizer: e.target.checked,
                              })
                            }
                          />
                          <span>주최기관</span>
                        </label>
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={calendarOptions.showInvitation}
                            onChange={(e) =>
                              onChangeCalendarOptions({
                                ...calendarOptions,
                                showInvitation: e.target.checked,
                              })
                            }
                          />
                          <span>초댓말 요약</span>
                        </label>
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={calendarOptions.showStatusBadge}
                            onChange={(e) =>
                              onChangeCalendarOptions({
                                ...calendarOptions,
                                showStatusBadge: e.target.checked,
                              })
                            }
                          />
                          <span>진행상태 배지</span>
                        </label>
                      </>
                    ) : (
                      LIST_COLUMN_LABELS.map((col) => (
                        <label key={col.key} className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={listColumns[col.key]}
                            onChange={(e) =>
                              onChangeListColumns({
                                ...listColumns,
                                [col.key]: e.target.checked,
                              })
                            }
                          />
                          <span>{col.label}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            </>
          )}

          {/* 가장 오른쪽 배치: 현재 페이지 및 필터 파라미터 공유하기 버튼 */}
          <div className={styles.shareBtnWrap}>
            <button
              type="button"
              className={`${styles.iconOnlyBtn} ${
                shareCopied ? styles.shareBtnCopied : ''
              }`}
              onClick={handleShareCurrentUrl}
              title="현재 페이지 및 필터 파라미터 URL 복사(공유하기)"
              aria-label="현재 페이지 및 필터 파라미터 공유하기"
            >
              {shareCopied ? <Check size={17} /> : <Share2 size={17} />}
            </button>
            {shareCopied && (
              <span className={styles.shareCopiedToast} role="status">
                공유 링크 복사됨!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 필터 펼치기/접기 애니메이션 드로어 */}
      {showFilterToolbar && (
        <div
          className={`${styles.filterAnimWrapper} ${
            filterOpen ? styles.filterAnimWrapperOpen : ''
          }`}
        >
          <div className={styles.filterAnimInner}>
            <div className={styles.filterContent}>
              {isPoolViewActive && poolFilters && onUpdatePoolFilter ? (
                <>
                  {/* 수영장 보기(일람 · 지도) 전용 필터 1: 소재지 (시·도 / 시·군·구) */}
                  <div className={styles.topicRow}>
                    <span className={styles.topicLabel}>소재지</span>
                    <div className={styles.topicRight}>
                      <div className={styles.primaryControlsLine}>
                        <label className={styles.inlineSelectGroup}>
                          <span className={styles.inlineControlLabel}>시·도</span>
                          <select
                            className={styles.detailSelect}
                            value={poolFilters.regionName}
                            aria-label="수영장 시도 선택"
                            onChange={(e) => {
                              onUpdatePoolFilter('regionName', e.target.value);
                              onUpdatePoolFilter('sigunguName', 'ALL');
                            }}
                          >
                            <option value="ALL">전국 (전체 시·도)</option>
                            {poolRegionOptions.map((reg) => (
                              <option key={reg} value={reg}>
                                {reg}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.inlineSelectGroup}>
                          <span className={styles.inlineControlLabel}>시·군·구</span>
                          <select
                            className={styles.detailSelect}
                            value={poolFilters.sigunguName}
                            disabled={poolFilters.regionName === 'ALL'}
                            aria-label="수영장 시군구 선택"
                            onChange={(e) =>
                              onUpdatePoolFilter('sigunguName', e.target.value)
                            }
                          >
                            <option value="ALL">
                              {poolFilters.regionName === 'ALL'
                                ? '전체 (시·도 먼저 선택)'
                                : `전체 (${poolSigunguOptions.length}개 시·군·구)`}
                            </option>
                            {poolSigunguOptions.map((sg) => (
                              <option key={sg} value={sg}>
                                {sg}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 수영장 보기(일람 · 지도) 전용 필터 2: 50m 여부 (복수 선택 가능) */}
                  <div className={styles.topicRow}>
                    <span className={styles.topicLabel}>50m 여부</span>
                    <div className={styles.topicRight}>
                      <div className={styles.primaryControlsLine}>
                        {(
                          [
                            { value: '50m', label: '50m (장수로 정규풀)' },
                            { value: '25m', label: '25m (단수로풀)' },
                          ] as const
                        ).map((opt) => {
                          const isChecked = safePoolCourses[opt.value];
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="checkbox"
                              aria-checked={isChecked}
                              className={`${styles.scopeToggleBtn} ${
                                isChecked ? styles.scopeToggleBtnChecked : ''
                              }`}
                              onClick={() => handleTogglePoolCourse(opt.value)}
                            >
                              <span className={styles.scopeCheckIndicator}>
                                {isChecked && <Check size={12} strokeWidth={3} />}
                              </span>
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 수영장 보기(일람 · 지도) 전용 필터 3: 검색 (대회명, 수영장 이름 등) */}
                  <div className={styles.topicRow}>
                    <span className={styles.topicLabel}>검색</span>
                    <div className={styles.topicRight}>
                      <div className={styles.primaryControlsLine}>
                        <div className={styles.detailSearchInputWrap}>
                          <Search size={14} className={styles.searchIcon} />
                          <input
                            type="text"
                            className={styles.detailSearchInput}
                            value={poolFilters.keyword}
                            onChange={(e) =>
                              onUpdatePoolFilter('keyword', e.target.value)
                            }
                            placeholder="대회명, 수영장 이름, 소재지(주소), 비고(공인급수 등) 검색..."
                          />
                          {poolFilters.keyword && (
                            <button
                              type="button"
                              className={styles.clearBtn}
                              onClick={() => onUpdatePoolFilter('keyword', '')}
                              title="검색어 지우기"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* DB 화면에서 종목별 필터링 지원 */}
                  {activeMenu === 'PROMO_DIRECTORY' && (
                <div className={styles.topicRow}>
                  <span className={styles.topicLabel}>종목</span>
                  <div className={styles.topicRight}>
                    <div className={styles.primaryControlsLine}>
                      {DB_CRAWL_TABS.map((tab) => {
                        const isSelected = activeDbTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            className={`${styles.scopeToggleBtn} ${
                              isSelected ? styles.scopeToggleBtnChecked : ''
                            }`}
                            onClick={() => onChangeDbTab(tab.id)}
                          >
                            {tab.sport && (
                              <OlympicSportPictogram sport={tab.sport} size={14} />
                            )}
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 1. 지역: 시·도 선택 + 시·군·구 선택 (상단 메뉴바에서 필터 하부 항목으로 이전) */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>지역</span>
                <div className={styles.topicRight}>
                  <div className={styles.primaryControlsLine}>
                    <label className={styles.inlineSelectGroup}>
                      <span className={styles.inlineControlLabel}>시·도</span>
                      <select
                        className={styles.detailSelect}
                        value={filters.regionId}
                        aria-label="시도 선택"
                        onChange={(e) => {
                          onUpdateFilter('regionId', e.target.value);
                          onUpdateFilter('sigunguCode', 'ALL');
                        }}
                      >
                        <option value="ALL">전국 (전체 시·도)</option>
                        {ADMIN_REGIONS.map((reg) => (
                          <option key={reg.id} value={reg.id}>
                            {reg.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.inlineSelectGroup}>
                      <span className={styles.inlineControlLabel}>시·군·구</span>
                      <select
                        className={styles.detailSelect}
                        value={filters.sigunguCode}
                        disabled={
                          filters.regionId === 'ALL' || sigunguOptions.length === 0
                        }
                        aria-label="시군구 선택"
                        onChange={(e) =>
                          onUpdateFilter('sigunguCode', e.target.value)
                        }
                      >
                        <option value="ALL">전체 시·군·구</option>
                        {sigunguOptions.map((sg) => (
                          <option key={sg.code} value={sg.code}>
                            {sg.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              {/* 2. 날짜 선택: 연도 선택(DB 최초~최후, 기본=전체) + 월 선택(전체, 상반기, 하반기, 1~4분기, 1~12월) */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>날짜 선택</span>
                <div className={styles.topicRight}>
                  <div className={styles.primaryControlsLine}>
                    <label className={styles.inlineSelectGroup}>
                      <span className={styles.inlineControlLabel}>연도</span>
                      <select
                        className={styles.detailSelect}
                        value={safeSelectedYear}
                        aria-label="연도 선택"
                        onChange={(e) =>
                          onUpdateFilter('selectedYear', e.target.value)
                        }
                      >
                        <option value="ALL">
                          전체 연도 ({minYear}~{maxYear})
                        </option>
                        {availableYears.map((yr) => (
                          <option key={yr} value={String(yr)}>
                            {yr}년
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.inlineSelectGroup}>
                      <span className={styles.inlineControlLabel}>월/기간</span>
                      <select
                        className={styles.detailSelect}
                        value={safeSelectedMonthPeriod}
                        aria-label="월 선택"
                        onChange={(e) =>
                          onUpdateFilter(
                            'selectedMonthPeriod',
                            e.target.value as MonthPeriodFilter
                          )
                        }
                      >
                        {MONTH_PERIOD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              {/* 3. 범위: "세계/대한연맹", "광역시도", "시군구", "동네" on/off 구분 (선택되었을 때만 하이라이트, lv 표기 없음, 각 범위별 이벤트 수 배지 표시) */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>범위</span>
                <div className={styles.topicRight}>
                  <div className={styles.primaryControlsLine}>
                    {ACTIVE_PROMO_LEVELS.map((level) => {
                      const isChecked = Boolean(safeScopeLevels[level]);
                      const scopeLabel =
                        activeMenu === 'PROMO_DIRECTORY'
                          ? DB_SCOPE_LABELS[level]
                          : PROMO_LEVEL_SHORT_LABELS[level];
                      const count = scopeEventCounts[level] ?? 0;
                      return (
                        <button
                          key={level}
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          className={`${styles.scopeToggleBtn} ${
                            isChecked ? styles.scopeToggleBtnChecked : ''
                          }`}
                          onClick={() => handleToggleScope(level)}
                        >
                          <span className={styles.scopeCheckIndicator}>
                            {isChecked && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span>{scopeLabel}</span>
                          <span className={styles.toggleCountBadge}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4. 행사 형태 (특별홍보관: 종목별 행사 형태 복수선택 토글 + 건수 배지 / 일반: 대분류·소분류) */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>행사 형태</span>
                <div className={styles.topicRight}>
                  {activeMenu === 'SPECIAL_PROMO' ? (
                    <div className={styles.primaryControlsLine}>
                      {(SPECIAL_PROMO_EVENT_FORMATS[activeSport] || []).map((fmt) => {
                        const isChecked = safeSpecialPromoFormats[fmt.code] !== false;
                        const count = specialPromoFormatCounts[fmt.code] ?? 0;
                        return (
                          <button
                            key={fmt.code}
                            type="button"
                            role="checkbox"
                            aria-checked={isChecked}
                            className={`${styles.scopeToggleBtn} ${
                              isChecked ? styles.scopeToggleBtnChecked : ''
                            }`}
                            onClick={() => handleToggleSpecialPromoFormat(fmt.code)}
                            title={fmt.label}
                          >
                            <span className={styles.scopeCheckIndicator}>
                              {isChecked && <Check size={12} strokeWidth={3} />}
                            </span>
                            <span>{fmt.shortLabel}</span>
                            <span className={styles.toggleCountBadge}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.primaryControlsLine}>
                      <select
                        className={styles.detailSelect}
                        value={filters.majorCategory}
                        aria-label="행사 대분류"
                        onChange={(e) => {
                          onUpdateFilter('majorCategory', e.target.value as any);
                          onUpdateFilter('subCategory', 'ALL');
                        }}
                      >
                        {MAJOR_CATEGORIES.map((cat) => (
                          <option key={cat.code} value={cat.code}>
                            {cat.name}
                          </option>
                        ))}
                      </select>

                      <select
                        className={styles.detailSelect}
                        value={filters.subCategory}
                        aria-label="행사 세부 성격"
                        onChange={(e) => onUpdateFilter('subCategory', e.target.value)}
                      >
                        <option value="ALL">전체 세부 성격</option>
                        {availableSubCategories.map((sub) => (
                          <option key={sub.code} value={sub.code}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. 행사 상태 (진행중 / 예정 / 종료 복수 선택 토글) */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>행사 상태</span>
                <div className={styles.topicRight}>
                  <div className={styles.primaryControlsLine}>
                    {(
                      [
                        { id: 'ONGOING', label: '진행중' },
                        { id: 'UPCOMING', label: '예정' },
                        { id: 'ENDED', label: '종료' },
                      ] as const
                    ).map((st) => {
                      const isChecked = safeStatusLevels[st.id];
                      return (
                        <button
                          key={st.id}
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          className={`${styles.scopeToggleBtn} ${
                            isChecked ? styles.scopeToggleBtnChecked : ''
                          }`}
                          onClick={() => handleToggleStatusLevel(st.id)}
                        >
                          <span className={styles.scopeCheckIndicator}>
                            {isChecked && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 6. 세부 검색 (상단 메뉴 검색을 통합 + 주최기관/초댓말/행사명/장소 검색위치 Checkbox 선택) */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>세부 검색</span>
                <div className={styles.topicRight}>
                  <div className={styles.primaryControlsLine}>
                    <div className={styles.detailInputWrap}>
                      <Search size={14} className={styles.detailSearchIcon} />
                      <input
                        type="text"
                        className={styles.detailInput}
                        placeholder="검색어 입력 (주최기관, 초댓말/내용, 행사명, 장소/주소 통합 검색...)"
                        value={safeDetailKeyword}
                        onChange={(e) => {
                          onUpdateFilter('detailKeyword', e.target.value);
                          onUpdateFilter('keyword', e.target.value);
                        }}
                      />
                      {safeDetailKeyword && (
                        <button
                          type="button"
                          className={styles.clearDetailSearchBtn}
                          onClick={() => {
                            onUpdateFilter('detailKeyword', '');
                            onUpdateFilter('keyword', '');
                          }}
                          title="검색어 지우기"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <div className={styles.searchTargetCheckGroup}>
                      <span className={styles.searchTargetGroupLabel}>검색위치:</span>
                      <label className={styles.targetCheckItem}>
                        <input
                          type="checkbox"
                          checked={safeDetailTargets.organizer}
                          onChange={() => handleToggleSearchTarget('organizer')}
                        />
                        <span>주최기관</span>
                      </label>
                      <label className={styles.targetCheckItem}>
                        <input
                          type="checkbox"
                          checked={safeDetailTargets.content}
                          onChange={() => handleToggleSearchTarget('content')}
                        />
                        <span>초댓말/내용</span>
                      </label>
                      <label className={styles.targetCheckItem}>
                        <input
                          type="checkbox"
                          checked={safeDetailTargets.title}
                          onChange={() => handleToggleSearchTarget('title')}
                        />
                        <span>행사명</span>
                      </label>
                      <label className={styles.targetCheckItem}>
                        <input
                          type="checkbox"
                          checked={safeDetailTargets.place}
                          onChange={() => handleToggleSearchTarget('place')}
                        />
                        <span>장소/주소</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
                </>
              )}

              {/* 7. 필터 최하단: 축약보기 ON/OFF 토글 + 세팅 바로 이동 */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>축약보기</span>
                <div className={styles.topicRight}>
                  <div className={styles.primaryControlsLine}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={abbreviationEnabled}
                      className={`${styles.scopeToggleBtn} ${
                        abbreviationEnabled ? styles.scopeToggleBtnChecked : ''
                      }`}
                      onClick={onToggleAbbreviation}
                      title="행사 제목 및 기관명 축약보기 켜기/끄기"
                    >
                      <span className={styles.scopeCheckIndicator}>
                        {abbreviationEnabled && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span>
                        {abbreviationEnabled ? '축약보기 켜짐' : '축약보기 꺼짐'}
                      </span>
                      <span className={styles.toggleCountBadge}>
                        {activeAbbreviationRuleCount}개 규칙
                      </span>
                    </button>

                    <button
                      type="button"
                      className={styles.openSettingsLinkBtn}
                      onClick={() => {
                        setFilterOpen(false);
                        onOpenSettings();
                      }}
                    >
                      <Settings size={13} />
                      <span>세팅에서 확인·변경·추가</span>
                    </button>

                    {isCalendarDisplayActive && (
                      <>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={calendarOptions.continuousYearView}
                          className={`${styles.scopeToggleBtn} ${
                            calendarOptions.continuousYearView
                              ? styles.scopeToggleBtnChecked
                              : ''
                          }`}
                          onClick={() =>
                            onChangeCalendarOptions({
                              ...calendarOptions,
                              continuousYearView: !calendarOptions.continuousYearView,
                            })
                          }
                        >
                          <span className={styles.scopeCheckIndicator}>
                            {calendarOptions.continuousYearView && (
                              <Check size={12} strokeWidth={3} />
                            )}
                          </span>
                          <span>월 구분 없이 1년치 이어보기</span>
                        </button>

                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={calendarOptions.collapseEmptyWeeks}
                          className={`${styles.scopeToggleBtn} ${
                            calendarOptions.collapseEmptyWeeks
                              ? styles.scopeToggleBtnChecked
                              : ''
                          }`}
                          onClick={() =>
                            onChangeCalendarOptions({
                              ...calendarOptions,
                              collapseEmptyWeeks: !calendarOptions.collapseEmptyWeeks,
                            })
                          }
                        >
                          <span className={styles.scopeCheckIndicator}>
                            {calendarOptions.collapseEmptyWeeks && (
                              <Check size={12} strokeWidth={3} />
                            )}
                          </span>
                          <span>행사 없는 주 묶어서 축약</span>
                        </button>
                      </>
                    )}

                    <span className={styles.abbrPreviewHint}>
                      예: 2026년 → 2026 · 제25회 → 25&apos; · 창원특례시장배 → 창원시장배
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
