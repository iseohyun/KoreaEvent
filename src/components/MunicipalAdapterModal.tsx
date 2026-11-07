import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { ADMIN_REGIONS, REGION_BY_ID } from '../constants/regions';
import { getMajorCategoryName, getSubCategoryName, SUB_CATEGORIES } from '../constants/categories';
import { FirestoreEventDoc, FirestorePromoLink, PromoLinkType } from '../types/event';
import styles from './MunicipalAdapterModal.module.css';

interface MunicipalAdapterModalProps {
  open: boolean;
  defaultRegionId: string;
  onClose: () => void;
  onAddFirestoreDoc: (doc: FirestoreEventDoc) => Promise<boolean>;
}

export const MunicipalAdapterModal: React.FC<MunicipalAdapterModalProps> = ({
  open,
  defaultRegionId,
  onClose,
  onAddFirestoreDoc,
}) => {
  const initialRegion = defaultRegionId !== 'ALL' ? defaultRegionId : 'gyeongnam';
  const [regionId, setRegionId] = useState(initialRegion);
  const [sigunguName, setSigunguName] = useState('진주시');
  const [sigunguCode, setSigunguCode] = useState('170');
  const [portalContentId, setPortalContentId] = useState('');

  // 7대 핵심 필드
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('2026-11-07');
  const [endDate, setEndDate] = useState('2026-11-30');
  const [scheduleNote, setScheduleNote] = useState('주말 집중 프로그램 및 상설 부스 운영');
  const [eventTime, setEventTime] = useState('10:00 ~ 21:00');
  const [host, setHost] = useState('');
  const [supervise, setSupervise] = useState('');
  const [contact, setContact] = useState('');
  const [category2, setCategory2] = useState<'MUNICIPAL' | 'EV01' | 'EV02' | 'EV03'>('MUNICIPAL');
  const [category3, setCategory3] = useState('MU010300');
  const [links, setLinks] = useState<FirestorePromoLink[]>([
    {
      type: 'TIER2_PROMO',
      label: '시·군·구청 문화관광 홍보포털',
      url: 'https://www.jinju.go.kr/02793/02258.web',
    },
    {
      type: 'TIER1_PROMO',
      label: '광역 시·도 문화관광 홍보포털',
      url: 'https://tour.gyeongnam.go.kr',
    },
  ]);
  const [invitation, setInvitation] = useState('');
  const [addr1, setAddr1] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const regionObj = REGION_BY_ID[regionId] || REGION_BY_ID['seoul'];
  const subList = Object.values(SUB_CATEGORIES).filter((s) => s.parentCode === category2);

  const handleAddLink = () => {
    setLinks((prev) => [
      ...prev,
      { type: 'OFFICIAL', label: '행사 공식/사전예약 링크', url: 'https://' },
    ]);
  };

  const handleRemoveLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateLink = (idx: number, key: keyof FirestorePromoLink, val: string) => {
    setLinks((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const cleanPortalId = portalContentId.trim() || undefined;
    const docId = cleanPortalId
      ? `portal-${cleanPortalId}`
      : `muni-${regionObj.lDongRegnCd}-${sigunguCode.trim() || '000'}-${Date.now()}`;

    const newDoc: FirestoreEventDoc = {
      id: docId,
      portalContentId: cleanPortalId,
      lDongRegnCd: regionObj.lDongRegnCd,
      lDongSignguCd: sigunguCode.trim() || '000',
      sigunguName: sigunguName.trim() || '본청',
      title: title.trim(),
      eventDate: {
        startDate: startDate.replace(/-/g, ''),
        endDate: endDate.replace(/-/g, ''),
        scheduleNote: scheduleNote.trim() || undefined,
      },
      eventTime: eventTime.trim() || '상시 운영',
      organizer: {
        host: host.trim() || `${regionObj.name} ${sigunguName}청`,
        supervise: supervise.trim() || undefined,
        contact: contact.trim() || undefined,
      },
      category: {
        lclsSystm2: category2,
        lclsSystm3: category3,
        label: `${getMajorCategoryName(category2)} > ${getSubCategoryName(category3)}`,
      },
      links: links.filter((l) => l.url.trim().length > 4),
      invitation:
        invitation.trim() ||
        `${regionObj.name} ${sigunguName} 공식 홍보 홈페이지에 수록된 행사입니다.`,
      addr1: addr1.trim() || `${regionObj.name} ${sigunguName}`,
      updatedAt: new Date().toISOString(),
    };

    await onAddFirestoreDoc(newDoc);
    setSaving(false);
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            🔥 Firebase Firestore (`koreaeventlist`) 신규 행사 · 홍보 DB 등록
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* 필수 연결 키 1 & 2 */}
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>
                [연결키2] 시·도 법정동 코드 (lDongRegnCd)
              </label>
              <select
                className={styles.select}
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
              >
                {ADMIN_REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (코드: {r.lDongRegnCd})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                [연결키2] 시·군·구명 및 코드 (예: 진주시 / 170)
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  className={styles.input}
                  style={{ flex: 1 }}
                  value={sigunguName}
                  onChange={(e) => setSigunguName(e.target.value)}
                  placeholder="진주시"
                  required
                />
                <input
                  type="text"
                  className={styles.input}
                  style={{ width: 76 }}
                  value={sigunguCode}
                  onChange={(e) => setSigunguCode(e.target.value)}
                  placeholder="170"
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>
                1. 행사명 (title)
              </label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 2026 진주 남강 야간 유등산책 & 실크 마켓"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                [연결키1] 공공데이터포털 contentId (선택 · 입력 시 포털 정보와 자동 조합)
              </label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 4124907 (순수 지자체 행사는 비워둠)"
                value={portalContentId}
                onChange={(e) => setPortalContentId(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>2-1. 행사 시작일 (eventDate.startDate)</label>
              <input
                type="date"
                className={styles.input}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>2-2. 행사 종료일 (eventDate.endDate)</label>
              <input
                type="date"
                className={styles.input}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>2-3. 회차/요일 안내 (scheduleNote)</label>
              <input
                type="text"
                className={styles.input}
                value={scheduleNote}
                onChange={(e) => setScheduleNote(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>3. 행사시각 (eventTime)</label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 07:00 ~ 09:00"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>4-1. 주최기관 (organizer.host · 매칭 힌트)</label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 진주시청 문화관광국"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>4-2. 주관기관 / 문의처 (supervise / contact)</label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 경남문화예술진흥원 / 055-749-2114"
                value={supervise}
                onChange={(e) => {
                  setSupervise(e.target.value);
                  setContact(e.target.value);
                }}
              />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>5-1. 행사 중분류 (category.lclsSystm2)</label>
              <select
                className={styles.select}
                value={category2}
                onChange={(e) => {
                  const next = e.target.value as 'MUNICIPAL' | 'EV01' | 'EV02' | 'EV03';
                  setCategory2(next);
                  const firstSub = Object.values(SUB_CATEGORIES).find(
                    (s) => s.parentCode === next
                  );
                  if (firstSub) setCategory3(firstSub.code);
                }}
              >
                <option value="MUNICIPAL">지자체 행정·시민참여 (MUNICIPAL)</option>
                <option value="EV01">축제 (EV01)</option>
                <option value="EV02">공연 (EV02)</option>
                <option value="EV03">행사/전시 (EV03)</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>5-2. 행사 소분류 (category.lclsSystm3)</label>
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

          {/* 6. 1:N 다중 링크 배열 */}
          <div className={styles.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.label}>6. 링크 (1:N 다중 링크 배열 · links)</label>
              <button
                type="button"
                className={styles.cancelBtn}
                style={{ padding: '4px 9px', fontSize: '0.74rem' }}
                onClick={handleAddLink}
              >
                <Plus size={12} style={{ verticalAlign: 'middle' }} /> 1:N 링크 추가
              </button>
            </div>

            {links.map((lnk, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '115px 1fr 1.2fr auto',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <select
                  className={styles.select}
                  value={lnk.type}
                  onChange={(e) =>
                    handleUpdateLink(idx, 'type', e.target.value as PromoLinkType)
                  }
                >
                  <option value="TIER1_PROMO">1단계 광역홍보</option>
                  <option value="TIER2_PROMO">2단계 시군구홍보</option>
                  <option value="OFFICIAL">공식 홈페이지</option>
                  <option value="TICKET">사전예약/티켓</option>
                  <option value="SNS">공식 SNS</option>
                </select>
                <input
                  type="text"
                  className={styles.input}
                  value={lnk.label}
                  onChange={(e) => handleUpdateLink(idx, 'label', e.target.value)}
                  placeholder="링크 이름"
                />
                <input
                  type="text"
                  className={styles.input}
                  value={lnk.url}
                  onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  className={styles.cancelBtn}
                  style={{ padding: '6px 8px' }}
                  onClick={() => handleRemoveLink(idx)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* 7. 초댓말 */}
          <div className={styles.field}>
            <label className={styles.label}>
              7. 초댓말 (invitation · 지자체 홍보 페이지 기반 핵심 요약 및 초대 문구)
            </label>
            <textarea
              className={styles.textarea}
              placeholder="소비자에게 보여줄 정교한 행사 코스, 주요 출연진/프로그램, 교통통제 안내 및 초댓말을 작성하세요..."
              value={invitation}
              onChange={(e) => setInvitation(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>보조 개최 장소 주소 (포털 미등록 행사 시 표시)</label>
            <input
              type="text"
              className={styles.input}
              placeholder={`예: ${regionObj.name} ${sigunguName} 일원`}
              value={addr1}
              onChange={(e) => setAddr1(e.target.value)}
            />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              취소
            </button>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving
                ? 'Firebase Firestore에 저장 중...'
                : 'Firestore DB 저장 및 행정지도 즉시 반영'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
