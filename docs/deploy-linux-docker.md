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

Per la produzione con immagini pubblicate su GitHub Container Registry usa invece:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Variabili utili:
- `GHCR_NAMESPACE` se il namespace del package non coincide con il default
- `IMAGE_TAG` se vuoi avviare una versione specifica invece di `latest`
- se il package risultasse ancora privato per versioni vecchie, esegui una sola volta `docker login ghcr.io` e aggiorna la visibilità del package su GitHub

## 6. Import iniziale dati

Esegui una sola volta quando il database e vuoto:

```bash
docker compose --profile tools run --rm importer
```

Il backend esegue automaticamente l'allineamento dello schema DB all'avvio, quindi non serve un comando separato per creare tabelle o colonne mancanti.
Il comando `npm run db:bootstrap` resta disponibile solo per manutenzione manuale o verifiche.

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
- gli update normali di backend e frontend eseguono automaticamente l'allineamento schema: usa solo `git pull` e `docker compose up -d --build`
- con le immagini pubblicate, l'update normale di produzione diventa `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`

## 9. Backup

Fare backup di:
- PostgreSQL
- `data/uploads`

Backup DB compresso con retention di 7 giorni:

```bash
npm run db:backup
```

Variabili utili:
- `BACKUP_DIR` per cambiare cartella di destinazione
- `COMPOSE_FILE` per usare un file compose diverso
- `RETENTION_DAYS` per cambiare la retention

Esempio `cron` giornaliero alle 02:15:

```cron
15 2 * * * cd /percorso/del/repository && /usr/bin/npm run db:backup >> backups/db-backup.log 2>&1
```

## 10. Note tecniche

- il frontend usa `apiUrl: '/api'`
- il backend ascolta su `0.0.0.0`
- il proxy Nginx gestisce SPA e path `/api`
