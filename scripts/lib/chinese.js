/**
 * Chinese text utilities
 *
 * Character classification and text processing for Chinese.
 */

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
 * Check if a character is in the CJK Unified Ideographs block.
 * Range: U+4E00 to U+9FFF (common Chinese characters)
 */
export function isCJK(char) {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

/**
 * Check if string is Chinese punctuation
 */
export function isChinesePunctuation(str) {
  return str.length === 1 && CHINESE_PUNCTUATION.has(str);
}

/**
 * Check if string contains any ASCII letters or numbers
 */
export function hasASCII(str) {
  return /[A-Za-z0-9]/.test(str);
}

/**
 * Split a token into known and unknown pieces using dynamic programming.
 *
 * Finds the optimal decomposition such that:
 * 1. Maximum characters are covered by known words (primary goal)
 * 2. Minimum number of pieces are used (secondary goal)
 *
 * @param {string} token - The string to split
 * @param {Set<string>} known - Set of known vocabulary words
 * @param {number} maxWordLen - Maximum word length to try (default: 6)
 * @returns {Array<{text: string, known: boolean}>}
 */
export function splitTokenIntoKnownAndUnknown(token, known, maxWordLen = 6) {
  const chars = [...token];
  const n = chars.length;

  const dp = Array(n + 1).fill(null);
  dp[0] = { covered: 0, pieces: 0, prev: -1, pieceText: "", pieceKnown: false };

  const isBetter = (a, b) => {
    if (a.covered !== b.covered) return a.covered > b.covered;
    return a.pieces < b.pieces;
  };

  for (let i = 0; i < n; i++) {
    if (!dp[i]) continue;

    // Option 1: Take current char as unknown
    const unknownState = {
      covered: dp[i].covered,
      pieces: dp[i].pieces + 1,
      prev: i,
      pieceText: chars[i],
      pieceKnown: false,
    };
    if (!dp[i + 1] || isBetter(unknownState, dp[i + 1])) {
      dp[i + 1] = unknownState;
    }

    // Option 2: Try matching known words
    for (let len = 1; len <= maxWordLen && i + len <= n; len++) {
      const candidate = chars.slice(i, i + len).join("");
      if (!known.has(candidate)) continue;

      const knownState = {
        covered: dp[i].covered + len,
        pieces: dp[i].pieces + 1,
        prev: i,
        pieceText: candidate,
        pieceKnown: true,
      };

      if (!dp[i + len] || isBetter(knownState, dp[i + len])) {
        dp[i + len] = knownState;
      }
    }
  }

  // Backtrack
  const piecesReversed = [];
  let position = n;
  while (position > 0) {
    const state = dp[position];
    if (!state) break;
    piecesReversed.push({ text: state.pieceText, known: state.pieceKnown });
    position = state.prev;
  }
  piecesReversed.reverse();

  // Merge adjacent pieces with same status
  const mergedPieces = [];
  for (const piece of piecesReversed) {
    const lastPiece = mergedPieces[mergedPieces.length - 1];
    if (lastPiece && lastPiece.known === piece.known) {
      lastPiece.text += piece.text;
    } else {
      mergedPieces.push({ ...piece });
    }
  }

  return mergedPieces;
}
