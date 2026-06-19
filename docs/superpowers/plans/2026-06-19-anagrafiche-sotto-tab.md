# Anagrafiche Sotto-Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un secondo livello di tab nella pagina Anagrafiche, uno per ogni tipo di anagrafica, in modo che solo la sezione selezionata sia visibile.

**Architecture:** Si aggiungono due variabili di stato indipendenti (`activePersoneSubTab`, `activeProduzioneSubTab`) che ricordano l'ultima sotto-tab visitata per ciascun gruppo. Il lazy loading viene refactorizzato per caricare solo la sezione attiva. L'HTML mostra una seconda riga di tab sotto le tab principali e renderizza solo il contenuto della sotto-tab attiva.

**Tech Stack:** Angular 17+ (standalone, `@if`/`@else if` flow control), TypeScript, SCSS

## Global Constraints

- Solo i file `app.component.ts`, `app.component.html`, `app.component.scss` vengono modificati
- Nessuna modifica al backend o alla logica CRUD esistente
- Usare solo classi CSS già esistenti + una nuova classe `registry-subtabs` minimale
- `isAdmin` guard su "Mittenti Disegno" e "Operai" invariato

---

### Task 1: Stato e metodi TypeScript

**Files:**
- Modify: `frontend/src/app/app.component.ts` — aggiunta proprietà e metodi sub-tab

**Interfaces:**
- Produce: `activePersoneSubTab: string`, `activeProduzioneSubTab: string`, `setPersoneSubTab(tab: string): void`, `setProduzioneSubTab(tab: string): void`

- [ ] **Step 1: Aggiungi le due proprietà sub-tab dopo `activeRegistryTab` (riga 90)**

Aggiungi queste due righe subito dopo `activeRegistryTab: RegistryTab = 'persone';`:

```typescript
activePersoneSubTab: string = 'utenti';
activeProduzioneSubTab: string = 'vettori';
```

- [ ] **Step 2: Aggiungi i metodi pubblici e privati dopo `setRegistryTab()`**

Subito dopo la chiusura di `setRegistryTab()` (dopo riga 585), inserisci:

```typescript
setPersoneSubTab(tab: string): void {
  this.activePersoneSubTab = tab;
  this.loadPersoneSubTab(tab);
}

setProduzioneSubTab(tab: string): void {
  this.activeProduzioneSubTab = tab;
  this.loadProduzioneSubTab(tab);
}

private loadPersoneSubTab(tab: string): void {
  if (tab === 'utenti') this.loadUsers();
  else if (tab === 'commerciali') this.loadCommerciali();
  else if (tab === 'responsabili') this.loadResponsabili();
  else if (tab === 'mittenti-disegno') this.loadMittentiDisegnoAdmin();
  else if (tab === 'operai') this.loadOperaiAdmin();
}

private loadProduzioneSubTab(tab: string): void {
  if (tab === 'vettori') this.loadVettoriAdmin();
  else if (tab === 'tipi-cemento') this.loadCementiTipiAdmin();
  else if (tab === 'tipi-accessorio') this.loadAccessoriTipiAdmin();
}
```

- [ ] **Step 3: Sostituisci il corpo di `loadActiveRegistryTab()` (righe 2340–2352)**

Sostituisci il corpo del metodo `loadActiveRegistryTab()` con:

```typescript
private loadActiveRegistryTab(): void {
  if (this.activeRegistryTab === 'persone') {
    this.loadPersoneSubTab(this.activePersoneSubTab);
  } else if (this.activeRegistryTab === 'produzione') {
    this.loadProduzioneSubTab(this.activeProduzioneSubTab);
  }
}
```

- [ ] **Step 4: Verifica compilazione TypeScript**

```powershell
cd frontend; npx tsc --noEmit
```

Atteso: nessun errore.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "feat(anagrafiche): stato e lazy-load sotto-tab persone/produzione"
```

---

### Task 2: Template HTML — navigazione sotto-tab

**Files:**
- Modify: `frontend/src/app/app.component.html` — aggiunta seconda riga di tab nel `section.detail-card`

**Interfaces:**
- Consumes: `activePersoneSubTab`, `activeProduzioneSubTab`, `setPersoneSubTab()`, `setProduzioneSubTab()`, `isAdmin`

- [ ] **Step 1: Aggiungi la riga sotto-tab dentro `section.detail-card` (intorno a riga 236–241)**

L'attuale blocco è:
```html
<section class="detail-card">
  <div class="registry-tabs">
    <button type="button" class="ghost" [class.active]="activeRegistryTab === 'persone'" (click)="setRegistryTab('persone')">Persone</button>
    <button type="button" class="ghost" [class.active]="activeRegistryTab === 'produzione'" (click)="setRegistryTab('produzione')">Produzione</button>
  </div>
</section>
```

Sostituiscilo con:
```html
<section class="detail-card">
  <div class="registry-tabs">
    <button type="button" class="ghost" [class.active]="activeRegistryTab === 'persone'" (click)="setRegistryTab('persone')">Persone</button>
    <button type="button" class="ghost" [class.active]="activeRegistryTab === 'produzione'" (click)="setRegistryTab('produzione')">Produzione</button>
  </div>
  @if (activeRegistryTab === 'persone') {
    <div class="registry-tabs registry-subtabs">
      <button type="button" class="ghost" [class.active]="activePersoneSubTab === 'utenti'" (click)="setPersoneSubTab('utenti')">Utenti</button>
      <button type="button" class="ghost" [class.active]="activePersoneSubTab === 'commerciali'" (click)="setPersoneSubTab('commerciali')">Commerciali</button>
      <button type="button" class="ghost" [class.active]="activePersoneSubTab === 'responsabili'" (click)="setPersoneSubTab('responsabili')">Responsabili</button>
      @if (isAdmin) {
        <button type="button" class="ghost" [class.active]="activePersoneSubTab === 'mittenti-disegno'" (click)="setPersoneSubTab('mittenti-disegno')">Mittenti Disegno</button>
        <button type="button" class="ghost" [class.active]="activePersoneSubTab === 'operai'" (click)="setPersoneSubTab('operai')">Operai</button>
      }
    </div>
  } @else if (activeRegistryTab === 'produzione') {
    <div class="registry-tabs registry-subtabs">
      <button type="button" class="ghost" [class.active]="activeProduzioneSubTab === 'vettori'" (click)="setProduzioneSubTab('vettori')">Vettori</button>
      <button type="button" class="ghost" [class.active]="activeProduzioneSubTab === 'tipi-cemento'" (click)="setProduzioneSubTab('tipi-cemento')">Tipi Cemento</button>
      <button type="button" class="ghost" [class.active]="activeProduzioneSubTab === 'tipi-accessorio'" (click)="setProduzioneSubTab('tipi-accessorio')">Tipi Accessorio</button>
    </div>
  }
</section>
```

- [ ] **Step 2: Commit navigazione**

```bash
git add frontend/src/app/app.component.html
git commit -m "feat(anagrafiche): seconda riga sotto-tab persone e produzione"
```

---

### Task 3: Template HTML — contenuto condizionale per sotto-tab

**Files:**
- Modify: `frontend/src/app/app.component.html` — wrapping dei blocchi di contenuto con `@if` sub-tab

**Interfaces:**
- Consumes: `activePersoneSubTab`, `activeProduzioneSubTab`

Le sezioni di contenuto che vanno wrappate:

**Persone:**
- `utenti`: dall'attuale `<section class="detail-card"><h2>Gestione utenti</h2>` fino alla fine del blocco reset password (`</section>` dopo il form reset, ~riga 323)
- `commerciali`: `<div class="settings-card"><h2 class="settings-card-title">Commerciali</h2>` fino a `</div>` (~righe 327–350)
- `responsabili`: `<div class="settings-card"><h2 class="settings-card-title">Responsabili</h2>` fino a `</div>` (~righe 352–376)
- `mittenti-disegno`: `<div class="settings-card"><h2 class="settings-card-title">Mittenti Disegno</h2>` fino a `</div>` (~righe 379–414, già dentro `@if (isAdmin)`)
- `operai`: `<div class="settings-card"><h2 class="settings-card-title">Operai</h2>` fino a `</div>` (~righe 416–452, già dentro `@if (isAdmin)`)

**Produzione:**
- `vettori`: `<div class="settings-card"><h2 class="settings-card-title">Vettori</h2>` fino a `</div>` (~righe 457–491)
- `tipi-cemento`: `<div class="settings-card"><h2 class="settings-card-title">Tipi Cemento</h2>` fino a `</div>` (~righe 493–531)
- `tipi-accessorio`: `<div class="settings-card"><h2 class="settings-card-title">Tipi Accessorio</h2>` fino a `</div>` (~righe 533–571)

- [ ] **Step 1: Riorganizza il blocco `@if (activeRegistryTab === 'persone')`**

Sostituisci l'intero blocco Persone (dalla riga `@if (activeRegistryTab === 'persone') {` fino a `} @else if (activeRegistryTab === 'produzione') {`) con:

```html
@if (activeRegistryTab === 'persone') {
  @if (activePersoneSubTab === 'utenti') {
    <section class="detail-card">
      <h2>Gestione utenti</h2>
      <div class="modal-grid">
        <input type="text" [(ngModel)]="newUserModel.username" placeholder="Username (min 3 caratteri)" />
        <select [(ngModel)]="newUserModel.role">
          <option value="admin">admin</option>
          <option value="operativo">operativo</option>
          <option value="lettura">lettura</option>
        </select>
        <label class="kanban-toggle">
          <input type="checkbox" [(ngModel)]="newUserModel.isActive" />
          <span>Attivo</span>
        </label>
        <button type="button" [disabled]="newUserModel.username.trim().length < 3" (click)="createUser()">Crea utente</button>
      </div>
      @if (generatedPassword) {
        <div class="generated-password-banner">
          <div class="generated-password-info">
            <span class="generated-password-label">Password generata per <strong>{{ generatedPasswordForUser }}</strong> — comunicala all'utente, non verrà più mostrata.</span>
            <span class="generated-password-value">{{ generatedPassword }}</span>
          </div>
          <button type="button" class="ghost" (click)="copyGeneratedPassword()">Copia</button>
          <button type="button" class="ghost" (click)="generatedPassword = null">✕</button>
        </div>
      }
    </section>

    <section class="table-card">
      @if (usersLoading) {
        <p>Caricamento utenti...</p>
      } @else {
        <table class="audit-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Ruolo</th>
              <th>Stato</th>
              <th>Aggiornato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            @for (userRow of usersRows; track userRow.id) {
              <tr>
                <td>{{ userRow.username }}</td>
                <td>
                  <select [ngModel]="userRow.role" (ngModelChange)="updateUserRole(userRow.id, $event)">
                    <option value="admin">admin</option>
                    <option value="operativo">operativo</option>
                    <option value="lettura">lettura</option>
                  </select>
                </td>
                <td>{{ userRow.isActive ? 'Attivo' : 'Disattivo' }}</td>
                <td>{{ userRow.updatedAt ? (userRow.updatedAt | date:'dd/MM/yyyy HH:mm') : '-' }}</td>
                <td>
                  <div class="attachment-actions">
                    <button type="button" [class]="userRow.isActive ? 'ghost-danger' : 'ghost'" (click)="toggleUserActive(userRow)">{{ userRow.isActive ? 'Disattiva' : 'Attiva' }}</button>
                    <button type="button" class="ghost" (click)="openPasswordReset(userRow.id)">Reset password</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>

    @if (passwordResetModel.userId) {
      <section class="detail-card">
        <h2>Reset password utente</h2>
        <div class="modal-grid">
          <input type="password" [(ngModel)]="passwordResetModel.password" placeholder="Nuova password (min 8)" />
          <button type="button" [disabled]="passwordResetModel.password.length < 8" (click)="resetUserPassword()">Conferma reset</button>
          <button type="button" class="ghost" (click)="passwordResetModel = { userId: null, password: '' }">Annulla</button>
        </div>
      </section>
    }
  }

  @if (activePersoneSubTab === 'commerciali') {
    <div class="settings-page">
      <div class="settings-card">
        <h2 class="settings-card-title">Commerciali</h2>
        @if (commercialiLoading) {
          <p class="settings-loading">Caricamento...</p>
        } @else {
          <table class="audit-table">
            <thead><tr><th>Nome</th><th>Azioni</th></tr></thead>
            <tbody>
              @for (item of commercialiRows; track item.id) {
                <tr>
                  <td>{{ item.nome }}</td>
                  <td><button type="button" class="danger" (click)="deleteCommerciale(item.id)">Elimina</button></td>
                </tr>
              }
              @if (!commercialiRows.length) {
                <tr><td colspan="2">Nessun commerciale.</td></tr>
              }
            </tbody>
          </table>
          <div class="settings-inline-add">
            <input type="text" [(ngModel)]="newComercialeModel.nome" placeholder="Nome commerciale" />
            <button type="button" [disabled]="!newComercialeModel.nome.trim()" (click)="createCommerciale()">Aggiungi</button>
          </div>
        }
      </div>
    </div>
  }

  @if (activePersoneSubTab === 'responsabili') {
    <div class="settings-page">
      <div class="settings-card">
        <h2 class="settings-card-title">Responsabili</h2>
        @if (responsabiliLoading) {
          <p class="settings-loading">Caricamento...</p>
        } @else {
          <table class="audit-table">
            <thead><tr><th>Nome</th><th>Azioni</th></tr></thead>
            <tbody>
              @for (item of responsabiliRows; track item.id) {
                <tr>
                  <td>{{ item.nome }}</td>
                  <td><button type="button" class="danger" (click)="deleteResponsabile(item.id)">Elimina</button></td>
                </tr>
              }
              @if (!responsabiliRows.length) {
                <tr><td colspan="2">Nessun responsabile.</td></tr>
              }
            </tbody>
          </table>
          <div class="settings-inline-add">
            <input type="text" [(ngModel)]="newResponsabileModel.nome" placeholder="Nome responsabile" />
            <button type="button" [disabled]="!newResponsabileModel.nome.trim()" (click)="createResponsabile()">Aggiungi</button>
          </div>
        }
      </div>
    </div>
  }

  @if (isAdmin && activePersoneSubTab === 'mittenti-disegno') {
    <div class="settings-page">
      <div class="settings-card">
        <h2 class="settings-card-title">Mittenti Disegno</h2>
        @if (mittentiDisegnoLoading) {
          <p class="settings-loading">Caricamento...</p>
        } @else {
          <table class="audit-table">
            <thead><tr><th>Nome</th><th>Azioni</th></tr></thead>
            <tbody>
              @for (item of mittentiDisegnoRows; track item.id) {
                <tr>
                  @if (editingMittenteDisegno?.id === item.id) {
                    <td><input type="text" [(ngModel)]="editMittenteDisegnoNome" /></td>
                    <td>
                      <button type="button" [disabled]="!editMittenteDisegnoNome.trim()" (click)="saveMittenteDisegno()">Salva</button>
                      <button type="button" class="ghost" (click)="cancelEditMittenteDisegno()">Annulla</button>
                    </td>
                  } @else {
                    <td>{{ item.nome }}</td>
                    <td>
                      <button type="button" class="ghost" (click)="startEditMittenteDisegno(item)">Modifica</button>
                      <button type="button" class="danger" (click)="deleteMittenteDisegno(item)">Elimina</button>
                    </td>
                  }
                </tr>
              }
              @if (!mittentiDisegnoRows.length) {
                <tr><td colspan="2">Nessun mittente disegno.</td></tr>
              }
            </tbody>
          </table>
          <div class="settings-inline-add">
            <input type="text" [(ngModel)]="newMittenteDisegnoNome" placeholder="Nome mittente" />
            <button type="button" [disabled]="!newMittenteDisegnoNome.trim()" (click)="createMittenteDisegno()">Aggiungi</button>
          </div>
        }
      </div>
    </div>
  }

  @if (isAdmin && activePersoneSubTab === 'operai') {
    <div class="settings-page">
      <div class="settings-card">
        <h2 class="settings-card-title">Operai</h2>
        @if (operaiLoading) {
          <p class="settings-loading">Caricamento...</p>
        } @else {
          <table class="audit-table">
            <thead><tr><th>Nome</th><th>Azioni</th></tr></thead>
            <tbody>
              @for (item of operaiRows; track item.id) {
                <tr>
                  @if (editingOperaio?.id === item.id) {
                    <td><input type="text" [(ngModel)]="editOperaioNome" /></td>
                    <td>
                      <button type="button" [disabled]="!editOperaioNome.trim()" (click)="saveOperaio()">Salva</button>
                      <button type="button" class="ghost" (click)="cancelEditOperaio()">Annulla</button>
                    </td>
                  } @else {
                    <td>{{ item.nome }}</td>
                    <td>
                      <button type="button" class="ghost" (click)="startEditOperaio(item)">Modifica</button>
                      <button type="button" class="danger" (click)="deleteOperaio(item)">Elimina</button>
                    </td>
                  }
                </tr>
              }
              @if (!operaiRows.length) {
                <tr><td colspan="2">Nessun operaio.</td></tr>
              }
            </tbody>
          </table>
          <div class="settings-inline-add">
            <input type="text" [(ngModel)]="newOperaioNome" placeholder="Nome operaio" />
            <button type="button" [disabled]="!newOperaioNome.trim()" (click)="createOperaio()">Aggiungi</button>
          </div>
        }
      </div>
    </div>
  }
```

- [ ] **Step 2: Riorganizza il blocco `@else if (activeRegistryTab === 'produzione')`**

Sostituisci l'intero blocco Produzione con:

```html
} @else if (activeRegistryTab === 'produzione') {
  @if (activeProduzioneSubTab === 'vettori') {
    <div class="settings-page">
      <div class="settings-card">
        <h2 class="settings-card-title">Vettori</h2>
        @if (vettoriLoading) {
          <p class="settings-loading">Caricamento...</p>
        } @else {
          <table class="audit-table">
            <thead><tr><th>Nome</th><th>Azioni</th></tr></thead>
            <tbody>
              @for (item of vettoriRows; track item.id) {
                <tr>
                  @if (editingVettore?.id === item.id) {
                    <td><input type="text" [(ngModel)]="editVettoreNome" /></td>
                    <td>
                      <button type="button" [disabled]="!editVettoreNome.trim()" (click)="saveVettore()">Salva</button>
                      <button type="button" class="ghost" (click)="cancelEditVettore()">Annulla</button>
                    </td>
                  } @else {
                    <td>{{ item.nome }}</td>
                    <td>
                      <button type="button" class="ghost" (click)="startEditVettore(item)">Modifica</button>
                      <button type="button" class="danger" (click)="deleteVettore(item)">Elimina</button>
                    </td>
                  }
                </tr>
              }
              @if (!vettoriRows.length) {
                <tr><td colspan="2">Nessun vettore.</td></tr>
              }
            </tbody>
          </table>
          <div class="settings-inline-add">
            <input type="text" [(ngModel)]="newVettoreNome" placeholder="Nome vettore" />
            <button type="button" [disabled]="!newVettoreNome.trim()" (click)="createVettore()">Aggiungi</button>
          </div>
        }
      </div>
    </div>
  }

  @if (activeProduzioneSubTab === 'tipi-cemento') {
    <div class="settings-page">
      <div class="settings-card">
        <h2 class="settings-card-title">Tipi Cemento</h2>
        @if (cementiTipiLoading) {
          <p class="settings-loading">Caricamento...</p>
        } @else {
          <table class="audit-table">
            <thead><tr><th>Nome</th><th>Ordine</th><th>Azioni</th></tr></thead>
            <tbody>
              @for (item of cementiTipiRows; track item.id) {
                <tr>
                  @if (editingCementoTipo?.id === item.id) {
                    <td><input type="text" [(ngModel)]="editCementoTipoNome" /></td>
                    <td><input type="number" [(ngModel)]="editCementoTipoOrdine" style="width:5rem" /></td>
                    <td>
                      <button type="button" [disabled]="!editCementoTipoNome.trim()" (click)="saveCementoTipo()">Salva</button>
                      <button type="button" class="ghost" (click)="cancelEditCementoTipo()">Annulla</button>
                    </td>
                  } @else {
                    <td>{{ item.nome }}</td>
                    <td>{{ item.ordine }}</td>
                    <td>
                      <button type="button" class="ghost" (click)="startEditCementoTipo(item)">Modifica</button>
                      <button type="button" class="danger" (click)="deleteCementoTipo(item)">Elimina</button>
                    </td>
                  }
                </tr>
              }
              @if (!cementiTipiRows.length) {
                <tr><td colspan="3">Nessun tipo cemento.</td></tr>
              }
            </tbody>
          </table>
          <div class="settings-inline-add">
            <input type="text" [(ngModel)]="newCementoTipoNome" placeholder="Nome tipo cemento" />
            <input type="number" [(ngModel)]="newCementoTipoOrdine" placeholder="Ordine" style="width:5rem" />
            <button type="button" [disabled]="!newCementoTipoNome.trim()" (click)="createCementoTipo()">Aggiungi</button>
          </div>
        }
      </div>
    </div>
  }

  @if (activeProduzioneSubTab === 'tipi-accessorio') {
    <div class="settings-page">
      <div class="settings-card">
        <h2 class="settings-card-title">Tipi Accessorio</h2>
        @if (accessoriTipiLoading) {
          <p class="settings-loading">Caricamento...</p>
        } @else {
          <table class="audit-table">
            <thead><tr><th>Nome</th><th>Ordine</th><th>Azioni</th></tr></thead>
            <tbody>
              @for (item of accessoriTipiRows; track item.id) {
                <tr>
                  @if (editingAccessorioTipo?.id === item.id) {
                    <td><input type="text" [(ngModel)]="editAccessorioTipoNome" /></td>
                    <td><input type="number" [(ngModel)]="editAccessorioTipoOrdine" style="width:5rem" /></td>
                    <td>
                      <button type="button" [disabled]="!editAccessorioTipoNome.trim()" (click)="saveAccessorioTipo()">Salva</button>
                      <button type="button" class="ghost" (click)="cancelEditAccessorioTipo()">Annulla</button>
                    </td>
                  } @else {
                    <td>{{ item.nome }}</td>
                    <td>{{ item.ordine }}</td>
                    <td>
                      <button type="button" class="ghost" (click)="startEditAccessorioTipo(item)">Modifica</button>
                      <button type="button" class="danger" (click)="deleteAccessorioTipo(item)">Elimina</button>
                    </td>
                  }
                </tr>
              }
              @if (!accessoriTipiRows.length) {
                <tr><td colspan="3">Nessun tipo accessorio.</td></tr>
              }
            </tbody>
          </table>
          <div class="settings-inline-add">
            <input type="text" [(ngModel)]="newAccessorioTipoNome" placeholder="Nome tipo accessorio" />
            <input type="number" [(ngModel)]="newAccessorioTipoOrdine" placeholder="Ordine" style="width:5rem" />
            <button type="button" [disabled]="!newAccessorioTipoNome.trim()" (click)="createAccessorioTipo()">Aggiungi</button>
          </div>
        }
      </div>
    </div>
  }
}
```

- [ ] **Step 3: Commit contenuto**

```bash
git add frontend/src/app/app.component.html
git commit -m "feat(anagrafiche): contenuto condizionale per sotto-tab"
```

---

### Task 4: Stile CSS sotto-tab

**Files:**
- Modify: `frontend/src/app/app.component.scss` — aggiunta classe `.registry-subtabs`

**Interfaces:**
- Consumes: `.registry-tabs` (classe esistente)

- [ ] **Step 1: Aggiungi la classe `.registry-subtabs` dopo `.registry-tabs button.active` (~riga 230)**

```scss
.registry-subtabs {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border, #e2e8f0);

  button {
    font-size: 0.875rem;
    padding: 4px 12px;
  }
}
```

- [ ] **Step 2: Verifica visiva nell'app**

Avvia l'app (`npm start` nella cartella `frontend`) e verifica:
1. Pagina Anagrafiche → due righe di tab visibili
2. Click su "Commerciali" → mostra solo Commerciali, non Responsabili o Utenti
3. Switch a "Produzione" → sotto-tab Produzione visibili
4. Torna a "Persone" → siamo ancora su "Commerciali" (ricorda l'ultima)
5. Tab "Mittenti Disegno" e "Operai" visibili solo se loggato come admin

- [ ] **Step 3: Commit stile**

```bash
git add frontend/src/app/app.component.scss
git commit -m "feat(anagrafiche): stile sotto-tab rientrati visivamente"
```
