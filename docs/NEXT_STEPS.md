---
sidebar_position: 4
---

# Next Steps: Building the Quiz Feature

Based on your goals, here's what you need to build next. This aligns with TODO items #7-12.

## Backend Tasks

**Important: With htmx, your routes return HTML (not JSON).**

You already have the pattern in your code:

```typescript
const layout = layoutForHtmx(request);
return reply.viewAsync("partial.ejs", data, layout ? { layout } : {});
```

- If `HX-Request` header present → return HTML fragment (no layout)
- If browser navigation → return full page (with layout)

### 1. Create route for quiz sentences

**What:** `GET /quiz/sentence`

**What it should do:**

- Accept query params: `?word_bank_id=<id>` (optional)
- If word_bank_id provided: return sentences where ALL words exist in that user's word bank
- If not provided: return any random sentence
- Join sentence with audio data if available
- **Return HTML:** Render `partials/quiz-sentence.ejs` with sentence data
- Use `layoutForHtmx()` helper to skip layout for htmx requests

**Database queries you'll need:**

- Query `sentences_tatoeba`
- If filtering by word bank: parse sentence (use your `parse-sentence.js` logic), check all words exist in user's bank
- Consider caching parsed sentences or pre-filtering during seed phase

**EJS template structure:**

```html
<!-- views/partials/quiz-sentence.ejs -->
<div id="quiz-sentence">
  <p class="chinese"><%= zh %></p>
  <p class="english hidden" id="answer"><%= en %></p>
  <!-- buttons, audio, etc -->
</div>
```

### 2. Create route to submit quiz answers

**What:** `POST /quiz/answer`

**What it should do:**

- Accept form data: `sentence_id`, `word_bank_id`, `correct` (from htmx request)
- Insert into a new table (you'll need to create): `quiz_attempts` or `user_quiz_history`
- **Return HTML:** Render next sentence + updated stats using `hx-swap-oob`
- Use out-of-band swap to update score without retargeting

**Migration needed:**

```typescript
// Create a table to track quiz attempts
table.increments("id");
table.integer("sentence_id").references("sentences_tatoeba.id");
table.integer("word_bank_id").references("user_bank.id");
table.boolean("correct");
table.integer("time_ms");
table.timestamp("attempted_at").defaultTo(knex.fn.now());
```

### 3. Create route for user stats

**What:** `GET /stats?word_bank_id=<id>`

**What it should do:**

- Return aggregate stats: total quizzes, correct count, accuracy percentage, recent history
- **Return HTML:** Render `partials/stats.ejs` or full `/progress` page
- Use `layoutForHtmx()` to determine if fragment or full page
- Maybe group by date for trend visualization later

### 4. Create route to serve audio

**What:** `GET /audio/:id`

**What it should do:**

- Fetch audio blob from `sentence_audio` table by ID
- Set proper Content-Type header (audio/wav, audio/webm, etc.)
- **Return binary data** (not HTML - this is an exception)
- Stream the binary data as response
- Consider caching headers for performance

**Note:** This route returns binary audio data, not HTML. It's used in `<audio>` src attribute.

---

## Frontend Tasks

### 1. Create quiz page UI (`/quiz`)

**HTML structure you need:**

- Container for Chinese sentence (large, center)
- Hidden container for English translation (revealed after answer)
- Hidden container for Pinyin (toggle button)
- Two buttons: "I know this" / "I don't know"
- Audio play button (if has_audio)
- Score display (correct/total)

**CSS considerations:**

- Chinese text should be large (2-3rem) and readable
- Use contrasting colors for correct/incorrect feedback
- Consider mobile-first design (your goal #7)
- Button states: default, hover, active, disabled

### 2. Add client-side JavaScript

**Since you're using htmx, here's what you need:**

**Core htmx attributes to use:**

- `hx-get="/quiz/sentence"` - Fetch new sentence on page load or button click
- `hx-post="/quiz/answer"` - Submit answer when user clicks "I know" / "I don't know"
- `hx-target="#sentence-container"` - Where to swap in new HTML
- `hx-swap="outerHTML"` - How to replace content (also consider `innerHTML`, `beforeend`)
- `hx-trigger="click"` - When to fire request (also `load`, `revealed`, custom events)
- `hx-vals='{"correct": true}'` - Include additional data with POST
- `hx-indicator="#loading-spinner"` - Show loading state during request

**Quiz flow with htmx:**

1. **Initial load:** `<div hx-get="/quiz/sentence?word_bank_id=1" hx-trigger="load">` fetches first sentence
2. **Show answer:** On button click, use `hx-swap-oob="true"` to reveal English without new request, OR simple Alpine.js/vanilla JS to toggle visibility
3. **Submit & next:** Button does `hx-post="/quiz/answer"` with `hx-include` to grab sentence_id, then server returns next sentence HTML
4. **Audio:** Use `hyperscript` or vanilla JS event listener: `<button _="on click play #audioElement">Play</button>`

**Fetching data:**

```html
<!-- htmx handles this - backend returns HTML partial -->
<div id="quiz-container" hx-get="/quiz/sentence" hx-trigger="load" hx-swap="innerHTML">Loading...</div>
```

> Loading...

</div>
```

**Handling user interaction:**

```html
<!-- Instead of vanilla JS event listeners, use hx-post -->
<button
  hx-post="/quiz/answer"
  hx-vals='{"sentence_id": "123", "correct": true}'
  hx-target="#quiz-container"
  hx-swap="outerHTML"
>
  I know this
</button>
```

**Playing audio:**

```html
<!-- Option 1: htmx extension _hyperscript for inline behavior -->
<button _="on click play #quizAudio">🔊 Play</button>
<audio id="quizAudio" preload="auto">
  <source src="/audio/<%= audio_id %>" type="audio/wav" />
</audio>

<!-- Option 2: Vanilla JS event listener (still simple) -->
<button onclick="document.getElementById('quizAudio').play()">🔊 Play</button>

<!-- Learn: HTML5 Audio API basics, preload attribute -->
<!-- Consider: htmx doesn't need to be involved here - audio is client-side only -->
```

**State management:**

```html
<!-- htmx approach: let backend manage state, return it in HTML -->
<!-- Score gets updated in each response from server -->
<div id="score-display" hx-swap-oob="true">Score: <%= correct %> / <%= total %></div>

<!-- Use hx-swap-oob in your backend response to update multiple targets -->
<!-- Learn: out-of-band swaps, server-side session state -->
<!-- Consider: localStorage for client-side persistence between sessions -->
```

**Key htmx patterns for your quiz:**

1. **Server returns full HTML partials** - No JSON parsing needed
2. **Out-of-band swaps (`hx-swap-oob`)** - Update score/stats without targeting them
3. **Include form data (`hx-include`)** - Send multiple inputs in one POST
4. **Response targets (`HX-Retarget` header)** - Server can override target dynamically
5. **Events (`htmx:afterSwap`)** - Trigger visual feedback after content loads
6. **Loading states (`hx-indicator`)** - Show spinner during requests

### 3. Pinyin display

**What you need:**

- Button/link to toggle Pinyin visibility
- Parse or fetch Pinyin for each word in sentence
- Display above or below characters
- CSS for proper spacing/alignment

**Consider:**

- Should Pinyin come from backend (reliable) or generate client-side?
- Tone colors are nice but not MVP

---

## Learning Resources for Frontend

Since you're new to browser JS/HTML/CSS:

**Key concepts to understand:**

1. **DOM manipulation** - `document.querySelector()`, `.innerHTML`, `.textContent`
2. **Event handling** - `.addEventListener('click', handler)`
3. **Fetch API** - `fetch()`, `.json()`, handling responses
4. **Async/await** - handling asynchronous operations
5. **CSS Flexbox/Grid** - centering content, layouts
6. **CSS transitions** - smooth color changes for feedback

**Recommended approach:**

- Start with vanilla JavaScript (no frameworks yet)
- Use browser DevTools Console to experiment
- Test API endpoints with `curl` or Postman first
- Build incrementally: HTML structure → CSS styling → JS interactivity

---

## Suggested Order of Implementation

1. **Backend:** Quiz sentence endpoint (without word bank filtering first)
2. **Frontend:** Basic quiz UI with hardcoded sentence
3. **Frontend:** Connect to API, display real sentences
4. **Frontend:** Add answer buttons + visual feedback
5. **Backend:** Submit answer endpoint + stats tracking
6. **Frontend:** Submit answers, show stats
7. **Backend:** Word bank filtering for sentences
8. **Frontend:** Word bank selector
9. **Frontend:** Audio playback
10. **Frontend:** Pinyin toggle

---

## Testing Your Work

**Manual tests:**

- Does the page load?
- Does clicking "I know this" show the translation?
- Does the score increment?
- Does audio play (if available)?
- Does it work on mobile screen size?
- What happens if API is slow/fails?

**Browser DevTools:**

- Console: Check for JavaScript errors
- Network: Verify API calls succeed
- Elements: Inspect DOM changes
- Responsive mode: Test mobile layout

---

## Questions to Consider

- How will users select their word bank?
- What happens when they run out of sentences?
- Should there be a "session" concept (10 sentences per session)?
- How to handle sentences without audio?
- What feedback do you show for correct vs incorrect?
- Do you want to prevent reviewing the same sentence too soon?
