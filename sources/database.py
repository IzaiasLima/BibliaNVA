import sqlite3


def connect(caminho: str) -> sqlite3.Connection:
    """Abre conexão com o banco de dados SQLite."""
    return sqlite3.connect(caminho)


def create(conexao: sqlite3.Connection) -> None:
    """Cria uma tabela de exemplo."""
    cursor = conexao.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS bible (
            book INTEGER NOT NULL,
            chapter INTEGER NOT NULL,
            paragraph INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            text TEXT NOT NULL,
            PRIMARY KEY (BOOK, CHAPTER, PARAGRAPH, VERSE)
        ) WITHOUT ROWID;
    """
    )
    conexao.commit()


def add_verse(
    conexao: sqlite3.Connection,
    book: int,
    chapter: int,
    paragraph: int,
    verse: int,
    text: str,
) -> None:
    """Insere um versículo no banco de dados."""
    cursor = conexao.cursor()
    cursor.execute(
        """
        INSERT INTO bible (book, chapter, paragraph, verse, text)
        VALUES (?, ?, ?, ?, ?)
    """,
        (book, chapter, paragraph, verse, text),
    )
    conexao.commit()


def close(conexao: sqlite3.Connection) -> None:
    """Fecha a conexão com o banco de dados."""
    conexao.close()
