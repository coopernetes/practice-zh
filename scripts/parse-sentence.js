import knex from "knex";

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
  let remaining = sentence;

  while (remaining.length > 0) {
    const firstChar = remaining[0];

    // Skip non-CJK characters (punctuation, symbols, etc.)
    if (!isCJK(firstChar)) {
      console.log(`Found non-CJK: ${firstChar}`);
      words.push({
        simplified_zh: firstChar,
        traditional_chars: firstChar,
        punctuation: true,
      });
      remaining = remaining.slice(1);
      continue;
    }

    let found = false;
    for (let len = 4; len >= 1; len--) {
      const chunk = remaining.slice(0, len);
      const word = await getWord(chunk);
      if (word) {
        console.log(`Found: ${chunk}`);
        words.push(word);
        remaining = remaining.slice(len);
        found = true;
        break;
      }
    }

    if (!found) {
      // Unknown CJK character - treat as a single unknown word
      const unknownChar = remaining[0];
      console.log(`Unknown char: ${unknownChar}`);
      words.push({
        simplified_zh: unknownChar,
        traditional_chars: unknownChar,
        unknown: true,
      });
      remaining = remaining.slice(1);
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
  const word = await db("words").where({ simplified_zh }).first();
  await db.destroy();
  return word;
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
  const rows = await db("sentences")
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
