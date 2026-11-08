import React, { useMemo } from 'react';
import { Building2, ExternalLink, Globe } from 'lucide-react';
import { AdminPromoRegistryData } from '../services/promoEnrichmentService';
import styles from './PromoDirectoryView.module.css';

interface PromoDirectoryViewProps {
  registry: AdminPromoRegistryData | null;
  selectedRegionId: string;
  selectedSigunguCode: string;
  keyword: string;
}

export const PromoDirectoryView: React.FC<PromoDirectoryViewProps> = ({
  registry,
  selectedRegionId,
  selectedSigunguCode,
  keyword,
}) => {
  const kw = keyword.trim().toLowerCase();

  const filteredProvinces = useMemo(() => {
    if (!registry) return [];
    return Object.values(registry.provinces).filter((p) => {
      if (selectedRegionId !== 'ALL' && p.regionId !== selectedRegionId) {
        return false;
      }
      if (kw) {
        const hay = `${p.name} ${p.hallName} ${p.promo1Name} ${p.promo2Name} ${p.organizerKeywords.join(' ')}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [registry, selectedRegionId, kw]);

  const filteredMunicipalities = useMemo(() => {
    if (!registry) return [];
    return Object.values(registry.municipalities).filter((m) => {
      if (selectedRegionId !== 'ALL' && m.regionId !== selectedRegionId) {
        return false;
      }
      if (selectedSigunguCode !== 'ALL' && m.lDongSignguCd !== selectedSigunguCode) {
        return false;
      }
      if (kw) {
        const hay = `${m.regionName} ${m.name} ${m.hallName} ${m.promo1Name} ${m.promo2Name}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [registry, selectedRegionId, selectedSigunguCode, kw]);

  if (!registry) {
    return (
      <div className={styles.page}>
        <div className={styles.sectionCard}>
          <strong>지자체 홍보 홈페이지 디렉토리를 불러오는 중입니다...</strong>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* 1. 광역 시·도 대표 홍보 홈페이지 */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            광역 시·도 대표 문화·축제 홍보 홈페이지
          </h2>
          <span className={styles.sectionCount}>
            {filteredProvinces.length}개 광역자치단체
          </span>
        </div>

        <div className={styles.grid}>
          {filteredProvinces.map((prov) => (
            <article key={prov.regionId} className={styles.portalCard}>
              <div className={styles.cardTop}>
                <span className={styles.regionTitle}>{prov.name}</span>
                <span className={styles.tierBadge1}>광역 시·도</span>
              </div>

              <div className={styles.linksList}>
                <a
                  href={prov.promo1Url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.linkItem} ${styles.linkItemPromo}`}
                >
                  <div className={styles.linkLabelWrap}>
                    <Globe size={14} />
                    <span className={styles.linkText}>
                      대표 홍보포털: {prov.promo1Name}
                    </span>
                  </div>
                  <ExternalLink size={13} />
                </a>

                <a
                  href={prov.promo2Url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.linkItem}
                >
                  <div className={styles.linkLabelWrap}>
                    <Globe size={14} />
                    <span className={styles.linkText}>
                      문화관광포털: {prov.promo2Name}
                    </span>
                  </div>
                  <ExternalLink size={13} />
                </a>

                <a
                  href={prov.hallUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.linkItem}
                >
                  <div className={styles.linkLabelWrap}>
                    <Building2 size={14} />
                    <span className={styles.linkText}>
                      공식 청사: {prov.hallName}
                    </span>
                  </div>
                  <ExternalLink size={13} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 2. 시·군·구 전용 홍보 홈페이지 */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            시·군·구 문화관광·축제 홍보 홈페이지
          </h2>
          <span className={styles.sectionCount}>
            {filteredMunicipalities.length}개 시·군·구
          </span>
        </div>

        <div className={styles.grid}>
          {filteredMunicipalities.map((muni) => (
            <article
              key={`${muni.lDongRegnCd}-${muni.lDongSignguCd}`}
              className={styles.portalCard}
            >
              <div className={styles.cardTop}>
                <span className={styles.regionTitle}>
                  {muni.regionName} {muni.name}
                </span>
                <span className={styles.tierBadge2}>시·군·구</span>
              </div>

              <div className={styles.linksList}>
                <a
                  href={muni.promo1Url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.linkItem} ${styles.linkItemPromo}`}
                >
                  <div className={styles.linkLabelWrap}>
                    <Globe size={14} />
                    <span className={styles.linkText}>{muni.promo1Name}</span>
                  </div>
                  <ExternalLink size={13} />
                </a>

                <a
                  href={muni.hallUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.linkItem}
                >
                  <div className={styles.linkLabelWrap}>
                    <Building2 size={14} />
                    <span className={styles.linkText}>{muni.hallName}</span>
                  </div>
                  <ExternalLink size={13} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
