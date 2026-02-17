-- SUBSTITUI ALGUMAS OCORRÊNCIAS DE YAHWEH POR SENHOR
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
-- Elimina notas de rodapé
--
UPDATE bible
SET text = SUBSTR(text, 1, INSTR(text, '[Nota:') - 1) || '' || SUBSTR(text, INSTR(text, ']') + 1)
WHERE text LIKE '%[Nota:%]%';
--
--
UPDATE bible
SET text = SUBSTR(text, 1, INSTR(text, '[Algumas versões') - 1) || '' || SUBSTR(text, INSTR(text, ']') + 1)
WHERE text LIKE '%[Algumas versões%]%';
--
-- Eliminar espacos duplos
--
UPDATE bible
SET text = REPLACE(text, '  ', ' ')
WHERE text LIKE '%  %';
--
-- Eliminar pontos duplos
--
UPDATE bible
SET text = REPLACE(text, '. .', '.')
WHERE text LIKE '%. .%';