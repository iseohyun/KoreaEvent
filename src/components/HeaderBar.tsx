import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  Columns,
  List,
  Map as MapIcon,
  Menu,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { ADMIN_REGIONS } from '../constants/regions';
import { MAJOR_CATEGORIES, SUB_CATEGORIES } from '../constants/categories';
import {
  ACTIVE_PROMO_LEVELS,
  PROMO_LEVEL_SHORT_LABELS,
  SPORT_LABELS,
} from '../shared/promoPolicy';
import {
  CalendarDisplayOptions,
  DetailSearchTargets,
  EventFilterState,
  ListColumnKey,
  ListColumnVisibility,
  MainMenuView,
  MonthPeriodFilter,
  PromoLevel,
  SpecialPromoSport,
  ViewMode,
} from '../types/event';
import styles from './HeaderBar.module.css';

interface HeaderBarProps {
  activeMenu: MainMenuView;
  activeSport: SpecialPromoSport;
  viewMode: ViewMode;
  filters: EventFilterState;
  availableYears: number[];
  sigunguOptions: Array<{ code: string; name: string }>;
  calendarOptions: CalendarDisplayOptions;
  listColumns: ListColumnVisibility;
  onToggleSidebar: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onUpdateFilter: <K extends keyof EventFilterState>(
    key: K,
    value: EventFilterState[K]
  ) => void;
  onResetFilters: () => void;
  onChangeCalendarOptions: (next: CalendarDisplayOptions) => void;
  onChangeListColumns: (next: ListColumnVisibility) => void;
}

const MENU_PAGE_TITLES: Record<MainMenuView, string> = {
  MAP: '지도로 보기',
  CALENDAR: '달력으로 보기',
  LIST: '행사 리스트',
  PROMO_DIRECTORY: '지자체 사이트',
  SPECIAL_PROMO: '특별 홍보관',
  ABOUT: '사이트 소개',
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

/**
 * 남한국토지도 실루엣 아이콘
 */
const SouthKoreaTerritoryIcon: React.FC = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect width="64" height="64" rx="14" fill="#2563eb" />
    <path
      d="M27 8 L36 7 L43 13 L46 21 L49 30 L48 39 L44 45 L37 47 L31 50 L23 52 L17 49 L16 41 L18 33 L15 25 L19 18 L21 12 Z"
      fill="#ffffff"
      stroke="#93c5fd"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <ellipse cx="22" cy="58" rx="5.2" ry="2.4" fill="#ffffff" />
    <circle cx="55" cy="24" r="2.1" fill="#ffffff" />
  </svg>
);

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeMenu,
  activeSport,
  viewMode,
  filters,
  availableYears,
  sigunguOptions,
  calendarOptions,
  listColumns,
  onToggleSidebar,
  onChangeViewMode,
  onUpdateFilter,
  onResetFilters,
  onChangeCalendarOptions,
  onChangeListColumns,
}) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  const showFilterToolbar = activeMenu !== 'ABOUT';
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

  const hasActiveDetailFilters =
    filters.regionId !== 'ALL' ||
    filters.sigunguCode !== 'ALL' ||
    safeSelectedYear !== 'ALL' ||
    safeSelectedMonthPeriod !== 'ALL' ||
    filters.majorCategory !== 'ALL' ||
    filters.subCategory !== 'ALL' ||
    filters.status !== 'ALL' ||
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

  return (
    <header className={styles.header}>
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

          <div className={styles.koreaMapIconWrap} title="대한민국 행사">
            <SouthKoreaTerritoryIcon />
          </div>

          <h1 className={styles.pageTitle}>{pageTitle}</h1>
        </div>

        {showFilterToolbar && (
          <div className={styles.toolbarSection}>
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
                            checked={calendarOptions.showRegion}
                            onChange={(e) =>
                              onChangeCalendarOptions({
                                ...calendarOptions,
                                showRegion: e.target.checked,
                              })
                            }
                          />
                          <span>행정구역명</span>
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
          </div>
        )}
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

              {/* 3. 범위: "세계/대한연맹", "광역시도", "시군구", "동네" on/off 구분 (선택되었을 때만 하이라이트, lv 표기 없음) */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>범위</span>
                <div className={styles.topicRight}>
                  <div className={styles.primaryControlsLine}>
                    {ACTIVE_PROMO_LEVELS.map((level) => {
                      const isChecked = Boolean(safeScopeLevels[level]);
                      const scopeLabel = PROMO_LEVEL_SHORT_LABELS[level];
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
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4. 행사 형태 (대분류 · 소분류) */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>행사 형태</span>
                <div className={styles.topicRight}>
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
                </div>
              </div>

              {/* 5. 행사 상태 (행사 형태와 분리된 독립 행) */}
              <div className={styles.topicRow}>
                <span className={styles.topicLabel}>행사 상태</span>
                <div className={styles.topicRight}>
                  <div className={styles.primaryControlsLine}>
                    <select
                      className={styles.detailSelect}
                      value={filters.status}
                      aria-label="행사 상태 선택"
                      onChange={(e) => onUpdateFilter('status', e.target.value as any)}
                    >
                      <option value="ALL">전체 상태</option>
                      <option value="ONGOING">진행중</option>
                      <option value="UPCOMING">개최예정</option>
                      <option value="ENDED">종료</option>
                    </select>

                    <div className={styles.subControlsLine}>
                      {(
                        [
                          { id: 'ALL', label: '전체 상태' },
                          { id: 'ONGOING', label: '진행중' },
                          { id: 'UPCOMING', label: '개최예정' },
                          { id: 'ENDED', label: '종료' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          className={`${styles.quickBtn} ${
                            filters.status === st.id ? styles.quickBtnActive : ''
                          }`}
                          onClick={() => onUpdateFilter('status', st.id)}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
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

                    <button
                      type="button"
                      className={styles.resetFilterBtn}
                      onClick={onResetFilters}
                    >
                      <RotateCcw size={12} />
                      <span>초기화</span>
                    </button>
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
