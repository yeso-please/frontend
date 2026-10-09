import type { ImageSourcePropType } from "react-native";

import type { MbtiType } from "@/store/mbti";

// 피그마 TriPin/Profile/Result Template (391:641) 데이터.
// 이름 16개는 피그마 공식 이름 그대로. 문구는 INFP만 피그마(400:1385) 원문이고 나머지 15개는 초안입니다.

export type MbtiProfile = {
  name: string;
  /** 2줄 요약 (Medium 15/22) */
  summary: [string, string];
  /** 설명 (Regular 13/20 muted, 줄 단위) */
  description: string[];
  /** 트레이트 칩 4개 ("#" 없이) */
  traits: [string, string, string, string];
  /** "나의 여행 취향 한눈에" 표 */
  pace: string;
  places: string;
  activities: string;
  companions: string;
};

export const MBTI_PROFILES: Record<MbtiType, MbtiProfile> = {
  // 초안 문구: 디자이너 검토 필요
  ISTJ: {
    name: "꼼꼼한 길잡이",
    summary: ["동선과 시간을 미리 챙겨", "실수 없는 여행을 만드는 타입"],
    description: ["계획한 대로 차근차근 흘러가는 여행에서 편안함을 느껴요.", "검증된 명소와 정확한 동선처럼", "믿고 따를 수 있는 일정에 끌립니다."],
    traits: ["계획", "동선정리", "명소", "효율"],
    pace: "계획한 만큼 알차게",
    places: "유적지 · 박물관 · 전망대 · 명소",
    activities: "코스 탐방 · 역사 공부 · 기념사진",
    companions: "가족 · 오랜 친구 · 혼자",
  },
  // 초안 문구: 디자이너 검토 필요
  ISFJ: {
    name: "다정한 동행자",
    summary: ["함께 가는 사람의 마음까지", "세심하게 챙기는 타입"],
    description: ["모두가 편안하고 즐거운 여행이 가장 중요해요.", "익숙한 맛집, 아늑한 숙소처럼", "마음 놓고 쉴 수 있는 장소에 끌립니다."],
    traits: ["배려", "편안함", "맛집", "힐링"],
    pace: "여유롭게",
    places: "한옥마을 · 공원 · 카페 · 온천",
    activities: "맛집 탐방 · 산책 · 기념품 고르기",
    companions: "가족 · 연인 · 가까운 친구",
  },
  // 초안 문구: 디자이너 검토 필요
  INFJ: {
    name: "풍경 수집가",
    summary: ["마음에 남는 풍경을 찾아", "조용히 오래 바라보는 타입"],
    description: ["사람 많은 명소보다 나만 아는 풍경이 더 소중해요.", "새벽 호수, 안개 낀 숲길처럼", "생각이 깊어지는 장소에 끌립니다."],
    traits: ["풍경", "사색", "자연", "고요함"],
    pace: "느긋하게",
    places: "숲길 · 호수 · 사찰 · 바다",
    activities: "풍경 감상 · 산책 · 일기 쓰기",
    companions: "혼자 · 가까운 친구",
  },
  // 초안 문구: 디자이너 검토 필요
  INTJ: {
    name: "숨은 길 설계자",
    summary: ["남들이 모르는 길을 찾아", "나만의 코스를 설계하는 타입"],
    description: ["정보를 모으고 분석해 최적의 여행을 짜는 게 즐거워요.", "덜 알려진 명소, 효율적인 동선처럼", "직접 찾아낸 장소에 끌립니다."],
    traits: ["설계", "숨은명소", "효율", "탐구"],
    pace: "효율적으로 알차게",
    places: "숨은 명소 · 미술관 · 서점 · 전망대",
    activities: "코스 짜기 · 전시 관람 · 건축 구경",
    companions: "혼자 · 취향 맞는 친구",
  },
  // 초안 문구: 디자이너 검토 필요
  ISTP: {
    name: "자유로운 탐험가",
    summary: ["발길 닿는 대로 움직이며", "직접 부딪혀 보는 타입"],
    description: ["정해진 일정보다 그때그때의 선택이 더 재미있어요.", "드라이브 코스, 한적한 바닷가처럼", "자유롭게 누빌 수 있는 장소에 끌립니다."],
    traits: ["자유", "드라이브", "액티비티", "즉흥"],
    pace: "내 마음대로",
    places: "해안도로 · 캠핑장 · 산 · 바다",
    activities: "드라이브 · 캠핑 · 서핑 · 트레킹",
    companions: "혼자 · 편한 친구",
  },
  // 초안 문구: 디자이너 검토 필요
  ISFP: {
    name: "감각적인 산책자",
    summary: ["예쁜 순간을 놓치지 않고", "천천히 걸으며 즐기는 타입"],
    description: ["눈에 들어오는 색감과 분위기가 여행의 기준이에요.", "소품숍, 꽃길, 감성 카페처럼", "감각을 깨우는 장소에 끌립니다."],
    traits: ["산책", "감성", "소품숍", "카페"],
    pace: "여유롭게",
    places: "골목 · 소품숍 · 꽃길 · 카페",
    activities: "산책 · 사진 · 소품 구경 · 공방 체험",
    companions: "혼자 · 연인 · 가까운 친구",
  },
  // 피그마 원문 (B · INFP 성향 결과 400:1385)
  INFP: {
    name: "낭만적인 기록가",
    summary: ["여행의 감정과 장면을", "나만의 기억으로 남기는 타입"],
    description: ["여행에서 느꼈던 감정과 장면을 기억하는 것이 중요해요.", "골목, 음악, 노을, 작은 카페처럼", "자신만의 이야기가 생기는 장소에 끌립니다."],
    traits: ["기록", "감성여행", "사진", "골목"],
    pace: "여유롭게",
    places: "골목 · 서점 · 카페 · 바다",
    activities: "사진 · 글쓰기 · 전시 · 노을 감상",
    companions: "혼자 · 연인 · 가까운 친구",
  },
  // 초안 문구: 디자이너 검토 필요
  INTP: {
    name: "호기심 많은 발견자",
    summary: ["궁금한 건 직접 확인해야", "직성이 풀리는 타입"],
    description: ["유명한 곳보다 이야기가 숨어 있는 곳이 더 궁금해요.", "과학관, 오래된 건축물, 낯선 동네처럼", "새로운 걸 알게 되는 장소에 끌립니다."],
    traits: ["호기심", "탐구", "박물관", "건축"],
    pace: "궁금한 만큼 천천히",
    places: "박물관 · 과학관 · 건축물 · 낯선 동네",
    activities: "관람 · 동네 탐방 · 자료 찾아보기",
    companions: "혼자 · 취향 맞는 친구",
  },
  // 초안 문구: 디자이너 검토 필요
  ESTJ: {
    name: "든든한 리더",
    summary: ["일정과 예산을 척척 챙겨", "모두를 이끄는 타입"],
    description: ["함께 간 사람들이 알차게 즐기고 오는 게 뿌듯해요.", "유명 명소, 검증된 맛집처럼", "실패 없는 장소에 끌립니다."],
    traits: ["리더십", "알찬일정", "명소", "맛집"],
    pace: "알차게",
    places: "랜드마크 · 시장 · 맛집 · 전망대",
    activities: "명소 투어 · 맛집 탐방 · 단체 사진",
    companions: "가족 · 친구 여럿 · 동료",
  },
  // 초안 문구: 디자이너 검토 필요
  ESFJ: {
    name: "행복한 미식가",
    summary: ["맛있는 음식과 웃음으로", "여행을 채우는 타입"],
    description: ["함께 먹고 이야기 나누는 시간이 여행의 하이라이트예요.", "로컬 맛집, 활기찬 시장처럼", "사람 냄새 나는 장소에 끌립니다."],
    traits: ["미식", "맛집", "시장", "함께"],
    pace: "적당히 알차게",
    places: "시장 · 맛집 거리 · 카페 · 축제",
    activities: "맛집 탐방 · 시장 구경 · 디저트 투어",
    companions: "가족 · 친구 여럿 · 연인",
  },
  // 초안 문구: 디자이너 검토 필요
  ENFJ: {
    name: "따뜻한 여행 메이트",
    summary: ["함께하는 모두가 즐겁도록", "분위기를 챙기는 타입"],
    description: ["같이 간 사람들과 추억을 나누는 게 가장 행복해요.", "다 함께 즐기는 체험, 노을 명소처럼", "함께 웃을 수 있는 장소에 끌립니다."],
    traits: ["추억", "함께", "체험", "노을"],
    pace: "적당히 여유롭게",
    places: "축제 · 해변 · 체험 마을 · 카페",
    activities: "체험 · 단체 사진 · 노을 감상",
    companions: "친구 여럿 · 가족 · 연인",
  },
  // 초안 문구: 디자이너 검토 필요
  ENTJ: {
    name: "대담한 코스 메이커",
    summary: ["목표를 세우고", "한 번에 많은 걸 해내는 타입"],
    description: ["짧은 시간에도 최대한 많은 경험을 담고 싶어요.", "핫플레이스, 대표 명소처럼", "확실한 만족을 주는 장소에 끌립니다."],
    traits: ["추진력", "알찬코스", "핫플", "도전"],
    pace: "빠르고 알차게",
    places: "핫플레이스 · 랜드마크 · 전망대 · 도심",
    activities: "코스 정복 · 액티비티 · 야경 투어",
    companions: "친구 여럿 · 동료 · 혼자",
  },
  // 초안 문구: 디자이너 검토 필요
  ESTP: {
    name: "즉흥 모험가",
    summary: ["재미있어 보이면 바로", "뛰어드는 타입"],
    description: ["계획보다 현장에서 만나는 짜릿함이 더 좋아요.", "레저 스포츠, 북적이는 거리처럼", "에너지가 넘치는 장소에 끌립니다."],
    traits: ["모험", "액티비티", "즉흥", "레저"],
    pace: "빠르게 이곳저곳",
    places: "바다 · 레저 스포츠장 · 번화가 · 야시장",
    activities: "서핑 · 패러글라이딩 · 야시장 탐방",
    companions: "친구 여럿 · 편한 친구",
  },
  // 초안 문구: 디자이너 검토 필요
  ESFP: {
    name: "반짝이는 분위기 메이커",
    summary: ["어디서든 즐거움을 찾아", "여행을 축제로 만드는 타입"],
    description: ["지금 이 순간을 신나게 즐기는 게 여행의 이유예요.", "축제, 루프톱, 바닷가처럼", "활기가 넘치는 장소에 끌립니다."],
    traits: ["축제", "핫플", "사진", "흥"],
    pace: "신나게 알차게",
    places: "축제 · 루프톱 · 해변 · 번화가",
    activities: "축제 즐기기 · 인생샷 · 쇼핑",
    companions: "친구 여럿 · 연인",
  },
  // 초안 문구: 디자이너 검토 필요
  ENFP: {
    name: "설레는 즉흥러",
    summary: ["설렘을 따라 움직이며", "새로운 이야기를 만드는 타입"],
    description: ["계획에 없던 곳에서 뜻밖의 재미를 발견하는 게 좋아요.", "처음 가 보는 동네, 낯선 골목처럼", "두근거림이 생기는 장소에 끌립니다."],
    traits: ["설렘", "즉흥", "새로운곳", "골목"],
    pace: "기분 따라 자유롭게",
    places: "낯선 동네 · 골목 · 플리마켓 · 카페",
    activities: "골목 탐방 · 플리마켓 · 현지인 맛집",
    companions: "친구 · 연인 · 새로운 사람",
  },
  // 초안 문구: 디자이너 검토 필요
  ENTP: {
    name: "새로운 길 개척자",
    summary: ["남들과 다른 여행을 찾아", "새 길을 여는 타입"],
    description: ["뻔한 코스보다 아무도 안 해 본 방식이 더 끌려요.", "이색 체험, 새로 생긴 공간처럼", "새로운 시도가 가능한 장소에 끌립니다."],
    traits: ["개척", "이색체험", "도전", "새로움"],
    pace: "즉흥적으로 알차게",
    places: "이색 공간 · 신상 핫플 · 전시 · 섬",
    activities: "이색 체험 · 새로운 코스 도전 · 전시 관람",
    companions: "친구 · 취향 맞는 사람",
  },
};

// Metro는 정적 require만 번들에 넣으므로 16개를 모두 나열합니다.
export const MBTI_IMAGES: Record<MbtiType, ImageSourcePropType> = {
  ISTJ: require("@/assets/illustrations/characters/istj.webp"),
  ISFJ: require("@/assets/illustrations/characters/isfj.webp"),
  INFJ: require("@/assets/illustrations/characters/infj.webp"),
  INTJ: require("@/assets/illustrations/characters/intj.webp"),
  ISTP: require("@/assets/illustrations/characters/istp.webp"),
  ISFP: require("@/assets/illustrations/characters/isfp.webp"),
  INFP: require("@/assets/illustrations/characters/infp.webp"),
  INTP: require("@/assets/illustrations/characters/intp.webp"),
  ESTJ: require("@/assets/illustrations/characters/estj.webp"),
  ESFJ: require("@/assets/illustrations/characters/esfj.webp"),
  ENFJ: require("@/assets/illustrations/characters/enfj.webp"),
  ENTJ: require("@/assets/illustrations/characters/entj.webp"),
  ESTP: require("@/assets/illustrations/characters/estp.webp"),
  ESFP: require("@/assets/illustrations/characters/esfp.webp"),
  ENFP: require("@/assets/illustrations/characters/enfp.webp"),
  ENTP: require("@/assets/illustrations/characters/entp.webp"),
};
