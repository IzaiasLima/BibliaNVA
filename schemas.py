from typing import Optional
from pydantic import BaseModel, RootModel


# Pydantic Schema
class BooksSchema(BaseModel):
    old: list[dict]
    new: list[dict]

    class Config:
        from_attributes = True


class ChaptersSchema(BaseModel):
    bookName: Optional[str] = None
    bookAbbr: Optional[str] = None
    chapter: Optional[int] = None
    chapters: Optional[list[int]] = []
    prevBook: Optional[str] = None
    nextBook: Optional[str] = None

    class Config:
        from_attributes = True


class BibleSchema(BaseModel):
    book: Optional[int] = None
    chapter: int
    verse: int
    text: str
    bookName: Optional[str] = None
    bookAbbr: Optional[str] = None
    words: Optional[str] = None
    strong: Optional[str] = None

    class Config:
        from_attributes = True


class ListBibleSchema(RootModel):
    root: list[BibleSchema]


class ListVersesSchema(BaseModel):
    chapter: Optional[int] = None
    totalChapters: Optional[int] = None
    verses: Optional[ListBibleSchema] = None
    title: Optional[str] = None
    bookName: Optional[str] = None
    bookAbbr: Optional[str] = None
    words: Optional[str] = None

    class Config:
        from_attributes = True
