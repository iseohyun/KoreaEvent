import React from 'react';
import { BookOpen, Database, MapPinned, PlusCircle, RefreshCw } from 'lucide-react';
import { APP_VERSION_DISPLAY } from '../version';
import { ResponseFormatMode } from '../types/event';
import styles from './HeaderBar.module.css';

interface HeaderBarProps {
  formatMode: ResponseFormatMode;
  detectedFormat: 'JSON' | 'XML';
  loading: boolean;
  totalPortalCount: number;
  totalMunicipalCount: number;
  onFormatModeChange: (mode: ResponseFormatMode) => void;
  onRefresh: () => void;
  onOpenMunicipalModal: () => void;
  onOpenRegistryModal: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  formatMode,
  detectedFormat,
  loading,
  totalPortalCount,
  totalMunicipalCount,
  onFormatModeChange,
  onRefresh,
  onOpenMunicipalModal,
  onOpenRegistryModal,
}) => {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brandGroup}>
          <div className={styles.logoBox}>
            <MapPinned size={22} />
          </div>
          <div className={styles.titleWrap}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>대한민국 행정지도 기반 통합 행사·축제 플랫폼</h1>
              <span className={styles.versionBadge} title="SemVer 및 일자 기반 캐시버스팅 태그">
                {APP_VERSION_DISPLAY}
              </span>
            </div>
            <p className={styles.subtitle}>
              공공데이터포털(KorService2) + 전국 1·2단계 267개 지자체 홍보DB 주최기관 매칭·요약 시스템
            </p>
          </div>
        </div>

        <div className={styles.controls}>
          <div
            className={styles.apiStatusPill}
            title="End Point: https://apis.data.go.kr/B551011/KorService2"
          >
            <span className={styles.statusDot} />
            <Database size={14} />
            <span>
              포털 {totalPortalCount}건 · 지자체 {totalMunicipalCount}건 ({detectedFormat} 파싱됨)
            </span>
          </div>

          <div
            className={styles.formatToggle}
            title="KorService2 요청 및 응답 파서 포맷 선택 (JSON + XML 모두 지원)"
          >
            <span className={styles.formatLabel}>데이터포맷</span>
            <button
              type="button"
              className={`${styles.formatBtn} ${
                formatMode === 'JSON' ? styles.formatBtnActive : ''
              }`}
              onClick={() => onFormatModeChange('JSON')}
            >
              JSON
            </button>
            <button
              type="button"
              className={`${styles.formatBtn} ${
                formatMode === 'XML' ? styles.formatBtnActive : ''
              }`}
              onClick={() => onFormatModeChange('XML')}
            >
              XML
            </button>
          </div>

          <button
            type="button"
            className={styles.actionBtn}
            onClick={onOpenRegistryModal}
            title="전국 1단계(17개 시도) + 2단계(250개 시군구) 행정·홍보 주소 마스터 DB 열기"
          >
            <BookOpen size={15} />
            <span>1·2단계 267개 홍보주소 DB</span>
          </button>

          <button
            type="button"
            className={styles.actionBtn}
            onClick={onRefresh}
            disabled={loading}
            title="공공데이터포털 실시간 재조회"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{loading ? '동기화 중...' : '새로고침'}</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${styles.primaryBtn}`}
            onClick={onOpenMunicipalModal}
          >
            <PlusCircle size={15} />
            <span>지자체 행사 추가</span>
          </button>
        </div>
      </div>
    </header>
  );
};
