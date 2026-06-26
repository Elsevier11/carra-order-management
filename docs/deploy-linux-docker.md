# Deploy Linux con Docker Compose

Questa procedura assume:
- server Linux del cliente
- repository clonata da GitHub
- Docker Engine e Docker Compose installati
- PostgreSQL gestito dentro `docker compose`

## 1. Prerequisiti

- `git`
- `docker`
- `docker compose`

## 2. Clona il repository

```bash
git clone <repo>
cd <repo>
git checkout <branch>
```

## 3. Configura i segreti

Imposta almeno queste variabili nel file `.env` del progetto:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`

Valori consigliati:
- password lunga e non banale
- `JWT_SECRET` di almeno 32 caratteri casuali

## 4. Prepara i dati iniziali

Metti il JSON importato dall'Excel in:

- `data/consegne.full.json`

Questo file viene usato solo per l'import iniziale o per i reimport di test.

## 5. Avvio stack

```bash
docker compose up -d --build
```

Il frontend sara pubblicato su:

- `http://<server>/`

Il backend risponde dietro il proxy su:

- `http://<server>/api`
- `http://<server>/health`

## 6. Import iniziale dati

Esegui una sola volta quando il database e vuoto:

```bash
docker compose --profile tools run --rm importer
```

Se il database e nuovo e lo stack viene avviato senza dati preesistenti, prima del primo start del backend esegui:

```bash
npm run db:bootstrap
```

Questo comando crea gli oggetti mancanti e prepara il DB iniziale. Non va usato come operazione di deploy ricorrente.

## 7. Verifiche minime

- apri `/health`
- login con utente demo o reale
- verifica lista ordini
- verifica modifica ordine
- verifica upload allegato se richiesto

## 8. Reimport

Regola operativa:
- su database di test puoi rifare l'import
- su produzione non rifare un import completo senza backup e approvazione

Se serve un refresh completo in test:

```bash
docker compose --profile tools run --rm importer
```

Se serve un reset totale del database di test, si fa solo dopo backup e con consenso esplicito.

Nota pratica:
- le credenziali `POSTGRES_USER` e `POSTGRES_PASSWORD` vengono lette solo alla prima inizializzazione del volume
- se cambi user/password o vuoi davvero ripartire da zero, devi fermare lo stack e rimuovere `data/postgres` prima del nuovo `docker compose up -d --build`
- gli update normali di backend e frontend non devono eseguire migrazioni automatiche: usa solo `git pull` e `docker compose up -d --build`

## 9. Backup

Fare backup di:
- PostgreSQL
- `data/uploads`

## 10. Note tecniche

- il frontend usa `apiUrl: '/api'`
- il backend ascolta su `0.0.0.0`
- il proxy Nginx gestisce SPA e path `/api`
