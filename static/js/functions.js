// Ativa o Service Worker que permite e site ser instalado como APP (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/pages/js/service-worker.js')
        .then(reg => console.log('Service Worker registrado'))
        .catch(err => console.log('Erro:', err));
}

document.addEventListener(
    "htmx:confirm",
    function (evt) {
        if (evt.detail.question !== null) {
            evt.preventDefault();
            Swal.fire({
                // animation: false,
                buttonsStyling: false,
                showCancelButton: true,
                reverseButtons: true,
                // icon: 'question',
                title: 'Favor confirmar!',
                text: `Deseja mesmo excluir ${(evt.detail.question).toUpperCase()} desta lista?`,
                showClass: { popup: 'animate__animated animate__fadeInUp animate__faster' },
                hideClass: { popup: 'animate__animated animate__zoomOut animate__faster' },
            }).then(function (res) {
                if (res.isConfirmed) evt.detail.issueRequest(true)
            })
        }
    }
);

document.addEventListener('swiped-right', async function (evt) {
    navigation(-1);
});

document.addEventListener('swiped-left', async function (evt) {
    navigation(1);
});

async function navigation(direction) {
    const book = document.getElementById("book");
    const nextBook = document.getElementById("next-book");
    const chapter = document.getElementById("chapter");
    const totChapter = document.getElementById("tot-chapter");
    let total = 0;

    console.log(book);


    if (totChapter) {
        total = Number(totChapter.innerHTML.trim());
    }

    if (nextBook) {
        await chaptersList(nextBook.innerHTML.trim());

    } else if (book && chapter) {
        const thisBook = book.innerHTML.trim();
        const nextChapter = Number(chapter.innerHTML.trim()) + direction

        if ((nextChapter >= 1) && (nextChapter <= total))
            await chapterView(thisBook, nextChapter);
    }

};

document.addEventListener('htmx:responseError', evt => {
    error = JSON.parse(evt.detail.xhr.responseText);
    showToast(error.detail);
});


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
            const result = document.getElementById('chapter-render');
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
    setTimeout(function () { elm.classList.remove('show', 'animate__fadeInUp') }, 3000);
}

function showDetail() {
    const detalhe = document.getElementById('detalhe');
    const info = document.getElementById('info');
    detalhe.classList.add('show');
    info.classList.add('show', 'animate__fadeInUp');
}

function hideDetail() {
    const detalhe = document.getElementById('detalhe');
    const info = document.getElementById('info');
    detalhe.classList.remove('show');
    info.classList.remove('show', 'animate__fadeInUp');
}

function showSpinner() {
    scrollToTop();
    spinner = document.getElementById("spinner");
    spinner.classList.add("show");
}


function allowsEditing(obj) {
    const editing = document.querySelector('.editing');

    if (editing) {
        htmx.trigger(editing, 'cancel')
    } else {
        htmx.trigger(obj, 'edit')
    }
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