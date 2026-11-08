/**
 * 브랜드 기본 아이콘 및 특별 홍보관 올림픽 스타일 종목 픽토그램 아이콘 모음
 * - KoreaGovEventIcon: 대한민국 정부 상징(태극 문양) + 우하단 녹색 체크(이벤트) 배지
 * - OlympicSportPictogram: 올림픽 공식 픽토그램 스타일 종목별(수영·러닝·자전거·철인) 아이콘
 */
import React from 'react';
import { SpecialPromoSport } from '../types/event';

interface KoreaGovEventIconProps {
  size?: number;
}

/**
 * 기본 아이콘: 대한민국 정부 상징(태극마크 스타일) + 우하단 녹색 체크 배지
 */
export const KoreaGovEventIcon: React.FC<KoreaGovEventIconProps> = ({
  size = 28,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* 배경 라운드 스퀘어 */}
    <rect width="64" height="64" rx="15" fill="#ffffff" />
    <rect
      x="1.2"
      y="1.2"
      width="61.6"
      height="61.6"
      rx="13.8"
      stroke="#cbd5e1"
      strokeWidth="2.2"
    />

    {/* 대한민국 정부 상징(태극 문양): 청색 상단·좌측 회오리 */}
    <path
      d="M30 9.5C17.57 9.5 7.5 19.57 7.5 32C7.5 40.35 12.06 47.64 18.82 51.52C15.54 47.74 14.12 42.28 15.86 37.18C18.06 30.8 25.25 28 31.38 30.4C36.58 32.44 42.5 30.14 44.85 24.94C46.84 20.5 45.46 14.94 40.96 12.02C37.65 10.38 33.92 9.5 30 9.5Z"
      fill="#003764"
    />

    {/* 대한민국 정부 상징(태극 문양): 적색 하단·우측 회오리 */}
    <path
      d="M46.1 15.85C48.55 19.68 48.96 24.68 46.72 29.06C43.82 34.72 36.78 36.96 30.9 34.42C25.86 32.22 19.88 34.32 17.84 39.46C16.06 43.96 17.9 49.2 22.24 52.02C24.68 52.94 27.28 53.4 30 53.4C42.43 53.4 52.5 43.33 52.5 30.9C52.5 25.04 50.08 19.72 46.1 15.85Z"
      fill="#e0002a"
    />

    {/* 우하단 녹색 이벤트 체크 배지 */}
    <circle
      cx="48.5"
      cy="48.5"
      r="13.2"
      fill="#16a34a"
      stroke="#ffffff"
      strokeWidth="3"
    />
    <path
      d="M42.6 48.6L46.6 52.6L54.8 44.3"
      stroke="#ffffff"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface OlympicSportPictogramProps {
  sport: SpecialPromoSport;
  size?: number;
  /** 상단 헤더바 등에서 원형/라운드 배지 배경과 함께 표시할지 여부 */
  withBadge?: boolean;
}

const BADGE_BG_BY_SPORT: Record<SpecialPromoSport, string> = {
  SWIMMING: '#0284c7',
  RUNNING: '#ea580c',
  CYCLING: '#16a34a',
  TRIATHLON: '#4f46e5',
};

/**
 * 올림픽 픽토그램 스타일 종목별 아이콘 (수영 · 러닝 · 자전거 · 철인)
 */
export const OlympicSportPictogram: React.FC<OlympicSportPictogramProps> = ({
  sport,
  size = 18,
  withBadge = false,
}) => {
  const fg = withBadge ? '#ffffff' : 'currentColor';
  const badgeBg = BADGE_BG_BY_SPORT[sport] || '#2563eb';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {withBadge && <rect width="32" height="32" rx="8" fill={badgeBg} />}

      {sport === 'SWIMMING' && (
        <g>
          {/* 올림픽 수영 픽토그램: 선수 머리 + 역동적인 크롤 스트로크 팔·상체 + 2단 수면 물결 */}
          <circle cx="21.5" cy="11.5" r="2.7" fill={fg} />
          <path
            d="M7.5 16.2L14.2 12.2L19.2 15.2L25.5 9.2"
            stroke={fg}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 20.5C7.2 18.8 9.6 18.8 11.8 20.5C14 22.2 16.4 22.2 18.6 20.5C20.8 18.8 23.2 18.8 25.4 20.5C26.3 21.2 27.1 21.5 28 21.4"
            stroke={fg}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M5 25C7.2 23.3 9.6 23.3 11.8 25C14 26.7 16.4 26.7 18.6 25C20.8 23.3 23.2 23.3 25.4 25C26.3 25.7 27.1 26 28 25.9"
            stroke={fg}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </g>
      )}

      {sport === 'RUNNING' && (
        <g>
          {/* 올림픽 육상/러닝 픽토그램: 전진하는 러너 머리·상체·양팔·양다리 실루엣 */}
          <circle cx="20.5" cy="6.5" r="2.6" fill={fg} />
          {/* 상체 및 앞다리 디딤 */}
          <path
            d="M11.5 12.5L16.8 10.5L22.5 13.8L25.5 11.2"
            stroke={fg}
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 몸통 중심축 -> 앞 무릎 -> 발 */}
          <path
            d="M17.2 10.8L14.8 17.5L20.5 20.2L23.5 26.2"
            stroke={fg}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 뒷다리 킥 */}
          <path
            d="M14.8 17.5L10.2 21.5L6.5 20.2"
            stroke={fg}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {sport === 'CYCLING' && (
        <g>
          {/* 올림픽 사이클 픽토그램: 양 바퀴 + 프레임 + 에어로 자세 라이더 */}
          <circle cx="9.2" cy="21.8" r="4.6" stroke={fg} strokeWidth="2.1" />
          <circle cx="22.8" cy="21.8" r="4.6" stroke={fg} strokeWidth="2.1" />
          <circle cx="19.5" cy="7.2" r="2.4" fill={fg} />
          {/* 라이더 상체 + 핸들바 + 페달링 다리 */}
          <path
            d="M13.2 12.5L18.5 10.6L21.6 15.2H15.2L13.2 12.5Z"
            stroke={fg}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.2 15.2L15.8 21.2M9.2 21.8L14.2 15.5M22.8 21.8L20.5 15.2"
            stroke={fg}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {sport === 'TRIATHLON' && (
        <g>
          {/* 올림픽 철인3종(트라이애슬론) 픽토그램: 러닝 질주 실루엣 + 사이클 휠 + 수영 물결 결합 */}
          <circle cx="19.8" cy="6.2" r="2.3" fill={fg} />
          {/* 러너 상체·팔·다리 */}
          <path
            d="M12.5 11.2L16.8 9.6L21.8 12.2L24.8 9.8"
            stroke={fg}
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16.8 9.8L14.8 15.8L19.8 18.2L22.2 23.2"
            stroke={fg}
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 좌측 사이클 바퀴 아크 */}
          <circle cx="9.2" cy="18.2" r="4.0" stroke={fg} strokeWidth="2" />
          {/* 하단 수영 물결 */}
          <path
            d="M4.5 26.2C6.8 24.6 9.2 24.6 11.5 26.2C13.8 27.8 16.2 27.8 18.5 26.2C20.8 24.6 23.2 24.6 25.5 26.2C26.4 26.8 27.2 27 28 26.8"
            stroke={fg}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
};
