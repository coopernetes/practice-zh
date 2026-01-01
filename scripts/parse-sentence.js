import knex from "knex";
import nodejieba from "nodejieba";

const dbConfig = {
  client: "better-sqlite3",
  connection: {
    filename: "./practice-zh.sqlite3",
  },
  useNullAsDefault: true,
};

// CJK Unified Ideographs: U+4E00 to U+9FFF
function isCJK(char) {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

// Chinese punctuation marks
const CHINESE_PUNCTUATION = new Set([
  "。",
  "，",
  "、",
  "；",
  "：",
  "？",
  "！",
  '"',
  '"',
  "'",
  "'",
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

function isChinesePunctuation(char) {
  return CHINESE_PUNCTUATION.has(char);
}

// Check if sentence contains any ASCII letters/numbers
function hasASCII(str) {
  return /[A-Za-z0-9]/.test(str);
}

/**
 *
 * @param {string} sentence
 * @returns {Promise<object[]>}
 */
async function parseSentence(sentence) {
  // Skip sentences with ASCII characters
  if (hasASCII(sentence)) {
    console.log(`\nSkipping (has ASCII): ${sentence}`);
    return [];
  }

  console.log(`\nParsing: ${sentence}`);
  const words = [];
  const segments = nodejieba.cut(sentence);

  for (const segment of segments) {
    // Handle Chinese punctuation
    if (isChinesePunctuation(segment)) {
      console.log(`Found punctuation: ${segment}`);
      words.push({
        simplified_zh: segment,
        traditional_chars: segment,
        punctuation: true,
      });
      continue;
    }

    // Handle non-CJK characters
    const hasCJK = [...segment].some((char) => isCJK(char));
    if (!hasCJK) {
      console.log(`Found non-CJK segment: ${segment}`);
      words.push({
        simplified_zh: segment,
        traditional_chars: segment,
        unexpected: true,
      });
      continue;
    }

    // Try to find the word in our database
    const word = await getWord(segment);
    if (word) {
      console.log(`Found: ${segment}`);
      words.push(word);
    } else {
      // Unknown word
      console.log(`Unknown word: ${segment}`);
      words.push({
        simplified_zh: segment,
        traditional_chars: segment,
        unknown: true,
      });
    }
  }

  const reconstructed = words
    .map((w) => w.simplified_zh || w.traditional_chars)
    .join("");

  if (reconstructed === sentence) {
    return words;
  }

  console.warn("Reconstruction mismatch, skipping sentence");
  return [];
}

async function getWord(simplified_zh) {
  const db = knex(dbConfig);

  // Check words_hsk first
  const hskWord = await db("words_hsk").where({ simplified_zh }).first();
  if (hskWord) {
    await db.destroy();
    return hskWord;
  }

  // Then check words_hsk_missing
  const missingWord = await db("words_hsk_missing")
    .where({ simplified_zh })
    .first();
  await db.destroy();
  return missingWord;
}

async function createPhraseComponent(sentence, words) {
  const components = [];
  let template = "";
  let position = 0;

  for (const word of words) {
    if (word.punctuation) {
      template += word.simplified_zh || word.traditional_chars;
      continue;
    }

    let pos = "unknown";
    if (word.part_of_speech) {
      try {
        const posArray = JSON.parse(word.part_of_speech);
        pos = posArray[0] || "unknown";
      } catch {
        pos = word.part_of_speech;
      }
    }

    if (pos === "common noun") pos = "noun";

    const component = {
      word_id: word.unknown ? null : word.id,
      slot_key: pos,
      position,
      is_optional: false,
    };

    if (word.unknown) {
      component.literal_zh = word.simplified_zh;
    }

    components.push(component);

    template += `{${position}}`;
    position++;
  }

  return {
    original_sentence: sentence,
    template,
    components,
  };
}

/**
 * Fetch 5 random sentences from DB
 */
async function getRandomSentences(limit = 5) {
  const db = knex(dbConfig);
  const rows = await db("sentences_tatoeba")
    .select("zh")
    .orderByRaw("RANDOM()")
    .limit(limit);
  await db.destroy();
  return rows.map((r) => r.zh);
}

(async () => {
  // Manual test cases with proper nouns
  const manualTests = [
    "鲍勃也会开车。",
    "杰夫找了三个月以后才找到了一份工作。",
  ];

  console.log("--- Manual Test Cases (proper nouns) ---");
  for (const sentence of manualTests) {
    const words = await parseSentence(sentence);
    if (!words.length) continue;

    const phraseComponent = await createPhraseComponent(sentence, words);
    console.log(JSON.stringify(phraseComponent, null, 2));
  }

  console.log("\n--- Random Sentences ---");
  console.log("Fetching random sentences...");
  const sentences = await getRandomSentences(5);

  for (const sentence of sentences) {
    const words = await parseSentence(sentence);
    if (!words.length) continue;

    const phraseComponent = await createPhraseComponent(sentence, words);
    console.log(JSON.stringify(phraseComponent, null, 2));
  }
})();
