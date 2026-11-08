/**
 * DB (크롤링 대상 사이트 마스터 디렉토리 뷰)
 * - 전국(level 3) / 광역시도(level 2) / 시군구(level 1) / 기타(level 0) 분류별 펼치기·접기 애니메이션 지원
 * - 상단 필터(종목·지역·범위·세부 검색)를 통해 종목별·지역별 필터링 지원
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { ADMIN_REGIONS } from '../constants/regions';
import { AdminPromoRegistryData } from '../services/promoEnrichmentService';
import {
  DbCrawlTabCategory,
  PromoLevel,
  ScopeFilterState,
  SpecialPromoSport,
} from '../types/event';
import { OlympicSportPictogram } from './BrandAndSportIcons';
import styles from './PromoDirectoryView.module.css';

interface PromoDirectoryViewProps {
  registry: AdminPromoRegistryData | null;
  activeDbTab: DbCrawlTabCategory;
  onChangeDbTab?: (tab: DbCrawlTabCategory) => void;
  selectedRegionId: string;
  selectedSigunguCode: string;
  scopeLevels: ScopeFilterState;
  keyword: string;
}

interface SportsRegistryItemRaw {
  id: string;
  level: number;
  regionId?: string;
  lDongRegnCd?: string;
  lDongSignguCd?: string;
  name: string;
  city?: string;
  region?: string;
  homepageUrl?: string;
  scheduleUrl?: string;
  noticeUrl?: string;
  applicationUrl?: string;
  sidoNewsUrl?: string;
  address?: string;
  mainPool?: string;
  description?: string;
  MainCompetitions?: string[];
  mainEvents?: string[];
}

interface SportsFederationRegistryJson {
  sports?: Record<
    SpecialPromoSport,
    {
      sport: SpecialPromoSport;
      label: string;
      worldAndNational?: SportsRegistryItemRaw[];
      provincialFederations?: SportsRegistryItemRaw[];
      municipalFederations?: SportsRegistryItemRaw[];
      individualPoolChannels?: SportsRegistryItemRaw[];
    }
  >;
}

interface CrawlSiteLink {
  label: string;
  url: string;
  isPrimary?: boolean;
  iconType?: 'globe' | 'calendar' | 'building';
}

interface DbCrawlSiteEntry {
  id: string;
  category: Exclude<DbCrawlTabCategory, 'ALL'>;
  categoryLabel: string;
  sport?: SpecialPromoSport;
  level: PromoLevel; // 3: 전국, 2: 광역시도, 1: 시군구, 0: 기타
  regionId: string; // 'ALL' 또는 시도 ID
  lDongSignguCd?: string;
  locationLabel: string;
  name: string;
  description?: string;
  links: CrawlSiteLink[];
}

const DB_SCOPE_GROUPS: Array<{
  level: PromoLevel;
  title: string;
  badgeLabel: string;
  desc: string;
}> = [
  {
    level: 3,
    title: '전국',
    badgeLabel: '전국',
    desc: '세계·대한연맹 및 정부·공공데이터포털 전국 통합 크롤링 사이트',
  },
  {
    level: 2,
    title: '광역시도',
    badgeLabel: '광역시도',
    desc: '17개 광역자치단체 공식 홍보포털 및 시·도별 종목 연맹 사이트',
  },
  {
    level: 1,
    title: '시군구',
    badgeLabel: '시군구',
    desc: '250개 시·군·구 문화관광 홍보포털 및 기초지자체 연맹·조직위 사이트',
  },
  {
    level: 0,
    title: '기타',
    badgeLabel: '기타',
    desc: '개별 수영장·스포츠센터·러닝크루·동호회 및 민간 대회 안내 플랫폼',
  },
];

const REGION_ID_BY_SHORT_NAME: Record<string, string> = {};
ADMIN_REGIONS.forEach((r) => {
  REGION_ID_BY_SHORT_NAME[r.shortName] = r.id;
  REGION_ID_BY_SHORT_NAME[r.name] = r.id;
});

function inferRegionIdFromItem(raw: SportsRegistryItemRaw): string {
  if (raw.regionId) return raw.regionId;
  const city = (raw.city || '').trim();
  if (city && REGION_ID_BY_SHORT_NAME[city]) {
    return REGION_ID_BY_SHORT_NAME[city];
  }
  for (const reg of ADMIN_REGIONS) {
    if (raw.name.includes(reg.shortName) || city.includes(reg.shortName)) {
      return reg.id;
    }
  }
  return 'ALL';
}

function buildSportItemLinks(raw: SportsRegistryItemRaw): CrawlSiteLink[] {
  const links: CrawlSiteLink[] = [];
  const seen = new Set<string>();

  const pushLink = (
    label: string,
    url?: string,
    isPrimary = false,
    iconType: CrawlSiteLink['iconType'] = 'globe'
  ) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    links.push({ label, url, isPrimary, iconType });
  };

  pushLink('대회일정·공지 게시판', raw.scheduleUrl, true, 'calendar');
  pushLink('공식 홈페이지', raw.homepageUrl, links.length === 0, 'globe');
  pushLink('공지사항 게시판', raw.noticeUrl, false, 'calendar');
  pushLink('참가신청 게시판', raw.applicationUrl, false, 'calendar');
  pushLink('시·도 소식 게시판', raw.sidoNewsUrl, false, 'building');

  return links;
}

export const PromoDirectoryView: React.FC<PromoDirectoryViewProps> = ({
  registry,
  activeDbTab,
  selectedRegionId,
  selectedSigunguCode,
  scopeLevels,
  keyword,
}) => {
  const [sportsRegistry, setSportsRegistry] =
    useState<SportsFederationRegistryJson | null>(null);

  // 전국(3) / 광역시도(2) / 시군구(1) / 기타(0) 펼치기·접기 상태
  const [expandedLevels, setExpandedLevels] = useState<Record<PromoLevel, boolean>>({
    3: true,
    2: true,
    1: true,
    0: true,
  });

  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    fetch(`${baseUrl}data/sports-federation-registry.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setSportsRegistry(json);
      })
      .catch((err) => {
        console.error('[DB] sports-federation-registry.json 로드 실패:', err);
      });
  }, []);

  const toggleLevelExpand = (level: PromoLevel) => {
    setExpandedLevels((prev) => ({
      ...prev,
      [level]: !prev[level],
    }));
  };

  // 전체 크롤링 대상 사이트 마스터 목록 생성 (지자체·행정 + 수영 + 러닝 + 자전거 + 철인)
  const allCrawlSiteEntries = useMemo<DbCrawlSiteEntry[]>(() => {
    const entries: DbCrawlSiteEntry[] = [];

    // 1. 지자체·행정 전국 통합 포털 (전국 = level 3)
    entries.push(
      {
        id: 'muni-national-korservice2',
        category: 'MUNICIPAL',
        categoryLabel: '지자체·행정',
        level: 3,
        regionId: 'ALL',
        locationLabel: '전국 (공공데이터포털)',
        name: '대한민국 공공데이터포털 · 한국관광공사 국문 관광정보 API (KorService2)',
        description:
          '전국 17개 시·도 및 250개 시·군·구 문화관광축제·공연·전시·기타행사 실시간 공공데이터 수집원',
        links: [
          {
            label: '공공데이터포털 OpenAPI (KorService2)',
            url: 'https://www.data.go.kr/data/15101578/openapi.do',
            isPrimary: true,
            iconType: 'globe',
          },
          {
            label: '한국관광공사 TourAPI 포털',
            url: 'https://api.visitkorea.or.kr',
            iconType: 'globe',
          },
        ],
      },
      {
        id: 'muni-national-visitkorea',
        category: 'MUNICIPAL',
        categoryLabel: '지자체·행정',
        level: 3,
        regionId: 'ALL',
        locationLabel: '전국 (문화체육관광부)',
        name: '문화체육관광부 · 대한민국 구석구석 전국 축제·행사 통합 포털',
        description:
          '문화체육관광부 지정 문화관광축제 및 전국 지역축제 공식 일정·홍보 통합 안내',
        links: [
          {
            label: '대한민국 구석구석 축제·행사 안내',
            url: 'https://korean.visitkorea.or.kr/kfes/list/wntyFstvlList.do',
            isPrimary: true,
            iconType: 'calendar',
          },
          {
            label: '문화체육관광부 지역문화축제 안내',
            url: 'https://www.mcst.go.kr/kor/s_culture/festival/festivalList.jsp',
            iconType: 'building',
          },
        ],
      }
    );

    // 2. 지자체·행정 광역시·도 (level 2) 및 시·군·구 (level 1)
    if (registry) {
      Object.values(registry.provinces).forEach((prov) => {
        const links: CrawlSiteLink[] = [];
        if (prov.promo1Url) {
          links.push({
            label: `대표 홍보포털: ${prov.promo1Name}`,
            url: prov.promo1Url,
            isPrimary: true,
            iconType: 'globe',
          });
        }
        if (prov.promo2Url && prov.promo2Url !== prov.promo1Url) {
          links.push({
            label: `문화관광포털: ${prov.promo2Name}`,
            url: prov.promo2Url,
            iconType: 'calendar',
          });
        }
        if (prov.hallUrl) {
          links.push({
            label: `공식 청사: ${prov.hallName}`,
            url: prov.hallUrl,
            iconType: 'building',
          });
        }

        entries.push({
          id: `muni-prov-${prov.regionId}`,
          category: 'MUNICIPAL',
          categoryLabel: '지자체·행정',
          level: 2,
          regionId: prov.regionId,
          locationLabel: prov.name,
          name: `${prov.name} (${prov.promo1Name})`,
          description: `수집 키워드: ${prov.organizerKeywords.slice(0, 5).join(', ')}`,
          links,
        });
      });

      Object.values(registry.municipalities).forEach((muni) => {
        const links: CrawlSiteLink[] = [];
        if (muni.promo1Url) {
          links.push({
            label: muni.promo1Name,
            url: muni.promo1Url,
            isPrimary: true,
            iconType: 'globe',
          });
        }
        if (muni.hallUrl && muni.hallUrl !== muni.promo1Url) {
          links.push({
            label: muni.hallName,
            url: muni.hallUrl,
            iconType: 'building',
          });
        }

        entries.push({
          id: `muni-sig-${muni.lDongRegnCd}-${muni.lDongSignguCd}`,
          category: 'MUNICIPAL',
          categoryLabel: '지자체·행정',
          level: 1,
          regionId: muni.regionId,
          lDongSignguCd: muni.lDongSignguCd,
          locationLabel: `${muni.regionName} ${muni.name}`,
          name: `${muni.regionName} ${muni.name} 문화관광·축제 홍보포털`,
          description: `${muni.hallName} · ${muni.promo1Name}`,
          links,
        });
      });
    }

    // 3. 4대 스포츠(수영·러닝·자전거·철인) 연맹·조직위·기타 채널
    if (sportsRegistry?.sports) {
      const sportKeys: SpecialPromoSport[] = [
        'SWIMMING',
        'RUNNING',
        'CYCLING',
        'TRIATHLON',
      ];

      sportKeys.forEach((spKey) => {
        const block = sportsRegistry.sports?.[spKey];
        if (!block) return;

        const pushSportList = (
          items: SportsRegistryItemRaw[] | undefined,
          fallbackLevel: PromoLevel
        ) => {
          (items || []).forEach((item) => {
            const lv = (
              item.level === 3 ||
              item.level === 2 ||
              item.level === 1 ||
              item.level === 0
                ? item.level
                : fallbackLevel
            ) as PromoLevel;
            const regId = lv === 3 || lv === 0 ? 'ALL' : inferRegionIdFromItem(item);
            const compList = item.MainCompetitions || item.mainEvents || [];
            const descParts = [
              item.description,
              item.mainPool ? `주요 경기장: ${item.mainPool}` : '',
              item.address ? `소재지: ${item.address}` : '',
              compList.length > 0 ? `주요 대회: ${compList.slice(0, 4).join(', ')}` : '',
            ].filter(Boolean);

            entries.push({
              id: `${spKey}-${item.id}`,
              category: spKey,
              categoryLabel: block.label,
              sport: spKey,
              level: lv,
              regionId: regId,
              lDongSignguCd: item.lDongSignguCd,
              locationLabel: item.city || item.region || block.label,
              name: item.name,
              description: descParts.join(' · ') || undefined,
              links: buildSportItemLinks(item),
            });
          });
        };

        pushSportList(block.worldAndNational, 3);
        pushSportList(block.provincialFederations, 2);
        pushSportList(block.municipalFederations, 1);
        pushSportList(block.individualPoolChannels, 0);
      });
    }

    return entries;
  }, [registry, sportsRegistry]);

  // 지역·범위·검색어 기준 필터링 (탭별 카운트 계산용)
  const baseFilteredEntries = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return allCrawlSiteEntries.filter((entry) => {
      if (!scopeLevels[entry.level]) {
        return false;
      }
      if (selectedRegionId !== 'ALL') {
        // 전국(3) 또는 기타(0) 중 특정 지역이 지정되지 않은 항목은 지역 필터 선택 시 제외하되, 해당 지역이면 포함
        if (entry.regionId !== selectedRegionId) {
          return false;
        }
      }
      if (selectedSigunguCode !== 'ALL') {
        if (entry.lDongSignguCd !== selectedSigunguCode) {
          return false;
        }
      }
      if (kw) {
        const hay = [
          entry.name,
          entry.locationLabel,
          entry.categoryLabel,
          entry.description || '',
          ...entry.links.map((l) => `${l.label} ${l.url}`),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [allCrawlSiteEntries, scopeLevels, selectedRegionId, selectedSigunguCode, keyword]);

  // 현재 선택된 종목 필터(activeDbTab)까지 반영된 최종 리스트
  const finalEntries = useMemo(() => {
    if (activeDbTab === 'ALL') return baseFilteredEntries;
    return baseFilteredEntries.filter((e) => e.category === activeDbTab);
  }, [baseFilteredEntries, activeDbTab]);

  // 전국(3) / 광역시도(2) / 시군구(1) / 기타(0) 그룹핑
  const groupedSections = useMemo(() => {
    return DB_SCOPE_GROUPS.map((grp) => ({
      ...grp,
      items: finalEntries.filter((e) => e.level === grp.level),
    })).filter((grp) => grp.items.length > 0);
  }, [finalEntries]);

  if (!registry) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyCard}>
          <strong>크롤링 대상 DB 디렉토리를 불러오는 중입니다...</strong>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* 전국 / 광역시도 / 시군구 / 기타 펼치기·접기 리스트 */}
      {groupedSections.length === 0 ? (
        <div className={styles.emptyCard}>
          선택한 종목·지역·범위 필터 조건에 해당하는 크롤링 사이트가 없습니다.
        </div>
      ) : (
        groupedSections.map((section) => {
          const isExpanded = expandedLevels[section.level];
          return (
            <section
              key={section.level}
              className={styles.scopeSection}
              aria-label={section.title}
            >
              <button
                type="button"
                className={styles.scopeHeaderBtn}
                onClick={() => toggleLevelExpand(section.level)}
                aria-expanded={isExpanded}
              >
                <div className={styles.scopeHeaderLeft}>
                  <span
                    className={`${styles.scopeBadge} ${
                      styles[`scopeBadgeLv${section.level}`]
                    }`}
                  >
                    {section.badgeLabel}
                  </span>
                  <h2 className={styles.scopeTitle}>{section.title}</h2>
                  <span className={styles.scopeCount}>{section.items.length}곳</span>
                  <span className={styles.scopeDesc}>{section.desc}</span>
                </div>

                <div className={styles.scopeHeaderRight}>
                  <span className={styles.collapseText}>
                    {isExpanded ? '접기' : '펼치기'}
                  </span>
                  {isExpanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </div>
              </button>

              <div
                className={`${styles.collapseWrapper} ${
                  isExpanded ? styles.collapseWrapperOpen : ''
                }`}
              >
                <div className={styles.collapseInner}>
                  <div className={styles.grid}>
                    {section.items.map((site) => (
                      <article key={site.id} className={styles.portalCard}>
                        <div className={styles.cardTop}>
                          <div className={styles.cardBadgesRow}>
                            <span
                              className={`${styles.categoryPill} ${
                                styles[`categoryPill_${site.category}`]
                              }`}
                            >
                              {site.sport && (
                                <OlympicSportPictogram
                                  sport={site.sport}
                                  size={13}
                                />
                              )}
                              <span>{site.categoryLabel}</span>
                            </span>
                            <span className={styles.locationBadge}>
                              {site.locationLabel}
                            </span>
                          </div>
                          <span
                            className={`${styles.scopeMiniTag} ${
                              styles[`scopeBadgeLv${site.level}`]
                            }`}
                          >
                            {section.badgeLabel}
                          </span>
                        </div>

                        <h3 className={styles.siteTitle}>{site.name}</h3>

                        {site.description && (
                          <p className={styles.siteDesc}>{site.description}</p>
                        )}

                        <div className={styles.linksList}>
                          {site.links.map((lnk, idx) => (
                            <a
                              key={`${site.id}-lnk-${idx}`}
                              href={lnk.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`${styles.linkItem} ${
                                lnk.isPrimary ? styles.linkItemPromo : ''
                              }`}
                            >
                              <div className={styles.linkLabelWrap}>
                                {lnk.iconType === 'calendar' ? (
                                  <Calendar size={14} />
                                ) : lnk.iconType === 'building' ? (
                                  <Building2 size={14} />
                                ) : (
                                  <Globe size={14} />
                                )}
                                <span className={styles.linkText}>{lnk.label}</span>
                              </div>
                              <ExternalLink size={13} />
                            </a>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
};
