from pydantic import BaseModel, RootModel


# Pydantic Schema
class BooksSchema(BaseModel):
    old: list[dict]
    new: list[dict]

    class Config:
        from_attributes = True


class ChaptersSchema(BaseModel):
    bookName: str
    bookAbbr: str
    chapters: list[int]
    prevBook: str
    nextBook: str

    class Config:
        from_attributes = True


class BibleSchema(BaseModel):
    book: int
    chapter: int
    verse: int
    text: str

    class Config:
        from_attributes = True


class ListBibleSchema(RootModel):
    root: list[BibleSchema]


class ListVersesSchema(BaseModel):
    bookName: str
    bookAbbr: str
    title: str
    verses: ListBibleSchema

    class Config:
        from_attributes = True


# data = ListBibleSchema.model_validate(
#     [
#         {
#             "book": 1,
#             "chapter": 1,
#             "verse": 1,
#             "text": "No princípio, criou Deus os céus e a terra.",
#         },
#         {
#             "book": 1,
#             "chapter": 1,
#             "verse": 2,
#             "text": "A terra estava sem forma e vazia; e as trevas estavam sobre a face do abismo; e o Espírito de Deus se movia sobre a face das águas.",
#         },
#     ]
# )
