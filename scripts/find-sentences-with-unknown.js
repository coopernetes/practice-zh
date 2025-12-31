import knex from "knex";

const dbConfig = {
  client: "better-sqlite3",
  connection: {
    filename: "./practice-zh.sqlite3",
  },
  useNullAsDefault: true,
};

const db = knex(dbConfig);

// CJK Unified Ideographs: U+4E00 to U+9FFF
function isCJK(char) {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

// Check if sentence contains any ASCII letters/numbers
function hasASCII(str) {
  return /[A-Za-z0-9]/.test(str);
}

async function getWord(simplified_zh) {
  return db("words").where({ simplified_zh }).first();
}

// Find unknown CJK characters in a sentence
async function findUnknownInSentence(zh) {
  const unknowns = new Set();
  let remaining = zh;

  while (remaining.length > 0) {
    const firstChar = remaining[0];

    if (!isCJK(firstChar)) {
      remaining = remaining.slice(1);
      continue;
    }

    let found = false;
    for (let len = 4; len >= 1; len--) {
      const chunk = remaining.slice(0, len);
      const word = await getWord(chunk);
      if (word) {
        remaining = remaining.slice(len);
        found = true;
        break;
      }
    }

    if (!found) {
      unknowns.add(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return [...unknowns];
}

async function main() {
  const sentences = await db("sentences").select("id", "zh", "en");

  // Output header
  console.log("id\tzh\ten\tunknown_chars");

  for (const { id, zh, en } of sentences) {
    // Skip sentences with ASCII
    if (hasASCII(zh)) continue;

    const unknowns = await findUnknownInSentence(zh);
    if (unknowns.length > 0) {
      console.log(`${id}\t${zh}\t${en}\t${unknowns.join("")}`);
    }
  }

  await db.destroy();
}

main();
