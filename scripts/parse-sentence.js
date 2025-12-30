import knex from "knex";

const s1 = "妈妈比爸爸大";
const expected1 = ["妈妈", "比", "爸爸", "大"];

const s2 = "昨天我们去吃晚饭";
const expected2 = ["昨天", "我们", "去", "吃", "晚饭"];

const s3 = "我们需要去加油站";
const expected3 = ["我们", "需要", "去", "加油站"];

const s4 = "這個永遠完不了了。";
const expected4 = ["這個", "永遠", "完", "不了", "了", "。"];

const s5 = "我不知道。";
const expected5 = ["我", "不", "知道", "。"];

const s6 = "這是什麼啊？";
const expected6 = ["這", "是", "什麼", "啊", "？"];

const s7 = "我该去睡觉了。";
const expected7 = ["我", "该", "去", "睡觉", "了", "。"];

const s8 = '密码是"Muiriel"。';
const expected8 = ["密码", "是", '"', "Muiriel", '"', "。"];

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

  const result2 = await parseSentence(s2);
  if (
    JSON.stringify(result2.map((w) => w.simplified_zh)) !==
    JSON.stringify(expected2)
  ) {
    console.error(
      `Test 2 failed: got ${JSON.stringify(result2.map((w) => w.simplified_zh))}, expected ${JSON.stringify(expected2)}`
    );
  } else {
    console.log("Test 2 passed!");
  }

  const result3 = await parseSentence(s3);
  if (
    JSON.stringify(result3.map((w) => w.simplified_zh)) !==
    JSON.stringify(expected3)
  ) {
    console.error(
      `Test 3 failed: got ${JSON.stringify(result3.map((w) => w.simplified_zh))}, expected ${JSON.stringify(expected3)}`
    );
  } else {
    console.log("Test 3 passed!");
  }

  const result4 = await parseSentence(s4);
  const result4Chars = result4.map(
    (w) => w.simplified_zh || w.traditional_chars
  );
  if (JSON.stringify(result4Chars) !== JSON.stringify(expected4)) {
    console.error(
      `Test 4 failed: got ${JSON.stringify(result4Chars)}, expected ${JSON.stringify(expected4)}`
    );
  } else {
    console.log("Test 4 passed!");
  }

  const result5 = await parseSentence(s5);
  const result5Chars = result5.map(
    (w) => w.simplified_zh || w.traditional_chars
  );
  if (JSON.stringify(result5Chars) !== JSON.stringify(expected5)) {
    console.error(
      `Test 5 failed: got ${JSON.stringify(result5Chars)}, expected ${JSON.stringify(expected5)}`
    );
  } else {
    console.log("Test 5 passed!");
  }

  const result6 = await parseSentence(s6);
  const result6Chars = result6.map(
    (w) => w.simplified_zh || w.traditional_chars
  );
  if (JSON.stringify(result6Chars) !== JSON.stringify(expected6)) {
    console.error(
      `Test 6 failed: got ${JSON.stringify(result6Chars)}, expected ${JSON.stringify(expected6)}`
    );
  } else {
    console.log("Test 6 passed!");
  }

  const result7 = await parseSentence(s7);
  const result7Chars = result7.map(
    (w) => w.simplified_zh || w.traditional_chars
  );
  if (JSON.stringify(result7Chars) !== JSON.stringify(expected7)) {
    console.error(
      `Test 7 failed: got ${JSON.stringify(result7Chars)}, expected ${JSON.stringify(expected7)}`
    );
  } else {
    console.log("Test 7 passed!");
  }

  const result8 = await parseSentence(s8);
  const result8Chars = result8.map(
    (w) => w.simplified_zh || w.traditional_chars
  );
  if (JSON.stringify(result8Chars) !== JSON.stringify(expected8)) {
    console.error(
      `Test 8 failed: got ${JSON.stringify(result8Chars)}, expected ${JSON.stringify(expected8)}`
    );
  } else {
    console.log("Test 8 passed!");
  }

  console.log("\n--- Phrase Components ---");
  const pc1 = await createPhraseComponent(s1, result1);
  console.log(JSON.stringify(pc1, null, 2));

  const pc2 = await createPhraseComponent(s2, result2);
  console.log(JSON.stringify(pc2, null, 2));

  const pc3 = await createPhraseComponent(s3, result3);
  console.log(JSON.stringify(pc3, null, 2));

  const pc4 = await createPhraseComponent(s4, result4);
  console.log(JSON.stringify(pc4, null, 2));

  const pc5 = await createPhraseComponent(s5, result5);
  console.log(JSON.stringify(pc5, null, 2));

  const pc6 = await createPhraseComponent(s6, result6);
  console.log(JSON.stringify(pc6, null, 2));

  const pc7 = await createPhraseComponent(s7, result7);
  console.log(JSON.stringify(pc7, null, 2));

  const pc8 = await createPhraseComponent(s8, result8);
  console.log(JSON.stringify(pc8, null, 2));
})();
