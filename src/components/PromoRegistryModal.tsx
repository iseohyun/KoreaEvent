import React, { useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { AdminPromoRegistryData } from '../services/promoEnrichmentService';
import styles from './PromoRegistryModal.module.css';

interface PromoRegistryModalProps {
  open: boolean;
  registry: AdminPromoRegistryData | null;
  onClose: () => void;
}

export const PromoRegistryModal: React.FC<PromoRegistryModalProps> = ({
  open,
  registry,
  onClose,
}) => {
  const [tier, setTier] = useState<'TIER1' | 'TIER2'>('TIER1');
  const [keyword, setKeyword] = useState('');

  const provinceList = useMemo(() => {
    if (!registry) return [];
    const list = Object.values(registry.provinces);
    const kw = keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter((p) =>
      `${p.name} ${p.hallName} ${p.promo1Name} ${p.promo1Url} ${p.promo2Name} ${p.organizerKeywords.join(' ')}`
        .toLowerCase()
        .includes(kw)
    );
  }, [registry, keyword]);

  const muniList = useMemo(() => {
    if (!registry) return [];
    const list = Object.values(registry.municipalities);
    const kw = keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter((m) =>
      `${m.regionName} ${m.name} ${m.hallName} ${m.promo1Url} ${m.lDongRegnCd}-${m.lDongSignguCd}`
        .toLowerCase()
        .includes(kw)
    );
  }, [registry, keyword]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>
              🏛️ 전국 1단계(17개 시·도) + 2단계(250개 시·군·구) 행정·홍보 페이지 마스터 DB
            </h2>
            <p className={styles.subtitle}>
              주최기관(sponsor1/telname) 및 법정동 코드 기반으로 동일 이벤트를 탐색·매칭하는 총 267개 지자체 공식 홍보 주소 데이터베이스입니다.
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tierTabs}>
            <button
              type="button"
              className={`${styles.tierBtn} ${tier === 'TIER1' ? styles.tierBtnActive : ''}`}
              onClick={() => setTier('TIER1')}
            >
              1단계 광역자치단체 (17개 시·도 홍보주소)
            </button>
            <button
              type="button"
              className={`${styles.tierBtn} ${tier === 'TIER2' ? styles.tierBtnActive : ''}`}
              onClick={() => setTier('TIER2')}
            >
              2단계 기초자치단체·일반구 (250개 시·군·구 홍보주소)
            </button>
          </div>

          <input
            type="text"
            className={styles.searchInput}
            placeholder="시·도, 시·군·구명, 도메인, 주최기관 키워드 검색..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className={styles.tableWrap}>
          {tier === 'TIER1' ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>법정동코드</th>
                  <th>1단계 광역 시·도</th>
                  <th>공식 행정홈페이지</th>
                  <th>홍보주소 1 (축제·행사포털)</th>
                  <th>홍보주소 2 (문화·관광포털)</th>
                  <th>주최기관 매칭 키워드 (힌트)</th>
                </tr>
              </thead>
              <tbody>
                {provinceList.map((prov) => (
                  <tr key={prov.regionId}>
                    <td>
                      <span className={styles.codeBadge}>{prov.lDongRegnCd}</span>
                    </td>
                    <td>
                      <strong>{prov.name}</strong>
                    </td>
                    <td>
                      <a
                        href={prov.hallUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.urlLink}
                      >
                        <span>{prov.hallName}</span>
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td>
                      <a
                        href={prov.promo1Url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.urlLink}
                      >
                        <span>{prov.promo1Name}</span>
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td>
                      <a
                        href={prov.promo2Url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.urlLink}
                      >
                        <span>{prov.promo2Name}</span>
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td>
                      {prov.organizerKeywords.map((kw) => (
                        <span key={kw} className={styles.kwChip}>
                          {kw}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>법정동코드</th>
                  <th>소속 시·도</th>
                  <th>2단계 시·군·구명</th>
                  <th>시·군·구청 행정홈페이지</th>
                  <th>시·군·구 홍보주소 1 (문화관광·축제)</th>
                  <th>광역 연계 홍보주소 2</th>
                </tr>
              </thead>
              <tbody>
                {muniList.map((m) => (
                  <tr key={`${m.kostatCode}-${m.lDongSignguCd}`}>
                    <td>
                      <span className={styles.codeBadge}>
                        {m.lDongRegnCd}-{m.lDongSignguCd}
                      </span>
                    </td>
                    <td>{m.regionName}</td>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>
                      <a
                        href={m.hallUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.urlLink}
                      >
                        <span>{m.hallName}</span>
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td>
                      <a
                        href={m.promo1Url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.urlLink}
                      >
                        <span>{m.promo1Name}</span>
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td>
                      <a
                        href={m.promo2Url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.urlLink}
                      >
                        <span>{m.promo2Name}</span>
                        <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
