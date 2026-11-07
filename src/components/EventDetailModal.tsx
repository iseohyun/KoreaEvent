import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ExternalLink, Globe, RefreshCw, Sparkles, X } from 'lucide-react';
import { fetchEventDetail } from '../services/korService2Api';
import {
  AdminPromoRegistryData,
  analyzeOrganizerAndMatchPromo,
} from '../services/promoEnrichmentService';
import { EventDetailInfo, ResponseFormatMode, UnifiedEventItem } from '../types/event';
import styles from './EventDetailModal.module.css';

interface EventDetailModalProps {
  event: UnifiedEventItem | null;
  registry: AdminPromoRegistryData | null;
  formatMode: ResponseFormatMode;
  onClose: () => void;
}

function formatDate(d: string): string {
  if (!d || d.length < 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

function extractHrefFromHtml(html?: string): string | undefined {
  if (!html) return undefined;
  const match = html.match(/href=["']([^"']+)["']/i);
  if (match && match[1]) return match[1];
  const urlMatch = html.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch && urlMatch[0]) return urlMatch[0];
  return undefined;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  registry,
  formatMode,
  onClose,
}) => {
  const [detail, setDetail] = useState<EventDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // 실시간 지자체 홍보 페이지 파싱 결과 상태
  const [customTargetUrl, setCustomTargetUrl] = useState('');
  const [liveScrapeResult, setLiveScrapeResult] = useState<{
    pageTitle: string;
    highlights: string[];
    trafficNotice: string | null;
    sourceUrl: string;
  } | null>(null);
  const [liveScraping, setLiveScraping] = useState(false);

  useEffect(() => {
    setLiveScrapeResult(null);
    if (!event) return;
    if (event.source === 'PUBLIC_PORTAL' && event.contentId) {
      setLoading(true);
      fetchEventDetail(event.contentId, event.contentTypeId || '15', formatMode)
        .then((res) => setDetail(res))
        .catch(() => setDetail(null))
        .finally(() => setLoading(false));
    } else {
      setDetail(null);
    }
  }, [event, formatMode]);

  const promoAnalysis = useMemo(() => {
    if (!event) return null;
    return analyzeOrganizerAndMatchPromo(event, detail, registry);
  }, [event, detail, registry]);

  useEffect(() => {
    if (promoAnalysis) {
      setCustomTargetUrl(
        promoAnalysis.deepEnrichment?.deepArticleUrl || promoAnalysis.primaryPromoUrl
      );
    }
  }, [promoAnalysis]);

  if (!event || !promoAnalysis) return null;

  const isPortal = event.source === 'PUBLIC_PORTAL';
  const externalUrl =
    extractHrefFromHtml(detail?.homepageHtml) || event.sourceOrgUrl;

  const handleLiveScrape = async () => {
    if (!customTargetUrl.trim()) return;
    setLiveScraping(true);
    try {
      const res = await fetch(
        `/api/municipal-enrich?url=${encodeURIComponent(customTargetUrl.trim())}`
      );
      const data = await res.json();
      if (res.ok && data.highlights) {
        setLiveScrapeResult(data);
      }
    } catch {
      // ignore
    } finally {
      setLiveScraping(false);
    }
  };

  const deep = promoAnalysis.deepEnrichment;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.badgeRow}>
              <span className={isPortal ? styles.portalBadge : styles.localBadge}>
                {event.sourceLabel}
              </span>
              <span className={styles.catBadge}>
                {event.regionName} · {event.sigunguName} (법정동 {event.lDongRegnCd}-
                {event.lDongSignguCd})
              </span>
              <span className={styles.catBadge}>
                {event.lclsSystm2Name} &gt; {event.lclsSystm3Name} ({event.lclsSystm3})
              </span>
            </div>
            <h2 className={styles.title}>{event.title}</h2>
          </div>

          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {event.imageUrl && (
            <img src={event.imageUrl} alt={event.title} className={styles.heroImg} />
          )}

          {/* 1. 기본 메타데이터 그리드 */}
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>행사 기간</span>
              <span className={styles.infoVal}>
                {formatDate(event.startDate)} ~ {formatDate(event.endDate)}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>개최 주소 / 장소</span>
              <span className={styles.infoVal}>
                {event.addr1} {event.addr2 || detail?.eventPlace || ''}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>주최 / 주관 / 문의처 (매칭 힌트)</span>
              <span className={styles.infoVal}>{promoAnalysis.organizerDisplay}</span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>이용요금 / 연락처</span>
              <span className={styles.infoVal}>
                {detail?.useTimeFestival || event.feeInfo || '상세 안내 참조'}
                {event.tel ? ` (${event.tel})` : ''}
              </span>
            </div>
          </div>

          {/* 2. 핵심 기능: 주최기관 힌트 기반 1·2단계 지자체 홍보 페이지 매칭·요약 및 별도 링크 */}
          <div className={styles.promoEnrichBox}>
            <div className={styles.promoHeader}>
              <span className={styles.promoTitle}>
                <Sparkles size={17} color="#2563eb" />
                <span>주최기관 힌트 기반 지자체 공식 홍보 페이지 요약 & 별도 링크</span>
              </span>
              <span className={styles.tierBadge}>
                {promoAnalysis.matchedTier === 'TIER1_PROVINCE'
                  ? '1단계 광역지자체 홍보DB 매칭'
                  : '2단계 기초지자체(시군구) 홍보DB 매칭'}
              </span>
            </div>

            <div className={styles.hintExplain}>
              💡 <strong>주최기관 라우팅 분석:</strong> {promoAnalysis.routingExplanation}
            </div>

            {deep ? (
              <div className={styles.deepCard}>
                <div className={styles.deepTitle}>
                  📌 [{deep.promoPortalName}] {deep.deepArticleTitle}
                </div>

                <ul className={styles.bulletList}>
                  {deep.summaryPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>

                {deep.trafficOrSafetyNotice && (
                  <div className={styles.trafficAlert}>{deep.trafficOrSafetyNotice}</div>
                )}

                {deep.historySummary && deep.historySummary.length > 0 && (
                  <div className={styles.historyBox}>
                    <strong>📅 지자체 홍보 페이지 수록 회차별 히스토리:</strong>
                    {deep.historySummary.map((h, idx) => (
                      <span key={idx}>· {h}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.deepCard}>
                <div className={styles.deepTitle}>
                  📌 매칭된 지자체 홍보 채널: {promoAnalysis.primaryPromoName}
                </div>
                <p style={{ fontSize: '0.8rem', color: '#475569' }}>
                  아래 지자체 홍보 페이지 바로가기 또는 실시간 원문 파싱 버튼으로 해당 지자체 홍보 사이트의 세부 공고 내용을 즉시 요약할 수 있습니다.
                </p>
              </div>
            )}

            {/* 실시간 지자체 홍보 페이지 파싱 결과 표시 */}
            {liveScrapeResult && (
              <div className={styles.deepCard} style={{ borderColor: '#0f766e' }}>
                <div className={styles.deepTitle} style={{ color: '#0f766e' }}>
                  ⚡ 실시간 홍보 사이트 파싱 요약 완료: {liveScrapeResult.pageTitle}
                </div>
                <ul className={styles.bulletList}>
                  {liveScrapeResult.highlights.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
                {liveScrapeResult.trafficNotice && (
                  <div className={styles.trafficAlert}>
                    {liveScrapeResult.trafficNotice}
                  </div>
                )}
              </div>
            )}

            {/* 별도 홍보 링크 그룹 (1단계 광역 + 2단계 시군구 + 매칭 원문) */}
            <div className={styles.promoLinksRow}>
              {deep && (
                <a
                  href={deep.deepArticleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.deepLinkBtn}
                >
                  <Globe size={14} />
                  <span>매칭된 지자체 홍보 상세페이지 바로가기</span>
                  <ExternalLink size={13} />
                </a>
              )}

              <a
                href={promoAnalysis.tier1Province.promo1Url}
                target="_blank"
                rel="noreferrer"
                className={styles.subPromoLinkBtn}
              >
                <Building2 size={13} />
                <span>
                  1단계 홍보주소1 ({promoAnalysis.tier1Province.promo1Name})
                </span>
                <ExternalLink size={12} />
              </a>

              <a
                href={promoAnalysis.tier2Municipality.promo1Url}
                target="_blank"
                rel="noreferrer"
                className={styles.subPromoLinkBtn}
              >
                <Building2 size={13} />
                <span>
                  2단계 홍보주소1 ({promoAnalysis.tier2Municipality.promo1Name})
                </span>
                <ExternalLink size={12} />
              </a>
            </div>

            {/* 실시간 지자체 홍보 URL 원문 수집·요약 실행 바 */}
            <div className={styles.liveScraperBar}>
              <input
                type="text"
                className={styles.liveUrlInput}
                value={customTargetUrl}
                onChange={(e) => setCustomTargetUrl(e.target.value)}
                placeholder="지자체 홍보 상세 URL 입력 (예: https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=974)"
              />
              <button
                type="button"
                className={styles.liveScrapeBtn}
                onClick={handleLiveScrape}
                disabled={liveScraping}
              >
                <RefreshCw
                  size={12}
                  style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }}
                />
                {liveScraping ? '실시간 요약 중...' : '홍보원문 실시간 파싱·요약'}
              </button>
            </div>
          </div>

          {/* 3. 공공데이터포털 기본 개요 */}
          <div className={styles.sectionBox}>
            <h3 className={styles.sectionTitle}>
              {isPortal
                ? '공공데이터포털 (KorService2 detailCommon2) 기본 개요'
                : '지자체 행정 홈페이지 기본 안내'}
            </h3>
            <div className={styles.overviewText}>
              {loading
                ? 'KorService2 detailCommon2 / detailIntro2 상세 정보를 조회하는 중입니다...'
                : detail?.overview ||
                  event.summary ||
                  '해당 행사의 기본 일정 및 위치 정보가 제공됩니다.'}
            </div>
          </div>

          {detail?.program && (
            <div className={styles.sectionBox}>
              <h3 className={styles.sectionTitle}>
                공공데이터포털 (KorService2 detailIntro2) 프로그램 정보
              </h3>
              <div className={styles.overviewText}>{detail.program}</div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
            {isPortal
              ? `공공데이터포털 콘텐츠 ID: ${event.contentId}`
              : `지자체 행정포털 수집 ID: ${event.id}`}
          </span>

          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.linkBtn}
            >
              <span>행사 개별 공식 홈페이지 바로가기</span>
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
