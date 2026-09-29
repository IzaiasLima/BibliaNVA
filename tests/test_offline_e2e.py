#!/usr/bin/env python3
"""Teste E2E do fluxo off-line via Chrome DevTools Protocol (headless).

Pré-requisitos: Google Chrome instalado (.venv com uvicorn/SQLAlchemy).
Os processos (servidor e Chrome) persistem entre comandos — rode as fases
em qualquer ordem, encerrando com env-down.

Uso:
  env-up        sobe servidor + Chrome (reutiliza perfil persistente)
  download      dispara o download completo via painel (retorna imediatamente)
  download-wait monitora o download por ~9 min (repetir até concluir)
  offline-cdp   emula rede offline via CDP e valida a leitura
  server-off    para o servidor e valida off-line real
  cleanup       volta on-line e limpa os dados baixados
  env-down      encerra servidor e Chrome

Exemplo de ciclo completo:
  python3 tests/test_offline_e2e.py env-up
  python3 tests/test_offline_e2e.py download && python3 tests/test_offline_e2e.py download-wait
  python3 tests/test_offline_e2e.py offline-cdp
  python3 tests/test_offline_e2e.py server-off
  python3 tests/test_offline_e2e.py cleanup
  python3 tests/test_offline_e2e.py env-down
"""
import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request

HOST = "127.0.0.1"
PORT = 8000
BASE = f"http://localhost:{PORT}"
UVICORN_LOG = "/tmp/biblia-uvicorn.log"


def server_up():
    with socket.socket() as s:
        return s.connect_ex((HOST, PORT)) == 0


def wait_server(timeout=20):
    for _ in range(timeout * 2):
        if server_up():
            return True
        time.sleep(0.5)
    return False


def read_pids():
    try:
        with open("/tmp/biblia-test-pids.json") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def write_pids(**kwargs):
    pids = read_pids()
    pids.update({k: v for k, v in kwargs.items() if v is not None})
    with open("/tmp/biblia-test-pids.json", "w") as f:
        json.dump(pids, f)


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


class CDP:
    """Cliente WebSocket mínimo para o Chrome DevTools Protocol."""

    def __init__(self, url):
        import base64
        import struct

        parsed = urllib.parse.urlparse(url)
        self.sock = socket.create_connection((parsed.hostname, parsed.port), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        target = parsed.path + (f"?{parsed.query}" if parsed.query else "")
        req = (
            f"GET {target} HTTP/1.1\r\n"
            f"Host: {parsed.hostname}:{parsed.port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        self.sock.settimeout(20)  # toda leitura terá teto de 20s
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.sock.recv(4096)
        if b"101" not in resp.split(b"\r\n")[0]:
            raise RuntimeError(f"Handshake falhou: {resp[:200]}")

    def _recv_exact(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise RuntimeError("conexão fechada")
            buf += chunk
        return buf

    def recv_msg(self):
        import struct

        b1, b2 = self._recv_exact(2)
        opcode = b1 & 0x0F
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack(">H", self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack(">Q", self._recv_exact(8))[0]
        payload = self._recv_exact(length)
        if opcode == 8:
            raise RuntimeError("websocket fechado")
        return json.loads(payload.decode("utf-8", "replace"))

    def send_msg(self, obj):
        import struct

        data = json.dumps(obj).encode()
        header = bytearray([0x81])
        n = len(data)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", n)
        mask = os.urandom(4)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(bytes(header) + masked)

    def send(self, method, **params):
        self._id = getattr(self, "_id", 0) + 1
        msg_id = self._id
        self.send_msg({"id": msg_id, "method": method, "params": params})
        while True:
            resp = self.recv_msg()
            if resp.get("id") == msg_id:
                if "error" in resp:
                    raise RuntimeError(f"CDP {method}: {resp['error']}")
                return resp.get("result", {})

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def start_server():
    proc = subprocess.Popen(
        [".venv/bin/python", "-m", "uvicorn", "main:app", "--port", str(PORT)],
        stdout=open(UVICORN_LOG, "a"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    if not wait_server():
        proc.terminate()
        print("ERRO: servidor não subiu", file=sys.stderr)
        sys.exit(1)
    write_pids(server=proc.pid)
    print(f"servidor no ar (pid {proc.pid})")


def start_chrome():
    proc = subprocess.Popen(
        [
            "google-chrome",
            "--headless=new",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-gpu",
            "--no-sandbox",
            "--user-data-dir=/tmp/biblia-chrome-profile",
            "--remote-debugging-port=9222",
            "--remote-allow-origins=*",
            "about:blank",
        ],
        stdout=open("/tmp/biblia-chrome.log", "w"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    for _ in range(30):
        try:
            tabs = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=2))
            page = next(t for t in tabs if t.get("type") == "page")
            write_pids(chrome=proc.pid)
            print(f"Chrome no ar (pid {proc.pid})")
            return page
        except Exception:
            time.sleep(0.5)
    proc.terminate()
    print("ERRO: Chrome não abriu a porta de debug", file=sys.stderr)
    sys.exit(1)


def get_page_ws():
    tabs = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5))
    return next(t for t in tabs if t.get("type") == "page")["webSocketDebuggerUrl"]


def cdp_eval(cdp, expr, await_promise=False):
    try:
        cdp.sock.settimeout(20)
        r = cdp.send("Runtime.evaluate", expression=expr, awaitPromise=await_promise, returnByValue=True)
        return r.get("result", {}).get("value")
    except (socket.timeout, TimeoutError, OSError):
        print("  [aviso] evaluate excedeu 20s — retornando None")
        return None


def check(cdp, name, expr):
    value = cdp_eval(cdp, expr)
    ok = bool(value)
    extra = f" -> {value!r}" if (not ok or isinstance(value, (str, int))) else ""
    print(f"  [{'OK' if ok else 'FALHOU'}] {name}{extra}")
    return ok


def wait_for(cdp, expr, timeout, poll=1.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if cdp_eval(cdp, expr):
            return True
        time.sleep(poll)
    return False


def new_tab(path):
    """Cria uma ABA NOVA por execução — evita herdar emulação de rede
    ou estado residual de execuções anteriores (causa de falsos negativos)."""
    import urllib.request as _ur

    req = _ur.Request(
        f"http://127.0.0.1:9222/json/new?{urllib.parse.quote(BASE + path, safe='/:?=&')}",
        method="PUT",
    )
    tab = json.load(_ur.urlopen(req, timeout=5))
    cdp = CDP(tab["webSocketDebuggerUrl"])
    cdp.send("Page.enable")
    cdp.send("Runtime.enable")
    time.sleep(1)
    return cdp


def ensure_controller(cdp, timeout=150):
    """Espera o SW ativar e controlar a página.
    O install pré-cacheia 68 URLs contra o Turso (~60-90s) e só então
    skipWaiting()+clients.claim() tornam o controller disponível."""
    if cdp_eval(cdp, "navigator.serviceWorker.controller !== null"):
        return
    print(f"  aguardando instalação do SW (até {timeout}s)...")
    if not wait_for(cdp, "navigator.serviceWorker.controller !== null", timeout):
        print("  recarregando para ativar o controller...")
        cdp.send("Page.reload")
        time.sleep(3)
        wait_for(cdp, "navigator.serviceWorker.controller !== null", timeout)


def count_cached_chapters(cdp):
    """Conta capítulos no cache da API, agnóstico à versão do cache."""
    return cdp_eval(
        cdp,
        "caches.keys().then(keys => Promise.all("
        "keys.filter(k => k.startsWith('biblia-api-'))"
        ".map(k => caches.open(k).then(c => c.keys()))))"
        ".then(all => all.flat().filter(r => { "
        "const q = new URL(r.url).pathname.split('/').filter(Boolean); "
        "return q.length === 3 && q[0] === 'api' && !isNaN(parseInt(q[2])); }).length)",
        await_promise=True,
    )


# ------------------------------------------------------------------ comandos


def cmd_env_up():
    if not server_up():
        start_server()
    else:
        print("servidor já está no ar")
    try:
        get_page_ws()
        print("Chrome já está no ar")
    except Exception:
        start_chrome()


def cmd_download():
    cdp = new_tab("/pages/index.html")
    ensure_controller(cdp)
    ok = True
    ok &= check(cdp, "SW controlando a página", "navigator.serviceWorker.controller !== null")

    cdp.send("Page.navigate", url=f"{BASE}/pages/bible.html")
    time.sleep(2)
    cdp_eval(cdp, "toggleOfflinePanel()")
    time.sleep(1)
    ok &= check(cdp, "painel aberto", "document.getElementById('offline-panel').classList.contains('show')")
    status_inicial = cdp_eval(cdp, "document.getElementById('offline-status').textContent")
    print(f"  estado inicial: {status_inicial!r}")

    before = count_cached_chapters(cdp)
    cdp_eval(cdp, "startOfflineDownload()")
    started = wait_for(cdp, "/Baixando/.test(document.getElementById('offline-status').textContent)", 30)
    print("  [OK] download iniciado" if started else "  [FALHOU] download não iniciou")
    ok &= started
    cdp.close()
    if not started:
        print("DOWNLOAD: FALHOU")
        sys.exit(1)
    print(f"download disparado; capítulos já em cache: {before}")
    print("DOWNLOAD: DISPARADO — monitore com: download-wait")
    sys.exit(0)


def cmd_download_wait():
    """Monitora o download em execução no SW por até ~9 min (janela síncrona).
    O SW continua baixando mesmo se esta janela terminar (Chrome sobrevive)."""
    ok = True
    cdp = new_tab("/pages/bible.html")
    deadline = time.time() + 540
    last_pct = -1
    done = False
    while time.time() < deadline:
        count = count_cached_chapters(cdp)
        pct = round(count / 1189 * 100)
        if pct != last_pct and pct % 10 == 0:
            print(f"  ... {count}/1189 capítulos ({pct}%)")
            last_pct = pct
        status = cdp_eval(cdp, "document.getElementById('offline-status')?.textContent || ''") or ""
        if "concluído" in status.lower() or count >= 1189:
            print(f"  [OK] download concluído ({count}/1189)")
            done = True
            break
        time.sleep(5)
    if done:
        # abre o painel para que a página consulte o estado e ajuste os botões
        cdp_eval(cdp, "toggleOfflinePanel()")
        time.sleep(2)
        ok &= check(cdp, "painel indica Bíblia completa",
                    "/completa/.test(document.getElementById('offline-status').textContent)")
        ok &= check(cdp, "botão 'Limpar dados' visível (estado full)",
                    "!document.getElementById('btn-offline-delete').classList.contains('hidden')")
        cdp.close()
        print("DOWNLOAD: PASSOU" if ok else "DOWNLOAD: FALHOU")
        sys.exit(0 if ok else 1)
    cdp.close()
    print(f"DOWNLOAD: AINDA RODANDO ({count}/1189) — execute download-wait novamente")
    sys.exit(3)


def cmd_offline_cdp():
    cdp = new_tab("/pages/bible.html")
    ensure_controller(cdp)
    # Garante que a página rodou sob o SW já atualizado (evita corrida de versão)
    cdp.send("Page.reload")
    time.sleep(3)
    ensure_controller(cdp)

    ok = True
    cdp.send("Network.enable")
    cdp.send("Network.emulateNetworkConditions", offline=True, latency=0, downloadThroughput=-1, uploadThroughput=-1)
    print("  rede emulada como offline")
    time.sleep(1)

    ok &= check(cdp, "lista de livros OFF-LINE", "document.querySelectorAll('ul.columns li a').length >= 60")
    cdp_eval(cdp, "chapterView('SL', 23)")
    time.sleep(2)
    # conta p.verse global: no primeiro capítulo a inserção vai para #data-render
    ok &= check(cdp, "Salmos 23 OFF-LINE", "document.querySelectorAll('p.verse').length >= 5")
    cdp_eval(cdp, "chaptersList('JÓ')")
    time.sleep(2)
    ok &= check(cdp, "capítulos de Jó OFF-LINE (URL acentuada)", "document.querySelectorAll('.chapter').length === 42")
    cdp_eval(cdp, "searcByhWords('pastor')")
    time.sleep(2)
    ok &= check(cdp, "busca off-line mostra aviso (limitação conhecida)",
                "document.getElementById('toast').classList.contains('show')")
    cdp.close()
    print("OFF-LINE (CDP): PASSOU" if ok else "OFF-LINE (CDP): FALHOU")
    sys.exit(0 if ok else 1)


def cmd_server_off():
    pids = read_pids()
    spid = pids.get("server")
    was_up = server_up()
    if was_up and spid and alive(spid):
        os.kill(spid, signal.SIGTERM)
        time.sleep(2)
    if server_up():
        print("ERRO: não consegui parar o servidor", file=sys.stderr)
        sys.exit(1)
    print("  servidor parado — off-line real")

    ok = True
    cdp = new_tab("/pages/bible.html")
    time.sleep(1)
    ok &= check(cdp, "livros do Cache Storage (sem servidor)", "document.querySelectorAll('ul.columns li a').length >= 60")
    # capítulos previamente lidos/baixados no teste
    cdp_eval(cdp, "chapterView('SL', 23)")
    time.sleep(2)
    ok &= check(cdp, "Salmos 23 sem servidor", "document.querySelectorAll('p.verse').length >= 5")
    cdp_eval(cdp, "chapterView('MT', 5)")
    time.sleep(2)
    ok &= check(cdp, "Mateus 5 sem servidor", "document.querySelectorAll('p.verse').length >= 10")
    cdp.close()

    # religa o servidor para os próximos passos
    start_server()
    print("SERVIDOR PARADO: PASSOU" if ok else "SERVIDOR PARADO: FALHOU")
    sys.exit(0 if ok else 1)


def cmd_cleanup():
    ok = True
    cdp = new_tab("/pages/bible.html")
    time.sleep(1)
    cdp_eval(cdp, "toggleOfflinePanel()")
    time.sleep(0.5)
    cdp_eval(cdp, "deleteOfflineData()")
    time.sleep(4)
    ok &= check(cdp, "dados excluídos (painel confirma)",
                "/exclu/i.test(document.getElementById('offline-status').textContent)")
    cdp.close()
    print("LIMPEZA: PASSOU" if ok else "LIMPEZA: FALHOU")
    sys.exit(0 if ok else 1)


def cmd_env_down():
    pids = read_pids()
    for key in ("chrome", "server"):
        pid = pids.get(key)
        if pid and alive(pid):
            try:
                os.killpg(pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                os.kill(pid, signal.SIGTERM)
            print(f"{key} (pid {pid}) encerrado")
    write_pids(chrome=None, server=None)


MAIN = {
    "env-up": cmd_env_up,
    "download": cmd_download,
    "download-wait": cmd_download_wait,
    "offline-cdp": cmd_offline_cdp,
    "server-off": cmd_server_off,
    "cleanup": cmd_cleanup,
    "env-down": cmd_env_down,
}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd not in MAIN:
        print(f"uso: {sys.argv[0]} {'|'.join(MAIN)}", file=sys.stderr)
        sys.exit(2)
    MAIN[cmd]()
