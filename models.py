from sqlalchemy import Column, Integer, String, PrimaryKeyConstraint, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class BibleORM(Base):
    __tablename__ = "bible"
    __table_args__ = (PrimaryKeyConstraint("book", "chapter", "verse"),)

    book = Column(Integer, ForeignKey("books.book_id"))
    chapter = Column(Integer)
    verse = Column(Integer)
    text = Column(String)


class BooksORM(Base):
    __tablename__ = "books"
    __table_args__ = (PrimaryKeyConstraint("book_id"),)

    book_id = Column(Integer)
    book_name = Column(String)
    book_abbr = Column(String)
    max_chapters = Column(Integer)


class FavoritesORM(Base):
    __tablename__ = "favorites"
    __table_args__ = (PrimaryKeyConstraint("id"),)

    id = Column(Integer, primary_key=True)
    book = Column(Integer)
    chapter = Column(Integer)
    verse = Column(Integer)
    verses = Column(String)
