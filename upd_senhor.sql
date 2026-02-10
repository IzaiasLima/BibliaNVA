-- Inicio da frase
--
UPDATE bible
SET text = REPLACE(text, 'Yahweh', 'O <mark>Senhor<mark>')
WHERE text LIKE 'Yahweh%'
    AND book = 19
    AND chapter = 23;
--
-- No meio da frase (de para do)
--
UPDATE bible
SET text = REPLACE(text, 'de Yahweh', 'do <mark>Senhor<mark>')
WHERE text LIKE '%de Yahweh%'
    AND book = 19
    AND chapter = 23;