# Data Ingestion Pipeline

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA SOURCES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  vendor/complete-hsk-vocabulary/   Tatoeba sentences     Hacking Chinese    │
│  complete.min.json                 (misc/*.tsv)          missing HSK words  │
│                                                          (misc/*.csv)       │
└──────────────┬───────────────────────────┬───────────────────────┬──────────┘
               │                           │                       │
               ▼                           ▼                       ▼
┌──────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  seeds/1_words.ts    │    │ seeds/1_sentences.ts │    │ words-additional-   │
│  → words_hsk table   │    │ → sentences_tatoeba  │    │ missing-hsk-cedict  │
└──────────────────────┘    └──────────────────────┘    └──────────┬──────────┘
                                                                   │
                                                    ┌──────────────┴──────────┐
                                                    ▼                         ▼
                                         misc/words_additional.json    CC-CEDICT
                                                    │              (enrichment)
                                                    ▼
                                         seeds/3_words_additional.ts
                                         → words_additional table
```

---

## Tables

| Table               | Source              | Purpose                        |
| ------------------- | ------------------- | ------------------------------ |
| `words_hsk`         | HSK vocabulary JSON | Core HSK 1-6 words             |
| `words_additional`  | Various JSON files  | Gap-fill vocabulary            |
| `sentences_tatoeba` | Tatoeba TSV         | Chinese-English sentence pairs |
| `user_bank`         | App runtime         | User's learned words           |

---

## Seed Files

### 1. `seeds/1_words.ts` → `words_hsk`

**Source:** `vendor/complete-hsk-vocabulary/complete.min.json`

Parses the HSK vocabulary dataset and inserts ~11k words with:

- Simplified/traditional characters
- Pinyin (numeric + tone marks)
- English definitions
- HSK level (both 2.0 and 3.0 versions)
- Part of speech

### 2. `seeds/1_sentences.ts` → `sentences_tatoeba`

**Source:** `misc/sentences_tatoeba.simplified.tsv` (env: `SEED_SENTENCES_TSV`)

Format: `zh_id \t chinese \t en_id \t english`

Sentence pairs from Tatoeba. Used for quiz generation.

### 3. `seeds/3_words_additional.ts` → `words_additional`

**Sources:**

- `misc/words_additional.json` — Missing HSK words from Hacking Chinese
- `misc/words_additional_custom.json` — Manual custom entries
- `misc/unknown_chunks_cedict_enriched.json` — Auto-discovered vocabulary gaps

---

## Scripts

### Vocabulary Enrichment Pipeline

The unified `pipeline.js` script handles all vocabulary enrichment steps with iterative convergence:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ npm run pipeline:full (or npm run sqlite:setup)                           │
│                                                                            │
│ Step 1: Enrich missing HSK words                                          │
│    Input:  vendor/complete-hsk-vocabulary/*.json + CEDICT                 │
│    Output: misc/words_additional.json                                     │
│    Result: 166 words enriched, 489 HSK duplicates skipped                 │
│                                                                            │
│ Iteration Loop (until convergence):                                       │
│                                                                            │
│   Step 2: Find unknown chunks in sentences                                │
│      Input:  sentences_tatoeba (75,056) + all vocabulary JSONs            │
│      Output: misc/unknown_chunks.tsv                                      │
│      Method: nodejieba segmentation + DP-based optimal splitting          │
│                                                                            │
│   Step 3: Look up unknown chunks in CEDICT                                │
│      Input:  misc/unknown_chunks.tsv + CEDICT                             │
│      Output: misc/unknown_chunks_cedict.json                              │
│              misc/unknown_chunks_notfound.json                            │
│                                                                            │
│   Step 4: Enrich and accumulate found words                               │
│      Input:  misc/unknown_chunks_cedict.json + CEDICT                     │
│      Output: misc/unknown_chunks_cedict_enriched.json (accumulated)       │
│                                                                            │
│   Convergence Check: If unknown count unchanged, stop                     │
│                                                                            │
│ Final Step: Seed database with all enriched vocabulary                    │
│    Result: 13,511 total words (11,494 HSK + 2,041 additional)            │
│            146 sentences (0.19%) with 37 rare unknown chunks              │
└────────────────────────────────────────────────────────────────────────────┘

Typical convergence: 3-4 iterations
  Iteration 1: 2042 unknowns → 1806 found in CEDICT
  Iteration 2: 64 unknowns → 27 found in CEDICT
  Iteration 3: 37 unknowns → 0 found (rare variants/proper nouns)
```

### Utility Scripts

| Script                           | Purpose                                                     |
| -------------------------------- | ----------------------------------------------------------- |
| `pipeline.js`                    | Unified enrichment pipeline with iterative convergence      |
| `parse-sentence.js`              | Parse sentence into word IDs using nodejieba + DP algorithm |
| `find-sentences-for-quiz.js`     | Find sentences matching user's vocabulary coverage          |
| `find-sentences-with-unknown.js` | Identify sentences containing unknown chunks                |
| `clean.js`                       | Delete `dist/` and `practice-zh.sqlite3`                    |

### Shared Libraries (`scripts/lib/`)

All scripts use consistent algorithms via shared libraries:

- `lib/cedict.js` - CC-CEDICT loading and word lookup
- `lib/chinese.js` - DP-based optimal token splitting, CJK utilities
- `lib/hsk.js` - HSK word loading from vendor JSON and enriched files
- `lib/db.js` - Database connection utilities

---

## Data Files (`misc/`)

### Primary Sources

| File                                    | Description                           |
| --------------------------------------- | ------------------------------------- |
| `cedict_1_0_ts_utf-8_mdbg.txt`          | CC-CEDICT dictionary (~120k entries)  |
| `sentences_tatoeba.tsv`                 | Raw Tatoeba sentence pairs            |
| `sentences_tatoeba.simplified.tsv`      | Simplified Chinese version            |
| `hacking-chinese_missing-hsk-words.csv` | Words missing from standard HSK lists |

### Generated/Enriched

| File                                               | Generated By  |
| -------------------------------------------------- | ------------- |
| `data/interim/words_additional.json`               | `pipeline.js` |
| `data/interim/unknown_chunks.tsv`                  | `pipeline.js` |
| `data/interim/unknown_chunks_cedict.json`          | `pipeline.js` |
| `data/interim/unknown_chunks_cedict_enriched.json` | `pipeline.js` |
| `data/interim/unknown_chunks_notfound.json`        | `pipeline.js` |
| `data/interim/words_additional.notfound.json`      | `pipeline.js` |

### Manual/Custom

| File                                                          | Purpose                         |
| ------------------------------------------------------------- | ------------------------------- |
| `data/custom/custom_words.json`                               | Hand-curated vocabulary         |
| `data/interim/custom_words_enriched.json`                     | Enriched custom words           |
| `data/custom/words_additional_custom.json`                    | Additional custom words         |
| `data/custom/words_additional_custom_from_unknown_nouns.json` | Manual entries for tricky nouns |

---

## Typical Workflow

```bash
# Complete reset and setup (recommended)
npm run sqlite:setup
# This runs: clean → migrate → seed → pipeline:full (iterative enrichment)

# Or step-by-step:

# 1. Clean slate: reset database
npm run sqlite:clean

# 2. Run full pipeline with iterations (finds gaps until convergence)
npm run pipeline:full

# 3. Check coverage statistics
npm run pipeline:stats

# 4. Manual iteration (if needed)
npm run pipeline:iterate
```

### Individual Commands

```bash
# Complete workflows
npm run sqlite:setup         # Full reset: clean + migrate + seed + pipeline:full
npm run pipeline:full        # Iterative enrichment until convergence + seed DB

# Pipeline stages
npm run pipeline:stats       # Show vocabulary coverage statistics
npm run pipeline:find-unknown # Step 2: Find unknown chunks
npm run pipeline:enrich      # Steps 3-4: CEDICT lookup + enrichment
npm run pipeline:iterate     # Run enrich + seed + find-unknown cycle

# Database operations
npm run seed                 # Run all seed files
npm run seed:words           # Seed only words_additional (upserts, stable IDs)
```

---

## Key Design Decisions

1. **Two-table vocabulary split**: `words_hsk` for canonical HSK words (11,494), `words_additional` for enriched vocabulary (2,041)
2. **CEDICT as enrichment source**: All words get traditional chars, pinyin, and English definitions from 120k-entry dictionary
3. **DP-based optimal splitting**: `splitTokenIntoKnownAndUnknown()` maximizes known word coverage before flagging unknowns
4. **Iterative convergence**: Pipeline runs until unknown count stabilizes (typically 3-4 iterations)
5. **JSON-first architecture**: All enrichment operates on JSON files, database seeded once at end for stable IDs
6. **Upsert-based seeding**: `ON CONFLICT(simplified_zh) DO UPDATE SET` ensures consecutive IDs (1-2041) across re-runs
7. **HSK duplicate prevention**: Filters out 489 HSK words from additional vocabulary to avoid redundancy
8. **Shared algorithm libraries**: All scripts use consistent nodejieba + DP splitting via `lib/chinese.js`

## Final Results

- **Total vocabulary**: 13,511 words (11,494 HSK + 2,041 additional)
- **Sentence coverage**: 74,910/75,056 sentences (99.81%)
- **Remaining unknowns**: 37 rare variants (妳/牠/踫/舖) and proper nouns (芭芭/汤姆)
- **Convergence**: Achieved in 3 iterations (2042 → 64 → 37 unknowns)
