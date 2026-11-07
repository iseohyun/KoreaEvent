import React, { useMemo } from 'react';
import { Building2, Calendar, Globe, Search, SlidersHorizontal } from 'lucide-react';
import { MAJOR_CATEGORIES, SUB_CATEGORIES } from '../constants/categories';
import { EventFilterState, MajorCategoryCode } from '../types/event';
import styles from './FilterPanel.module.css';

interface FilterPanelProps {
  filters: EventFilterState;
  counts: {
    all: number;
    portal: number;
    municipal: number;
  };
  onUpdateFilter: <K extends keyof EventFilterState>(key: K, value: EventFilterState[K]) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  counts,
  onUpdateFilter,
}) => {
  const availableSubCategories = useMemo(() => {
    const allSubs = Object.values(SUB_CATEGORIES);
    if (filters.majorCategory === 'ALL') {
      return [];
    }
    return allSubs.filter((sub) => sub.parentCode === filters.majorCategory);
  }, [filters.majorCategory]);

  const handleMajorCategoryClick = (code: MajorCategoryCode) => {
    onUpdateFilter('majorCategory', code);
    onUpdateFilter('subCategory', 'ALL');
  };

  return (
    <section className={styles.panel}>
      {/* 1. 데이터 출처 탭 & 키워드 검색 */}
      <div className={styles.row}>
        <div className={styles.sourceTabs}>
          <button
            type="button"
            className={`${styles.sourceBtn} ${
              filters.source === 'ALL' ? styles.sourceBtnActiveAll : ''
            }`}
            onClick={() => onUpdateFilter('source', 'ALL')}
          >
            <SlidersHorizontal size={15} />
            <span>전체 통합 행사</span>
            <span className={styles.countChip}>{counts.all}</span>
          </button>

          <button
            type="button"
            className={`${styles.sourceBtn} ${
              filters.source === 'PUBLIC_PORTAL' ? styles.sourceBtnActivePortal : ''
            }`}
            onClick={() => onUpdateFilter('source', 'PUBLIC_PORTAL')}
          >
            <Globe size={15} />
            <span>공공데이터포털 (KorService2)</span>
            <span className={styles.countChip}>{counts.portal}</span>
          </button>

          <button
            type="button"
            className={`${styles.sourceBtn} ${
              filters.source === 'MUNICIPAL_WEB' ? styles.sourceBtnActiveLocal : ''
            }`}
            onClick={() => onUpdateFilter('source', 'MUNICIPAL_WEB')}
          >
            <Building2 size={15} />
            <span>지자체 행정 홈페이지</span>
            <span className={styles.countChip}>{counts.municipal}</span>
          </button>
        </div>

        <div className={styles.searchGroup}>
          <div className={styles.searchInputWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="행사명, 시·군·구, 장소 키워드 검색..."
              value={filters.keyword}
              onChange={(e) => onUpdateFilter('keyword', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2. KorService2 신분류체계(lclsSystm2 / lclsSystm3) + 행정행사 분류 */}
      <div className={styles.categorySection}>
        <div className={styles.categoryRow}>
          <span className={styles.sectionLabel}>분류체계 (중분류)</span>
          {MAJOR_CATEGORIES.map((cat) => (
            <button
              key={cat.code}
              type="button"
              className={`${styles.catBtn} ${
                filters.majorCategory === cat.code ? styles.catBtnActive : ''
              }`}
              onClick={() => handleMajorCategoryClick(cat.code)}
              title={cat.description}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {availableSubCategories.length > 0 && (
          <div className={styles.categoryRow}>
            <span className={styles.sectionLabel}>세부분류 (소분류)</span>
            <button
              type="button"
              className={`${styles.subCatBtn} ${
                filters.subCategory === 'ALL' ? styles.subCatBtnActive : ''
              }`}
              onClick={() => onUpdateFilter('subCategory', 'ALL')}
            >
              전체 소분류
            </button>
            {availableSubCategories.map((sub) => (
              <button
                key={sub.code}
                type="button"
                className={`${styles.subCatBtn} ${
                  filters.subCategory === sub.code ? styles.subCatBtnActive : ''
                }`}
                onClick={() => onUpdateFilter('subCategory', sub.code)}
              >
                {sub.name} ({sub.code})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. 조회 기간 / 진행 상태 / 정렬 */}
      <div className={styles.metaFilterRow}>
        <div className={styles.dateAndStatus}>
          <div className={styles.fieldGroup}>
            <Calendar size={14} />
            <span>행사 시작일 기준</span>
            <input
              type="date"
              className={styles.dateInput}
              value={filters.startDate}
              onChange={(e) => onUpdateFilter('startDate', e.target.value)}
            />
            <span>~</span>
            <input
              type="date"
              className={styles.dateInput}
              value={filters.endDate}
              onChange={(e) => onUpdateFilter('endDate', e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <span>진행 상태</span>
            <select
              className={styles.selectInput}
              value={filters.status}
              onChange={(e) => onUpdateFilter('status', e.target.value as EventFilterState['status'])}
            >
              <option value="ALL">전체 상태</option>
              <option value="ONGOING">진행중</option>
              <option value="UPCOMING">개최 예정</option>
              <option value="ENDED">종료됨</option>
            </select>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span>API 정렬 (arrange)</span>
          <select
            className={styles.selectInput}
            value={filters.arrange}
            onChange={(e) =>
              onUpdateFilter('arrange', e.target.value as EventFilterState['arrange'])
            }
          >
            <option value="C">최신 수정일순 (C)</option>
            <option value="A">제목 가나다순 (A)</option>
            <option value="D">최초 등록일순 (D)</option>
            <option value="Q">대표이미지 보유 + 최신순 (Q)</option>
            <option value="O">대표이미지 보유 + 제목순 (O)</option>
          </select>
        </div>
      </div>
    </section>
  );
};
