from fastapi import FastAPI, Depends
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import uvicorn

from db import get_db
from models import BibleORM
from schemas import ListVersesSchema, ListBibleSchema, ChaptersSchema, BooksSchema
from utils import bookIds, booksAbbr, booksNames

app = FastAPI()

app.mount("/pages", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=RedirectResponse)
def read_root():
    return RedirectResponse(url="/pages/index.html")


@app.get("/api", response_class=RedirectResponse)
def read_root():
    return RedirectResponse(url="/pages/sobre.html")


@app.get("/biblia", response_model=BooksSchema)
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
@app.get("/biblia/{book}", response_model=ChaptersSchema)
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
            else ChaptersSchema(chapters=[])
        )
        return chapters

    except Exception:
        return ChaptersSchema()


@app.get("/biblia/{book}/{chapter}", response_model=ListVersesSchema)
def get_chapter(book: str, chapter: int, db: Session = Depends(get_db)):
    try:
        title = (
            db.query(BibleORM)
            .filter(
                BibleORM.book == bookIds.get(book.upper(), 0),
                BibleORM.chapter == chapter,
            )
            .where(BibleORM.verse == 0)
            .first()
        )

        data = (
            db.query(BibleORM)
            .filter(
                BibleORM.book == bookIds.get(book.upper(), 0),
                BibleORM.chapter == chapter,
            )
            .where(BibleORM.verse > 0)
            .order_by(BibleORM.verse)
            .all()
        )

        data_list = ListVersesSchema(
            bookName=booksNames.get(bookIds.get(book.upper(), 0), ""),
            bookAbbr=book.upper(),
            title=title.text if title and len(title.text) > 10 else "",
            verses=ListBibleSchema(root=data),
        )

        return data_list if data_list else ListVersesSchema(root=[])
    except Exception:
        return ListVersesSchema(root=[])


@app.get("/biblia/{book}/{chapter}/{verses}", response_model=ListVersesSchema)
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
            db.query(BibleORM)
            .filter(
                BibleORM.book == bookIds.get(book.upper(), 0),
                BibleORM.chapter == chapter,
                BibleORM.verse.in_(list_verses),
            )
            .all()
        )

        data_list = ListVersesSchema(
            bookName=booksNames.get(bookIds.get(book.upper(), 0), ""),
            bookAbbr=book.upper(),
            title="",
            verses=ListBibleSchema(root=data),
        )

        return data_list

    except Exception:
        return ListVersesSchema(
            bookName="", bookAbbr="", title="", verses=ListBibleSchema(root=[])
        )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
