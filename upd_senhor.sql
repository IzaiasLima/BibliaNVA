--
-- Update de Yahweh para SENHOR em alguns textos
--

-- No inicio da frase
--
UPDATE bible
SET text = REPLACE(text, 'Yahweh ', 'O <mark>Senhor</mark> ')
WHERE text LIKE 'Yahweh %';
--
-- No meio da frase (de para do)
--
UPDATE bible
SET text = REPLACE(text, 'de Yahweh', 'do <mark>Senhor</mark>')
WHERE text LIKE '%de Yahweh%';
--
-- Para o Senhor dos Exércitos
--
UPDATE bible
SET text = REPLACE(
        text,
        'diz Yahweh dos Exércitos',
        'diz o <mark>Senhor</mark> dos Exércitos'
    )
WHERE text LIKE '%diz Yahweh dos Exércitos%';
--
-- Eliminar espacos duplos
--
UPDATE bible
SET text = REPLACE(text, '  ', ' ')
WHERE text LIKE '%  %';