/** Common Chinese punctuation marks */
export const CHINESE_PUNCTUATION = new Set([
  "。",
  "，",
  "、",
  "；",
  "：",
  "？",
  "！",
  "\u201C",
  "\u201D",
  "\u2018",
  "\u2019", // quotes
  "（",
  "）",
  "【",
  "】",
  "《",
  "》",
  "—",
  "…",
  "·",
  "～",
]);

/**
 * Check if string contains any ASCII letters or numbers
 */
export function hasASCII(str: string): boolean {
  return /[A-Za-z0-9]/.test(str);
}

/**
 * Check if a character is in the CJK Unified Ideographs block.
 * Range: U+4E00 to U+9FFF (common Chinese characters)
 */
export function isCJK(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

/**
 * Check if string is Chinese punctuation
 */
export function isChinesePunctuation(str: string): boolean {
  return str.length === 1 && CHINESE_PUNCTUATION.has(str);
}

export function generatePassword(length: number = 12): string {
  const NUM_MIN = 48;
  const NUM_MAX = 57;
  const ALPHA_UPPER_MIN = 65;
  const ALPHA_UPPER_MAX = 90;
  const ALPHA_LOWER_MIN = 97;
  const ALPHA_LOWER_MAX = 122;

  const points = Array.from(
    { length: NUM_MAX - NUM_MIN },
    (_value, index) => index + NUM_MIN,
  )
    .concat(
      Array.from(
        { length: ALPHA_UPPER_MAX - ALPHA_UPPER_MIN },
        (_value, index) => index + ALPHA_UPPER_MIN,
      ),
    )
    .concat(
      Array.from(
        { length: ALPHA_LOWER_MAX - ALPHA_LOWER_MIN },
        (_value, index) => index + ALPHA_LOWER_MIN,
      ),
    );

  const getRandomChar = () => {
    const c = Math.floor(Math.random() * points.length);
    return String.fromCodePoint(points.at(c) ?? NUM_MIN);
  };

  return Array.from({ length })
    .map((_undef) => getRandomChar())
    .join("");
}
