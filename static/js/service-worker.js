// self.addEventListener('install', (event) => {
//     console.log('Service Worker instalado');
// });

// self.addEventListener('fetch', (event) => {
//     event.respondWith(fetch(event.request));
// });

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

const CACHE_VERSION = 'v1';
const CACHE_API     = `biblia-api-${CACHE_VERSION}`;
const CACHE_STATIC  = `biblia-static-${CACHE_VERSION}`;

/**
 * Converte a abreviação do livro para uma URL de path segura.
 * Necessário para livros com caracteres acentuados como JÓ (Jó).
 * Exemplo: 'JÓ' → 'j%C3%B3'
 */
function abbrToPath(abbr) {
  return encodeURIComponent(abbr.toLowerCase());
}

// ------------------------------------------------------------------
// Todos os 66 livros com suas abreviações e quantidade de capítulos.
// Gerado a partir de /api — atualize bookAbbr/maxChapters se a API mudar.
// ------------------------------------------------------------------
const BOOKS = [
  // Antigo Testamento
  { abbr: 'GN',  chapters: 50 }, { abbr: 'EX',  chapters: 40 },
  { abbr: 'LV',  chapters: 27 }, { abbr: 'NM',  chapters: 36 },
  { abbr: 'DT',  chapters: 34 }, { abbr: 'JS',  chapters: 24 },
  { abbr: 'JZ',  chapters: 21 }, { abbr: 'RT',  chapters:  4 },
  { abbr: '1SM', chapters: 31 }, { abbr: '2SM', chapters: 24 },
  { abbr: '1RS', chapters: 22 }, { abbr: '2RS', chapters: 25 },
  { abbr: '1CR', chapters: 29 }, { abbr: '2CR', chapters: 36 },
  { abbr: 'ED',  chapters: 10 }, { abbr: 'NE',  chapters: 13 },
  { abbr: 'ET',  chapters: 10 }, { abbr: 'JÓ',  chapters: 42 },
  { abbr: 'SL',  chapters: 150}, { abbr: 'PV',  chapters: 31 },
  { abbr: 'EC',  chapters: 12 }, { abbr: 'CT',  chapters:  8 },
  { abbr: 'IS',  chapters: 66 }, { abbr: 'JR',  chapters: 52 },
  { abbr: 'LM',  chapters:  5 }, { abbr: 'EZ',  chapters: 48 },
  { abbr: 'DN',  chapters: 12 }, { abbr: 'OS',  chapters: 14 },
  { abbr: 'JL',  chapters:  3 }, { abbr: 'AM',  chapters:  9 },
  { abbr: 'OB',  chapters:  1 }, { abbr: 'JN',  chapters:  4 },
  { abbr: 'MQ',  chapters:  7 }, { abbr: 'NA',  chapters:  3 },
  { abbr: 'HC',  chapters:  3 }, { abbr: 'SF',  chapters:  3 },
  { abbr: 'AG',  chapters:  2 }, { abbr: 'ZC',  chapters: 14 },
  { abbr: 'ML',  chapters:  4 },
  // Novo Testamento
  { abbr: 'MT',  chapters: 28 }, { abbr: 'MC',  chapters: 16 },
  { abbr: 'LC',  chapters: 24 }, { abbr: 'JO',  chapters: 21 },
  { abbr: 'AT',  chapters: 28 }, { abbr: 'RM',  chapters: 16 },
  { abbr: '1CO', chapters: 16 }, { abbr: '2CO', chapters: 13 },
  { abbr: 'GL',  chapters:  6 }, { abbr: 'EF',  chapters:  6 },
  { abbr: 'FP',  chapters:  4 }, { abbr: 'CL',  chapters:  4 },
  { abbr: '1TS', chapters:  5 }, { abbr: '2TS', chapters:  3 },
  { abbr: '1TM', chapters:  6 }, { abbr: '2TM', chapters:  4 },
  { abbr: 'TT',  chapters:  3 }, { abbr: 'FL',  chapters:  1 },
  { abbr: 'HB',  chapters: 13 }, { abbr: 'TG',  chapters:  5 },
  { abbr: '1PE', chapters:  5 }, { abbr: '2PE', chapters:  3 },
  { abbr: '1JO', chapters:  5 }, { abbr: '2JO', chapters:  1 },
  { abbr: '3JO', chapters:  1 }, { abbr: 'JD',  chapters:  1 },
  { abbr: 'AP',  chapters: 22 },
];

// ------------------------------------------------------------------
// URLs da API que serão pré-cacheadas na instalação do SW.
// abbrToPath() garante encoding correto para livros com acentos (ex: JÓ).
// ------------------------------------------------------------------
const PRECACHE_API_URLS = [
  '/api',           // lista de todos os livros
  '/api/favorites', // favoritos do usuário
  // Uma URL por livro (retorna metadados + lista de capítulos)
  ...BOOKS.map(b => `/api/${abbrToPath(b.abbr)}`),
];

// Total de capítulos: ~1.189 — cacheados sob demanda (lazy) na primeira leitura
// e opcionalmente via precache em background após o install.

// ==================================================================
//  INSTALL — pré-cacheia rotas fixas
// ==================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando e pré-cacheando rotas da API...');

  event.waitUntil(
    caches.open(CACHE_API).then((cache) => {
      // Usa addAll com Promise.allSettled para não abortar se um endpoint falhar
      return Promise.allSettled(
        PRECACHE_API_URLS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Falha ao pré-cachear ${url}:`, err)
          )
        )
      );
    }).then(() => {
      console.log('[SW] Pré-cache da API concluído.');
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
    // Para qualquer outra rota da API (texto bíblico imutável) → Cache-First.
    if (url.pathname === '/api/favorites') {
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
 * Cache-First: serve do cache imediatamente.
 * Se não houver, busca na rede com o request original (que pode ter
 * headers HTMX), armazena usando apenas a URL como chave, e retorna.
 *
 * @param {string}  cacheKey  - URL pura (sem headers) usada como chave
 * @param {string}  cacheName - nome do cache a usar
 * @param {Request} request   - request original (pode ter headers HTMX)
 */
async function cacheFirst(cacheKey, cacheName, request) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(cacheKey);
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
    const cache  = await caches.open(cacheName);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    return offlineFallback(cacheKey);
  }
}

/**
 * Fallback offline: retorna JSON compatível com Mustache para a API
 * (o template {{#data}}...{{/data}} não renderiza nada com data vazio)
 * ou uma resposta genérica para outros recursos.
 *
 * @param {string} url - URL da requisição que falhou
 */
function offlineFallback(url) {
  const pathname = typeof url === 'string' ? new URL(url, self.location.origin).pathname : url;
  if (pathname.startsWith('/api')) {
    // Retorna estrutura compatível com o que o Mustache espera:
    // { data: [] } → {{#data}} não itera, nada é exibido
    return new Response(JSON.stringify({ data: [], offline: true }), {
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
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'PRECACHE_ALL_CHAPTERS') {
    console.log('[SW] Iniciando pré-cache de todos os capítulos em background...');
    precacheAllChapters();
  }

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function precacheAllChapters() {
  const cache = await caches.open(CACHE_API);
  let cached = 0;
  let skipped = 0;

  for (const book of BOOKS) {
    for (let ch = 1; ch <= book.chapters; ch++) {
      // abbrToPath() faz encodeURIComponent — essencial para 'JÓ' → 'j%C3%B3'
      const url = `/api/${abbrToPath(book.abbr)}/${ch}`;

      // Pula se já estiver no cache
      const exists = await cache.match(url);
      if (exists) {
        skipped++;
        continue;
      }

      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          cached++;
        }
      } catch (_err) {
        // Offline durante o precache — tentará na próxima visita
      }

      // Pausa de 30 ms entre requests para não sobrecarregar a rede
      await sleep(30);
    }
  }

  console.log(`[SW] Pré-cache concluído: ${cached} capítulos baixados, ${skipped} já estavam em cache.`);

  // Notifica todas as abas abertas
  const clients = await self.clients.matchAll();
  clients.forEach((client) =>
    client.postMessage({
      type: 'PRECACHE_DONE',
      cached,
      skipped,
      total: cached + skipped,
    })
  );
}

// ==================================================================
//  UTILITÁRIOS
// ==================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|svg|ico|webp|jpg|jpeg|woff2?|ttf|json)$/.test(pathname);
}