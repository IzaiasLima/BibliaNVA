CREATE TABLE IF NOT EXISTS books (
    book_id INTEGER NOT NULL,
    book_name TEXT NOT NULL,
    book_abbr TEXT NOT NULL,
    max_chapters INTEGER NOT NULL,
    PRIMARY KEY (book_id)
) WITHOUT ROWID;
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (1, 'Gênesis', 'GN', 50);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (2, 'Êxodo', 'EX', 40);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (3, 'Levítico', 'LV', 27);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (4, 'Números', 'NM', 36);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (5, 'Deuteronômio', 'DT', 34);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (6, 'Josué', 'JS', 24);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (7, 'Juízes', 'JZ', 21);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (8, 'Rute', 'RT', 4);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (9, '1 Samuel', '1SM', 31);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (10, '2 Samuel', '2SM', 24);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (11, '1 Reis', '1RS', 22);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (12, '2 Reis', '2RS', 25);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (13, '1 Crônicas', '1CR', 29);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (14, '2 Crônicas', '2CR', 36);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (15, 'Esdras', 'ED', 10);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (16, 'Neemias', 'NE', 13);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (17, 'Ester', 'ET', 10);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (18, 'Jó', 'JÓ', 42);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (19, 'Salmos', 'SL', 150);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (20, 'Provérbios', 'PV', 31);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (21, 'Eclesiastes', 'EC', 12);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (22, 'Cânticos', 'CT', 8);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (23, 'Isaías', 'IS', 66);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (24, 'Jeremias', 'JR', 52);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (25, 'Lamentações', 'LM', 5);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (26, 'Ezequiel', 'EZ', 48);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (27, 'Daniel', 'DN', 12);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (28, 'Oséias', 'OS', 14);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (29, 'Joel', 'JL', 3);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (30, 'Amós', 'AM', 9);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (31, 'Obadias', 'OB', 1);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (32, 'Jonas', 'JN', 4);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (33, 'Miquéias', 'MQ', 7);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (34, 'Naum', 'NA', 3);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (35, 'Habacuque', 'HC', 3);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (36, 'Sofonias', 'SF', 3);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (37, 'Ageu', 'AG', 2);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (38, 'Zacarias', 'ZC', 14);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (39, 'Malaquias', 'ML', 4);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (40, 'Mateus', 'MT', 28);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (41, 'Marcos', 'MC', 16);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (42, 'Lucas', 'LC', 24);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (43, 'João', 'JO', 21);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (44, 'Atos', 'AT', 28);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (45, 'Romanos', 'RM', 16);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (46, '1 Coríntios', '1CO', 16);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (47, '2 Coríntios', '2CO', 13);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (48, 'Gálatas', 'GL', 6);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (49, 'Efésios', 'EF', 6);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (50, 'Filipenses', 'FP', 4);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (51, 'Colossenses', 'CL', 4);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (52, '1 Tessalonicenses', '1TS', 5);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (53, '2 Tessalonicenses', '2TS', 3);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (54, '1 Timóteo', '1TM', 6);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (55, '2 Timóteo', '2TM', 4);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (56, 'Tito', 'TT', 3);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (57, 'Filemom', 'FL', 1);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (58, 'Hebreus', 'HB', 13);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (59, 'Tiago', 'TG', 5);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (60, '1 Pedro', '1PE', 5);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (61, '2 Pedro', '2PE', 3);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (62, '1 João', '1JO', 5);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (63, '2 João', '2JO', 1);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (64, '3 João', '3JO', 1);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (65, 'Judas', 'JD', 1);
INSERT INTO books (book_id, book_name, book_abbr, max_chapters)
VALUES (66, 'Apocalipse', 'AP', 22);