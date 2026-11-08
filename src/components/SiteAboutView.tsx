import React from 'react';
import { PlusCircle, RefreshCw } from 'lucide-react';
import { APP_VERSION_DISPLAY } from '../version';
import { ResponseFormatMode } from '../types/event';
import styles from './SiteAboutView.module.css';

interface SiteAboutViewProps {
  formatMode: ResponseFormatMode;
  detectedFormat: 'JSON' | 'XML';
  loading: boolean;
  totalPortalCount: number;
  apiTotalCount: number;
  totalFirestoreCount: number;
  firestoreCloudSynced: boolean;
  onFormatModeChange: (mode: ResponseFormatMode) => void;
  onRefresh: () => void;
  onOpenMunicipalModal: () => void;
}

export const SiteAboutView: React.FC<SiteAboutViewProps> = ({
  formatMode,
  detectedFormat,
  loading,
  totalPortalCount,
  apiTotalCount,
  totalFirestoreCount,
  firestoreCloudSynced,
  onFormatModeChange,
  onRefresh,
  onOpenMunicipalModal,
}) => {
  return (
    <div className={styles.page}>
      {/* 1. 사이트 전체 소개 (메뉴 소개 삭제) */}
      <section className={styles.card}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>대한민국 행사 소개</h2>
          <span className={styles.versionTag}>{APP_VERSION_DISPLAY}</span>
        </div>

        <p className={styles.desc}>
          대한민국 17개 광역 시·도 및 250개 시·군·구 행정구역을 기준으로 공공데이터포털과 전국
          지자체 공식 홍보 사이트의 축제·공연·전시·스포츠·시민참여 행사 정보를 통합 제공하는
          서비스입니다.
        </p>
      </section>

      {/* 2. 데이터 연동 현황 (스펙식 한 줄 간단 나열, 연결 키 숨김) */}
      <section className={styles.card}>
        <h2 className={styles.title}>데이터 연동 현황</h2>

        <ul className={styles.specList}>
          <li className={styles.specLine}>
            <span className={styles.specKey}>공공데이터포털</span>
            <span className={styles.specVal}>
              {totalPortalCount}건 로드 (전체 {apiTotalCount.toLocaleString()}건)
            </span>
          </li>
          <li className={styles.specLine}>
            <span className={styles.specKey}>지자체·홍보 DB</span>
            <span className={styles.specVal}>
              {totalFirestoreCount}건 ({firestoreCloudSynced ? '클라우드 동기화' : '로컬 캐시'})
            </span>
          </li>
          <li className={styles.specLine}>
            <span className={styles.specKey}>지자체 사이트</span>
            <span className={styles.specVal}>광역 17곳 · 시·군·구 250곳 (총 267곳)</span>
          </li>
          <li className={styles.specLine}>
            <span className={styles.specKey}>데이터 포맷</span>
            <span className={styles.specVal}>{detectedFormat}</span>
          </li>
        </ul>

        <div className={styles.controlsRow}>
          <div className={styles.formatToggle}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>포맷 전환:</span>
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

          <div className={styles.actionGroup}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw size={14} />
              <span>{loading ? '동기화 중...' : '새로고침'}</span>
            </button>

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.primaryBtn}`}
              onClick={onOpenMunicipalModal}
            >
              <PlusCircle size={14} />
              <span>행사 등록</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
