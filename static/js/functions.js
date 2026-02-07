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

document.addEventListener('swiped-up', function (evt) {
    const prev = document.getElementById("prev-book");

    if (!prev) return;

    getChapters(prev.innerHTML.trim());
});

document.addEventListener('swiped-right', function (evt) {
    const prev = document.getElementById("prev-book");

    if (!prev) return;

    getChapters(prev.innerHTML.trim());
});

document.addEventListener('swiped-down', function (evt) {
    const next = document.getElementById("next-book");

    if (!next) return;

    getChapters(next.innerHTML.trim());
});
document.addEventListener('swiped-left', function (evt) {
    const next = document.getElementById("next-book");

    if (!next) return;

    getChapters(next.innerHTML.trim());
});

document.addEventListener('htmx:responseError', evt => {
    error = JSON.parse(evt.detail.xhr.responseText);
    showToast(error.detail);
});


function getChapters(book) {
    htmx.ajax('GET', `/biblia/${book}`, {
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
        }
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