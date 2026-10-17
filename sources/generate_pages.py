#!/usr/bin/env python3
"""Gera páginas HTML estáticas de capítulos da Bíblia a partir da API.

Reproduz, para um capítulo arbitrário, um livro completo ou toda a Bíblia, o
mesmo HTML que a navegação do aplicativo exibiria — ou seja, o template
``chapter-template`` de ``static/bible.html`` renderizado com a resposta de
``GET /api/{book}/{chapter}``.

O caminho de saída segue o padrão já adotado no projeto:
``static/books/<NomeDoLivro>/<capítulo>.html`` (ex. ``static/books/Salmos/23.html``).
Como o backend agora resolve caminhos sem extensão, a página também fica
acessível em ``/pages/books/Salmos/23``.

Uso (servidor em execução, por padrão em http://127.0.0.1:8000):

    chapter <abreviação> <capítulo>     # um capítulo:      chapter SL 23
    book <abreviação>                   # livro completo:   book SL
    all                                 # toda a Bíblia:    all

Opções comuns:
    --base-url  URL do servidor (padrão: http://127.0.0.1:8000)
    --out       diretório raiz de saída (padrão: static/books)
    --force     reescreve páginas já existentes (padrão: pula existentes)
    --delay     intervalo em segundos entre requisições (padrão: 0.5;
                use 0 para desativar — relevante apenas em `all`)
    --dry-run   apenas lista o que seria gerado, sem escrever arquivos
    --https     ignora erro de certificado TLS autoassinado (dev local)

Exemplos:

    python3 generate_pages.py chapter SL 23
    python3 generate_pages.py book JD
    python3 generate_pages.py all --dry-run
    python3 generate_pages.py all --base-url https://127.0.0.1:8000 --https

Sai com código 0 em sucesso total, 1 se alguma requisição ou capítulo falhou
(as páginas bem-sucedidas são mantidas) e 2 para erro de uso.
"""
from __future__ import annotations

import argparse
import json
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API_ROOT = "/api"
PAGE_TITLE = "Bíblia NVA - {bookName}, {chapter}"

# Mesmo template "chapter-template" de static/books/index.html, com {{...}}
# pré-expandido. Os espaços residuais (ex.: class="verse ") são os que o
# Mustache deixa ao renderizar, e são mantidos de propósito para que a página
# gerada seja idêntica à exibida pela navegação.
PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="pt-BR">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="htmx-config" content='{{"htmx.config.requestClass":""}}'>
        <title>{title}</title>
        <link rel="manifest" href="/pages/js/manifest.json">
        <link rel="icon" href="/pages/icons/favicon.png" type="image/x-icon">
        <link rel="stylesheet" href="/pages/css/animate.min.css">
        <link rel="stylesheet" href="/pages/css/styles.css">
    </head>

    <body>
        <div class="container">
            <div class="content">

                <!-- Espelho do template "chapter-template" (bible.html) já renderizado
                     com a resposta de GET /api/{bookAbbr}/{chapter}. -->
                <div id="data-render">
                    <div id="chapter-render">

                        <div class="header">
                            <!-- reexibe os capítulos -->
                            <a href="/pages/books/index.html">
                                <img src="/pages/icons/chevron-left.svg" class="icon">
                            </a>

                            <!-- reexibe a lista de livros -->
                            <a href="/pages/books/index.html">
                                <h3 class="title">{bookName}, <span id="chapter">{chapter}</span></h3>
                            </a>

                            <div class="icon-alpha">
                                <a onclick="decFontSize()">
                                    <img src="/pages/icons/text-decrease.svg" class="icon text-decrease">
                                </a>
                                <a onclick="incFontSize()">
                                    <img src="/pages/icons/text-increase.svg" class="icon text-increase">
                                </a>
                            </div>
                        </div>

                        <div class="verses">
                            <p class="title">{subtitle}</p>
                            {verses}
                        </div>

                        <!-- Registrar que o capitulo foi lido -->
                        <div id="btn-position" class="animate__animated animate__faster">
                            <button id="btn-read" data-book="{bookAbbr}" data-chapter="{chapter}"
                                onclick="updateReadChapters(this.dataset.book, this.dataset.chapter)">
                                Registrar como lido
                            </button>
                        </div>

                        <nav class="navigation">
                            <!-- previous chapter -->
                            <div id="nav-arrow" class="chevron" data-book="{bookAbbr}" data-chapter="{chapter}"
                                data-total="{totalChapters}" onclick="navigation(-1)">
                                &nbsp;
                                <img src="/pages/icons/chevron-left.svg">
                                &nbsp;
                            </div>

                            <!-- next chapter -->
                            <div class="chevron" onclick="navigation(1)">
                                &nbsp;
                                <img class="chevron" src="/pages/icons/chevron-right.svg">
                                &nbsp;
                            </div>
                        </nav>

                    </div>
                </div>

            </div>

            <div id="toast" class="animate__animated animate__faster">
                <!-- Hook para exibir mensagem de erro -->
            </div>
        </div>

        <footer>
            <div class="footer">
                <a href="/pages/books/index.html">
                    <img class="icon" src="/pages/icons/book.svg" alt="livros">
                </a>

                <img class="icon" src="/pages/icons/search.svg" onclick="searchShow()" alt="search">

                <img class="icon" src="/pages/icons/last-chapter.svg" onclick="getLastChapter()" alt="last chapter">

                <img class="icon" src="/pages/icons/favorites.svg" onclick="getFavorites()" alt="favorites">

                <img class="icon" src="/pages/icons/download.svg" onclick="toggleOfflinePanel()" alt="modo off-line">
            </div>
        </footer>

        <script src="/pages/js/functions.js"></script>
        <script src="/pages/js/htmx.min.js"></script>
        <script src="/pages/js/mustache.min.js"></script>
        <script src="/pages/js/client-side-templates.min.js"></script>
        <script src="/pages/js/swiped.js"></script>

    </body>

</html>
"""

VERSE_TEMPLATE = """<p class="verse {strong}"><span class="number {strong}">{verse}</span>&ensp;<span>{text}</span></p> """


def mustache_escape(value: object) -> str:
    """Escapa como o Mustache faz em {{...}} (interpolação HTML-escaped)."""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


class Api:
    """Cliente mínimo da API, sem dependências externas."""

    def __init__(self, base_url: str, timeout: float = 30.0, insecure: bool = False):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        # Dev local com certificado autoassinado (mkcert/openssl); nunca em produção.
        self.context = ssl._create_unverified_context() if insecure else None

    def get_json(self, path: str) -> dict:
        url = f"{self.base_url}{API_ROOT}{path}"
        request = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(
            request, timeout=self.timeout, context=self.context
        ) as response:
            return json.loads(response.read().decode("utf-8"))

    def books(self) -> list[dict]:
        """Lista os 66 livros (AT e NT), na ordem canônica."""
        data = self.get_json("")
        return data["old"] + data["new"]

    def chapters(self, book_abbr: str) -> dict:
        return self.get_json(f"/{urllib.parse.quote(book_abbr)}")

    def chapter(self, book_abbr: str, chapter: int) -> dict:
        return self.get_json(f"/{urllib.parse.quote(book_abbr)}/{chapter}")


def render_chapter(data: dict) -> str:
    """Renderiza a resposta de /api/{book}/{chapter} como HTML estático.

    Reproduz a semântica do Mustache sobre o template "chapter-template":
    campos nulos (title, strong) rendem vazio e {{{text}}} não é escapado,
    preservando as tags <mark> devolvidas pela API.
    """
    book_name = data["bookName"]
    book_abbr = data["bookAbbr"]
    chapter = data["chapter"]
    total_chapters = data.get("totalChapters") or ""

    # A rota só devolve title com mais de 10 caracteres; valores nulos ou
    # curtos rendem <p class="title"> vazio, como na navegação.
    title = data.get("title") or ""
    subtitle = mustache_escape(title) if len(title) > 10 else ""

    verses = "\n".join(
        VERSE_TEMPLATE.format(
            strong=mustache_escape(verse.get("strong") or ""),
            verse=verse["verse"],
            # {{{text}}}: interpolação crua (mark, etc.).
            text=verse.get("text") or "",
        )
        for verse in data.get("verses", [])
    )

    return PAGE_TEMPLATE.format(
        title=mustache_escape(PAGE_TITLE.format(bookName=book_name, chapter=chapter)),
        bookAbbr=mustache_escape(book_abbr),
        bookName=mustache_escape(book_name),
        chapter=chapter,
        subtitle=subtitle,
        totalChapters=mustache_escape(total_chapters),
        verses=verses,
    )


def page_path(out_root: Path, book_name: str, chapter: int) -> Path:
    # O nome do diretório é o bookName acentuado (ex.: "Salmos", "Jó").
    return out_root / book_name / f"{chapter}.html"


def write_page(
    out_root: Path, book_name: str, chapter: int, html: str, force: bool, dry_run: bool
) -> str:
    """Grava a página; devolve 'gerada', 'existente' (pulada) ou 'planejada'."""
    target = page_path(out_root, book_name, chapter)
    if target.exists() and not force:
        return "existente"
    if dry_run:
        return "planejada"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding="utf-8")
    return "gerada"


def generate_chapter(
    api: Api,
    book_abbr: str,
    chapter: int,
    out_root: Path,
    force: bool,
    dry_run: bool,
) -> str:
    """Gera um capítulo; devolve o status ('gerada', 'existente', 'planejada')."""
    data = api.chapter(book_abbr, chapter)

    if not data.get("bookAbbr") or not data.get("verses"):
        # A API devolve um corpo vazio (ou só {bookAbbr: ...}) para capítulo
        # inexistente — o mesmo que a navegação interpretaria como ausente.
        raise LookupError(
            f"capítulo inexistente: {book_abbr} {chapter} (resposta sem versículos)"
        )

    html = render_chapter(data)
    return write_page(out_root, data["bookName"], chapter, html, force, dry_run)


def plan_book(api: Api, book_abbr: str) -> tuple[dict, list[int]]:
    """Resolve o livro pela abreviação (case-insensitive) e lista os capítulos."""
    wanted = book_abbr.casefold()
    for book in api.books():
        if book["bookAbbr"].casefold() == wanted:
            return book, list(range(1, book["maxChapters"] + 1))
    raise LookupError(f"livro não encontrado: {book_abbr!r}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Gera páginas HTML estáticas a partir da API da Bíblia NVA.",
        epilog=__doc__.split("Uso", 1)[1] if __doc__ else None,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "mode",
        choices=["chapter", "book", "all"],
        help="chapter: um capítulo | book: livro completo | all: toda a Bíblia",
    )
    parser.add_argument("args", nargs="*", help="[abreviação] [capítulo]")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--out", default="../static/books")
    parser.add_argument("--force", action="store_true", help="reescreve existentes")
    parser.add_argument("--delay", type=float, default=0.5)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--verbose", action="store_true", help="lista cada página também em --dry-run"
    )
    parser.add_argument(
        "--https", action="store_true", help="ignora certificado TLS autoassinado"
    )
    ns = parser.parse_args(argv)

    if ns.mode == "chapter":
        if len(ns.args) != 2 or not ns.args[1].isdigit():
            parser.error("modo 'chapter' exige: chapter <abreviação> <capítulo>")
        abbr, chapter = ns.args[0], int(ns.args[1])
        jobs = [(abbr, c) for c in [chapter]]
    elif ns.mode == "book":
        if len(ns.args) != 1:
            parser.error("modo 'book' exige: book <abreviação>")
        abbr = ns.args[0]
        jobs = None  # resolvido abaixo, via API
    else:
        if ns.args:
            parser.error("modo 'all' não recebe argumentos posicionais")
        abbr = None
        jobs = None

    api = Api(ns.base_url, insecure=ns.https)
    out_root = Path(ns.out)

    # Monta a lista de (abreviação, capítulo) a processar. Falhas aqui são
    # reportadas como erro de uso/ambiente, sem stack trace.
    try:
        if ns.mode == "all":
            books = api.books()
            plan = [
                (book["bookAbbr"], chapter)
                for book in books
                for chapter in range(1, book["maxChapters"] + 1)
            ]
        elif ns.mode == "book":
            book, chapters = plan_book(api, abbr)
            plan = [(book["bookAbbr"], c) for c in chapters]
        else:
            book, _ = plan_book(api, abbr)
            if not 1 <= chapter <= book["maxChapters"]:
                parser.error(
                    f"capítulo fora do intervalo: {abbr} {chapter} "
                    f"(1..{book['maxChapters']})"
                )
            plan = [(abbr, chapter)]
    except LookupError as exc:
        print(f"erro: {exc}", file=sys.stderr)
        return 2
    except (urllib.error.URLError, OSError) as exc:
        reason = getattr(exc, "reason", exc)
        print(
            f"erro: não foi possível consultar {ns.base_url} ({reason}). "
            "Verifique se o servidor está em execução.",
            file=sys.stderr,
        )
        return 2

    total = len(plan)
    print(
        f"{'Planejados' if ns.dry_run else 'Gerando'} {total} capítulo(s) "
        f"de {ns.base_url} em {out_root}/"
    )

    generated = skipped = planned = failed = 0
    for index, (book_abbr, chapter) in enumerate(plan, start=1):
        try:
            status = generate_chapter(api, book_abbr, chapter, out_root, ns.force, ns.dry_run)
        except (urllib.error.URLError, LookupError, OSError, json.JSONDecodeError) as exc:
            failed += 1
            print(f"  [{index}/{total}] ERRO {book_abbr} {chapter}: {exc}", file=sys.stderr)
            continue

        if status == "gerada":
            generated += 1
            print(f"  [{index}/{total}] gerada {book_abbr} {chapter}")
        elif status == "planejada":
            planned += 1
        else:
            skipped += 1

        if ns.delay and index < total and (not ns.dry_run or ns.verbose):
            time.sleep(ns.delay)

    print(
        f"Concluído: {generated} gerada(s), {skipped} existente(s) mantida(s), "
        f"{planned} planejada(s), {failed} falha(s)."
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
