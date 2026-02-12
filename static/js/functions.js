// Ativa o Service Worker que permite e site ser instalado como APP (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/pages/js/service-worker.js')
        .then(reg => console.log('Service Worker registrado'))
        .catch(err => console.log('Erro:', err));
}

document.addEventListener('htmx:responseError', evt => {
    error = JSON.parse(evt.detail.xhr.responseText);
    showToast(error.detail);
});

const input = document.getElementById("search");
if (input) input.addEventListener('keyup', searchWords);


// Exibe o campo de pesquisa (ou faz a pesquisa, se o campo foi preenchido)
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
function updateReadChapters(book, chapter) {
    const readChapters = JSON.parse(localStorage.getItem('readChapters')) || { books: [] };
    const bookIndex = readChapters.books.findIndex(b => b.name === book);

    const btnRead = document.getElementById("btn-position");

    if (bookIndex < 0) {
        readChapters.books.push({ name: book, chapters: [chapter] });
    } else {
        if (!(readChapters.books[bookIndex].chapters.includes(chapter))) {
            readChapters.books[bookIndex].chapters.push(chapter);
        }
    }
    localStorage.setItem('readChapters', JSON.stringify(readChapters));
    btnRead.classList.remove('show', 'animate__fadeInUp');
}

// verifica se o capitulo foi lido
function isReadChapters(book, chapter) {
    const readChapters = JSON.parse(localStorage.getItem('readChapters')) || { books: [] };
    const bookIndex = readChapters.books.findIndex(b => b.name === book);
    if (bookIndex < 0) return;
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

const events = ['scroll', 'wheel', 'touchmove'];
events.forEach(eventType => {
    window.addEventListener(eventType, (e) => {
        showBtnRead();
        markChaptersRead();
    });
});

// exibe botao para sinalizar capitulo lido
function showBtnRead() {
    const btnRead = document.getElementById("btn-read");
    const position = document.getElementById("btn-position");
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const visible = (scrollTop + clientHeight + 50) >= scrollHeight

    if (visible && position) position.classList.add('show', 'animate__fadeInUp');

    if (btnRead) {
        const book = btnRead.dataset.book;
        const chapter = btnRead.dataset.chapter;
        if (isReadChapters(book, chapter)) position.classList.remove('show', 'animate__fadeInUp');
    }
};

// pinta os capitulos de verde, se já foram lidos
function markChaptersRead() {
    const btnChapter = document.getElementsByClassName("chapter");
    Array.from(btnChapter).forEach(btn => {
        const book = btn.dataset.book;
        const chapter = btn.dataset.chapter;
        if (isReadChapters(book, chapter)) btn.classList.add('bg-success');
    });
}

document.addEventListener('swiped-right', async function () {
    navigation(-1);
});


document.addEventListener('swiped-left', async function () {
    navigation(1);
});

async function navigation(direction = 0) {
    const navArrow = document.getElementById("nav-arrow");

    const book = navArrow.dataset.book;
    const chapter = Number(navArrow.dataset.chapter);
    const totChapter = Number(navArrow.dataset.total);

    const nextBook = navArrow.dataset.nextbook;
    const prevtBook = navArrow.dataset.prevbook;

    if ((direction > 0) && nextBook) {
        await chaptersList(nextBook);
    } else if ((direction < 0) && prevtBook) {
        await chaptersList(prevtBook);
    }

    if (book && chapter) {
        const nextChapter = chapter + direction;

        if ((nextChapter >= 1) && (nextChapter <= totChapter)) {
            await chapterView(book, nextChapter);
            setLastChapter(book, nextChapter);

        } else {
            const position = (nextChapter < 1) ? 'Início' : 'Final'
            showToast(`${position} do livro!`, true);
            showSpinner(false);
        }
    } else {
        showSpinner(false);
    }
}

async function chaptersList(book) {
    showSpinner();

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
    showSpinner();

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
            showSpinner(false);
        }
    });
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function showToast(msg, advice = false) {
    const elm = document.getElementById('toast');
    elm.innerHTML = msg;
    elm.classList.add('show', 'animate__fadeInUp');

    if (advice) elm.classList.add('advice');

    setTimeout(function () { elm.classList.remove('show', 'advice', 'animate__fadeInUp') }, 5000);
}

function showSpinner(show = true) {
    spinner = document.getElementById("spinner");

    if (show) {
        spinner.classList.add("show");
    } else {
        spinner.classList.remove("show");
    }
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