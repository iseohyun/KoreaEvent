import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ArrowLeft, Building2, ExternalLink, Globe, Layers, MapPin, Navigation } from 'lucide-react';
import { ADMIN_REGIONS, REGION_BY_ID } from '../constants/regions';
import { resolveSigunguPortalInfo } from '../constants/municipalityPortals';
import { SigunguItem, UnifiedEventItem } from '../types/event';
import styles from './KoreaAdminMap.module.css';

interface GeoFeature {
  type: 'Feature';
  properties: {
    kostatCode: string;
    regionId: string;
    regionName?: string;
    lDongRegnCd: string;
    lDongSignguCd?: string;
    parentSignguCd?: string | null;
    name: string;
    shortName?: string;
    rawName?: string;
    center: [number, number];
    bbox: [number, number, number, number];
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
}

interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

interface KoreaAdminMapProps {
  selectedRegionId: string;
  selectedSigunguCode: string;
  sigunguList: SigunguItem[];
  sigunguLoading: boolean;
  allEvents: UnifiedEventItem[];
  filteredEvents: UnifiedEventItem[];
  onSelectRegion: (regionId: string) => void;
  onSelectSigungu: (sigunguCode: string) => void;
  onSelectEvent: (event: UnifiedEventItem) => void;
}

const SVG_WIDTH = 480;
const SVG_HEIGHT = 510;
const SVG_PAD = 24;

export const KoreaAdminMap: React.FC<KoreaAdminMapProps> = ({
  selectedRegionId,
  selectedSigunguCode,
  allEvents,
  filteredEvents,
  onSelectRegion,
  onSelectSigungu,
  onSelectEvent,
}) => {
  const [mapMode, setMapMode] = useState<'POLYGON' | 'LEAFLET'>('POLYGON');
  const [provincesGeo, setProvincesGeo] = useState<GeoCollection | null>(null);
  const [municipalitiesGeo, setMunicipalitiesGeo] = useState<GeoCollection | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<GeoFeature | null>(null);

  const leafletContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);

  // 정식 행정경계 GeoJSON 로드 (시·도 17개 + 시·군·구 250개)
  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    Promise.all([
      fetch(`${baseUrl}geo/skorea-provinces-geo.json`).then((r) => r.json()),
      fetch(`${baseUrl}geo/skorea-municipalities-geo.json`).then((r) => r.json()),
    ])
      .then(([provData, muniData]) => {
        setProvincesGeo(provData);
        setMunicipalitiesGeo(muniData);
      })
      .catch((err) => {
        console.error('Failed to load administrative GeoJSON:', err);
      });
  }, []);

  // 시도별 포털/지자체 행사 건수 집계
  const regionStats = useMemo(() => {
    const map: Record<string, { total: number; portal: number; municipal: number }> = {};
    ADMIN_REGIONS.forEach((r) => {
      map[r.id] = { total: 0, portal: 0, municipal: 0 };
    });

    allEvents.forEach((ev) => {
      if (!map[ev.regionId]) {
        map[ev.regionId] = { total: 0, portal: 0, municipal: 0 };
      }
      map[ev.regionId].total += 1;
      if (ev.source === 'PUBLIC_PORTAL') {
        map[ev.regionId].portal += 1;
      } else {
        map[ev.regionId].municipal += 1;
      }
    });
    return map;
  }, [allEvents]);

  // 시군구별(regionId + lDongSignguCd) 행사 건수 집계
  const sigunguStats = useMemo(() => {
    const map: Record<string, { total: number; portal: number; municipal: number }> = {};
    allEvents.forEach((ev) => {
      const key = `${ev.regionId}-${ev.lDongSignguCd}`;
      if (!map[key]) {
        map[key] = { total: 0, portal: 0, municipal: 0 };
      }
      map[key].total += 1;
      if (ev.source === 'PUBLIC_PORTAL') {
        map[key].portal += 1;
      } else {
        map[key].municipal += 1;
      }
    });
    return map;
  }, [allEvents]);

  // 현재 표시할 GeoJSON Feature 목록 (전국=17개 시도, 특정 시도 선택 시=해당 시도의 시·군·구 폴리곤들)
  const activeFeatures = useMemo<GeoFeature[]>(() => {
    if (selectedRegionId === 'ALL') {
      return provincesGeo?.features || [];
    }
    if (!municipalitiesGeo) return [];
    return municipalitiesGeo.features.filter(
      (f) => f.properties.regionId === selectedRegionId
    );
  }, [selectedRegionId, provincesGeo, municipalitiesGeo]);

  // 현재 Feature 집합의 전체 Bounding Box 및 경위도 -> SVG(x,y) 투영 함수 계산
  const projection = useMemo(() => {
    if (activeFeatures.length === 0) {
      return null;
    }

    let minLng = 999;
    let minLat = 999;
    let maxLng = -999;
    let maxLat = -999;

    activeFeatures.forEach((f) => {
      const [bx0, by0, bx1, by1] = f.properties.bbox;
      if (bx0 < minLng) minLng = bx0;
      if (by0 < minLat) minLat = by0;
      if (bx1 > maxLng) maxLng = bx1;
      if (by1 > maxLat) maxLat = by1;
    });

    const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
    const cosFactor = Math.cos(midLatRad);

    const geoWidth = Math.max((maxLng - minLng) * cosFactor, 0.02);
    const geoHeight = Math.max(maxLat - minLat, 0.02);

    const drawW = SVG_WIDTH - SVG_PAD * 2;
    const drawH = SVG_HEIGHT - SVG_PAD * 2;

    const scale = Math.min(drawW / geoWidth, drawH / geoHeight);
    const offsetX = SVG_PAD + (drawW - geoWidth * scale) / 2;
    const offsetY = SVG_PAD + (drawH - geoHeight * scale) / 2;

    const projectPoint = (lng: number, lat: number): [number, number] => {
      const x = offsetX + (lng - minLng) * cosFactor * scale;
      const y = offsetY + (maxLat - lat) * scale;
      return [x, y];
    };

    const ringToSvgPath = (ring: [number, number][]): string => {
      if (!ring || ring.length === 0) return '';
      return (
        ring
          .map((pt, idx) => {
            const [x, y] = projectPoint(pt[0], pt[1]);
            return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ') + ' Z'
      );
    };

    const geometryToSvgPath = (geom: GeoFeature['geometry']): string => {
      if (geom.type === 'Polygon') {
        return geom.coordinates.map((ring: [number, number][]) => ringToSvgPath(ring)).join(' ');
      }
      if (geom.type === 'MultiPolygon') {
        return geom.coordinates
          .map((poly: [number, number][][]) =>
            poly.map((ring) => ringToSvgPath(ring)).join(' ')
          )
          .join(' ');
      }
      return '';
    };

    return {
      projectPoint,
      geometryToSvgPath,
    };
  }, [activeFeatures]);

  // 특정 시군구 feature의 행사 건수 계산 (창원시 등 상위코드 120 포함 여부 고려)
  const getFeatureStats = (f: GeoFeature) => {
    if (selectedRegionId === 'ALL') {
      return regionStats[f.properties.regionId] || { total: 0, portal: 0, municipal: 0 };
    }
    const key = `${f.properties.regionId}-${f.properties.lDongSignguCd}`;
    return sigunguStats[key] || { total: 0, portal: 0, municipal: 0 };
  };

  // 폴리곤 색상 계산
  const getFeatureFill = (f: GeoFeature) => {
    if (selectedRegionId === 'ALL') {
      const count = getFeatureStats(f).total;
      if (count >= 15) return '#3b82f6';
      if (count >= 8) return '#60a5fa';
      if (count >= 3) return '#93c5fd';
      if (count >= 1) return '#bfdbfe';
      return '#dbeafe';
    }

    const isSelectedSigungu =
      selectedSigunguCode !== 'ALL' &&
      f.properties.lDongSignguCd === selectedSigunguCode;
    if (isSelectedSigungu) {
      return '#1d4ed8';
    }

    const count = getFeatureStats(f).total;
    if (count >= 5) return '#60a5fa';
    if (count >= 2) return '#93c5fd';
    if (count >= 1) return '#bfdbfe';
    return '#e2e8f0';
  };

  // 시군구 폴리곤 라벨 축약 표기 (예: "창원시 의창구" -> "의창구", "진주시" -> "진주시")
  const getShortMuniLabel = (name: string) => {
    if (name.startsWith('창원시 ')) {
      return name.replace('창원시 ', '');
    }
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[parts.length - 1];
    }
    return name;
  };

  // Leaflet 상세 지도 초기화 및 정식 행정경계 레이어 + 행사 마커 렌더링
  useEffect(() => {
    if (mapMode !== 'LEAFLET' || !leafletContainerRef.current) return;

    if (!leafletMapRef.current) {
      const initRegion =
        selectedRegionId !== 'ALL' ? REGION_BY_ID[selectedRegionId] : undefined;
      const mapInstance = L.map(leafletContainerRef.current, {
        center: initRegion ? [initRegion.centerLat, initRegion.centerLng] : [36.35, 127.85],
        zoom: initRegion ? initRegion.zoom : 7,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapInstance);

      markerLayerRef.current = L.layerGroup().addTo(mapInstance);
      leafletMapRef.current = mapInstance;
    }

    const mapInstance = leafletMapRef.current;
    const layerGroup = markerLayerRef.current;
    if (!mapInstance || !layerGroup) return;

    if (boundaryLayerRef.current) {
      boundaryLayerRef.current.remove();
      boundaryLayerRef.current = null;
    }

    if (activeFeatures.length > 0) {
      const geoLayer = L.geoJSON(
        { type: 'FeatureCollection', features: activeFeatures } as any,
        {
          style: (feature: any) => {
            const isSel =
              selectedRegionId !== 'ALL' &&
              selectedSigunguCode !== 'ALL' &&
              feature?.properties?.lDongSignguCd === selectedSigunguCode;
            return {
              color: isSel ? '#1e3a8a' : '#2563eb',
              weight: isSel ? 3 : 1.5,
              fillColor: isSel ? '#3b82f6' : '#93c5fd',
              fillOpacity: isSel ? 0.35 : 0.15,
            };
          },
          onEachFeature: (feature, layer) => {
            layer.on('click', () => {
              if (selectedRegionId === 'ALL') {
                onSelectRegion(feature.properties.regionId);
              } else if (feature.properties.lDongSignguCd) {
                onSelectSigungu(
                  selectedSigunguCode === feature.properties.lDongSignguCd
                    ? 'ALL'
                    : feature.properties.lDongSignguCd
                );
              }
            });
          },
        }
      ).addTo(mapInstance);

      boundaryLayerRef.current = geoLayer;
      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [20, 20] });
      }
    }

    layerGroup.clearLayers();

    filteredEvents.forEach((ev) => {
      if (!ev.mapY || !ev.mapX) return;
      const isPortal = ev.source === 'PUBLIC_PORTAL';
      const circle = L.circleMarker([ev.mapY, ev.mapX], {
        radius: 8,
        fillColor: isPortal ? '#2563eb' : '#16a34a',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.92,
      });

      circle.bindTooltip(
        `<strong>[${isPortal ? '공공데이터포털' : '지자체홈페이지'}]</strong><br/>${ev.title}<br/><span style="font-size:11px;color:#475569;">${ev.regionName} ${ev.sigunguName} · ${ev.lclsSystm3Name}</span>`,
        { direction: 'top' }
      );

      circle.on('click', () => {
        onSelectEvent(ev);
      });

      circle.addTo(layerGroup);
    });

    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 100);
  }, [
    mapMode,
    selectedRegionId,
    selectedSigunguCode,
    activeFeatures,
    filteredEvents,
    onSelectRegion,
    onSelectSigungu,
    onSelectEvent,
  ]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  const activeRegion = selectedRegionId !== 'ALL' ? REGION_BY_ID[selectedRegionId] : null;

  // 현재 선택된 시군구 Feature 및 홍보 홈페이지 정보
  const selectedMuniFeature = useMemo(() => {
    if (selectedRegionId === 'ALL' || selectedSigunguCode === 'ALL') return null;
    return (
      activeFeatures.find((f) => f.properties.lDongSignguCd === selectedSigunguCode) || null
    );
  }, [selectedRegionId, selectedSigunguCode, activeFeatures]);

  const activePortalInfo = useMemo(() => {
    if (!activeRegion) return null;
    if (selectedMuniFeature) {
      return resolveSigunguPortalInfo(
        activeRegion.id,
        activeRegion.lDongRegnCd,
        selectedMuniFeature.properties.lDongSignguCd || '',
        selectedMuniFeature.properties.name
      );
    }
    return {
      lDongRegnCd: activeRegion.lDongRegnCd,
      lDongSignguCd: 'ALL',
      name: activeRegion.name,
      hallName: `${activeRegion.name}청`,
      hallUrl: activeRegion.municipalPortalUrl,
      promoName: activeRegion.municipalPortalName,
      promoUrl: activeRegion.municipalPortalUrl,
    };
  }, [activeRegion, selectedMuniFeature]);

  return (
    <section className={styles.mapCard}>
      <div className={styles.cardHeader}>
        <div className={styles.headerTitleGroup}>
          <h2 className={styles.cardTitle}>
            <Navigation size={18} color="#2563eb" />
            <span>
              {activeRegion
                ? `${activeRegion.name} 정식 시·군·구 행정경계 지도`
                : '대한민국 정식 행정경계 지도 (17개 시·도 → 250개 시·군·구)'}
            </span>
          </h2>
          <p className={styles.cardDesc}>
            {activeRegion
              ? `${activeRegion.name}의 개별 시·군·구 구역을 클릭하면 해당 시·군·구청 행사와 홍보 홈페이지를 연결합니다.`
              : '시·도를 클릭하면 해당 도의 시·군·구(진주·통영·창원 의창/성산/마산/진해 등) 상세 행정지도로 확대됩니다.'}
          </p>
        </div>

        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.modeTab} ${mapMode === 'POLYGON' ? styles.modeTabActive : ''}`}
            onClick={() => setMapMode('POLYGON')}
          >
            <Layers size={14} />
            <span>정식 행정구역 지도</span>
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mapMode === 'LEAFLET' ? styles.modeTabActive : ''}`}
            onClick={() => setMapMode('LEAFLET')}
          >
            <MapPin size={14} />
            <span>배경 타일 + GPS 마커</span>
          </button>
        </div>
      </div>

      {/* 상단 17개 시·도 퀵 선택 바 */}
      <div className={styles.regionQuickBar}>
        <button
          type="button"
          className={`${styles.regionPill} ${
            selectedRegionId === 'ALL' ? styles.regionPillActive : ''
          }`}
          onClick={() => onSelectRegion('ALL')}
        >
          <span>전국 17개 시도</span>
          <span className={styles.pillCount}>({allEvents.length})</span>
        </button>
        {ADMIN_REGIONS.map((reg) => {
          const count = regionStats[reg.id]?.total || 0;
          return (
            <button
              key={reg.id}
              type="button"
              className={`${styles.regionPill} ${
                selectedRegionId === reg.id ? styles.regionPillActive : ''
              }`}
              onClick={() => onSelectRegion(reg.id)}
            >
              <span>{reg.shortName}</span>
              <span className={styles.pillCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* 본문: 정식 GeoJSON 행정경계 폴리곤 지도 (전국 시도 <-> 시군구 자동 확대) */}
      <div className={styles.mapBody}>
        {activeRegion && (
          <button
            type="button"
            className={styles.backToNationalBtn}
            onClick={() => onSelectRegion('ALL')}
          >
            <ArrowLeft size={14} />
            <span>전국 17개 시·도 지도로 돌아가기</span>
          </button>
        )}

        <div className={styles.levelIndicator}>
          {activeRegion
            ? `${activeRegion.name} (${activeFeatures.length}개 시·군·구 정식 경계)`
            : '전국 17개 광역자치단체 정식 경계'}
        </div>

        {mapMode === 'POLYGON' ? (
          <>
            {hoveredFeature && (
              <div className={styles.hoverTooltip}>
                <span className={styles.tooltipTitle}>
                  {selectedRegionId === 'ALL'
                    ? `${hoveredFeature.properties.name} (시도코드: ${hoveredFeature.properties.lDongRegnCd})`
                    : `${hoveredFeature.properties.regionName} ${hoveredFeature.properties.name} (코드: ${hoveredFeature.properties.lDongRegnCd}-${hoveredFeature.properties.lDongSignguCd})`}
                </span>
                <span>
                  통합 행사: <strong>{getFeatureStats(hoveredFeature).total}건</strong> (포털{' '}
                  {getFeatureStats(hoveredFeature).portal}건 · 지자체{' '}
                  {getFeatureStats(hoveredFeature).municipal}건)
                </span>
                <span style={{ fontSize: '0.71rem', color: '#cbd5e1' }}>
                  {selectedRegionId === 'ALL'
                    ? '클릭 시 해당 시·도의 시·군·구 상세 행정지도로 확대됩니다.'
                    : '클릭 시 해당 시·군·구의 행사 목록 및 시군구청 홍보홈페이지를 표시합니다.'}
                </span>
              </div>
            )}

            {projection ? (
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className={styles.svgMap}
                role="img"
                aria-label="대한민국 정식 시·도 및 시·군·구 행정경계 지도"
              >
                <g>
                  {activeFeatures.map((feat) => {
                    const isSelected =
                      selectedRegionId !== 'ALL' &&
                      selectedSigunguCode !== 'ALL' &&
                      feat.properties.lDongSignguCd === selectedSigunguCode;
                    const d = projection.geometryToSvgPath(feat.geometry);
                    return (
                      <path
                        key={feat.properties.kostatCode}
                        d={d}
                        fill={getFeatureFill(feat)}
                        className={`${styles.regionPolygon} ${
                          isSelected ? styles.regionPolygonSelected : ''
                        }`}
                        onMouseEnter={() => setHoveredFeature(feat)}
                        onMouseLeave={() => setHoveredFeature(null)}
                        onClick={() => {
                          if (selectedRegionId === 'ALL') {
                            onSelectRegion(feat.properties.regionId);
                          } else {
                            const code = feat.properties.lDongSignguCd || 'ALL';
                            onSelectSigungu(selectedSigunguCode === code ? 'ALL' : code);
                          }
                        }}
                      />
                    );
                  })}
                </g>

                <g className={styles.regionLabelGroup}>
                  {activeFeatures.map((feat) => {
                    const [cx, cy] = projection.projectPoint(
                      feat.properties.center[0],
                      feat.properties.center[1]
                    );
                    const stats = getFeatureStats(feat);
                    const isSelected =
                      selectedRegionId !== 'ALL' &&
                      selectedSigunguCode !== 'ALL' &&
                      feat.properties.lDongSignguCd === selectedSigunguCode;

                    const labelText =
                      selectedRegionId === 'ALL'
                        ? feat.properties.shortName || feat.properties.name
                        : getShortMuniLabel(feat.properties.name);

                    return (
                      <g key={`lbl-${feat.properties.kostatCode}`}>
                        <text
                          x={cx}
                          y={cy}
                          className={`${
                            selectedRegionId === 'ALL'
                              ? styles.regionLabelText
                              : styles.sigunguLabelText
                          } ${isSelected ? styles.regionLabelSelected : ''}`}
                        >
                          {labelText}
                        </text>
                        {stats.total > 0 && (
                          <text
                            x={cx}
                            y={cy + 11}
                            className={styles.regionCountBadge}
                          >
                            {stats.total}건
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            ) : (
              <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                정식 행정경계 GeoJSON 데이터를 불러오는 중입니다...
              </div>
            )}

            <div className={styles.legendBox}>
              <strong>{activeRegion ? '시·군·구 행사 분포' : '시·도 행사 분포'}</strong>
              <div className={styles.legendRow}>
                <span className={styles.legendSwatch} style={{ background: '#1d4ed8' }} />
                <span>선택된 행정구역</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.legendSwatch} style={{ background: '#60a5fa' }} />
                <span>행사 다수 분포</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.legendSwatch} style={{ background: '#bfdbfe' }} />
                <span>행사 1건 이상</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div ref={leafletContainerRef} className={styles.leafletContainer} />
            <div className={styles.legendBox} style={{ zIndex: 20 }}>
              <strong>행사 출처 마커 범례</strong>
              <div className={styles.legendRow}>
                <span
                  className={styles.legendSwatch}
                  style={{ background: '#2563eb', borderRadius: '50%' }}
                />
                <span>공공데이터포털 (KorService2)</span>
              </div>
              <div className={styles.legendRow}>
                <span
                  className={styles.legendSwatch}
                  style={{ background: '#16a34a', borderRadius: '50%' }}
                />
                <span>시·군·구청 홍보 홈페이지</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 선택된 시·도 또는 시·군·구청 공식 행정 홈페이지 및 문화관광 홍보 포털 바로가기 배너 */}
      {activePortalInfo && (
        <div className={styles.sigunguPortalBanner}>
          <div className={styles.portalBannerInfo}>
            <span className={styles.portalBannerName}>
              🏛️ {activePortalInfo.name} 공식 행정·홍보 포털 연동
            </span>
            <span className={styles.portalBannerSub}>
              법정동코드: {activePortalInfo.lDongRegnCd}
              {activePortalInfo.lDongSignguCd !== 'ALL'
                ? `-${activePortalInfo.lDongSignguCd}`
                : ' (시·도 전체)'}{' '}
              · 해당 지자체 홍보 홈페이지의 문화·축제·고시 행사와 매핑됩니다.
            </span>
          </div>

          <div className={styles.portalBtnGroup}>
            <a
              href={activePortalInfo.hallUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.portalLinkBtn}
            >
              <Building2 size={13} />
              <span>{activePortalInfo.hallName} 홈페이지</span>
              <ExternalLink size={12} />
            </a>
            <a
              href={activePortalInfo.promoUrl}
              target="_blank"
              rel="noreferrer"
              className={`${styles.portalLinkBtn} ${styles.portalLinkBtnPromo}`}
            >
              <Globe size={13} />
              <span>{activePortalInfo.promoName}</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {/* 선택된 시·도의 시·군·구 전체 버튼 목록 */}
      <div className={styles.sigunguPanel}>
        <div className={styles.sigunguHeader}>
          <span className={styles.sigunguTitle}>
            {activeRegion
              ? `📍 ${activeRegion.name} 시·군·구 선택 (${activeFeatures.length}개 행정구역)`
              : '📍 지도에서 시·도를 클릭하면 시·군·구 단위 정식 지도가 확대됩니다'}
          </span>
        </div>

        {activeRegion && (
          <div className={styles.sigunguList}>
            <button
              type="button"
              className={`${styles.sigunguBtn} ${
                selectedSigunguCode === 'ALL' ? styles.sigunguBtnActive : ''
              }`}
              onClick={() => onSelectSigungu('ALL')}
            >
              {activeRegion.shortName} 전체 ({regionStats[activeRegion.id]?.total || 0})
            </button>
            {activeFeatures.map((feat) => {
              const code = feat.properties.lDongSignguCd || '';
              const count = getFeatureStats(feat).total;
              return (
                <button
                  key={feat.properties.kostatCode}
                  type="button"
                  className={`${styles.sigunguBtn} ${
                    selectedSigunguCode === code ? styles.sigunguBtnActive : ''
                  }`}
                  onClick={() =>
                    onSelectSigungu(selectedSigunguCode === code ? 'ALL' : code)
                  }
                >
                  <span>{feat.properties.name}</span>
                  <span>({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
