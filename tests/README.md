# Testes E2E — Modo off-line

Suíte de regressão que valida o fluxo completo do modo off-line no Chrome
headless, controlado via **Chrome DevTools Protocol (CDP)** — a mesma
interface usada pelo painel DevTools, incluindo a emulação de rede offline
(`Network.emulateNetworkConditions`).

## Cenários cobertos

| Fase | Comando | O que valida |
|---|---|---|
| Ambiente | `env-up` | Sobe uvicorn (porta 8000) + Chrome headless com perfil persistente |
| Download | `download` + `download-wait` | Painel → "Baixar Bíblia" → progresso → 1.189/1.189 capítulos |
| Off-line (emulado) | `offline-cdp` | Livros, capítulos (incl. Jó, URL acentuada) e aviso da busca com a rede emulada como offline |
| Off-line (real) | `server-off` | Para o servidor e valida leitura 100% do Cache Storage |
| Limpeza | `cleanup` | Botão "Limpar dados" esvazia o cache da API |
| Encerramento | `env-down` | Finaliza Chrome e servidor |

## Pré-requisitos

- Google Chrome (`/usr/bin/google-chrome`)
- Ambiente do projeto em `.venv` (uvicorn, FastAPI, SQLAlchemy)
- Credenciais do Turso em `.env` (o download exercita a API real)

## Ciclo completo

```shell
python3 tests/test_offline_e2e.py env-up
python3 tests/test_offline_e2e.py download
python3 tests/test_offline_e2e.py download-wait   # repetir até "PASSOU"
python3 tests/test_offline_e2e.py offline-cdp
python3 tests/test_offline_e2e.py server-off
python3 tests/test_offline_e2e.py cleanup
python3 tests/test_offline_e2e.py env-down
```

## Notas de operação

- **`download-wait` monitora por ~9 min por execução.** Com a API no Turso
  (~0,7s por capítulo), o download completo leva ~10 min: repita o comando
  até obter `DOWNLOAD: PASSOU`. O Service Worker continua baixando em
  background entre execuções (o perfil do Chrome persiste e os capítulos
  já baixados são pulados).
- **Se o Chrome for encerrado no meio** (ex.: sessão interrompida), o
  download para — basta rodar `download` novamente que ele retoma do ponto
  em que parou.
- O perfil do Chrome fica em `/tmp/biblia-chrome-profile`; remova-o para
  recomeçar do zero.
- Cada comando abre abas novas no Chrome headless; se houver muitos
  monitores acumulados, rode `env-down` e `env-up` para limpar.
