from fastapi import FastAPI, Depends
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from sqlalchemy import and_
from sqlalchemy.orm import Session
import uvicorn

from db import get_db
from models import BibleORM, BooksORM, FavoritesORM
from schemas import (
    ListVersesSchema,
    ListBibleSchema,
    ChaptersSchema,
    BooksSchema,
    BibleSchema,
    ListBooksSchema,
)

# from utils import booksAbbr, bookIds, booksNames, maxChapters, favorites
import random

app = FastAPI(
    title="Bíblia NVA - API",
    version="1.1.3",
    summary="""Este site/aplicativo reproduz o texto da tradução da Bíblia Nova Versão de Acesso Livre (NVA), 
    disponibilizado para acesso livre por meio da licença Creative Commons Attribution-ShareAlike 4.0 
    International (CC BY-SA 4.0).""",
    license_info={
        "name": "CC BY-SA 4.0",
        "url": "hhttps://creativecommons.org/licenses/by-sa/4.0/",
    },
)

app.mount("/pages", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=RedirectResponse)
def read_root():
    return RedirectResponse(url="/pages/index.html")


@app.get("/api", response_model=ListBooksSchema)
def get_books(db: Session = Depends(get_db)):
    books_at = db.query(BooksORM).filter(BooksORM.book_id < 40).all()
    books_nt = db.query(BooksORM).filter(BooksORM.book_id >= 40).all()

    old = [
        BooksSchema(
            bookId=book.book_id,
            bookName=book.book_name,
            bookAbbr=book.book_abbr,
            maxChapters=book.max_chapters,
        )
        for book in books_at
    ]

    new = [
        BooksSchema(
            bookId=book.book_id,
            bookName=book.book_name,
            bookAbbr=book.book_abbr,
            maxChapters=book.max_chapters,
        )
        for book in books_nt
    ]
    return ListBooksSchema(old=old, new=new)


@app.get(
    "/api/favorites",
    response_model=list[BibleSchema],
    response_model_exclude_none=True,
)
def get_favorites(db: Session = Depends(get_db)):
    data = (
        db.query(BibleORM, BooksORM)
        .join(BooksORM, BibleORM.book == BooksORM.book_id)
        .filter(
            BibleORM.book == FavoritesORM.book,
            BibleORM.chapter == FavoritesORM.chapter,
            BibleORM.verse == FavoritesORM.verse,
        )
        .order_by(BibleORM.book, BibleORM.chapter, BibleORM.verse)
        .all()
    )

    resp = [
        BibleSchema(
            chapter=d.BibleORM.chapter,
            verse=d.BibleORM.verse,
            text=d.BibleORM.text,
            bookName=d.BooksORM.book_name,
            bookAbbr=d.BooksORM.book_abbr,
        )
        for d in data
    ]

    return resp


@app.get(
    "/api/{book}",
    response_model=ChaptersSchema,
    response_model_exclude_none=True,
)
def get_chapters(book: str, db: Session = Depends(get_db)):
    try:
        this_book = (
            db.query(BooksORM).filter(BooksORM.book_abbr == book.upper()).first()
        )

        prev_book = (
            db.query(BooksORM).filter(BooksORM.book_id == this_book.book_id - 1).first()
        )

        next_book = (
            db.query(BooksORM).filter(BooksORM.book_id == this_book.book_id + 1).first()
        )

        if this_book:
            chapters = ChaptersSchema(
                bookName=this_book.book_name,
                bookAbbr=this_book.book_abbr,
                prevBook=prev_book.book_abbr if prev_book else None,
                nextBook=next_book.book_abbr if next_book else None,
                chapters=[x + 1 for x in range(0, this_book.max_chapters)],
            )
        else:
            chapters = ChaptersSchema()

        return chapters

    except Exception:
        return ChaptersSchema()


@app.get(
    "/api/favorite/random",
    response_model=ListVersesSchema,
    response_model_exclude_none=True,
)
def get_favorite_random(db: Session = Depends(get_db)):
    favorites = (
        db.query(FavoritesORM, BooksORM.book_abbr)
        .join(BooksORM, FavoritesORM.book == BooksORM.book_id)
        .all()
    )

    choice = random.randint(0, len(favorites) - 1)

    selected = favorites[choice] if choice < len(favorites) else 0
    favorite, book = selected

    data = get_bible_verses(book, favorite.chapter, favorite.verses, db)
    text = " ".join(t.text for t in data.verses.root)

    resp = [
        BibleSchema(
            chapter=favorite.chapter,
            verse=favorite.verse,
            text=text,
        )
    ]

    result = ListVersesSchema(
        bookName=data.bookName,
        bookAbbr=data.bookAbbr,
        verses=ListBibleSchema(root=resp),
    )

    return result


@app.get(
    "/api/search/{words}",
    response_model=list[BibleSchema],
    response_model_exclude_none=True,
)
def biblie_search_words(words: str, db: Session = Depends(get_db)):
    terms = [w for w in words.split() if len(w) > 2]
    words = " ".join(terms)

    data = (
        db.query(BibleORM, BooksORM)
        .join(BooksORM)
        .filter(and_(*[BibleORM.text.like(f"%{term}%") for term in terms]))
        .order_by(BibleORM.book, BibleORM.chapter, BibleORM.verse)
        .all()
    )

    resp = [
        BibleSchema(
            chapter=d.BibleORM.chapter,
            verse=d.BibleORM.verse,
            text=d.BibleORM.text,
            bookName=d.BooksORM.book_name,
            bookAbbr=d.BooksORM.book_abbr,
            words=words,
        )
        for d in data
    ]

    return resp


@app.get(
    "/api/{book}/{chapter}",
    response_model=ListVersesSchema,
    response_model_exclude_none=True,
)
def get_chapter(
    book: str,
    chapter: int,
    words: str | None = None,
    verse: int | None = None,
    db: Session = Depends(get_db),
):
    try:
        title = (
            db.query(BibleORM, BooksORM)
            .join(BooksORM)
            .filter(
                BooksORM.book_abbr == book.upper(),
                BibleORM.chapter == chapter,
                BibleORM.verse == 0,
            )
            .first()
        )

        data = (
            db.query(BibleORM, BooksORM)
            .join(BooksORM)
            .filter(
                BooksORM.book_abbr == book.upper(),
                BibleORM.chapter == chapter,
                BibleORM.verse > 0,
            )
            .order_by(BibleORM.verse)
            .all()
        )

        resp = [
            BibleSchema(
                chapter=d.BibleORM.chapter,
                verse=d.BibleORM.verse,
                text=d.BibleORM.text,
                strong="strong" if verse and d.BibleORM.verse == verse else None,
            )
            for d in data
        ]

        data_list = ListVersesSchema(
            chapter=data[0].BibleORM.chapter,
            bookName=data[0].BooksORM.book_name,
            bookAbbr=data[0].BooksORM.book_abbr,
            verses=ListBibleSchema(root=resp),
            totalChapters=data[0].BooksORM.max_chapters,
            words=words,
            title=(
                title.BibleORM.text if title and len(title.BibleORM.text) > 10 else None
            ),
        )
        return data_list

    except Exception:
        return ListVersesSchema()


@app.get(
    "/api/{book}/{chapter}/{verses}",
    response_model=ListVersesSchema,
    response_model_exclude_none=True,
)
def get_bible_verses(
    book: str, chapter: int, verses: str, db: Session = Depends(get_db)
):
    try:
        if "-" in verses:
            start, end = map(int, verses.split("-"))
            list_verses = list(range(start, end + 1))
        else:
            list_verses = list(map(int, verses.split(",")))

        data = (
            db.query(BibleORM, BooksORM)
            .join(BooksORM, BibleORM.book == BooksORM.book_id)
            .filter(
                BooksORM.book_abbr == book.upper(),
                BibleORM.chapter == chapter,
                BibleORM.verse.in_(list_verses),
            )
            .all()
        )

        resp = [
            BibleSchema(
                chapter=d.BibleORM.chapter,
                verse=d.BibleORM.verse,
                text=d.BibleORM.text,
            )
            for d in data
        ]

        data_list = ListVersesSchema(
            bookName=data[0].BooksORM.book_name,
            bookAbbr=data[0].BooksORM.book_abbr,
            chapter=chapter,
            verses=ListBibleSchema(root=resp),
        )
        return data_list

    except Exception:
        return ListVersesSchema()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
