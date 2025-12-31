import knex from "knex";

const s1 = "今天很冷";
const expected1 = ["今天", "很", "冷"];
/**
 *
 * @param {string} sentence
 * @returns {Promise<string[]>}
 */
async function parseSentence(sentence) {
  console.log(`Parsing: ${sentence}`);
  const words = [];
  let remaining = sentence;
  const punctuationRegex = /[。！？，、；：""''（）【】《》]/;

  while (remaining.length > 0) {
    // Check if first character is punctuation
    const firstChar = remaining[0];
    if (punctuationRegex.test(firstChar)) {
      console.log(`Found punctuation: ${firstChar}`);
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
      console.log(`No match for: ${remaining.slice(0, 4)}`);
      break;
    }
  }
  console.log(`Result: ${JSON.stringify(words)}`);
  const reconstructed = words
    .map((w) => w.simplified_zh || w.traditional_chars)
    .join("");
  if (reconstructed === sentence) {
    return words;
  }
  return [];
}

async function getWord(simplified_zh) {
  const db = knex({
    client: "better-sqlite3",
    connection: {
      filename: "./practice-zh.sqlite3",
    },
    useNullAsDefault: true,
  });

  const word = await db("words").where({ simplified_zh }).first();
  await db.destroy();
  return word;
}

async function createPhraseComponent(sentence, words) {
  const components = [];
  let template = "";
  let position = 0;

  for (const word of words) {
    // Handle punctuation
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

    // Shorten "common noun" to "noun"
    if (pos === "common noun") {
      pos = "noun";
    }

    components.push({
      word_id: word.id,
      simplified_zh: word.simplified_zh,
      slot_key: pos,
      position: position,
      is_optional: false,
    });

    template += `{${position}}`;
    position++;
  }

  return {
    original_sentence: sentence,
    template,
    components,
  };
}

(async () => {
  console.log("Starting test...");
  const result1 = await parseSentence(s1);
  if (
    JSON.stringify(result1.map((w) => w.simplified_zh)) !==
    JSON.stringify(expected1)
  ) {
    console.error(
      `Test 1 failed: got ${JSON.stringify(result1.map((w) => w.simplified_zh))}, expected ${JSON.stringify(expected1)}`
    );
  } else {
    console.log("Test 1 passed!");
  }

  console.log("\n--- Phrase Components ---");
  const pc1 = await createPhraseComponent(s1, result1);
  console.log(JSON.stringify(pc1, null, 2));
})();
