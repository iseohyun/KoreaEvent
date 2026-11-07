import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ADMIN_REGIONS, REGION_BY_ID } from '../constants/regions';
import { SUB_CATEGORIES } from '../constants/categories';
import { MunicipalRawFeedItem } from '../services/municipalEventAdapter';
import styles from './MunicipalAdapterModal.module.css';

interface MunicipalAdapterModalProps {
  open: boolean;
  defaultRegionId: string;
  onClose: () => void;
  onAddEvent: (item: MunicipalRawFeedItem) => void;
}

export const MunicipalAdapterModal: React.FC<MunicipalAdapterModalProps> = ({
  open,
  defaultRegionId,
  onClose,
  onAddEvent,
}) => {
  const initialRegion = defaultRegionId !== 'ALL' ? defaultRegionId : 'seoul';
  const [regionId, setRegionId] = useState(initialRegion);
  const [sigunguName, setSigunguName] = useState('강남구');
  const [sigunguCode, setSigunguCode] = useState('680');
  const [title, setTitle] = useState('');
  const [category2, setCategory2] = useState<'MUNICIPAL' | 'EV01' | 'EV02' | 'EV03'>('MUNICIPAL');
  const [category3, setCategory3] = useState('MU010300');
  const [startDate, setStartDate] = useState('2026-11-07');
  const [endDate, setEndDate] = useState('2026-11-30');
  const [addr1, setAddr1] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [sourceOrgUrl, setSourceOrgUrl] = useState('');
  const [summary, setSummary] = useState('');

  if (!open) return null;

  const regionObj = REGION_BY_ID[regionId] || REGION_BY_ID['seoul'];
  const subList = Object.values(SUB_CATEGORIES).filter((s) => s.parentCode === category2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddEvent({
      regionId,
      sigunguCode: sigunguCode.trim() || '000',
      sigunguName: sigunguName.trim() || '본청',
      title: title.trim(),
      category2,
      category3,
      startDate: startDate.replace(/-/g, ''),
      endDate: endDate.replace(/-/g, ''),
      addr1: addr1.trim() || `${regionObj.name} ${sigunguName}`,
      organizer: organizer.trim() || `${regionObj.name} ${sigunguName}청`,
      sourceLabel: `${regionObj.shortName} ${sigunguName} 행정홈페이지`,
      sourceOrgUrl: sourceOrgUrl.trim() || regionObj.municipalPortalUrl,
      summary:
        summary.trim() ||
        `${regionObj.name} ${sigunguName} 행정 홈페이지에서 등록된 지역 문화·시민참여 행사입니다.`,
    });
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>지자체 행정 홈페이지 행사 수집·등록 어댑터</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>시·도 행정구역</label>
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
              <label className={styles.label}>시·군·구명 (예: 강남구, 수원시)</label>
              <input
                type="text"
                className={styles.input}
                value={sigunguName}
                onChange={(e) => setSigunguName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>행사명 (지자체 홈페이지 공고·새소식 제목)</label>
            <input
              type="text"
              className={styles.input}
              placeholder="예: [강남구청] 2026 구민과 함께하는 가을 플리마켓 & 음악회"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>중분류 체계</label>
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
              <label className={styles.label}>소분류 체계</label>
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

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>시작일</label>
              <input
                type="date"
                className={styles.input}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>종료일</label>
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
              <label className={styles.label}>개최 장소 주소</label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 서울특별시 강남구 학동로 426 구청 광장"
                value={addr1}
                onChange={(e) => setAddr1(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>주최 지자체/부서 또는 홈페이지 URL</label>
              <input
                type="text"
                className={styles.input}
                placeholder={regionObj.municipalPortalUrl}
                value={sourceOrgUrl}
                onChange={(e) => setSourceOrgUrl(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>행사 요약 설명</label>
            <textarea
              className={styles.textarea}
              placeholder="지자체 행정 홈페이지 행사 안내 본문 요약..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              취소
            </button>
            <button type="submit" className={styles.submitBtn}>
              행정지도 및 목록에 즉시 반영
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
