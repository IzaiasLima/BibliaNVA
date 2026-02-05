from pathlib import Path
from database import *


livros = {
    "Ageu": "37",
    "Amós": "30",
    "Apocalipse": "66",
    "Atos": "44",
    "Cantares de Salomão": "22",
    "Colossenses": "51",
    "1 Coríntios": "46",
    "2 Coríntios": "47",
    "1 Crônicas": "13",
    "2 Crônicas": "14",
    "Daniel": "27",
    "Deuteronômio": "5",
    "Eclesiastes": "21",
    "Efésios": "49",
    "Esdras": "15",
    "Ester": "17",
    "Êxodo": "2",
    "Ezequiel": "26",
    "Filemom": "57",
    "Filipenses": "50",
    "Gálatas": "48",
    "Gênesis": "1",
    "Habacuque": "35",
    "Hebreus": "58",
    "Isaías": "23",
    "Jeremias": "24",
    "Jó": "18",
    "João": "43",
    "1 João": "62",
    "2 João": "63",
    "3 João": "64",
    "Joel": "29",
    "Jonas": "32",
    "Josué": "6",
    "Judas": "65",
    "Juízes": "7",
    "Lamentações": "25",
    "Levítico": "3",
    "Lucas": "42",
    "Malaquias": "39",
    "Marcos": "41",
    "Mateus": "40",
    "Miquéias": "33",
    "Naum": "34",
    "Neemias": "16",
    "Números": "4",
    "Obadias": "31",
    "Oséias": "28",
    "1 Pedro": "60",
    "2 Pedro": "61",
    "Provérbios": "20",
    "1 Reis": "11",
    "2 Reis": "12",
    "Romanos": "45",
    "Rute": "8",
    "Salmos": "19",
    "1 Samuel": "9",
    "2 Samuel": "10",
    "Sofonias": "36",
    "1 Tessalonicenses": "52",
    "2 Tessalonicenses": "53",
    "Tiago": "59",
    "1 Timóteo": "54",
    "2 Timóteo": "55",
    "Tito": "56",
    "Zacarias": "38",
}


def converter():
    # Converter os arquivos de texto, baixados do Git, para o banco de dados

    p = Path(".")

    folders = [f for f in p.iterdir() if f.is_dir()]

    for folder in folders:
        t = folder / "front" / "title.txt"

        if t.exists():
            with t.open() as tit:
                title = tit.read()

            book_id = livros.get(title)

            if book_id is None:
                print(
                    f"Erro na pasta '{folder}': O nome do livro '{title}' parece estar grafado incorretamente no arquivo 'title.txt'."
                )
                continue

            path = Path(folder)

            # processar apenas um ou mais livros específicos, ignorando os demais
            if title not in [
                "João",
                "Êxodo",
                "Deuteronômio",
                "2 Crônicas",
                "1 Samuael",
                "Jeremias",
            ]:
                continue

            print(f"Processando: {title}")

            for file in path.iterdir():
                if file.name.isdigit():
                    verse_files = [v for v in file.iterdir() if v.name != "title.txt"]
                    verse_files.sort()
                    paragraph = 0

                    for verse in verse_files:
                        with verse.open() as v:
                            text = v.readlines()

                        for txt in text:
                            t = txt.split("\\v ")
                            paragraph += 1

                            if len(t) > 1:
                                for msg in t[1:]:
                                    msg = msg.split(" ")
                                    nr_verse = msg[0].strip()
                                    txt_verse = " ".join(msg[1:]).strip()

                                    try:
                                        add_verse(
                                            db,
                                            int(book_id),
                                            int(file.name),
                                            paragraph,
                                            int(nr_verse),
                                            txt_verse,
                                        )
                                    except Exception as e:
                                        print(f"Erro ao adicionar verso: {e}")
                                        print(
                                            f"Provável local do erro: {verse} ==> {txt}"
                                        )

                            else:
                                msg = t[0].strip()
                                msg = " ".join(msg.split(" ")[2:])
                                nr_verse = "0"
                                txt_verse = msg

                                if txt_verse != "":
                                    try:
                                        add_verse(
                                            db,
                                            int(book_id),
                                            int(file.name),
                                            paragraph,
                                            int(nr_verse),
                                            txt_verse,
                                        )
                                    except Exception as e:
                                        print(f"Erro ao adicionar verso: {e}")
                                        print(
                                            f"Provável local do erro: {verse} ==> {txt}"
                                        )


if __name__ == "__main__":

    db = connect("../database.db")

    create(db)

    try:
        converter()
    except Exception as e:
        print(f"Erro durante a conversão: {e}")
    finally:
        close(db)
