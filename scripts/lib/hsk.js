/**
 * HSK vocabulary loader
 *
 * Loads HSK words from the vendored complete-hsk-vocabulary JSON file
 */

import fs from "node:fs";
import path from "node:path";

const HSK_JSON_PATH = "./vendor/complete-hsk-vocabulary/complete.min.json";

/**
 * Load all HSK words into a Set for fast lookup
 * @returns {Set<string>} Set of simplified Chinese words
 */
export function loadHskWords() {
  const jsonPath = path.resolve(HSK_JSON_PATH);
  const content = fs.readFileSync(jsonPath, "utf-8");
  const entries = JSON.parse(content);

  const words = new Set();
  for (const entry of entries) {
    if (entry.s) {
      words.add(entry.s);
    }
  }

  return words;
}

/**
 * Load all words from JSON files in misc/ directory
 * @param {string[]} filePaths - Array of file paths relative to project root
 * @returns {Set<string>} Set of simplified Chinese words
 */
export function loadWordsFromJsonFiles(filePaths) {
  const words = new Set();

  for (const filePath of filePaths) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        for (const entry of data) {
          if (entry.simplified_zh) {
            words.add(entry.simplified_zh);
          }
        }
      }
    } catch (err) {
      console.warn(`Warning: Failed to load ${filePath}: ${err.message}`);
    }
  }

  return words;
}

/**
 * Load sentences from TSV files
 * @param {string[]} filePaths - Array of TSV file paths
 * @returns {Array<{id: number, zh: string}>} Array of sentence objects
 */
export function loadSentencesFromTsv(filePaths) {
  const sentences = [];

  for (const filePath of filePaths) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.trim().split("\n");

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split("\t");
      if (columns.length >= 2) {
        const id = parseInt(columns[0], 10);
        const zh = columns[1];
        if (zh && zh.trim()) {
          sentences.push({ id, zh });
        }
      }
    }
  }

  return sentences;
}
