// Ativa o Service Worker que permite o site ser instalado como APP (PWA)
// Neste APP, o service worker é utilizado para cachear os dados, 
// permitindo o acesso offline dos dados, melhorando a performance do site.

if ('serviceWorker' in navigator) {
    // Registrado na raiz da origem para que o escopo '/' cubra as páginas e a API
    navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('Service Worker registrado'))
        .catch(err => console.log('Erro:', err));
}

window.addEventListener('load', function () {
    const urlParams = new URLSearchParams(window.location.search);

    // Recebe parâmetros da página anterior
    // E exibe o capítulo passado, se for o caso
    const book = urlParams.get('book');
    const chapter = urlParams.get('chapter');
    const verse = urlParams.get('verse');

    if (book && chapter && verse) {
        chapterView(book, chapter, verse);
    }
});

// Captura eventos
const events = ['scroll', 'wheel', 'touchmove'];
events.forEach(eventType => {
    window.addEventListener(eventType, (e) => {
        showBtnRead();
        markChaptersRead();
    });
});

document.addEventListener('htmx:responseError', evt => {
    // O fallback off-line do SW responde {detail: "..."}; erros de validação
    // da API também usam {detail}. Qualquer outro corpo mostra mensagem
    // genérica — nunca o literal "undefined".
    try {
        const error = JSON.parse(evt.detail.xhr.responseText);
        showToast(error.detail || 'Sem conexão com a internet.');
    } catch (_err) {
        showToast('Sem conexão com a internet.');
    }
});

// document.addEventListener('htmx:beforeRequest', ev => {
//     showSpinner();
// });

// document.addEventListener('htmx:afterRequest', ev => {
//     showSpinner(false);
// });

const input = document.getElementById("search");
if (input) input.addEventListener('keyup', searchWords);

// Extrai a mensagem amigável do corpo de erro (o fallback off-line do SW
// responde {detail: "..."}; a API usa {detail} nas validações). Garante
// texto útil na tela — nunca o literal "undefined".
function apiErrorMessage(xhr, fallback = 'Sem conexão com a internet.') {
    try {
        const body = JSON.parse(xhr.responseText);
        return body.detail || fallback;
    } catch (_err) {
        return fallback;
    }
}

// ==================================================================
//  MODO OFF-LINE
//  Comunica-se com o Service Worker (static/js/service-worker.js)
//  via postMessage para baixar, monitorar, cancelar e excluir
//  o conteúdo armazenado para uso sem conexão.
// ==================================================================

let offlineActive = false; // download em andamento
let offlineState = 'unknown'; // unknown | partial | full
let offlineListenerAdded = false; // evita registrar o listener repetidamente

// Verifica o estado atual (chamado ao abrir o painel)
function checkOfflineStatus() {
    if (!offlineSWReady()) return;

    if (!offlineListenerAdded) {
        navigator.serviceWorker.addEventListener('message', offlineSWListener);
        offlineListenerAdded = true;
    }

    navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_COUNT_REQUEST' });
}

// Garante que há um Service Worker controlando a página
function offlineSWReady() {
    if (!(navigator.serviceWorker && navigator.serviceWorker.controller)) {
        const status = document.getElementById('offline-status');
        if (status) status.textContent = 'Recurso indisponível. Recarregue a página para ativá-lo.';
        return false;
    }
    return true;
}

// Inicia o download de todos os capítulos
function startOfflineDownload() {
    if (!offlineSWReady() || offlineActive) return;

    // Avisar antes de tentar: iniciar download sem rede só geraria falhas
    if (!navigator.onLine) {
        const status = document.getElementById('offline-status');
        status.textContent = 'Sem conexão com a internet. Conecte-se para baixar o conteúdo.';
        showToast('Sem conexão com a internet.', 'advice');
        return;
    }

    offlineActive = true;
    setOfflineButtons();
    navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_ALL_CHAPTERS' });
}

// Cancela o download em andamento
function cancelOfflineDownload() {
    if (!offlineSWReady()) return;
    navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_CANCEL' });
}

// Exclui os dados armazenados para uso off-line (após confirmação)
function deleteOfflineData() {
    if (!offlineSWReady()) return;
    closeConfirmDeleteOffline();
    navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE_DELETE' });
}

// Mostra o diálogo de confirmação antes de excluir os dados off-line
function confirmDeleteOfflineData() {
    if (!offlineSWReady()) return;
    document.getElementById('confirm-offline-delete').classList.remove('hidden');
}

// Fecha o diálogo de confirmação sem excluir nada
function closeConfirmDeleteOffline() {
    // index.html também carrega este script, mas não tem o diálogo
    const overlay = document.getElementById('confirm-offline-delete');
    if (overlay) {
        overlay.classList.add('hidden');
        const panel = document.getElementById('offline-panel');
        if (panel) {
            panel.classList.remove('show', 'animate__fadeInUp');
        }
    }
}

// Esc também cancela a exclusão
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeConfirmDeleteOffline();
});

// Mostra/oculta o painel do modo off-line
function toggleOfflinePanel() {
    const panel = document.getElementById('offline-panel');
    const visible = panel.classList.contains('show');

    if (visible) {
        panel.classList.remove('show', 'animate__fadeInUp');
    } else {
        panel.classList.add('show', 'animate__fadeInUp');
        checkOfflineStatus();
    }
}

// Ajusta a exibição dos botões conforme o estado do download
function setOfflineButtons() {
    const btnDownload = document.getElementById('btn-offline-download');
    const btnCancel = document.getElementById('btn-offline-cancel');
    const btnDelete = document.getElementById('btn-offline-delete');
    const progress = document.getElementById('offline-progress');

    if (offlineActive) {
        // Download em andamento: progresso visível + botão cancelar
        progress.classList.add('show');
        btnDownload.classList.add('hidden');
        btnCancel.classList.remove('hidden');
        btnDelete.classList.add('hidden');
    } else if (offlineState === 'full') {
        // Bíblia completa armazenada: só permite excluir
        progress.classList.remove('show');
        btnDownload.classList.add('hidden');
        btnCancel.classList.add('hidden');
        btnDelete.classList.remove('hidden');
    } else {
        // Sem download completo: botão baixar disponível
        progress.classList.remove('show');
        btnDownload.classList.remove('hidden');
        btnCancel.classList.add('hidden');
        btnDelete.classList.add('hidden');
    }
}

// Atualiza a barra de progresso e o texto de status
function updateOfflineProgress(downloaded, total) {
    const bar = document.getElementById('offline-progress-bar');
    const status = document.getElementById('offline-status');
    const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;

    bar.style.width = `${percent}%`;

    if (percent > 0) {
        status.textContent = `Baixando ${downloaded} de ${total} capítulos (${percent}%)`;
    } else {
        status.textContent = 'Aguardando início do download...';
    }
}

// Listener de mensagens enviadas pelo Service Worker
function offlineSWListener(event) {
    const status = document.getElementById('offline-status');
    const panel = document.getElementById('offline-panel');

    switch (event.data?.type) {
        case 'PRECACHE_COUNT': {
            offlineState = (event.data.cached >= event.data.total) ? 'full' : 'partial';
            setOfflineButtons();

            if (offlineState === 'full') {
                status.textContent = 'Bíblia completa armazenada neste dispositivo.';
            } else if (event.data.cached > 0) {
                status.textContent = 'Parte do conteúdo está armazenado. Baixe o restante para uso off-line.';
            } else {
                status.textContent = 'Nenhum conteúdo armazenado. Baixe para usar sem conexão.';
            }

            // Contexto útil para quem abriu o painel já off-line
            if (!navigator.onLine) {
                status.textContent += ' Você está sem conexão: apenas o conteúdo armazenado pode ser lido.';
            }
            break;
        }

        case 'PRECACHE_PROGRESS':
            offlineActive = true;
            setOfflineButtons();
            updateOfflineProgress(event.data.downloaded, event.data.total);
            break;

        case 'PRECACHE_DONE':
            offlineActive = false;
            offlineState = 'full';
            setOfflineButtons();
            status.textContent = event.data.message;
            showToast('Bíblia disponível para uso off-line.', 'info');
            break;

        case 'PRECACHE_OFFLINE':
        case 'PRECACHE_PARTIAL':
            // O download terminou com falhas de rede: não é "concluído".
            // O painel permanece aberto para o usuário ler a orientação.
            offlineActive = false;
            offlineState = 'partial';
            setOfflineButtons();
            status.textContent = event.data.message;
            showToast(event.data.message, 'advice');
            break;

        case 'PRECACHE_CANCELLED':
            offlineActive = false;
            setOfflineButtons();
            status.textContent = 'Download cancelado. O conteúdo baixado até aqui foi mantido.';
            break;

        case 'PRECACHE_DELETED':
            offlineActive = false;
            offlineState = 'partial';
            setOfflineButtons();
            status.textContent = 'Dados excluídos deste dispositivo.';
            break;
    }

    // Fecha o painel automaticamente ao concluir ou cancelar
    if (['PRECACHE_DONE', 'PRECACHE_CANCELLED', 'PRECACHE_DELETED'].includes(event.data?.type)) {
        setTimeout(() => {
            panel.classList.remove('show', 'animate__fadeInUp');
        }, 2500);
    }
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'auto'
    });
}

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

// exibe botao para sinalizar capitulo lido
function showBtnRead() {
    const btnRead = document.getElementById("btn-read");
    const position = document.getElementById("btn-position");
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const visible = (scrollTop + clientHeight + 50) >= scrollHeight

    if (position) {
        if (visible) {
            position.classList.add('show', 'animate__fadeInUp');
        } else {
            position.classList.remove('show', 'animate__fadeInUp');
        }
    }

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

    if (!navArrow) return;

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
            showToast(`${position} do livro!`, 'advice');
        }
    }
}

// busca pelas palavra digitadas no campo de pesquisa
async function searcByhWords(words) {
    // A pesquisa é processada no servidor (SQL LIKE) e não funciona off-line.
    // O handler customizado do htmx 2.x não é invocado em respostas 4xx/5xx,
    // então sem este guarda o usuário ficaria sem qualquer feedback.
    if (!navigator.onLine) {
        showToast('A pesquisa requer conexão com a internet.', 'advice');
        return;
    }

    htmx.ajax('GET', `/api/search/${words}`, {
        handler: function (elm, response) {
            if (response.xhr.status >= 400) {
                showToast(apiErrorMessage(response.xhr, 'Dados indisponíveis.'), 'advice');
                return;
            }
            const data = JSON.parse(response.xhr.responseText);

            if (!(data.length && data[0].bookName)) {
                showToast('Não encontrada nenhuma das palavras pesquisadas.');
                return;
            }

            words = words.split(' ');

            const verses = data.map(v => ({ ...v, text: highlightedText(v.text, words) }));

            const template = document.getElementById('search-template').innerHTML;
            const result = document.getElementById('data-render');
            result.innerHTML = Mustache.render(template, { data: verses });
            htmx.process(result);
        }
    });
}

async function getFavorites() {
    htmx.ajax('GET', `/api/favorites`, {
        handler: function (elm, response) {
            // showSpinner(false);
            if (response.xhr.status >= 400) {
                showToast(`Favoritos indisponíveis. (${response.xhr.statusText} Error.)`);
                return;
            }
            const favorites = JSON.parse(response.xhr.responseText);

            if (!(favorites.length && favorites[0].bookName)) {
                showToast('A lista de favoritos não foi localizada.');
                return;
            }

            const template = document.getElementById('favorites-template').innerHTML;
            const result = document.getElementById('data-render');
            const rendered = Mustache.render(template, { data: favorites });
            result.innerHTML = rendered
            htmx.process(result);
            scrollToTop();
        }
    });
}

async function chaptersList(book) {
    // showSpinner();

    htmx.ajax('GET', `/api/${book}`, {
        handler: function (elm, response) {
            if (response.xhr.status >= 400) {
                showToast(apiErrorMessage(response.xhr, 'Os dados não estão disponíveis.'), 'advice');
                return;
            }
            const data = JSON.parse(response.xhr.responseText);

            if (!data.bookAbbr) return;

            const template = document.getElementById('chapters-list').innerHTML;
            const result = document.getElementById('data-render');
            result.innerHTML = Mustache.render(template, { data: data });
            htmx.process(result);
        }
    });
}

async function chapterView(book, chapter, verse = null) {
    const url = (verse) ? `/api/${book}/${chapter}?verse=${verse}` : `/api/${book}/${chapter}`;
    htmx.ajax('GET', url, {
        handler: function (elm, response) {
            // showSpinner(false);
            if (response.xhr.status >= 400) {
                // Ex.: capítulo ausente do cache off-line → orientação do SW
                showToast(apiErrorMessage(response.xhr, 'Os dados não estão disponíveis.'), 'advice');
                return;
            }
            const data = JSON.parse(response.xhr.responseText);

            if (!data.bookAbbr) return;

            const template = document.getElementById('chapter-template').innerHTML;
            var result = document.getElementById('chapter-render')

            result = (result) ? result : document.getElementById('data-render');
            result.innerHTML = Mustache.render(template, { data: data });
            htmx.process(result);
        }
    });
}

function showToast(msg, styleClass = null) {
    const elm = document.getElementById('toast');
    elm.innerHTML = msg;
    elm.classList.add('show', 'animate__fadeInUp');

    if (styleClass) elm.classList.add(styleClass);

    setTimeout(function () {
        elm.classList.remove('show', 'animate__fadeInUp', styleClass)
    }, 5000);
}

// function showSpinner(show = true) {
// return
// spinner = document.getElementById("spinner");

// if (show) {
//     spinner.classList.add("show");
// } else {
//     spinner.classList.remove("show");
// }
// }

function highlightedText(text, words) {
    let result = text;

    words.forEach(word => {
        const regex = new RegExp(word, 'gi');
        result = result.replace(regex, `<strong>${word}</strong>`);
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