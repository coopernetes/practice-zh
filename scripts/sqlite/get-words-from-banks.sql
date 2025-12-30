SELECT DISTINCT w.simplified_zh
FROM words w
JOIN user_bank_words ubw ON w.id = ubw.word_id
WHERE ubw.bank_id IN (1, 2, 3, 4, 5);