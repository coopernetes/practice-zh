---
sidebar_position: 2
---

# Development Goals

This is a wish list of things I'd like to use in practice-zh.

### Must haves

1. Phrase/sentence-based testing. Given a sentence in Chinese, what is its meaning in English? Similar to flash card systems, a simple "correct" or "incorrect".
2. Keep track of scores for correct guesses.
3. The ability to view the Pinyin for a given word or set of words.
4. A "sliding scale" of test phrases that increase in difficulty as I progress through the guided curriculums of other apps like HelloChinese. In other words, if I complete 5 lessons and learn 100 words, I should be able to tell me app "hey, here's 100 words I've learnt. Give me test phrases against that word list". It should be dynamic in that I can add to this word bank over time.
5. The ability to be tested using phrases that match my
6. A large variety of phrases and supplemented with large language models. Use LLMs what they're good for and don't rely on generative outputs solely since they may not be very accurate.
7. Highly responsive and performant. I just have spotty home internet & cell reception at times.

### Nice to haves

1. Text-to-speech for a phrase or word. Use something like [Google's TTS APIs](https://docs.cloud.google.com/text-to-speech/docs/reference/rest).
2. Light & dark modes.
3. Spaced repetition.
4. Audio only tests for better speech recognition.
5. Convert phrases to use traditional characters.

### Non-goals

- Compete with HelloChinese, Duolingo or other language learner providers. I'm quite happy with the native speaker content, the variety of learning delivery methods (fill in the blanks, )
- Add AI for the heck of it. I _do_ think this app wil greatly benefit from carefully planned LLM usage along with RAG. I am motivated to explore LLMs like OpenAI, Gemini or Qwen but only where it makes sense to add it. It would be easy to vibe code a crappy site that serves up generated content...But I've already had useful chats on those tools already and this app is a habit builder primarily, not a wrapper around a chat bot.
