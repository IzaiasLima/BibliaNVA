// ============================================================
//  Bíblia NVA — Service Worker
//  Estratégia: Cache-First para a API (conteúdo imutável)
//              Network-First para o restante (HTML/CSS/JS)
//
//  Compatível com:
//  - HTMX (headers HX-* são ignorados na chave de cache — correto,
//    pois a API retorna sempre JSON independente desses headers)
//  - Mustache (a renderização é feita no cliente após receber o JSON;
//    o SW cacheia apenas o JSON bruto, sem interferir no template)
//  - URLs com caracteres Unicode (ex: /api/jó → /api/j%C3%B3)
// ============================================================

// v2: força re-download dos assets estáticos (functions.js ganhou guarda
// de busca off-line e registro do SW na raiz; HTML/CSS também mudaram).
// v3: functions.js com mensagens de erro amigáveis (apiErrorMessage) —
// elimina "undefined" em capítulos ausentes do cache off-line.
// v4: styles.css sem @import do Google Fonts — Figtree servida localmente.
// v5: functions.js pede confirmação antes de excluir os dados off-line;
// styles.css ganhou o modal de confirmação.
// Sem o bump, usuários receberiam para sempre o functions.js antigo do cache.
// v9: /api/favorite/random passa a ser Network-First — sem o bump, o verso
// aleatório continuaria vindo do cache (sempre o mesmo) ficando também
// congelado até a próxima troca de CACHE_VERSION.
// v11: o download completo passa a cachear as páginas ESTÁTICAS de
// public/pages/books (shell + metadados da API + 1.189 páginas de capítulo) em
// vez de baixar 1.189 JSONs da API — muito mais rápido e alinhado à versão
// static do projeto. O bump invalida os caches v10 (JSONs) e força o
// re-download no novo formato.
// v12: as páginas estáticas de capítulo ganharam a caixa de pesquisa
// (#search-position) e o functions.js passa a carregar a extensão
// client-side-templates sob demanda — sem o bump, o cache-first congelaria
// o functions.js antigo e o ícone de busca seguiria quebrado.
const CACHE_VERSION = 'v12';
const CACHE_API = `biblia-api-${CACHE_VERSION}`;
const CACHE_STATIC = `biblia-static-${CACHE_VERSION}`;

/**
 * Converte a abreviação do livro para uma URL de path segura.
 * Necessário para livros com caracteres acentuados como JÓ (Jó).
 * Exemplo: 'JÓ' → 'j%C3%B3'
 */
function pathSafeAbbr(abbr) {
  return encodeURIComponent(abbr.toLowerCase());
}

// ------------------------------------------------------------------
// Todos os 66 livros com suas abreviações e quantidade de capítulos.
// Gerado a partir de /api — atualize bookAbbr/maxChapters se a API mudar.
// ------------------------------------------------------------------
const BOOKS = [
  // Antigo Testamento
  { abbr: 'GN', chapters: 50 }, { abbr: 'EX', chapters: 40 },
  { abbr: 'LV', chapters: 27 }, { abbr: 'NM', chapters: 36 },
  { abbr: 'DT', chapters: 34 }, { abbr: 'JS', chapters: 24 },
  { abbr: 'JZ', chapters: 21 }, { abbr: 'RT', chapters: 4 },
  { abbr: '1SM', chapters: 31 }, { abbr: '2SM', chapters: 24 },
  { abbr: '1RS', chapters: 22 }, { abbr: '2RS', chapters: 25 },
  { abbr: '1CR', chapters: 29 }, { abbr: '2CR', chapters: 36 },
  { abbr: 'ED', chapters: 10 }, { abbr: 'NE', chapters: 13 },
  { abbr: 'ET', chapters: 10 }, { abbr: 'JÓ', chapters: 42 },
  { abbr: 'SL', chapters: 150 }, { abbr: 'PV', chapters: 31 },
  { abbr: 'EC', chapters: 12 }, { abbr: 'CT', chapters: 8 },
  { abbr: 'IS', chapters: 66 }, { abbr: 'JR', chapters: 52 },
  { abbr: 'LM', chapters: 5 }, { abbr: 'EZ', chapters: 48 },
  { abbr: 'DN', chapters: 12 }, { abbr: 'OS', chapters: 14 },
  { abbr: 'JL', chapters: 3 }, { abbr: 'AM', chapters: 9 },
  { abbr: 'OB', chapters: 1 }, { abbr: 'JN', chapters: 4 },
  { abbr: 'MQ', chapters: 7 }, { abbr: 'NA', chapters: 3 },
  { abbr: 'HC', chapters: 3 }, { abbr: 'SF', chapters: 3 },
  { abbr: 'AG', chapters: 2 }, { abbr: 'ZC', chapters: 14 },
  { abbr: 'ML', chapters: 4 },
  // Novo Testamento
  { abbr: 'MT', chapters: 28 }, { abbr: 'MC', chapters: 16 },
  { abbr: 'LC', chapters: 24 }, { abbr: 'JO', chapters: 21 },
  { abbr: 'AT', chapters: 28 }, { abbr: 'RM', chapters: 16 },
  { abbr: '1CO', chapters: 16 }, { abbr: '2CO', chapters: 13 },
  { abbr: 'GL', chapters: 6 }, { abbr: 'EF', chapters: 6 },
  { abbr: 'FP', chapters: 4 }, { abbr: 'CL', chapters: 4 },
  { abbr: '1TS', chapters: 5 }, { abbr: '2TS', chapters: 3 },
  { abbr: '1TM', chapters: 6 }, { abbr: '2TM', chapters: 4 },
  { abbr: 'TT', chapters: 3 }, { abbr: 'FL', chapters: 1 },
  { abbr: 'HB', chapters: 13 }, { abbr: 'TG', chapters: 5 },
  { abbr: '1PE', chapters: 5 }, { abbr: '2PE', chapters: 3 },
  { abbr: '1JO', chapters: 5 }, { abbr: '2JO', chapters: 1 },
  { abbr: '3JO', chapters: 1 }, { abbr: 'JD', chapters: 1 },
  { abbr: 'AP', chapters: 22 },
];


// ------------------------------------------------------------------
// URLs da API que serão pré-cacheadas na instalação do SW.
// pathSafeAbbr() garante encoding correto para livros com acentos (ex: JÓ).
// ------------------------------------------------------------------
// Total de capítulos: ~1.189 — cacheados sob demanda (lazy) na primeira leitura
// e no download completo (PRECACHE_ALL_CHAPTERS → precacheAllContent).
const TOTAL_CHAPTERS = BOOKS.reduce((sum, b) => sum + b.chapters, 0);

// ------------------------------------------------------------------
// Shell do app: telas HTML + assets (CSS/JS/ícones/fontes/imagens).
// Precacheados junto com o download completo para que o app abra off-line
// mesmo num dispositivo que nunca visitou cada tela. Servidos pelo próprio
// servidor (não passam pela API). O .xcf é arquivo-fonte e ficou de fora.
// ------------------------------------------------------------------
const SHELL_URLS = [
  '/pages/index.html',
  '/pages/bible.html',
  '/pages/books/index.html',
  '/pages/about.html',
  '/pages/license.html',
  '/pages/css/styles.css',
  '/pages/css/animate.min.css',
  '/pages/js/functions.js',
  '/pages/js/htmx.min.js',
  '/pages/js/mustache.min.js',
  '/pages/js/client-side-templates.min.js',
  '/pages/js/swiped.js',
  '/pages/js/manifest.json',
  '/pages/fonts/figtree-latin.woff2',
  '/pages/fonts/figtree-latin-italic.woff2',
  '/pages/icons/book.svg',
  '/pages/icons/chevron-left.svg',
  '/pages/icons/chevron-right.svg',
  '/pages/icons/download.svg',
  '/pages/icons/favorites.svg',
  '/pages/icons/favicon.png',
  '/pages/icons/icon-128.png',
  '/pages/icons/icon-192.png',
  '/pages/icons/icon-512.png',
  '/pages/icons/last-chapter.svg',
  '/pages/icons/license.svg',
  '/pages/icons/search.svg',
  '/pages/icons/spinner.svg',
  '/pages/icons/text-decrease.svg',
  '/pages/icons/text-increase.svg',
  '/pages/images/nva-logo.png',
  '/pages/images/bg-full.jpg',
  '/pages/images/bg-mobile.jpg',
];

/**
 * É a URL de uma página de capítulo (…/pages/books/<Livro>/<n>[.html])?
 * Usado para contar o progresso do download e para o "Limpar dados"
 * remover só o conteúdo, preservando o shell do CACHE_STATIC.
 * Nomes com acento/spaço chegam percent-encoded (ex: 1%20Cor%C3%ADntios),
 * que [^/]+ cobre — só o separador limita.
 */
function isChapterPage(pathname) {
  return /^\/pages\/books\/[^/]+\/\d+(\.html)?$/.test(pathname);
}

// ------------------------------------------------------------------
// Estado do pré-cache manual (modo off-line)
// ------------------------------------------------------------------
let cancelPrecache = false;       // sinaliza cancelamento do download
let cancelledPrecache = false;    // indica que o download foi cancelado
let downloadedFromCache = 0;      // nº de capítulos cacheados (baixados ou já existentes)
let failedCount = 0;              // capítulos que não puderam ser baixados (ex.: offline)
let requestingClient = null;      // janela que iniciou o download (recebe progresso)

// ==================================================================
//  INSTALL — pré-cacheia o essencial e ativa rapidamente
//
//  Importante: o install NÃO deve bloquear a ativação em dezenas de
//  fetches de rede. Com a API no Turso, 68 requests levariam 60-90s
//  (e minutos numa rede móvel ruim), atrasando o controle da página.
//  Aqui pré-cacheamos apenas /api (lista de livros, necessária para a
//  navegação off-line); os metadados dos livros e os capítulos são
//  baixados em background (PRECACHE_ALL_CHAPTERS) ou on-demand pelo
//  fetch handler Cache-First.
// ==================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando (pré-cache rápido de /api)...');

  event.waitUntil(
    caches.open(CACHE_API)
      .then((cache) =>
        cache.add('/api').catch((err) =>
          console.warn('[SW] Falha ao pré-cachear /api:', err)
        )
      )
      .then(() => {
        console.log('[SW] Install concluído.');
        self.skipWaiting(); // ativa imediatamente sem esperar aba fechar
      })
  );
});

// ==================================================================
//  ACTIVATE — remove caches de versões anteriores
// ==================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando e limpando caches antigos...');

  const validCaches = [CACHE_API, CACHE_STATIC];

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !validCaches.includes(key))
          .map((key) => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // assume controle de todas as abas abertas
  );
});

// ==================================================================
//  FETCH — intercepta todas as requisições
// ==================================================================
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignora requisições de outras origens (ex: CDN externo)
  if (url.origin !== self.location.origin) return;

  // Ignora métodos não-GET (POST, DELETE, etc.)
  // Importante: HTMX pode disparar POST para /api/favorites — nunca cachear.
  if (req.method !== 'GET') return;

  // --- Rotas da API ------------------------------------------------
  if (url.pathname.startsWith('/api')) {

    // /api/favorites pode mudar (usuário adiciona/remove) → Network-First.
    // /api/favorite/random também: o verso é sorteado a cada leitura — do
    // cache viria sempre o mesmo. Offline, o networkFirst serve o último
    // verso em cache (a página não fica vazia).
    // Para as demais rotas da API (texto bíblico imutável) → Cache-First.
    if (url.pathname === '/api/favorites' || url.pathname === '/api/favorite/random') {
      event.respondWith(networkFirst(req, CACHE_API));
    } else {
      // Cria uma Request "limpa" sem os headers do HTMX para a chave de cache.
      // O HTMX envia HX-Request, HX-Target, HX-Trigger, etc., que não fazem
      // parte da URL e não devem diferenciar entradas no cache.
      // A Cache API usa a Request inteira como chave, então passamos apenas
      // a URL como string para garantir que cache.match() funcione corretamente.
      event.respondWith(cacheFirst(url.href, CACHE_API, req));
    }
    return;
  }

  // --- Assets estáticos: Cache-First --------------------------------
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(url.href, CACHE_STATIC, req));
    return;
  }

  // --- HTML / navegação: Network-First (garante versão atualizada) --
  event.respondWith(networkFirst(req, CACHE_STATIC));
});

// ==================================================================
//  ESTRATÉGIAS DE CACHE
// ==================================================================

/**
 * Normaliza a caixa do livro em paths da API para busca no cache.
 *
 * A UI navega com o bookAbbr canônico da API (MAIÚSCULO: /api/SL/23,
 * /api/JÓ/3), mas o precache armazena em minúsculas (/api/sl/23,
 * /api/j%C3%B3/3). O servidor ignora a caixa, mas o Cache Storage
 * trata chaves literalmente — sem esta normalização, a leitura
 * off-line falharia com 503 para qualquer livro.
 *
 * Exemplos: '/api/SL/23' → '/api/sl/23'; '/api/J%C3%B3' → '/api/j%C3%B3'
 * (segmentos seguintes, como termos de busca em /api/search/{words},
 * não são alterados).
 */
function normalizeApiPath(pathname) {
  try {
    const segments = decodeURIComponent(pathname).split('/');
    if (segments.length >= 3 && segments[1] === 'api') {
      segments[2] = segments[2].toLowerCase();
      return segments.map(encodeURIComponent).join('/');
    }
  } catch (_err) {
    // path com encoding inválido — usa como está
  }
  return pathname;
}

/**
 * Cache-First: serve do cache imediatamente.
 * Se não houver, busca na rede com o request original (que pode ter
 * headers HTMX), armazena usando apenas a URL como chave, e retorna.
 *
 * @param {string}  cacheKey  - URL pura (sem headers) usada como chave
 * @param {string}  cacheName - nome do cache a usar
 * @param {Request} request   - request original (pode ter headers HTMX)
 */
async function cacheFirst(cacheKey, cacheName, request) {
  const cache = await caches.open(cacheName);
  let cached = await cache.match(cacheKey);

  // Fallback de caixa para paths da API (a UI usa bookAbbr maiúsculo,
  // o cache armazena minúsculo)
  if (!cached && cacheName === CACHE_API) {
    const normalized = normalizeApiPath(new URL(cacheKey).pathname);
    if (normalized !== new URL(cacheKey).pathname) {
      cached = await cache.match(new URL(normalized, new URL(cacheKey).origin).href);
    }
  }
  if (cached) return cached;

  try {
    // Faz o fetch com o request original (preserva cookies, headers HTMX, etc.)
    const response = await fetch(request || cacheKey);
    if (response && response.ok) {
      // Armazena usando a URL limpa como chave — garante hit em próximas chamadas
      // mesmo que os headers HTMX sejam diferentes
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (err) {
    console.error('[SW] cacheFirst falhou e sem cache:', cacheKey, err);
    return offlineFallback(cacheKey);
  }
}

/**
 * Network-First: tenta a rede primeiro.
 * Se falhar (offline), serve do cache.
 *
 * @param {Request} request   - request original
 * @param {string}  cacheName - nome do cache a usar
 */
async function networkFirst(request, cacheName) {
  const cacheKey = request.url;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (_err) {
    const cache = await caches.open(cacheName);
    let cached = await cache.match(cacheKey);
    // Navegações com query (?book=...&chapter=...&verse=...) nunca são
    // pré-cacheadas com a query — ex.: o cartão do verso do dia. Serve a
    // página base em cache; a própria página então redireciona
    // (chapterView) para o capítulo estático correspondente.
    if (!cached) cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return offlineFallback(cacheKey);
  }
}

/**
 * Fallback offline: retorna JSON compatível com Mustache para a API
 * (o template {{#data}}...{{/data}} não renderiza nada com data vazio)
 * ou uma resposta genérica para outros recursos.
 *
 * A chave "detail" é lida pelo listener htmx:responseError em functions.js
 * e exibida como toast — sem ela, o usuário veria um "undefined".
 *
 * @param {string} url - URL da requisição que falhou
 */
function offlineFallback(url) {
  const pathname = typeof url === 'string' ? new URL(url, self.location.origin).pathname : url;
  if (pathname.startsWith('/api')) {
    // Retorna estrutura compatível com o que o Mustache espera:
    // { data: [] } → {{#data}} não itera, nada é exibido
    const detail = pathname.match(/^\/api\/[^/]+\/\d+$/)
      ? 'Capítulo não disponível off-line. Conecte-se à internet e toque em Baixar Bíblia para fazer o download dos dados.'
      : 'Sem conexão com a internet.';
    return new Response(JSON.stringify({ data: [], detail, offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response('Offline — sem conexão', { status: 503 });
}

// ==================================================================
//  PRECACHE DE CAPÍTULOS EM BACKGROUND
//  Acionado pela página principal via postMessage após o app carregar
// ==================================================================
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PRECACHE_ALL_CHAPTERS') {
    console.log('[SW] Iniciando download completo: shell + metadados + páginas estáticas...');

    // Guarda a janela solicitante para enviar progresso e conclusão
    if (event.source) {
      requestingClient = event.source;
    } else {
      self.clients.matchAll().then((all) => { requestingClient = all[0] || null; });
    }

    cancelPrecache = false;
    cancelledPrecache = false;
    downloadedFromCache = 0;
    failedCount = 0;

    // ESSENCIAL: event.waitUntil mantém o Service Worker vivo durante
    // todo o download (~10-20 min). Sem isso, o Chrome encerra o SW
    // considerando-o inativo e o download morre no meio.
    event.waitUntil(precacheAllContent());
  }

  if (event.data?.type === 'PRECACHE_CANCEL') {
    console.log('[SW] Cancelamento de pré-cache solicitado.');
    cancelPrecache = true;
  }

  if (event.data?.type === 'PRECACHE_COUNT_REQUEST') {
    sendPrecacheCount(event.source);
  }

  if (event.data?.type === 'PRECACHE_DELETE') {
    // O SW não pode ser encerrado antes de concluir a exclusão
    event.waitUntil(deletePrecachedData());
  }

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function precacheAllContent() {
  const apiCache = await caches.open(CACHE_API);
  const staticCache = await caches.open(CACHE_STATIC);
  let cached = 0;
  let skipped = 0;
  failedCount = 0;

  // Feedback imediato: a UI exibe a barra desde o primeiro instante,
  // inclusive durante as fases de shell e de metadados abaixo
  notifyProgress();

  // --- Fase 1: shell do app (telas + CSS/JS/ícones/fontes/imagens) ---
  // Precacheado para o app abrir off-line mesmo num aparelho que nunca
  // visitou cada tela. Não conta no progresso de capítulos.
  for (const url of SHELL_URLS) {
    if (cancelPrecache) { cancelledPrecache = true; break; }
    if (await staticCache.match(url)) continue;
    try {
      const response = await fetch(url);
      if (response.ok) await staticCache.put(url, response);
    } catch (_err) {
      // sem rede — o resultado final reflete a falha via fase 3
    }
  }

  // --- Fase 2: metadados dos livros (/api/{abbr}) ---
  // Além da lista de capítulos (navegação off-line), a resposta traz
  // bookName — o nome da pasta em public/pages/books/ — necessário para montar
  // a URL de cada página estática na fase 3.
  const bookFolder = {}; // abbr → nome da pasta (ex: 'SL' → 'Salmos')
  for (const book of BOOKS) {
    if (cancelPrecache) { cancelledPrecache = true; break; }
    const url = `/api/${pathSafeAbbr(book.abbr)}`;
    try {
      let response = await apiCache.match(url);
      if (!response) {
        response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await apiCache.put(url, response.clone());
      }
      const meta = await response.json();
      if (meta && meta.bookName) {
        bookFolder[book.abbr] = meta.bookName;
      } else {
        // livro não resolvido → as páginas deste livro não podem ser montadas
        failedCount += book.chapters;
      }
    } catch (_err) {
      // Sem metadados não há como montar a URL da página (ex.: download
      // iniciado off-line). Conta como falha — o resultado final reflete,
      // em vez de fingir "concluído".
      failedCount += book.chapters;
    }
  }

  // --- Fase 3: páginas estáticas dos capítulos (1.189) ---
  // O servidor já entrega o HTML pronto (generate_pages.py, public/pages/books/):
  // sem render no cliente e sem 1.189 JSONs ida-e-volta à API — o download
  // dura segundos em vez de minutos (antes eram requests ao Turso).
  for (const book of BOOKS) {
    if (cancelPrecache) { cancelledPrecache = true; break; }

    const name = bookFolder[book.abbr];
    // Sem nome, a falha já foi contada na fase 2 (metadados)
    if (!name) continue;

    for (let ch = 1; ch <= book.chapters; ch++) {
      if (cancelPrecache) {
        cancelledPrecache = true;
        break;
      }

      // Caminho SEM .html — é o que os links da lista usam
      // (href="/pages/books/{Livro}/{n}") e o que chapterView monta.
      // encodeURIComponent cobre pastas com acento/espaço (1%20Cor%C3%ADntios).
      const url = `/pages/books/${encodeURIComponent(name)}/${ch}`;

      // Pula se já estiver no cache, mas conta como "cacheado"
      // para o cálculo de disponibilidade off-line
      const exists = await staticCache.match(url);
      if (exists) {
        skipped++;
        downloadedFromCache++;
        continue;
      }

      try {
        const response = await fetch(url);
        if (response.ok) {
          await staticCache.put(url, response);
          cached++;
          downloadedFromCache++;
        } else {
          // ex.: capítulo ainda não gerado (404) → falha real
          failedCount++;
        }
      } catch (_err) {
        // Sem rede (ou erro de rede): conta como falha para que o
        // resultado final reflita a verdade em vez de "concluído"
        failedCount++;
      }

      // Informa progresso a cada capítulo processado
      // (as requests sequenciais já se auto-limitam; sem pausa artificial —
      //  timers no SW oculto sofrem throttle agressivo do Chrome)
      notifyProgress();
    }

    if (cancelPrecache) break;
  }

  notifyProgress();
  console.log(`[SW] Download completo: ${cached} páginas baixadas, ${skipped} já em cache, ${failedCount} falharam.`);

  // O resultado deve refletir a realidade: se houve falhas de rede (ex.:
  // usuário iniciou o download off-line ou perdeu conexão no meio), não
  // é "concluído" — é parcial com falha, e o usuário precisa saber.
  let doneType = 'PRECACHE_DONE';
  let message = 'Download concluído';
  if (cancelledPrecache) {
    doneType = 'PRECACHE_CANCELLED';
    message = 'Download cancelado';
  } else if (failedCount > 0 && downloadedFromCache === 0) {
    doneType = 'PRECACHE_OFFLINE';
    message = 'Sem conexão com a internet. O download será possível quando a conexão for restabelecida.';
  } else if (failedCount > 0) {
    doneType = 'PRECACHE_PARTIAL';
    message = `Download parcial: ${downloadedFromCache} de ${TOTAL_CHAPTERS} capítulos. Conecte-se e toque em Baixar Bíblia para concluir.`;
  }

  // Notifica a janela solicitante (ou todas, se ela não existir mais)
  const doneMsg = { type: doneType, message };
  let notified = false;
  if (requestingClient) {
    try {
      requestingClient.postMessage(doneMsg);
      notified = true;
    } catch (_err) {
      requestingClient = null;
    }
  }
  if (!notified) {
    self.clients.matchAll({ includeUncontrolled: true }).then((all) => {
      all.forEach((client) => {
        try {
          client.postMessage(doneMsg);
        } catch (_err) {
          // janela indisponível — ignora
        }
      });
    });
  }

  cancelPrecache = false;
  cancelledPrecache = false;
  requestingClient = null;
}

// ==================================================================
//  UTILITÁRIOS
// ==================================================================

/**
 * Envia progresso do pré-cache para a janela que solicitou o download.
 * downloadedFromCache conta capítulos baixados OU já presentes no cache,
 * de modo que o percentual reflete a disponibilidade off-line real.
 *
 * Robustez: se a janela solicitante foi fechada ou recarregou, postMessage
 * lança exceção — um erro não tratado aqui rejeitaria a promessa do
 * event.waitUntil e ENCERRARIA o Service Worker no meio do download.
 * Por isso: try/catch + broadcast para as demais janelas abertas.
 */
function notifyProgress() {
  const msg = {
    type: 'PRECACHE_PROGRESS',
    downloaded: downloadedFromCache,
    total: TOTAL_CHAPTERS,
  };

  if (requestingClient) {
    try {
      requestingClient.postMessage(msg);
      return;
    } catch (_err) {
      requestingClient = null; // cliente morto — cai para o broadcast
    }
  }

  // Broadcast: qualquer painel aberto recebe o progresso
  self.clients.matchAll({ includeUncontrolled: true }).then((all) => {
    all.forEach((client) => {
      try {
        client.postMessage(msg);
      } catch (_err) {
        // janela indisponível — ignora
      }
    });
  });
}

/**
 * Conta quantas das 1.189 páginas estáticas de capítulo estão no cache
 * (chaves limpas, sem .html) e informa a janela solicitante.
 */
async function sendPrecacheCount(client) {
  const cache = await caches.open(CACHE_STATIC);
  const keys = await cache.keys();
  const count = keys.filter((req) => {
    const { pathname } = new URL(req.url);
    return isChapterPage(pathname) && !pathname.endsWith('.html');
  }).length;

  client?.postMessage({
    type: 'PRECACHE_COUNT',
    cached: count,
    total: TOTAL_CHAPTERS,
  });
}

/**
 * Remove o conteúdo baixado (botão "Limpar dados"), preservando o shell
 * do app no CACHE_STATIC (telas, CSS/JS, ícones). Apaga: as páginas de
 * capítulo do CACHE_STATIC e todo o CACHE_API (metadados + JSONs de
 * versões anteriores). Depois restaura só /api, essencial já na primeira
 * tela — o restante do shell é re-cacheado pela própria navegação.
 */
async function deletePrecachedData() {
  const staticCache = await caches.open(CACHE_STATIC);
  const staleKeys = await staticCache.keys();
  for (const req of staleKeys) {
    if (isChapterPage(new URL(req.url).pathname)) {
      await staticCache.delete(req);
    }
  }

  await caches.delete(CACHE_API);
  console.log('[SW] Conteúdo off-line removido (páginas de capítulo + cache da API); shell mantido.');

  // Reabre o cache vazio e re-pré-cacheia apenas o essencial (/api)
  const cache = await caches.open(CACHE_API);
  await cache.add('/api').catch(() => { });

  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage({ type: 'PRECACHE_DELETED' }));
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|svg|ico|webp|jpg|jpeg|woff2?|ttf|json)$/.test(pathname);
}