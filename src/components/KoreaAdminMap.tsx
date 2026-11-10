import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { HelpCircle, Layers, MapPin, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { ADMIN_REGIONS, REGION_BY_ID } from '../constants/regions';
import { UnifiedEventItem } from '../types/event';
import styles from './KoreaAdminMap.module.css';

export interface GeoFeature {
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

export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

interface KoreaAdminMapProps {
  selectedRegionId: string;
  selectedSigunguCode: string;
  allEvents: UnifiedEventItem[];
  filteredEvents: UnifiedEventItem[];
  onSelectRegion: (regionId: string) => void;
  onSelectSigungu: (sigunguCode: string) => void;
  onSelectEvent: (event: UnifiedEventItem) => void;
  onMunicipalitiesLoaded?: (features: GeoFeature[]) => void;
}

const SVG_WIDTH = 480;
const SVG_HEIGHT = 530;
const SVG_PAD = 24;

export const KoreaAdminMap: React.FC<KoreaAdminMapProps> = ({
  selectedRegionId,
  selectedSigunguCode,
  allEvents,
  filteredEvents,
  onSelectRegion,
  onSelectSigungu,
  onSelectEvent,
  onMunicipalitiesLoaded,
}) => {
  const [mapMode, setMapMode] = useState<'POLYGON' | 'LEAFLET'>('POLYGON');
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
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
        if (onMunicipalitiesLoaded && muniData?.features) {
          onMunicipalitiesLoaded(muniData.features);
        }
      })
      .catch((err) => {
        console.error('Failed to load administrative GeoJSON:', err);
      });
  }, [onMunicipalitiesLoaded]);

  // 시도별 행사 건수 집계
  const regionStats = useMemo(() => {
    const map: Record<string, { total: number }> = {};
    ADMIN_REGIONS.forEach((r) => {
      map[r.id] = { total: 0 };
    });

    allEvents.forEach((ev) => {
      if (!map[ev.regionId]) {
        map[ev.regionId] = { total: 0 };
      }
      map[ev.regionId].total += 1;
    });
    return map;
  }, [allEvents]);

  // 시군구별 행사 건수 집계
  const sigunguStats = useMemo(() => {
    const map: Record<string, { total: number }> = {};
    allEvents.forEach((ev) => {
      const key = `${ev.regionId}-${ev.lDongSignguCd}`;
      if (!map[key]) {
        map[key] = { total: 0 };
      }
      map[key].total += 1;
    });
    return map;
  }, [allEvents]);

  // 현재 표시할 GeoJSON Feature 목록
  const activeFeatures = useMemo<GeoFeature[]>(() => {
    if (selectedRegionId === 'ALL') {
      return provincesGeo?.features || [];
    }
    if (!municipalitiesGeo) return [];
    return municipalitiesGeo.features.filter(
      (f) => f.properties.regionId === selectedRegionId
    );
  }, [selectedRegionId, provincesGeo, municipalitiesGeo]);

  // 경위도 -> SVG(x,y) 투영 계산
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

  const getFeatureStats = (f: GeoFeature) => {
    if (selectedRegionId === 'ALL') {
      return regionStats[f.properties.regionId] || { total: 0 };
    }
    const key = `${f.properties.regionId}-${f.properties.lDongSignguCd}`;
    return sigunguStats[key] || { total: 0 };
  };

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

  // Leaflet 상세 지도 초기화 및 마커 렌더링
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
        `<strong>${ev.title}</strong><br/><span style="font-size:11px;color:#475569;">${ev.regionName} ${ev.sigunguName} · ${ev.lclsSystm3Name}</span>`,
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

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (mapMode === 'LEAFLET' && leafletMapRef.current) {
      setTimeout(() => {
        leafletMapRef.current?.invalidateSize();
      }, 60);
    }
  }, [isFullscreen, mapMode]);

  const activeRegion = selectedRegionId !== 'ALL' ? REGION_BY_ID[selectedRegionId] : null;

  return (
    <section
      className={`${styles.mapCard} ${isFullscreen ? styles.mapCardFullscreen : ''}`}
    >
      <div
        className={`${styles.mapBody} ${isFullscreen ? styles.mapBodyFullscreen : ''}`}
      >
        {/* 우상단 리모컨 컨트롤러 (아이콘만 노출) */}
        <div className={styles.remoteControl} aria-label="지도 보기 리모컨">
          <button
            type="button"
            className={`${styles.remoteBtn} ${isFullscreen ? styles.remoteBtnActive : ''}`}
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? '전체 화면 종료 (ESC)' : '전체 화면으로 보기'}
            aria-label={isFullscreen ? '전체 화면 종료' : '전체 화면으로 보기'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <div className={styles.remoteDivider} />

          <button
            type="button"
            className={`${styles.remoteBtn} ${
              mapMode === 'POLYGON' ? styles.remoteBtnActive : ''
            }`}
            onClick={() => setMapMode('POLYGON')}
            title="행정구역 지도 보기"
            aria-label="행정구역 지도 보기"
          >
            <Layers size={18} />
          </button>

          <button
            type="button"
            className={`${styles.remoteBtn} ${
              mapMode === 'LEAFLET' ? styles.remoteBtnActive : ''
            }`}
            onClick={() => setMapMode('LEAFLET')}
            title="GPS 위치 마커 지도 보기"
            aria-label="GPS 위치 마커 지도 보기"
          >
            <MapPin size={18} />
          </button>

          <div className={styles.remoteDivider} />

          <button
            type="button"
            className={`${styles.remoteBtn} ${showLegend ? styles.remoteBtnActive : ''}`}
            onClick={() => setShowLegend((prev) => !prev)}
            title="범례 표시 켜기/끄기"
            aria-label="범례 토글"
          >
            <HelpCircle size={18} />
          </button>

          {activeRegion && (
            <>
              <div className={styles.remoteDivider} />
              <button
                type="button"
                className={styles.remoteBtn}
                onClick={() => onSelectRegion('ALL')}
                title="전국 지도로 돌아가기"
                aria-label="전국 지도로 돌아가기"
              >
                <RotateCcw size={17} />
              </button>
            </>
          )}
        </div>

        {mapMode === 'POLYGON' ? (
          <>
            {hoveredFeature && (
              <div className={styles.hoverTooltip}>
                <span className={styles.tooltipTitle}>
                  {selectedRegionId === 'ALL'
                    ? hoveredFeature.properties.name
                    : `${hoveredFeature.properties.regionName} ${hoveredFeature.properties.name}`}
                </span>
                <span>
                  등록 행사: <strong>{getFeatureStats(hoveredFeature).total}건</strong>
                </span>
              </div>
            )}

            {projection ? (
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className={styles.svgMap}
                role="img"
                aria-label="대한민국 행정경계 지도"
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
                행정경계 지도를 불러오는 중입니다...
              </div>
            )}

            {showLegend && (
              <div className={styles.legendBox}>
                <strong>{activeRegion ? '시·군·구 행사 분포' : '시·도 행사 분포'}</strong>
                <div className={styles.legendRow}>
                  <span className={styles.legendSwatch} style={{ background: '#1d4ed8' }} />
                  <span>선택 구역</span>
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
            )}
          </>
        ) : (
          <>
            <div ref={leafletContainerRef} className={styles.leafletContainer} />
            {showLegend && (
              <div className={styles.legendBox}>
                <strong>행사 출처 범례</strong>
                <div className={styles.legendRow}>
                  <span
                    className={styles.legendSwatch}
                    style={{ background: '#2563eb', borderRadius: '50%' }}
                  />
                  <span>공공포털 행사</span>
                </div>
                <div className={styles.legendRow}>
                  <span
                    className={styles.legendSwatch}
                    style={{ background: '#16a34a', borderRadius: '50%' }}
                  />
                  <span>지자체 홍보 행사</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
