// Ativa o Service Worker que permite e site ser instalado como APP (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/pages/js/service-worker.js')
        .then(reg => console.log('Service Worker registrado'))
        .catch(err => console.log('Erro:', err));
}

const input = document.getElementById("search");
if (input) input.addEventListener('keyup', searchWords);


// Exibe o campo de pesquisa (ou realiza a pesquisa, se o campo já está preenchido)
function searchShow() {
    const elm = document.getElementById("search-position");
    elm.classList.add('show', 'animate__fadeInUp');
    input.focus();

    if (input.value) {
        const elm = document.getElementById("search-position");
        searcByhWords(input.value);
        elm.classList.remove('show', 'animate__fadeInUp');
        input.value = null;
    }
}

// Realiza a pesquisa, se for digitado o ENTER
function searchWords(evt) {
    if (evt.type == 'keyup' && evt.key == 'Enter') {
        const elm = document.getElementById("search-position");
        searcByhWords(input.value);
        elm.classList.remove('show', 'animate__fadeInUp');
        input.value = null;
    }
}

// salva capitulos lidos
function setReadChapters(book, chapter) {
    const readChapters = JSON.parse(localStorage.getItem('readChapters')) || { books: [] };
    const bookIndex = readChapters.books.findIndex(b => b.name === book);

    if (bookIndex > -1) {
        if (!readChapters.books[bookIndex].chapters.includes(chapter)) {
            readChapters.books[bookIndex].chapters.push(chapter);
        }
    } else {
        readChapters.books.push({ name: book, chapters: [chapter] });
    }
    localStorage.setItem('readChapters', JSON.stringify(readChapters));
}

// verifica se o capitulo foi lido
function isReadChapters(book, chapter) {
    const readChapters = JSON.parse(localStorage.getItem('readChapters')) || { books: [] };
    const bookIndex = readChapters.books.findIndex(b => b.name === book);
    return readChapters.books[bookIndex].chapters.includes(chapter);
}

// salva o altimo capitulo lido
function setLastChapter(book, chapter) {
    const lastState = { book: book, chapter: chapter };
    localStorage.setItem('lastState', JSON.stringify(lastState));
}

// reexibe o ultiomo capitolo lido
function getLastChapter() {
    var lastState = JSON.parse(localStorage.getItem('lastState'))

    if (!lastState) {
        lastState = { book: 'SL', chapter: 23 };
    }
    chapterView(lastState.book, lastState.chapter);
}

function showBtnRead() {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const btn = document.getElementById("btn-read");
    const position = document.getElementById("btn-position");

    if (btn && position) {
        const book = btn.dataset.book;
        const chapter = btn.dataset.chapter;

        if (!isReadChapters(book, chapter)) {
            if (scrollTop + clientHeight >= scrollHeight - 20) {
                position.classList.add('show', 'animate__fadeInUp');
            } else {
                position.classList.remove('show', 'animate__fadeInUp');
            }
        }
    }
}

document.addEventListener('htmx:responseError', evt => {
    error = JSON.parse(evt.detail.xhr.responseText);
    showToast(error.detail);
});


document.addEventListener('swiped-up', async function () {
    showBtnRead();
    const btnChapter = document.getElementsByClassName("chapter");

    Array.from(btnChapter).forEach(btn => {
        const book = btn.dataset.book;
        const chapter = btn.dataset.chapter;
        if (isReadChapters(book, chapter)) {
            btn.classList.add('bg-success');
        }
    });

});


document.addEventListener('swiped-right', async function () {
    showSpinner();
    navigation(-1);
});


document.addEventListener('swiped-left', async function () {
    showSpinner();
    navigation(1);
});

async function navigation(direction) {
    const book = document.getElementById("book");
    const nextBook = document.getElementById("next-book");
    const chapter = document.getElementById("chapter");
    const totChapter = document.getElementById("tot-chapter");
    let total = 0;

    if (totChapter) {
        total = Number(totChapter.innerHTML.trim());
    }

    if (nextBook) {
        await chaptersList(nextBook.innerHTML.trim());

    } else if (book && chapter) {
        const thisBook = book.innerHTML.trim();
        const nextChapter = Number(chapter.innerHTML.trim()) + direction

        if ((nextChapter >= 1) && (nextChapter <= total)) {
            await chapterView(thisBook, nextChapter);
            setLastChapter(thisBook, nextChapter);
        }
    }
};

async function chaptersList(book) {
    htmx.ajax('GET', `/api/${book}`, {
        handler: function (elm, response) {
            if (response.xhr.status >= 400) {
                showToast(`Os dados não estão disponíveis! (${response.xhr.statusText} Error.)`, true);
                return
            }
            const data = JSON.parse(response.xhr.responseText);

            if (!data.bookAbbr) return

            const template = document.getElementById('chapters-list').innerHTML;
            const result = document.getElementById('data-render');
            result.innerHTML = Mustache.render(template, { data: data });
            htmx.process(result);
        }
    });
}

async function searcByhWords(words) {
    htmx.ajax('GET', `/api/search/${words}`, {
        handler: function (elm, response) {
            if (response.xhr.status >= 400) {
                showToast(`Os dados não estão disponíveis! (${response.xhr.statusText} Error.)`, true);
                return
            }
            const data = JSON.parse(response.xhr.responseText);

            if (!(data.length && data[0].bookName)) {
                showToast('Nenhum versículo encontrado com as palavras informadas.', true);
                return
            }

            words = words.split(' ');

            const verses = data.map(v => ({ ...v, text: highlightedText(v.text, words) }));
            // verses = { words: words, verses: verses };

            const template = document.getElementById('search-template').innerHTML;
            const result = document.getElementById('data-render');
            result.innerHTML = Mustache.render(template, { data: verses });
            htmx.process(result);
        }
    });
}

async function chapterView(book, chapter) {
    htmx.ajax('GET', `/api/${book}/${chapter}`, {
        handler: function (elm, response) {
            if (response.xhr.status >= 400) {
                showToast(`Os dados não estão disponíveis! (${response.xhr.statusText} Error.)`, true);
                return
            }
            const data = JSON.parse(response.xhr.responseText);

            if (!data.bookAbbr) return

            const template = document.getElementById('chapter-template').innerHTML;
            var result = document.getElementById('chapter-render')

            result = (result) ? result : document.getElementById('data-render');
            result.innerHTML = Mustache.render(template, { data: data });
            htmx.process(result);
        }
    });
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function showToast(msg) {
    const elm = document.getElementById('toast');
    elm.innerHTML = msg;
    elm.classList.add('show', 'animate__fadeInUp');
    setTimeout(function () { elm.classList.remove('show', 'animate__fadeInUp') }, 5000);
}

function showSpinner() {
    spinner = document.getElementById("spinner");
    spinner.classList.add("show");
}

function highlightedText(text, words) {
    let result = text;

    words.forEach(word => {
        const regex = new RegExp(word, 'gi');
        result = result.replace(regex, `<strong>$&</strong>`);
    });
    return result;
}

function decFontSize() {
    fontSize(-1)
}

function incFontSize() {
    fontSize(+1)
}

function fontSize(inc) {
    const body = document.querySelector(':root');
    const style = window.getComputedStyle(body, null).getPropertyValue('font-size');
    const fontSize = parseFloat(style);
    body.style.fontSize = (fontSize + inc) + 'px';
}