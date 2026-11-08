import React, { useEffect, useState } from 'react';
import {
  Award,
  Calendar,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  Database,
  Info,
  List,
  Map,
  X,
} from 'lucide-react';
import { MainMenuView, SpecialPromoSport } from '../types/event';
import {
  KoreaGovEventIcon,
  OlympicSportPictogram,
} from './BrandAndSportIcons';
import styles from './SidebarDrawer.module.css';

interface SidebarDrawerProps {
  open: boolean;
  activeMenu: MainMenuView;
  activeSport: SpecialPromoSport;
  onSelectMenu: (menu: MainMenuView) => void;
  onSelectSport: (sport: SpecialPromoSport) => void;
  onClose: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  open,
  activeMenu,
  activeSport,
  onSelectMenu,
  onSelectSport,
  onClose,
}) => {
  const [specialPromoExpanded, setSpecialPromoExpanded] = useState<boolean>(true);

  useEffect(() => {
    if (activeMenu === 'SPECIAL_PROMO') {
      setSpecialPromoExpanded(true);
    }
  }, [activeMenu]);

  if (!open) return null;

  const handlePick = (menu: MainMenuView) => {
    onSelectMenu(menu);
    onClose();
  };

  const handlePickSport = (sport: SpecialPromoSport) => {
    onSelectSport(sport);
    onSelectMenu('SPECIAL_PROMO');
    onClose();
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.drawer} aria-label="메인 메뉴 사이드바">
        <div className={styles.topBlock}>
          <div className={styles.drawerHeader}>
            <span
              className={styles.drawerTitle}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <KoreaGovEventIcon size={24} />
              <span>대한민국 행사</span>
            </span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="사이드바 닫기"
            >
              <X size={16} />
            </button>
          </div>

          <nav className={styles.navList}>
            <button
              type="button"
              className={`${styles.navItem} ${
                activeMenu === 'MAP' ? styles.navItemActive : ''
              }`}
              onClick={() => handlePick('MAP')}
            >
              <Map size={18} />
              <span>지도로 보기</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${
                activeMenu === 'CALENDAR' ? styles.navItemActive : ''
              }`}
              onClick={() => handlePick('CALENDAR')}
            >
              <Calendar size={18} />
              <span>달력으로 보기</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${
                activeMenu === 'LIST' ? styles.navItemActive : ''
              }`}
              onClick={() => handlePick('LIST')}
            >
              <List size={18} />
              <span>행사 리스트</span>
            </button>

            {/* 특별 홍보관: 자체 페이지 없이 하위 항목('수영', '러닝', '자전거', '철인')을 펼치는 상위 그룹 */}
            <div className={styles.navGroup}>
              <button
                type="button"
                className={`${styles.navItem} ${styles.navGroupHeader} ${
                  activeMenu === 'SPECIAL_PROMO' ? styles.navGroupHeaderActive : ''
                }`}
                onClick={() => setSpecialPromoExpanded((prev) => !prev)}
                aria-expanded={specialPromoExpanded}
              >
                <span className={styles.navGroupLabel}>
                  <Award size={18} />
                  <span>특별 홍보관</span>
                </span>
                {specialPromoExpanded ? (
                  <ChevronDown size={15} />
                ) : (
                  <ChevronRight size={15} />
                )}
              </button>

              {specialPromoExpanded && (
                <div className={styles.subNavList}>
                  <button
                    type="button"
                    className={`${styles.subNavItem} ${
                      activeMenu === 'SPECIAL_PROMO' && activeSport === 'SWIMMING'
                        ? styles.subNavItemActive
                        : ''
                    }`}
                    onClick={() => handlePickSport('SWIMMING')}
                  >
                    <OlympicSportPictogram sport="SWIMMING" size={18} />
                    <span>수영</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.subNavItem} ${
                      activeMenu === 'SPECIAL_PROMO' && activeSport === 'RUNNING'
                        ? styles.subNavItemActive
                        : ''
                    }`}
                    onClick={() => handlePickSport('RUNNING')}
                  >
                    <OlympicSportPictogram sport="RUNNING" size={18} />
                    <span>러닝</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.subNavItem} ${
                      activeMenu === 'SPECIAL_PROMO' && activeSport === 'CYCLING'
                        ? styles.subNavItemActive
                        : ''
                    }`}
                    onClick={() => handlePickSport('CYCLING')}
                  >
                    <OlympicSportPictogram sport="CYCLING" size={18} />
                    <span>자전거</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.subNavItem} ${
                      activeMenu === 'SPECIAL_PROMO' && activeSport === 'TRIATHLON'
                        ? styles.subNavItemActive
                        : ''
                    }`}
                    onClick={() => handlePickSport('TRIATHLON')}
                  >
                    <OlympicSportPictogram sport="TRIATHLON" size={18} />
                    <span>철인</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* 사이드바 하단: 행사 등록 -> DB -> 사이트 소개 */}
        <div className={styles.bottomBlock}>
          <button
            type="button"
            className={`${styles.navItem} ${
              activeMenu === 'EVENT_REGISTER' ? styles.navItemActive : ''
            }`}
            onClick={() => handlePick('EVENT_REGISTER')}
          >
            <CalendarPlus size={18} />
            <span>행사 등록</span>
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${
              activeMenu === 'PROMO_DIRECTORY' ? styles.navItemActive : ''
            }`}
            onClick={() => handlePick('PROMO_DIRECTORY')}
          >
            <Database size={18} />
            <span>DB</span>
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${
              activeMenu === 'ABOUT' ? styles.navItemActive : ''
            }`}
            onClick={() => handlePick('ABOUT')}
          >
            <Info size={18} />
            <span>사이트 소개</span>
          </button>
        </div>
      </aside>
    </>
  );
};
