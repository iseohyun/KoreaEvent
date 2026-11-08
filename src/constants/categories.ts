import { MajorCategoryCode } from '../types/event';

export interface SubCategoryDef {
  code: string;
  name: string;
  parentCode: Exclude<MajorCategoryCode, 'ALL'>;
}

export const MAJOR_CATEGORIES: {
  code: MajorCategoryCode;
  name: string;
  description: string;
}[] = [
  { code: 'ALL', name: '전체 분류', description: '모든 축제·공연·박람회·스포츠·지자체 행사' },
  { code: 'EV01', name: '축제 (EV01)', description: '문화관광·예술·지역특산물·전통역사·생태자연 축제' },
  { code: 'EV02', name: '공연 (EV02)', description: '전통공연·연극·뮤지컬·오페라·무용·클래식·콘서트' },
  { code: 'EV03', name: '행사/전시·스포츠 (EV03)', description: '전시회·박람회·스포츠경기(수영·마라톤 등)·기타행사' },
  { code: 'MUNICIPAL', name: '행정·시민참여', description: '지자체 홈페이지 고유 시민강좌·나눔장터·생활체육행사' },
];

export const SUB_CATEGORIES: Record<string, SubCategoryDef> = {
  // EV01: 축제 (신분류체계 정의서 기준)
  EV010100: { code: 'EV010100', name: '문화관광축제', parentCode: 'EV01' },
  EV010200: { code: 'EV010200', name: '문화예술축제', parentCode: 'EV01' },
  EV010300: { code: 'EV010300', name: '지역특산물축제', parentCode: 'EV01' },
  EV010400: { code: 'EV010400', name: '전통역사축제', parentCode: 'EV01' },
  EV010500: { code: 'EV010500', name: '생태자연축제', parentCode: 'EV01' },
  EV010600: { code: 'EV010600', name: '기타축제', parentCode: 'EV01' },

  // EV02: 공연 (신분류체계 정의서 기준)
  EV020100: { code: 'EV020100', name: '전통공연', parentCode: 'EV02' },
  EV020200: { code: 'EV020200', name: '연극', parentCode: 'EV02' },
  EV020300: { code: 'EV020300', name: '뮤지컬', parentCode: 'EV02' },
  EV020400: { code: 'EV020400', name: '오페라', parentCode: 'EV02' },
  EV020500: { code: 'EV020500', name: '무용', parentCode: 'EV02' },
  EV020600: { code: 'EV020600', name: '클래식음악회', parentCode: 'EV02' },
  EV020700: { code: 'EV020700', name: '대중콘서트', parentCode: 'EV02' },
  EV020800: { code: 'EV020800', name: '영화', parentCode: 'EV02' },
  EV020900: { code: 'EV020900', name: '기타공연', parentCode: 'EV02' },
  EV021000: { code: 'EV021000', name: '넌버벌', parentCode: 'EV02' },

  // EV03: 행사 (신분류체계 정의서 기준)
  EV030100: { code: 'EV030100', name: '전시회', parentCode: 'EV03' },
  EV030200: { code: 'EV030200', name: '박람회', parentCode: 'EV03' },
  EV030300: { code: 'EV030300', name: '스포츠경기·대회', parentCode: 'EV03' },
  EV030400: { code: 'EV030400', name: '기타행사', parentCode: 'EV03' },

  // MUNICIPAL: 지자체 행정 홈페이지 고유 분류
  MU010100: { code: 'MU010100', name: '시민참여·플리마켓', parentCode: 'MUNICIPAL' },
  MU010200: { code: 'MU010200', name: '구민특강·교육강좌', parentCode: 'MUNICIPAL' },
  MU010300: { code: 'MU010300', name: '지자체 기획문화행사', parentCode: 'MUNICIPAL' },
  MU010400: { code: 'MU010400', name: '지역장터·나눔행사', parentCode: 'MUNICIPAL' },
  MU010500: { code: 'MU010500', name: '생활체육·시민대회', parentCode: 'MUNICIPAL' },
};

export function getMajorCategoryName(code: string): string {
  switch (code) {
    case 'EV01':
      return '축제';
    case 'EV02':
      return '공연';
    case 'EV03':
      return '행사·전시';
    case 'MUNICIPAL':
      return '행정·시민참여';
    default:
      return '축제·행사';
  }
}

export function getSubCategoryName(code: string): string {
  return SUB_CATEGORIES[code]?.name || '일반행사';
}
