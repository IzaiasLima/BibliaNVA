from fastapi import FastAPI, Depends
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from sqlalchemy import select, and_
from sqlalchemy.orm import Session
import uvicorn

from db import get_db
from models import BibleORM
from schemas import (
    ListVersesSchema,
    ListBibleSchema,
    ChaptersSchema,
    BooksSchema,
    BibleSchema,
)
from utils import booksAbbr, bookIds, booksNames, maxChapters

app = FastAPI(
    title="Bíblia Nova Versão de Acesso Livre (NVA)",
    version="1.0.5",
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


@app.get("/api", response_model=BooksSchema)
def get_books():
    old = [
        dict(book=id, bookAbbr=abbr, bookName=booksNames.get(id, ""))
        for abbr, id in bookIds.items()
        if id < 40
    ]
    new = [
        dict(book=id, bookAbbr=abbr, bookName=booksNames.get(id, ""))
        for abbr, id in bookIds.items()
        if id >= 40
    ]

    old.sort(key=lambda x: x["book"])
    new.sort(key=lambda x: x["book"])

    return BooksSchema(old=old, new=new)


# Endpoints
@app.get(
    "/api/{book}",
    response_model=ChaptersSchema,
    response_model_exclude_none=True,
)
def get_chapters(book: str, db: Session = Depends(get_db)):
    bookId = bookIds.get(book.upper(), 0)

    try:
        data = (
            db.query(BibleORM.chapter)
            .filter(
                BibleORM.book == bookId,
            )
            .distinct()
            .all()
        )

        chapters = (
            ChaptersSchema(
                bookName=booksNames.get(bookId, ""),
                bookAbbr=book.upper(),
                chapters=[chapter for (chapter,) in data],
                prevBook=booksAbbr(bookId - 1),
                nextBook=booksAbbr(bookId + 1),
            )
            if data
            else ChaptersSchema()
        )
        return chapters

    except Exception:
        return ChaptersSchema()


@app.get(
    "/api/search/{words}",
    response_model=list[BibleSchema],
    response_model_exclude_none=True,
)
def biblie_search_words(words: str, db: Session = Depends(get_db)):
    terms = words.split()
    filter = [BibleORM.text.like(f"%{word}%") for word in terms]
    stmt = select(BibleORM).where(and_(*filter))
    results = db.execute(stmt).scalars().all()

    result = [
        BibleSchema(
            chapter=v.chapter,
            verse=v.verse,
            text=v.text,
            bookName=booksNames.get(v.book, ""),
            bookAbbr=booksAbbr(v.book),
            words=words,
        )
        for v in results
    ]
    return result


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
    bookId = bookIds.get(book.upper(), 0)
    tot_chapters = maxChapters.get(bookId)

    try:
        title = (
            db.query(BibleORM)
            .filter(
                BibleORM.book == bookId,
                BibleORM.chapter == chapter,
            )
            .where(BibleORM.verse == 0)
            .first()
        )

        data = (
            db.query(BibleORM)
            .filter(
                BibleORM.book == bookId,
                BibleORM.chapter == chapter,
            )
            .where(BibleORM.verse > 0)
            .order_by(BibleORM.verse)
            .all()
        )

        data = [
            BibleSchema(
                chapter=d.chapter,
                verse=d.verse,
                text=d.text,
                bookName=booksNames.get(d.book, ""),
                bookAbbr=booksAbbr(d.book),
                words=words,
                strong="strong" if verse and d.verse == verse else None,
            )
            for d in data
        ]

        data_list = ListVersesSchema(
            chapter=chapter,
            title=title.text if title and len(title.text) > 10 else None,
            verses=ListBibleSchema(root=data),
            bookName=booksNames.get(bookId, ""),
            bookAbbr=book.upper(),
            totalChapters=tot_chapters,
            words=words,
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
    bookId = bookIds.get(book.upper(), 0)

    try:
        if "-" in verses:
            start, end = map(int, verses.split("-"))
            list_verses = list(range(start, end + 1))
        else:
            list_verses = list(map(int, verses.split(",")))

        data = (
            db.query(BibleORM)
            .filter(
                BibleORM.book == bookId,
                BibleORM.chapter == chapter,
                BibleORM.verse.in_(list_verses),
            )
            .all()
        )

        data_list = ListVersesSchema(
            bookName=booksNames.get(bookId, ""),
            bookAbbr=book.upper(),
            chapter=chapter,
            verses=ListBibleSchema(root=data),
        )
        return data_list

    except Exception:
        return ListVersesSchema()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
