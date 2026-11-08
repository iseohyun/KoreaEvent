import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  Newspaper,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ADMIN_REGIONS, REGION_BY_ID } from '../constants/regions';
import {
  getMajorCategoryName,
  getSubCategoryName,
  SUB_CATEGORIES,
} from '../constants/categories';
import { AdminPromoRegistryData } from '../services/promoEnrichmentService';
import {
  FirestoreEventDoc,
  FirestorePromoLink,
  PromoLevel,
  PromoLinkType,
} from '../types/event';
import styles from './EventRegistrationView.module.css';

interface EventRegistrationViewProps {
  registry: AdminPromoRegistryData | null;
  onRegisterEventDoc: (doc: FirestoreEventDoc) => Promise<boolean>;
}

interface AutoClassifiedGeo {
  matched: boolean;
  regionId: string;
  regionName: string;
  lDongRegnCd: string;
  sigunguName: string;
  lDongSignguCd: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: {
          roadAddress?: string;
          jibunAddress?: string;
          address?: string;
          sido?: string;
          sigungu?: string;
          bcode?: string;
        }) => void;
      }) => { open: () => void };
    };
  }
}

const SIDO_ALIAS_TO_REGION_ID: Array<{ re: RegExp; regionId: string }> = [
  { re: /^(?:서울특별시|서울시|서울)\b/, regionId: 'seoul' },
  { re: /^(?:부산광역시|부산시|부산)\b/, regionId: 'busan' },
  { re: /^(?:대구광역시|대구시|대구)\b/, regionId: 'daegu' },
  { re: /^(?:인천광역시|인천시|인천)\b/, regionId: 'incheon' },
  { re: /^(?:광주광역시|광주시|광주)\b/, regionId: 'gwangju' },
  { re: /^(?:대전광역시|대전시|대전)\b/, regionId: 'daejeon' },
  { re: /^(?:울산광역시|울산시|울산)\b/, regionId: 'ulsan' },
  { re: /^(?:세종특별자치시|세종시|세종)\b/, regionId: 'sejong' },
  { re: /^(?:경기도|경기)\b/, regionId: 'gyeonggi' },
  { re: /^(?:강원특별자치도|강원도|강원)\b/, regionId: 'gangwon' },
  { re: /^(?:충청북도|충북)\b/, regionId: 'chungbuk' },
  { re: /^(?:충청남도|충남)\b/, regionId: 'chungnam' },
  { re: /^(?:전북특별자치도|전라북도|전북)\b/, regionId: 'jeonbuk' },
  { re: /^(?:전라남도|전남)\b/, regionId: 'jeonnam' },
  { re: /^(?:경상북도|경북)\b/, regionId: 'gyeongbuk' },
  { re: /^(?:경상남도|경남)\b/, regionId: 'gyeongnam' },
  { re: /^(?:제주특별자치도|제주도|제주)\b/, regionId: 'jeju' },
];

const BUILTIN_SIGUNGU_FALLBACKS: Array<{
  regionId: string;
  lDongRegnCd: string;
  sigunguName: string;
  lDongSignguCd: string;
}> = [
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '종로구', lDongSignguCd: '110' },
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '중구', lDongSignguCd: '140' },
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '용산구', lDongSignguCd: '170' },
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '성동구', lDongSignguCd: '200' },
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '광진구', lDongSignguCd: '215' },
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '마포구', lDongSignguCd: '440' },
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '영등포구', lDongSignguCd: '560' },
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '서초구', lDongSignguCd: '650' },
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '강남구', lDongSignguCd: '680' },
  { regionId: 'seoul', lDongRegnCd: '11', sigunguName: '송파구', lDongSignguCd: '710' },
  { regionId: 'busan', lDongRegnCd: '26', sigunguName: '동래구', lDongSignguCd: '260' },
  { regionId: 'busan', lDongRegnCd: '26', sigunguName: '해운대구', lDongSignguCd: '350' },
  { regionId: 'busan', lDongRegnCd: '26', sigunguName: '수영구', lDongSignguCd: '500' },
  { regionId: 'busan', lDongRegnCd: '26', sigunguName: '기장군', lDongSignguCd: '710' },
  { regionId: 'daegu', lDongRegnCd: '27', sigunguName: '수성구', lDongSignguCd: '260' },
  { regionId: 'incheon', lDongRegnCd: '28', sigunguName: '연수구', lDongSignguCd: '185' },
  { regionId: 'daejeon', lDongRegnCd: '30', sigunguName: '유성구', lDongSignguCd: '200' },
  { regionId: 'ulsan', lDongRegnCd: '31', sigunguName: '남구', lDongSignguCd: '140' },
  { regionId: 'sejong', lDongRegnCd: '36110', sigunguName: '세종시', lDongSignguCd: '110' },
  { regionId: 'gyeonggi', lDongRegnCd: '41', sigunguName: '수원시', lDongSignguCd: '110' },
  { regionId: 'gyeonggi', lDongRegnCd: '41', sigunguName: '성남시', lDongSignguCd: '130' },
  { regionId: 'gyeonggi', lDongRegnCd: '41', sigunguName: '고양시', lDongSignguCd: '280' },
  { regionId: 'gangwon', lDongRegnCd: '51', sigunguName: '춘천시', lDongSignguCd: '110' },
  { regionId: 'gangwon', lDongRegnCd: '51', sigunguName: '강릉시', lDongSignguCd: '150' },
  { regionId: 'gyeongnam', lDongRegnCd: '48', sigunguName: '창원시', lDongSignguCd: '120' },
  { regionId: 'gyeongnam', lDongRegnCd: '48', sigunguName: '진주시', lDongSignguCd: '170' },
  { regionId: 'gyeongnam', lDongRegnCd: '48', sigunguName: '통영시', lDongSignguCd: '220' },
  { regionId: 'jeju', lDongRegnCd: '50', sigunguName: '제주시', lDongSignguCd: '110' },
  { regionId: 'jeju', lDongRegnCd: '50', sigunguName: '서귀포시', lDongSignguCd: '130' },
];

const SAMPLE_ADDRESSES = [
  '부산광역시 동래구 종합운동장로 29 사직실내수영장',
  '서울특별시 송파구 올림픽로 424 올림픽공원',
  '경상남도 진주시 남강로 626 진주성 일원',
  '강원특별자치도 춘천시 스포츠타운길 367 송암스포츠타운',
];

function extractRegistrableDomain(urlOrEmail: string): string {
  const raw = String(urlOrEmail || '').trim().toLowerCase();
  if (!raw) return '';
  let host = '';
  if (raw.includes('@')) {
    host = raw.split('@').pop() || '';
  } else {
    try {
      const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      host = new URL(withProto).hostname.toLowerCase();
    } catch {
      return '';
    }
  }
  host = host.replace(/^www\./, '');
  const parts = host.split('.').filter(Boolean);
  if (parts.length >= 3 && ['go', 'or', 'ac', 'co', 're', 'pe', 'kr'].includes(parts[parts.length - 2])) {
    return parts.slice(-3).join('.');
  }
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return host;
}

/**
 * 입력/선정된 행사 주소 문자열에서 광역시·도 및 시·군·구 행정구역과 법정동 코드를 자동 분류
 */
function classifyAddressToRegionAndCode(
  address: string,
  registry: AdminPromoRegistryData | null
): AutoClassifiedGeo {
  const cleanAddr = String(address || '').trim();
  const muniList = registry?.municipalities
    ? Object.values(registry.municipalities)
    : [];

  // 1) 시·도 감지
  let detectedRegionId: string | null = null;
  for (const rule of SIDO_ALIAS_TO_REGION_ID) {
    if (rule.re.test(cleanAddr)) {
      detectedRegionId = rule.regionId;
      break;
    }
  }
  if (!detectedRegionId) {
    for (const reg of ADMIN_REGIONS) {
      if (cleanAddr.includes(reg.name) || cleanAddr.startsWith(reg.shortName)) {
        detectedRegionId = reg.id;
        break;
      }
    }
  }

  // 세종특별자치시 단일 행정구역 처리
  if (detectedRegionId === 'sejong' || cleanAddr.includes('세종특별자치시') || cleanAddr.startsWith('세종시')) {
    const sejongReg = REGION_BY_ID['sejong'];
    return {
      matched: true,
      regionId: 'sejong',
      regionName: sejongReg.name,
      lDongRegnCd: sejongReg.lDongRegnCd,
      sigunguName: '세종시',
      lDongSignguCd: '110',
    };
  }

  // 2) registry의 250개 시·군·구와 대조
  const candidateMunis = detectedRegionId
    ? muniList.filter((m) => m.regionId === detectedRegionId)
    : muniList;

  // 이름이 긴 시·군·구(예: '창원시 의창구', '수원시 영통구')부터 우선 매칭
  const sortedCandidates = [...candidateMunis].sort(
    (a, b) => b.name.length - a.name.length
  );

  for (const m of sortedCandidates) {
    const tokens = m.name.split(/\s+/).filter(Boolean);
    const fullMatch = cleanAddr.includes(m.name);
    const firstTokenMatch =
      tokens.length >= 1 && tokens[0].length >= 2 && cleanAddr.includes(tokens[0]);
    if (fullMatch || firstTokenMatch) {
      const regObj = REGION_BY_ID[m.regionId] || REGION_BY_ID['seoul'];
      return {
        matched: true,
        regionId: m.regionId,
        regionName: regObj.name,
        lDongRegnCd: m.lDongRegnCd,
        sigunguName: m.name,
        lDongSignguCd: m.lDongSignguCd,
      };
    }
  }

  // 3) 내장 폴백 시·군·구 매칭
  const fallbackPool = detectedRegionId
    ? BUILTIN_SIGUNGU_FALLBACKS.filter((f) => f.regionId === detectedRegionId)
    : BUILTIN_SIGUNGU_FALLBACKS;

  for (const fb of fallbackPool) {
    if (cleanAddr.includes(fb.sigunguName)) {
      const regObj = REGION_BY_ID[fb.regionId] || REGION_BY_ID['seoul'];
      return {
        matched: true,
        regionId: fb.regionId,
        regionName: regObj.name,
        lDongRegnCd: fb.lDongRegnCd,
        sigunguName: fb.sigunguName,
        lDongSignguCd: fb.lDongSignguCd,
      };
    }
  }

  // 4) 시·도만 매칭되고 시·군·구는 주소에서 추출 가능한 경우 (예: OO시 / OO군 / OO구)
  if (detectedRegionId) {
    const regObj = REGION_BY_ID[detectedRegionId] || REGION_BY_ID['seoul'];
    const sggMatch = cleanAddr.match(/([가-힣]{1,6}(?:시|군|구))\b/);
    const firstMuniInRegion = candidateMunis[0];
    return {
      matched: true,
      regionId: regObj.id,
      regionName: regObj.name,
      lDongRegnCd: regObj.lDongRegnCd,
      sigunguName: sggMatch ? sggMatch[1] : firstMuniInRegion?.name || `${regObj.shortName} 본청`,
      lDongSignguCd: firstMuniInRegion?.lDongSignguCd || '110',
    };
  }

  const defaultReg = REGION_BY_ID['seoul'];
  return {
    matched: false,
    regionId: 'seoul',
    regionName: defaultReg.name,
    lDongRegnCd: defaultReg.lDongRegnCd,
    sigunguName: '송파구',
    lDongSignguCd: '710',
  };
}

export const EventRegistrationView: React.FC<EventRegistrationViewProps> = ({
  registry,
  onRegisterEventDoc,
}) => {
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // 1. 사전 안내 필수 동의 3개 항목
  const [agreeTwoChannelNotice, setAgreeTwoChannelNotice] = useState(false);
  const [agreeMunicipalUpgradeNotice, setAgreeMunicipalUpgradeNotice] = useState(false);
  const [agreePastEventPressNotice, setAgreePastEventPressNotice] = useState(false);

  const allPreNoticesAgreed =
    agreeTwoChannelNotice &&
    agreeMunicipalUpgradeNotice &&
    agreePastEventPressNotice;

  const handleToggleAgreeAll = () => {
    const next = !allPreNoticesAgreed;
    setAgreeTwoChannelNotice(next);
    setAgreeMunicipalUpgradeNotice(next);
    setAgreePastEventPressNotice(next);
  };

  // 2. 행사 기본 정보 및 주소 (주소 선정 시 지역·지역코드 자동 분류)
  const [addr1, setAddr1] = useState(
    '부산광역시 동래구 종합운동장로 29 사직실내수영장'
  );
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [scheduleNote, setScheduleNote] = useState('');
  const [eventTime, setEventTime] = useState('09:00 ~ 18:00');
  const [host, setHost] = useState('');
  const [supervise, setSupervise] = useState('');
  const [category2, setCategory2] = useState<'MUNICIPAL' | 'EV01' | 'EV02' | 'EV03'>(
    'EV01'
  );
  const [category3, setCategory3] = useState('EV010100');
  const [invitation, setInvitation] = useState('');

  // 3. 행사 규모 선택 (기본 0=동네/일반, 1~3=지자체 이상급 격상)
  const [promoLevel, setPromoLevel] = useState<PromoLevel>(0);

  // 4. 지자체 이상급 격상 시 필수: 지자체 도메인 홍보사이트 + 동일 도메인 메일 인증
  const [municipalPromoUrl, setMunicipalPromoUrl] = useState('');
  const [municipalOfficialEmail, setMunicipalOfficialEmail] = useState('');
  const [municipalMailCodeSent, setMunicipalMailCodeSent] = useState(false);
  const [municipalMailCodeInput, setMunicipalMailCodeInput] = useState('');
  const [municipalDomainVerified, setMunicipalDomainVerified] = useState(false);

  // 5. 예정/진행 행사: 담당자 연락처 2채널 인증 (채널 1: 휴대전화/연락처, 채널 2: 담당자 이메일)
  const [contactPhone, setContactPhone] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCodeInput, setPhoneCodeInput] = useState('');
  const [phoneChannelVerified, setPhoneChannelVerified] = useState(false);

  const [contactEmail, setContactEmail] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeInput, setEmailCodeInput] = useState('');
  const [emailChannelVerified, setEmailChannelVerified] = useState(false);

  // 6. 지난 행사: 담당자 인증 면제 + 확인 가능한 언론 노출(뉴스 보도 기사 URL) 필수
  const [pressOutletName, setPressOutletName] = useState('');
  const [pressArticleUrl, setPressArticleUrl] = useState('');
  const [pressUrlVerified, setPressUrlVerified] = useState(false);

  // 7. 홍보 링크 목록
  const [links, setLinks] = useState<FirestorePromoLink[]>([
    {
      type: 'OFFICIAL',
      label: '행사 공식 안내 페이지',
      url: 'https://',
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [registeredResult, setRegisteredResult] = useState<{
    id: string;
    title: string;
    regionLabel: string;
    isPast: boolean;
  } | null>(null);

  // 주소 기반 지역·지역코드 실시간 자동 분류
  const classifiedGeo = useMemo(
    () => classifyAddressToRegionAndCode(addr1, registry),
    [addr1, registry]
  );

  // 지난 행사 여부 판별 (종료일이 오늘보다 과거인 경우)
  const isPastEvent = useMemo(() => {
    if (!endDate) return false;
    return endDate < todayStr;
  }, [endDate, todayStr]);

  // 지자체 이상급 규모(1: 시군구, 2: 광역시도, 3: 전국) 선택 여부
  const isMunicipalOrHigherScope = promoLevel >= 1;

  // 지자체 홍보사이트 도메인과 공식 이메일 도메인 일치 검증
  const domainMatchStatus = useMemo(() => {
    if (!isMunicipalOrHigherScope) {
      return { valid: true, siteDomain: '', emailDomain: '', message: '' };
    }
    const siteDomain = extractRegistrableDomain(municipalPromoUrl);
    const emailDomain = extractRegistrableDomain(municipalOfficialEmail);
    if (!siteDomain || !emailDomain) {
      return {
        valid: false,
        siteDomain,
        emailDomain,
        message: '지자체 홍보사이트 URL과 공식 이메일(@도메인)을 모두 입력해주세요.',
      };
    }
    const isGovOrOfficial =
      /\.(go\.kr|or\.kr|kr|org|net|com)$/i.test(siteDomain) &&
      siteDomain === emailDomain;
    if (!isGovOrOfficial) {
      return {
        valid: false,
        siteDomain,
        emailDomain,
        message: `도메인 불일치: 홍보사이트(${siteDomain})와 이메일(@${emailDomain})의 도메인이 동일해야 합니다.`,
      };
    }
    return {
      valid: true,
      siteDomain,
      emailDomain,
      message: `도메인 일치 확인됨 (${siteDomain}) — 메일 인증을 완료해주세요.`,
    };
  }, [isMunicipalOrHigherScope, municipalPromoUrl, municipalOfficialEmail]);

  const subList = useMemo(
    () => Object.values(SUB_CATEGORIES).filter((s) => s.parentCode === category2),
    [category2]
  );

  // 카카오(다음) 우편번호·도로명주소 검색 팝업 호출
  const handleOpenAddressFinder = () => {
    const openWidget = () => {
      if (!window.daum?.Postcode) return;
      new window.daum.Postcode({
        oncomplete: (data) => {
          const picked =
            data.roadAddress ||
            data.jibunAddress ||
            data.address ||
            `${data.sido || ''} ${data.sigungu || ''}`.trim();
          if (picked) {
            setAddr1(picked);
          }
        },
      }).open();
    };

    if (window.daum?.Postcode) {
      openWidget();
      return;
    }

    const script = document.createElement('script');
    script.src =
      'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    script.onload = () => openWidget();
    document.head.appendChild(script);
  };

  // 언론 노출 기사 URL 유효성 검증 (지난 행사 전용)
  const handleVerifyPressUrl = () => {
    const trimmed = pressArticleUrl.trim();
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(trimmed)) {
      setPressUrlVerified(false);
      return;
    }
    setPressUrlVerified(true);
  };

  const handleAddLink = () => {
    setLinks((prev) => [
      ...prev,
      { type: 'OFFICIAL', label: '추가 홍보·안내 링크', url: 'https://' },
    ]);
  };

  const handleRemoveLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateLink = (
    idx: number,
    key: keyof FirestorePromoLink,
    val: string
  ) => {
    setLinks((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it))
    );
  };

  // 제출 가능 여부 종합 검증
  const canSubmit = useMemo(() => {
    if (!allPreNoticesAgreed) return false;
    if (!title.trim() || !addr1.trim() || !classifiedGeo.matched) return false;
    if (!startDate || !endDate) return false;

    // 1) 지난 행사: 확인 가능한 언론 노출 필수 (담당자 2채널 인증 면제)
    if (isPastEvent) {
      if (!pressUrlVerified || !pressArticleUrl.trim()) return false;
    } else {
      // 2) 예정/진행 행사: 담당자 연락처 등 2채널 인증 완료 필수
      if (!phoneChannelVerified || !emailChannelVerified) return false;
    }

    // 3) 지자체 이상급 규모 격상 시: 지자체 도메인 홍보사이트 + 동일 도메인 메일 인증 필수
    if (isMunicipalOrHigherScope) {
      if (!domainMatchStatus.valid || !municipalDomainVerified) return false;
    }

    return true;
  }, [
    allPreNoticesAgreed,
    title,
    addr1,
    classifiedGeo.matched,
    startDate,
    endDate,
    isPastEvent,
    pressUrlVerified,
    pressArticleUrl,
    phoneChannelVerified,
    emailChannelVerified,
    isMunicipalOrHigherScope,
    domainMatchStatus.valid,
    municipalDomainVerified,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);

    const docId = `user-reg-${classifiedGeo.lDongRegnCd}-${classifiedGeo.lDongSignguCd}-${Date.now()}`;
    const validLinks: FirestorePromoLink[] = links.filter(
      (l) => l.url.trim().length > 8
    );

    if (isMunicipalOrHigherScope && municipalPromoUrl.trim()) {
      const promoType: PromoLinkType =
        promoLevel >= 2 ? 'TIER1_PROMO' : 'TIER2_PROMO';
      if (!validLinks.some((l) => l.url === municipalPromoUrl.trim())) {
        validLinks.unshift({
          type: promoType,
          label: `${classifiedGeo.sigunguName} 지자체 공식 홍보사이트`,
          url: municipalPromoUrl.trim(),
        });
      }
    }

    if (isPastEvent && pressArticleUrl.trim()) {
      validLinks.push({
        type: 'OFFICIAL',
        label: `언론 보도 확인 (${pressOutletName.trim() || '보도자료/뉴스'})`,
        url: pressArticleUrl.trim(),
      });
    }

    const newDoc: FirestoreEventDoc = {
      id: docId,
      lDongRegnCd: classifiedGeo.lDongRegnCd,
      lDongSignguCd: classifiedGeo.lDongSignguCd,
      sigunguName: classifiedGeo.sigunguName,
      title: title.trim(),
      eventDate: {
        startDate: startDate.replace(/-/g, ''),
        endDate: endDate.replace(/-/g, ''),
        scheduleNote: scheduleNote.trim() || undefined,
      },
      eventTime: eventTime.trim() || '09:00 ~ 18:00',
      organizer: {
        host:
          host.trim() ||
          `${classifiedGeo.regionName} ${classifiedGeo.sigunguName}`,
        supervise: supervise.trim() || undefined,
        contact: isPastEvent
          ? `지난 행사 언론노출 검증 (${pressOutletName.trim() || '언론보도'})`
          : contactPhone.trim() || undefined,
      },
      category: {
        lclsSystm2: category2,
        lclsSystm3: category3,
        label: `${getMajorCategoryName(category2)} > ${getSubCategoryName(category3)}`,
      },
      links: validLinks,
      invitation:
        invitation.trim() ||
        `[${classifiedGeo.regionName} ${classifiedGeo.sigunguName}] ${title.trim()} 안내입니다.`,
      promoLevel,
      addr1: addr1.trim(),
      manualEdited: true,
      updatedAt: new Date().toISOString(),
      registrationMeta: {
        isPastEvent,
        twoChannelVerified: !isPastEvent
          ? phoneChannelVerified && emailChannelVerified
          : undefined,
        contactPhone: !isPastEvent ? contactPhone.trim() : undefined,
        contactEmail: !isPastEvent ? contactEmail.trim() : undefined,
        pressVerifyUrl: isPastEvent ? pressArticleUrl.trim() : undefined,
        pressOutletName: isPastEvent ? pressOutletName.trim() : undefined,
        municipalDomainSiteUrl: isMunicipalOrHigherScope
          ? municipalPromoUrl.trim()
          : undefined,
        municipalDomainEmail: isMunicipalOrHigherScope
          ? municipalOfficialEmail.trim()
          : undefined,
        municipalDomainVerified: isMunicipalOrHigherScope
          ? municipalDomainVerified
          : undefined,
        agreedPreNoticeAt: new Date().toISOString(),
      },
    };

    await onRegisterEventDoc(newDoc);
    setSaving(false);
    setRegisteredResult({
      id: docId,
      title: newDoc.title,
      regionLabel: `${classifiedGeo.regionName} (${classifiedGeo.lDongRegnCd}) > ${classifiedGeo.sigunguName} (${classifiedGeo.lDongSignguCd})`,
      isPast: isPastEvent,
    });
    setTitle('');
  };

  return (
    <div className={styles.page}>
      {/* 상단 배너: 누구나 등록 가능 + 주소 기반 지역·코드 자동 분류 안내 */}
      <div className={styles.heroBanner}>
        <div className={styles.heroLeft}>
          <div className={styles.heroBadgeRow}>
            <span className={styles.openToAllBadge}>
              <Sparkles size={13} />
              누구나 행사 등록 가능
            </span>
            <span className={styles.autoGeoBadge}>
              <MapPin size={13} />
              주소 선정 시 지역 · 법정동 코드 자동 분류
            </span>
          </div>
          <h2 className={styles.heroTitle}>대한민국 행사 등록 센터</h2>
          <p className={styles.heroDesc}>
            전국 지자체·연맹·동호회·지역 축제를 누구나 등록할 수 있습니다. 아래 사전
            안내 사항에 동의하신 후 행사 주소를 선정하면 광역시·도 및 시·군·구 코드가
            자동으로 분류됩니다.
          </p>
        </div>
      </div>

      {registeredResult && (
        <div className={styles.successBanner}>
          <div>
            ✅ <strong>'{registeredResult.title}'</strong> 행사가 성공적으로
            등록되었습니다! (자동 분류: {registeredResult.regionLabel} ·{' '}
            {registeredResult.isPast
              ? '지난 행사 언론 노출 검증 완료'
              : '담당자 2채널 인증 완료'}
            )
          </div>
          <button
            type="button"
            className={styles.verifyActionBtn}
            onClick={() => setRegisteredResult(null)}
          >
            확인
          </button>
        </div>
      )}

      {/* STEP 1. 사전 안내 및 필수 동의 */}
      <section className={styles.card} aria-label="등록 전 사전안내 및 필수 동의">
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleWrap}>
            <span className={styles.stepBadge}>STEP 1</span>
            <h3 className={styles.cardTitle}>
              등록 전 사전 안내 및 필수 동의 (필수)
            </h3>
          </div>
          <button
            type="button"
            className={`${styles.agreeAllBtn} ${
              allPreNoticesAgreed ? styles.agreeAllBtnActive : ''
            }`}
            onClick={handleToggleAgreeAll}
          >
            <CheckCircle2 size={15} />
            <span>사전 안내 3건 전체 동의</span>
          </button>
        </div>

        <div className={styles.noticeList}>
          <label
            className={`${styles.noticeItem} ${
              agreeTwoChannelNotice ? styles.noticeItemChecked : ''
            }`}
          >
            <input
              type="checkbox"
              className={styles.noticeCheckbox}
              checked={agreeTwoChannelNotice}
              onChange={(e) => setAgreeTwoChannelNotice(e.target.checked)}
            />
            <div className={styles.noticeContent}>
              <div className={styles.noticeTitleRow}>
                <span className={styles.requiredTag}>필수 동의 1</span>
                <span className={styles.noticeHeadline}>
                  담당자 연락처 등 2채널 인증 후 서버 노출 안내
                </span>
              </div>
              <p className={styles.noticeSub}>
                신규·예정 행사는 허위 등록 방지를 위해 담당자 연락처(휴대전화 SMS 및
                보조 이메일/기관 연락처)로 <strong>2채널 인증이 완료된 후에야 서버(지도·달력·리스트)에 정식 노출</strong>됨을 확인하고 동의합니다.
              </p>
            </div>
          </label>

          <label
            className={`${styles.noticeItem} ${
              agreeMunicipalUpgradeNotice ? styles.noticeItemChecked : ''
            }`}
          >
            <input
              type="checkbox"
              className={styles.noticeCheckbox}
              checked={agreeMunicipalUpgradeNotice}
              onChange={(e) => setAgreeMunicipalUpgradeNotice(e.target.checked)}
            />
            <div className={styles.noticeContent}>
              <div className={styles.noticeTitleRow}>
                <span className={styles.requiredTag}>필수 동의 2</span>
                <span className={styles.noticeHeadline}>
                  지자체 이상급 행사규모 격상 시 도메인 및 동일 도메인 메일 인증 안내
                </span>
              </div>
              <p className={styles.noticeSub}>
                행사 규모를 <strong>지자체 이상급(시·군·구 / 광역시·도 / 전국)으로 격상하려면 지자체 공식 도메인의 홍보사이트와, 해당 사이트와 동일한 도메인의 메일 인증</strong>이 반드시 있어야 함을 확인하고 동의합니다.
              </p>
            </div>
          </label>

          <label
            className={`${styles.noticeItem} ${
              agreePastEventPressNotice ? styles.noticeItemChecked : ''
            }`}
          >
            <input
              type="checkbox"
              className={styles.noticeCheckbox}
              checked={agreePastEventPressNotice}
              onChange={(e) => setAgreePastEventPressNotice(e.target.checked)}
            />
            <div className={styles.noticeContent}>
              <div className={styles.noticeTitleRow}>
                <span className={styles.requiredTag}>필수 동의 3</span>
                <span className={styles.noticeHeadline}>
                  지난 행사 등록 시 담당자 인증 면제 및 언론 노출 필수 안내
                </span>
              </div>
              <p className={styles.noticeSub}>
                이미 종료된 <strong>지난 행사에 대하여도 등록이 가능하며, 이때는 담당자 인증은 필요 없지만 실제 개최를 확인할 수 있는 언론 노출(뉴스 보도 기사 링크 등)</strong>이 있어야만 등록 가능함을 확인하고 동의합니다.
              </p>
            </div>
          </label>
        </div>
      </section>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* STEP 2. 행사 주소 선정 및 지역·지역코드 자동 분류 */}
        <section className={styles.card} aria-label="행사 주소 선정 및 지역 자동 분류">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <span className={styles.stepBadge}>STEP 2</span>
              <h3 className={styles.cardTitle}>
                행사 주소 선정 (지역 및 법정동 지역코드 자동 분류)
              </h3>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <MapPin size={14} color="#2563eb" />
              <span>행사 개최 주소 (도로명 또는 지번 주소 선정)</span>
            </label>
            <div className={styles.addressSearchRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="주소 검색 버튼을 누르거나 도로명/지번 주소를 입력하세요 (예: 부산광역시 동래구 종합운동장로 29)"
                value={addr1}
                onChange={(e) => setAddr1(e.target.value)}
                required
              />
              <button
                type="button"
                className={styles.addressSearchBtn}
                onClick={handleOpenAddressFinder}
              >
                <Search size={14} />
                <span>주소 검색</span>
              </button>
            </div>

            <div className={styles.sampleAddrRow}>
              <span className={styles.sampleAddrLabel}>빠른 주소 예시 클릭:</span>
              {SAMPLE_ADDRESSES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  className={styles.sampleChip}
                  onClick={() => setAddr1(sample)}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* 주소 선정 결과 자동 분류된 지역 및 법정동 코드 표시 */}
          <div className={styles.autoClassificationBox}>
            <div className={styles.autoClassLeft}>
              <span className={styles.autoClassStatus}>
                {classifiedGeo.matched ? '자동 분류 완료' : '주소 입력 대기'}
              </span>
              <span className={styles.autoClassDetail}>
                {classifiedGeo.regionName} &gt; {classifiedGeo.sigunguName}
              </span>
            </div>

            <div className={styles.codePillGroup}>
              <span className={styles.codePill}>
                시·도 코드(lDongRegnCd): {classifiedGeo.lDongRegnCd}
              </span>
              <span className={styles.codePill}>
                시·군·구 코드(lDongSignguCd): {classifiedGeo.lDongSignguCd}
              </span>
            </div>
          </div>
        </section>

        {/* STEP 3. 행사 기본 정보 및 일정 */}
        <section className={styles.card} aria-label="행사 기본 정보">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <span className={styles.stepBadge}>STEP 3</span>
              <h3 className={styles.cardTitle}>행사 기본 정보 및 일정</h3>
            </div>
          </div>

          <div className={styles.formGrid2}>
            <div className={styles.field}>
              <label className={styles.label}>행사명</label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 2026 제5회 동래구민 건강 생활체육 대회"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>행사 운영 시각</label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 09:00 ~ 18:00"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formGrid3}>
            <div className={styles.field}>
              <label className={styles.label}>행사 시작일</label>
              <input
                type="date"
                className={styles.input}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>행사 종료일</label>
              <input
                type="date"
                className={styles.input}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>일정 비고 / 참가 정원 안내</label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 우천 시 순연 / 선착순 500명"
                value={scheduleNote}
                onChange={(e) => setScheduleNote(e.target.value)}
              />
            </div>
          </div>

          {/* 종료일 기준 자동 감지된 등록 모드 안내 */}
          {isPastEvent ? (
            <div className={styles.modeBannerPast}>
              <span>
                🕰️ <strong>[지난 행사 아카이브 등록 모드]</strong> 행사 종료일({endDate})이
                오늘({todayStr}) 이전이므로 <strong>담당자 2채널 인증은 면제</strong>되며,
                하단에서 <strong>확인 가능한 언론 노출(뉴스 기사 링크)</strong>을 입력해야 합니다.
              </span>
            </div>
          ) : (
            <div className={styles.modeBannerUpcoming}>
              <span>
                📅 <strong>[신규·예정 행사 등록 모드]</strong> 행사 종료일({endDate})이
                오늘 이후이므로 하단에서 <strong>담당자 연락처 2채널 인증</strong>이 완료된 후
                서버에 노출됩니다.
              </span>
            </div>
          )}

          <div className={styles.formGrid2}>
            <div className={styles.field}>
              <label className={styles.label}>주최 기관/단체명</label>
              <input
                type="text"
                className={styles.input}
                placeholder={`예: ${classifiedGeo.sigunguName} 체육회 / 행사 조직위원회`}
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>주관 기관/담당 부서 (선택)</label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 문화체육과 / 대회 운영사무국"
                value={supervise}
                onChange={(e) => setSupervise(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formGrid2}>
            <div className={styles.field}>
              <label className={styles.label}>행사 대분류</label>
              <select
                className={styles.select}
                value={category2}
                onChange={(e) => {
                  const nextCat2 = e.target.value as
                    | 'MUNICIPAL'
                    | 'EV01'
                    | 'EV02'
                    | 'EV03';
                  setCategory2(nextCat2);
                  const firstSub = Object.values(SUB_CATEGORIES).find(
                    (s) => s.parentCode === nextCat2
                  );
                  if (firstSub) setCategory3(firstSub.code);
                }}
              >
                <option value="EV01">축제·문화 (EV01)</option>
                <option value="EV02">공연·예술 (EV02)</option>
                <option value="EV03">행사·전시·스포츠 (EV03)</option>
                <option value="MUNICIPAL">지자체 행정·홍보 (MUNICIPAL)</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>행사 소분류</label>
              <select
                className={styles.select}
                value={category3}
                onChange={(e) => setCategory3(e.target.value)}
              >
                {subList.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>행사 소개 및 초댓말 요약</label>
            <textarea
              className={styles.textarea}
              placeholder="행사 주요 프로그램, 참가 대상, 현장 안내 등을 요약해 주세요."
              value={invitation}
              onChange={(e) => setInvitation(e.target.value)}
            />
          </div>
        </section>

        {/* STEP 4. 행사 규모 설정 및 지자체 이상급 격상 인증 */}
        <section className={styles.card} aria-label="행사 규모 및 지자체 도메인 격상 인증">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <span className={styles.stepBadge}>STEP 4</span>
              <h3 className={styles.cardTitle}>
                행사 규모 설정 (지자체 이상급 격상 시 도메인·동일 메일 인증)
              </h3>
            </div>
          </div>

          <div className={styles.scopeCardsGrid}>
            {(
              [
                {
                  level: 0 as PromoLevel,
                  title: '동네 · 일반 행사',
                  sub: '기본 규모 (별도 지자체 도메인 불필요)',
                },
                {
                  level: 1 as PromoLevel,
                  title: '시·군·구 지자체급',
                  sub: '기초지자체 도메인 + 동일 메일 인증 필수',
                },
                {
                  level: 2 as PromoLevel,
                  title: '광역시·도급',
                  sub: '광역지자체 도메인 + 동일 메일 인증 필수',
                },
                {
                  level: 3 as PromoLevel,
                  title: '전국 · 중앙연맹급',
                  sub: '정부/중앙연맹 도메인 + 동일 메일 인증 필수',
                },
              ] as const
            ).map((item) => {
              const active = promoLevel === item.level;
              return (
                <button
                  key={item.level}
                  type="button"
                  className={`${styles.scopeCardBtn} ${
                    active ? styles.scopeCardBtnActive : ''
                  }`}
                  onClick={() => {
                    setPromoLevel(item.level);
                    setMunicipalDomainVerified(false);
                  }}
                >
                  <div className={styles.scopeCardTop}>
                    <span className={styles.scopeCardTitle}>{item.title}</span>
                    {active && <CheckCircle2 size={15} color="#2563eb" />}
                  </div>
                  <span className={styles.scopeCardSub}>{item.sub}</span>
                </button>
              );
            })}
          </div>

          {isMunicipalOrHigherScope && (
            <div className={styles.upgradeVerifyPanel}>
              <h4 className={styles.upgradeTitle}>
                <ShieldCheck size={16} />
                지자체 이상급 규모 격상 필수 인증 (지자체 도메인 홍보사이트 + 동일 도메인 메일 인증)
              </h4>

              <div className={styles.formGrid2}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    1) 지자체/공식 기관 도메인 홍보사이트 URL
                  </label>
                  <input
                    type="url"
                    className={styles.input}
                    placeholder="예: https://www.jinju.go.kr/02793/02258.web"
                    value={municipalPromoUrl}
                    onChange={(e) => {
                      setMunicipalPromoUrl(e.target.value);
                      setMunicipalDomainVerified(false);
                    }}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    2) 홍보사이트와 동일한 도메인의 공식 이메일
                  </label>
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="예: culture@jinju.go.kr"
                    value={municipalOfficialEmail}
                    onChange={(e) => {
                      setMunicipalOfficialEmail(e.target.value);
                      setMunicipalDomainVerified(false);
                    }}
                  />
                </div>
              </div>

              <div
                className={`${styles.domainMatchHint} ${
                  domainMatchStatus.valid
                    ? styles.domainMatchOk
                    : styles.domainMatchErr
                }`}
              >
                {domainMatchStatus.message}
              </div>

              <div className={styles.verifyRow}>
                <button
                  type="button"
                  className={styles.verifyActionBtn}
                  disabled={!domainMatchStatus.valid}
                  onClick={() => {
                    setMunicipalMailCodeSent(true);
                    setMunicipalMailCodeInput('202611');
                  }}
                >
                  <Mail size={13} />
                  <span>동일 도메인 인증메일 발송</span>
                </button>

                {municipalMailCodeSent && (
                  <>
                    <input
                      type="text"
                      className={styles.input}
                      style={{ width: 150 }}
                      placeholder="인증코드 6자리"
                      value={municipalMailCodeInput}
                      onChange={(e) => setMunicipalMailCodeInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.verifyActionBtn}
                      disabled={municipalMailCodeInput.trim().length < 4}
                      onClick={() => setMunicipalDomainVerified(true)}
                    >
                      인증 확인
                    </button>
                  </>
                )}

                {municipalDomainVerified && (
                  <span className={styles.verifiedPill}>
                    <CheckCircle2 size={13} />
                    지자체 도메인·메일 일치 인증 완료
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* STEP 5. 노출 자격 검증: (신규/예정 행사 = 담당자 2채널 인증) vs (지난 행사 = 언론 노출 검증) */}
        <section className={styles.card} aria-label="노출 자격 인증">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <span className={styles.stepBadge}>STEP 5</span>
              <h3 className={styles.cardTitle}>
                {isPastEvent
                  ? '지난 행사 사실 확인 — 언론 노출(보도자료/뉴스 기사) 검증 (담당자 인증 면제)'
                  : '서버 노출을 위한 담당자 연락처 2채널 인증 (필수)'}
              </h3>
            </div>
          </div>

          {isPastEvent ? (
            <div
              className={`${styles.verifyChannelBox} ${
                pressUrlVerified ? styles.verifyChannelBoxDone : ''
              }`}
            >
              <div className={styles.formGrid2}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <Newspaper size={14} color="#2563eb" />
                    <span>보도 언론사명 / 매체명</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="예: 연합뉴스, 부산일보, KBS, 지역신문 등"
                    value={pressOutletName}
                    onChange={(e) => setPressOutletName(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    <ExternalLink size={14} color="#2563eb" />
                    <span>확인 가능한 언론 노출(뉴스 기사) URL (필수)</span>
                  </label>
                  <div className={styles.verifyRow}>
                    <input
                      type="url"
                      className={styles.input}
                      style={{ flex: 1 }}
                      placeholder="https://news.naver.com/... 또는 언론사 기사 원문 URL"
                      value={pressArticleUrl}
                      onChange={(e) => {
                        setPressArticleUrl(e.target.value);
                        setPressUrlVerified(false);
                      }}
                    />
                    <button
                      type="button"
                      className={styles.verifyActionBtn}
                      onClick={handleVerifyPressUrl}
                    >
                      언론 노출 확인
                    </button>
                  </div>
                </div>
              </div>

              {pressUrlVerified && (
                <div>
                  <span className={styles.verifiedPill}>
                    <CheckCircle2 size={13} />
                    언론 노출 링크 확인 완료 (담당자 2채널 인증 면제 대상)
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.formGrid2}>
              {/* 채널 1: 담당자 전화번호/휴대전화 인증 */}
              <div
                className={`${styles.verifyChannelBox} ${
                  phoneChannelVerified ? styles.verifyChannelBoxDone : ''
                }`}
              >
                <label className={styles.label}>
                  <Phone size={14} color="#2563eb" />
                  <span>[1채널] 담당자 연락처 (휴대전화 / 직통번호) 인증</span>
                </label>
                <div className={styles.verifyRow}>
                  <input
                    type="tel"
                    className={styles.input}
                    style={{ flex: 1 }}
                    placeholder="예: 010-1234-5678"
                    value={contactPhone}
                    onChange={(e) => {
                      setContactPhone(e.target.value);
                      setPhoneChannelVerified(false);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.verifyActionBtn}
                    disabled={contactPhone.trim().length < 8}
                    onClick={() => {
                      setPhoneCodeSent(true);
                      setPhoneCodeInput('158801');
                    }}
                  >
                    인증번호 발송
                  </button>
                </div>

                {phoneCodeSent && (
                  <div className={styles.verifyRow}>
                    <input
                      type="text"
                      className={styles.input}
                      style={{ width: 130 }}
                      placeholder="6자리 코드"
                      value={phoneCodeInput}
                      onChange={(e) => setPhoneCodeInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.verifyActionBtn}
                      disabled={phoneCodeInput.trim().length < 4}
                      onClick={() => setPhoneChannelVerified(true)}
                    >
                      1채널 인증 확인
                    </button>
                    {phoneChannelVerified && (
                      <span className={styles.verifiedPill}>
                        <CheckCircle2 size={13} />
                        1채널 완료
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 채널 2: 담당자 보조 채널(이메일) 인증 */}
              <div
                className={`${styles.verifyChannelBox} ${
                  emailChannelVerified ? styles.verifyChannelBoxDone : ''
                }`}
              >
                <label className={styles.label}>
                  <Mail size={14} color="#2563eb" />
                  <span>[2채널] 담당자 이메일 보조 채널 인증</span>
                </label>
                <div className={styles.verifyRow}>
                  <input
                    type="email"
                    className={styles.input}
                    style={{ flex: 1 }}
                    placeholder="예: manager@example.or.kr"
                    value={contactEmail}
                    onChange={(e) => {
                      setContactEmail(e.target.value);
                      setEmailChannelVerified(false);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.verifyActionBtn}
                    disabled={!contactEmail.includes('@')}
                    onClick={() => {
                      setEmailCodeSent(true);
                      setEmailCodeInput('794210');
                    }}
                  >
                    인증코드 발송
                  </button>
                </div>

                {emailCodeSent && (
                  <div className={styles.verifyRow}>
                    <input
                      type="text"
                      className={styles.input}
                      style={{ width: 130 }}
                      placeholder="6자리 코드"
                      value={emailCodeInput}
                      onChange={(e) => setEmailCodeInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.verifyActionBtn}
                      disabled={emailCodeInput.trim().length < 4}
                      onClick={() => setEmailChannelVerified(true)}
                    >
                      2채널 인증 확인
                    </button>
                    {emailChannelVerified && (
                      <span className={styles.verifiedPill}>
                        <CheckCircle2 size={13} />
                        2채널 완료
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 부가 홍보 링크 */}
          <div className={styles.field} style={{ marginTop: 4 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <label className={styles.label}>홍보 및 안내 링크 (선택/추가)</label>
              <button
                type="button"
                className={styles.verifyActionBtn}
                onClick={handleAddLink}
              >
                <Plus size={13} />
                <span>링크 추가</span>
              </button>
            </div>
            <div className={styles.linksList}>
              {links.map((lnk, idx) => (
                <div key={idx} className={styles.linkItemRow}>
                  <input
                    type="text"
                    className={styles.input}
                    style={{ width: 200 }}
                    placeholder="링크 제목"
                    value={lnk.label}
                    onChange={(e) => handleUpdateLink(idx, 'label', e.target.value)}
                  />
                  <input
                    type="url"
                    className={styles.input}
                    style={{ flex: 1 }}
                    placeholder="https://..."
                    value={lnk.url}
                    onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                  />
                  {links.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeLinkBtn}
                      onClick={() => handleRemoveLink(idx)}
                      title="링크 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 하단 제출 바 */}
        <div className={styles.submitBar}>
          <div className={styles.submitCheckSummary}>
            <span>
              • 사전안내 동의:{' '}
              <strong>{allPreNoticesAgreed ? '완료' : '미완료 (STEP 1 동의 필요)'}</strong>
            </span>
            <span>
              • 주소 자동 분류:{' '}
              <strong>
                {classifiedGeo.regionName}({classifiedGeo.lDongRegnCd}) &gt;{' '}
                {classifiedGeo.sigunguName}({classifiedGeo.lDongSignguCd})
              </strong>
            </span>
            <span>
              • 노출 인증 상태:{' '}
              <strong>
                {isPastEvent
                  ? pressUrlVerified
                    ? '지난 행사 언론 노출 확인 완료'
                    : '지난 행사 언론 노출(뉴스 기사 URL) 확인 필요'
                  : phoneChannelVerified && emailChannelVerified
                  ? '담당자 2채널 인증 완료 (서버 즉시 노출)'
                  : '담당자 연락처 2채널 인증 필요'}
              </strong>
            </span>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!canSubmit || saving}
          >
            <ShieldCheck size={17} />
            <span>{saving ? '서버 등록 처리 중...' : '행사 정식 등록하기'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
