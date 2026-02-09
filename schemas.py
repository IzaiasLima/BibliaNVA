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
    bookName: Optional[str] = None
    bookAbbr: Optional[str] = None
    book: Optional[int] = None
    chapter: int
    verse: int
    text: str

    class Config:
        from_attributes = True


class ListBibleSchema(RootModel):
    root: list[BibleSchema]


class ListVersesSchema(BaseModel):
    bookName: Optional[str] = None
    bookAbbr: Optional[str] = None
    chapter: Optional[int] = None
    totalChapters: Optional[int] = None
    title: Optional[str] = None
    verses: Optional[ListBibleSchema] = None

    class Config:
        from_attributes = True
