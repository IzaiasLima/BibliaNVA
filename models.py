from sqlalchemy import Column, Integer, String, PrimaryKeyConstraint
from sqlalchemy.orm import declarative_base

# SQLAlchemy Model
Base = declarative_base()


class BibleORM(Base):
    __tablename__ = "bible"
    __table_args__ = (PrimaryKeyConstraint("book", "chapter", "verse"),)

    book = Column(Integer)
    chapter = Column(Integer)
    verse = Column(Integer)
    text = Column(String)
