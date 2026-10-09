// 한국어 조사 고르기. 마지막 글자의 받침 여부로 정합니다 (한글이 아니면 받침 없음으로 봅니다).
const lastCode = (word: string) => {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 : 0;
};

const hasBatchim = (word: string) => lastCode(word) !== 0;

/** "강릉" → "강릉으로", "경주" → "경주로", "서울" → "서울로" (ㄹ 받침은 "로") */
export const withEuro = (word: string) => `${word}${hasBatchim(word) && lastCode(word) !== 8 ? "으로" : "로"}`;

/** "강릉" → "강릉은", "경주" → "경주는" */
export const withEunNeun = (word: string) => `${word}${hasBatchim(word) ? "은" : "는"}`;

/** "강릉" → "강릉이", "경주" → "경주가" */
export const withIGa = (word: string) => `${word}${hasBatchim(word) ? "이" : "가"}`;

/** "강릉" → "강릉을", "경주" → "경주를" */
export const withEulReul = (word: string) => `${word}${hasBatchim(word) ? "을" : "를"}`;

/** 지역 표시 이름: "강원특별자치도 강릉시" → "강릉", 구는 "부산 해운대구"처럼 시도 약칭을 붙입니다. */
export const shortRegionName = (province: string, city: string) => {
  // "수원시장안구" / "수원시 장안구" → "수원 장안구"
  const cityGu = city.match(/^(.+?)시\s?(.+구)$/);
  if (cityGu) return `${cityGu[1]} ${cityGu[2]}`;
  if (/(시|군)$/.test(city) && city.length > 2) return city.replace(/(시|군)$/, "");
  if (/구$/.test(city)) return `${province.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "")} ${city}`;
  return city;
};
