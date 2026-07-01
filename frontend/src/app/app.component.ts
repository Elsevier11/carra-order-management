import { CommonModule } from '@angular/common';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, Type, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable, Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { AuthService } from './auth.service';
import { ConsegneService } from './consegne.service';
import {
  AccessorioTipo,
  AppUserRecord,
  AttachmentRecord,
  AuditLogRecord,
  AuthUser,
  BoardColumn,
  CementoTipo,
  CommercialeRecord,
  ConsegnaFilters,
  ConsegnaRecord,
  ConsegnaStats,
  DuplicateOrderCandidate,
  DuplicateOrderResponse,
  ErpOrderPreviewItem,
  MittenteDisegno,
  Operaio,
  OrderAccessorio,
  OrderCemento,
  OrderEvent,
  ResponsabileRecord,
  SqlServerConfigResponse,
  SqlServerConfigSavePayload,
  SqlServerImportResult,
  SqlServerTestResult,
  Vettore,
} from './consegne.types';
import { TransitionModalComponent, type TransitionModalModel } from './transition-modal.component';
import { KanbanBoardComponent, type KanbanBoardHost } from './kanban-board.component';
import { OrderDetailModalComponent } from './order-detail-modal.component';
import {
  boardCementiSummary as boardCementiSummaryHelper,
  boardConclusiBadge as boardConclusiBadgeHelper,
  boardOperaiSummary as boardOperaiSummaryHelper,
  boardOperaiWarning as boardOperaiWarningHelper,
  cementoBadgeClass as cementoBadgeClassHelper,
  cementoBadgeClassFromFlags as cementoBadgeClassFromFlagsHelper,
  detailMissingItems as detailMissingItemsHelper,
  onCementoFattaChange as onCementoFattaChangeHelper,
  onCementoOrdinataChange as onCementoOrdinataChangeHelper,
  orderWarnings as orderWarningsHelper,
} from './order-formatters';
import { SettingsService } from './settings.service';
import { ORDER_STATUS_FLOW, allowedNextStatuses, statusClass, statusShortLabel, type ConsegnaStatus } from '../../../src/shared/order-flow';
import { validateTransitionState } from '../../../src/shared/transition-validation';

type EditableConsegna = {
  rif: string;
  cliente: string;
  tipoImpianto: string;
  dataConsegna: string;
  cantiere: string;
  dataOrdine: string;
  referente: string;
  telefono: string;
  referente2: string;
  telefono2: string;
  scarico: string;
  vascheCav: string;
  accessori: string;
  operai: string;
  stato: string;
  note: string;
  trasporto: boolean;
  scaricoCarico: boolean;
  accontoPagato: boolean;
  commercialeId: number | null;
  responsabileInternoId: number | null;
  folderLinkDocumenti: string;
  folderLinkFoto: string;
  cementiNote: string;
};

type ConfirmModalState = {
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  onConfirm: () => void;
};

type ViewMode = 'dashboard' | 'kanban' | 'audit' | 'anagrafiche' | 'settings';
type RegistryTab = 'persone' | 'produzione';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, NgxDatatableModule, TransitionModalComponent, KanbanBoardComponent, OrderDetailModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly consegneService = inject(ConsegneService);
  private readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);

  rows: ConsegnaRecord[] = [];
  total = 0;
  page = 1;
  pageSize = 15;
  loading = false;
  loadingDetails = false;
  selectedRow: ConsegnaRecord | Pick<ConsegnaRecord, 'id'> | null = null;
  selectedDetail: ConsegnaRecord | null = null;
  attachments: AttachmentRecord[] = [];
  loadingAttachments = false;
  selectedUploadFile: File | null = null;
  operationError = '';
  operationSuccess = '';
  activeView: ViewMode = 'kanban';
  activeRegistryTab: RegistryTab = 'persone';
  activePersoneSubTab: string = 'utenti';
  activeProduzioneSubTab: string = 'vettori';
  showFiltersPanel = false;

  private operationMessageTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly searchSubject = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  loginState = {
    username: '',
    password: '',
    error: '',
  };

  user: AuthUser | null = null;
  canWrite = false;

  readonly statusFlow: ConsegnaStatus[] = [...ORDER_STATUS_FLOW];
  readonly kanbanHost: KanbanBoardHost = this as unknown as KanbanBoardHost;
  readonly dashboardHost: AppComponent = this;
  readonly detailHost: AppComponent = this;

  boardColumns: BoardColumn[] = [];
  loadingBoard = false;
  showOnlyLateInKanban = false;
  kanbanCompactMode = false;
  visibleStatuses: Set<ConsegnaStatus> = new Set(this.statusFlow);
  kanbanScrollContentWidth = 0;
  history: OrderEvent[] = [];
  loadingHistory = false;

  historyModalTitle = '';
  historyModalEvents: OrderEvent[] = [];
  loadingHistoryModal = false;

  transitionModel = {
    toStatus: '' as ConsegnaStatus | '',
    note: '',
  };

  pendingTransitionId: number | null = null;
  dashboardChartsComponent: Type<unknown> | null = null;
  loadingDashboardCharts = false;

  dropTransitionModal: TransitionModalModel = {
    open: false,
    order: null,
    fromStatus: '',
    toStatus: '',
    disegnoSpeditoAt: '',
    disegnoMittenteId: null,
    disegnoApprovatoAt: '',
    lavorazioneAssegnataAt: '',
    consegnaDataEffettiva: '',
    vettoreId: null,
    bilici: null,
    operaiIds: [],
    skipAssegnazione: false,
    conclusiMode: 'week',
    conclusiWeek: '',
    conclusiDate: '',
    accontoPagato: false,
    note: '',
    error: '',
  };

  formVisible = false;
  editingId: number | null = null;
  formModel: EditableConsegna = this.emptyForm();

  filters: ConsegnaFilters = {
    q: '',
    cliente: '',
    stato: '',
    responsabileInternoId: '',
    fromDate: '',
    toDate: '',
  };

  availableFilters = {
    clienti: [] as string[],
    stati: [] as string[],
  };

  stats: ConsegnaStats = {
    kpi: {
      consegneSettimanaCorrente: 0,
      consegneProssimaSettimana: 0,
      ritardi: 0,
      totaleAttivi: 0,
      accontiDaIncassare: 0,
      ordiniIncompleti: 0,
      senzaResponsabile: 0,
      senzaDocumenti: 0,
      senzaFoto: 0,
    },
    byStatus: [],
    pipelineConRitardi: [],
    weeklyTrend: [],
    upcomingByWeek: [],
    byClienteAttivi: [],
  };

  auditRows: AuditLogRecord[] = [];
  auditLoading = false;
  auditPage = 1;
  auditPageSize = 20;
  auditTotal = 0;
  selectedAuditRow: AuditLogRecord | null = null;
  auditFilters: { username: string; action: string; entity: string; success: string; fromDate: string; toDate: string } = {
    username: '',
    action: '',
    entity: '',
    success: '',
    fromDate: '',
    toDate: '',
  };
  detailModalOpen = false;
  deleteConfirmOpen = false;
  confirmModal: ConfirmModalState | null = null;
  savingForm = false;

  commercialiRows: CommercialeRecord[] = [];
  commercialiLoading = false;
  newComercialeModel = { nome: '' };

  responsabiliRows: ResponsabileRecord[] = [];
  responsabiliLoading = false;
  newResponsabileModel = { nome: '' };

  usersRows: AppUserRecord[] = [];
  usersLoading = false;
  newUserModel: { username: string; role: 'admin' | 'operativo' | 'lettura'; isActive: boolean } = {
    username: '',
    role: 'operativo',
    isActive: true,
  };
  generatedPassword: string | null = null;
  generatedPasswordForUser: string | null = null;
  passwordResetModel: { userId: number | null; password: string } = {
    userId: null,
    password: '',
  };

  // ── Lookup lists per campi condizionali per stato ─────────────────────────
  mittentiDisegno: MittenteDisegno[] = [];
  operaiList: Operaio[] = [];
  vettoriList: Vettore[] = [];

  // ── Admin CRUD: Mittenti Disegno ──────────────────────────────────────────
  mittentiDisegnoRows: MittenteDisegno[] = [];
  mittentiDisegnoLoading = false;
  newMittenteDisegnoNome = '';
  editingMittenteDisegno: MittenteDisegno | null = null;
  editMittenteDisegnoNome = '';

  // ── Admin CRUD: Operai ────────────────────────────────────────────────────
  operaiRows: Operaio[] = [];
  operaiLoading = false;
  newOperaioNome = '';
  editingOperaio: Operaio | null = null;
  editOperaioNome = '';

  // ── Admin CRUD: Vettori ───────────────────────────────────────────────────
  vettoriRows: Vettore[] = [];
  vettoriLoading = false;
  newVettoreNome = '';
  editingVettore: Vettore | null = null;
  editVettoreNome = '';

  // ── Admin CRUD: Tipi Cemento ──────────────────────────────────────────────
  cementiTipiRows: CementoTipo[] = [];
  cementiTipiLoading = false;
  newCementoTipoNome = '';
  newCementoTipoOrdine = 0;
  editingCementoTipo: CementoTipo | null = null;
  editCementoTipoNome = '';
  editCementoTipoOrdine = 0;

  // ── Admin CRUD: Tipi Accessorio ───────────────────────────────────────────
  accessoriTipiRows: AccessorioTipo[] = [];
  accessoriTipiLoading = false;
  newAccessorioTipoNome = '';
  newAccessorioTipoOrdine = 0;
  editingAccessorioTipo: AccessorioTipo | null = null;
  editAccessorioTipoNome = '';
  editAccessorioTipoOrdine = 0;

  // ── Settings ERP ─────────────────────────────────────────────────────────────
  settingsConfig: SqlServerConfigResponse | null = null;
  settingsLoading = false;
  settingsSaving = false;
  settingsTesting = false;
  settingsError = '';
  settingsSuccess = '';
  settingsTestResult: SqlServerTestResult | null = null;
  settingsShowPassword = false;
  settingsEditMode = false;
  settingsForm = {
    host: '',
    port: '1433',
    database: '',
    user: '',
    password: '',
    timeoutMs: '15000',
  };

  // ── ERP SQL Server import ──────────────────────────────────────────────────
  sqlImportModalOpen = false;
  sqlImportLoading = false;
  sqlImportExecuting = false;
  sqlImportError = '';
  sqlImportPreview: ErpOrderPreviewItem[] = [];
  sqlImportSelected = new Set<string>();
  sqlImportLastDate = '';
  sqlImportDateEdit = '';
  sqlImportResult: SqlServerImportResult | null = null;
  sqlImportAlreadyImportedCount = 0;
  sqlImportTruncated = false;
  sqlImportConfirmOpen = false;

  get sqlImportSelectedCount(): number {
    return this.sqlImportSelected.size;
  }

  get sqlImportStep(): 1 | 2 | 3 {
    if (this.sqlImportResult) return 3;
    if (this.sqlImportPreview.length > 0) return 2;
    return 1;
  }

  get sqlImportSelectedCustomersCount(): number {
    return new Set(
      this.sqlImportPreview
        .filter((order) => this.sqlImportSelected.has(order.externalRef))
        .map((order) => (order.cliente || '').trim())
        .filter(Boolean),
    ).size;
  }

  // ── Detail modal tab switcher ─────────────────────────────────────────────
  activeDetailTab: 'dettagli' | 'cementi' | 'accessori' | 'cam' | 'gestione' = 'dettagli';
  private detailReturnView: ViewMode | null = null;

  cementiTipiList: CementoTipo[] = [];
  accessoriTipiList: AccessorioTipo[] = [];

  // Working copies: array indexed by tipoId for the current order
  cementiSelections: { tipoId: number; nome: string; selezionato: boolean; ordinata: boolean; fatta: boolean }[] = [];
  accessoriSelections: { tipoId: number; nome: string; selezionato: boolean; ordinata: boolean; fatta: boolean }[] = [];

  // Snapshots for dirty-state detection (updated after load and after successful save)
  private cementiSnapshot = '';
  private accessoriSnapshot = '';
  private detailSectionsSnapshot = '';
  private operaiSnapshot = '';
  private camSnapshot: boolean | null = null;
  closeConfirmOpen = false;

  // Inline edit mode for the Dettagli tab
  editMode = false;
  private dettagliSnapshot = '';

  private kanbanMainScrollEl: HTMLElement | null = null;
  private kanbanBottomScrollEl: HTMLElement | null = null;
  private kanbanScrollSyncRaf: number | null = null;

  @ViewChild('kanbanMainScroll')
  set kanbanMainScrollRef(ref: ElementRef<HTMLElement> | undefined) {
    this.kanbanMainScrollEl = ref?.nativeElement ?? null;
    this.scheduleKanbanScrollSync();
  }

  @ViewChild('kanbanBottomScroll')
  set kanbanBottomScrollRef(ref: ElementRef<HTMLElement> | undefined) {
    this.kanbanBottomScrollEl = ref?.nativeElement ?? null;
    this.scheduleKanbanScrollSync();
  }


  readonly columns = [
    { name: 'Rif', prop: 'rif' },
    { name: 'Cliente', prop: 'cliente' },
    { name: 'Tipo Impianto', prop: 'tipoImpianto' },
    { name: 'Data Consegna', prop: 'dataConsegna' },
    { name: 'Stato', prop: 'stato' },
  ];

  get isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  get isReadOnly(): boolean {
    return this.user?.role === 'lettura';
  }

  get activeFiltersCount(): number {
    return [this.filters.q, this.filters.cliente, this.filters.stato, this.filters.responsabileInternoId, this.filters.fromDate, this.filters.toDate, this.showOnlyLateInKanban]
      .filter((v) => !!v).length;
  }

  get showKanbanCreateAction(): boolean {
    return this.activeView === 'kanban' && this.canWrite;
  }

  ngOnInit(): void {
    this.searchSubject.pipe(debounceTime(400), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilters();
    });

    this.user = this.authService.user;
    this.canWrite = this.user?.role === 'admin' || this.user?.role === 'operativo';
    this._restoreVisibleColumns();

    this.authService.user$.subscribe((user) => {
      this.user = user;
      this.canWrite = user?.role === 'admin' || user?.role === 'operativo';
      if (user) {
        this.loginState.error = '';
        this.restorePreset();
        this.restoreAuditPreset();
        this.loadFilters();
        this.refreshData();
        this.ensureDashboardChartsLoaded();
        this.loadCommerciali();
        this.loadResponsabili();
      }
    });

    if (this.user) {
      this.restorePreset();
      this.restoreAuditPreset();
      this.loadFilters();
      this.refreshData();
      this.ensureDashboardChartsLoaded();
      this.loadCommerciali();
      this.loadResponsabili();
    }
  }

  ngAfterViewInit(): void {
    this.scheduleKanbanScrollSync();
  }

  ngOnDestroy(): void {
    if (this.kanbanScrollSyncRaf !== null) {
      cancelAnimationFrame(this.kanbanScrollSyncRaf);
      this.kanbanScrollSyncRaf = null;
    }
    if (this.operationMessageTimer) {
      clearTimeout(this.operationMessageTimer);
      this.operationMessageTimer = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  notifySuccess(message: string, timeoutMs = 3500): void {
    this.operationError = '';
    this.operationSuccess = message;
    this.scheduleOperationMessageClear(timeoutMs);
  }

  notifyError(message: string, timeoutMs = 5000): void {
    this.operationSuccess = '';
    this.operationError = message;
    this.scheduleOperationMessageClear(timeoutMs);
  }

  private scheduleOperationMessageClear(timeoutMs: number): void {
    if (this.operationMessageTimer) clearTimeout(this.operationMessageTimer);
    this.operationMessageTimer = setTimeout(() => {
      this.operationSuccess = '';
      this.operationError = '';
      this.operationMessageTimer = null;
    }, timeoutMs);
  }

  toggleFiltersPanel(): void {
    this.showFiltersPanel = !this.showFiltersPanel;
  }

  onFilterTextChange(): void {
    this.searchSubject.next();
  }

  onFilterSelectChange(): void {
    this.applyFilters();
  }

  login(): void {
    this.loginState.error = '';
    this.authService.login(this.loginState.username, this.loginState.password).subscribe({
      next: () => {
        this.loginState.password = '';
      },
      error: (error) => {
        this.loginState.error = error?.error?.message ?? 'Login fallito';
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.rows = [];
    this.selectedRow = null;
    this.selectedDetail = null;
    this.detailModalOpen = false;
    this.attachments = [];
    this.formVisible = false;
    this.selectedAuditRow = null;
  }

  goToKanbanLate(): void {
    this.showOnlyLateInKanban = true;
    this.changeView('kanban');
  }

  refreshData(page = this.page, allowAutoRecover = true): void {
    if (!this.user) return;

    this.page = page;
    this.loading = true;
    this.operationError = '';
    this.operationSuccess = '';

    this.consegneService
      .list({
        ...this.filters,
        page: this.page,
        pageSize: this.pageSize,
        sortBy: 'dataConsegna',
        sortDir: 'desc',
      })
      .subscribe({
        next: (response) => {
          this.rows = response.data;
          this.total = response.pagination.total;
          this.loading = false;
        },
        error: (error) => {
          this.loading = false;
          if (allowAutoRecover && error?.status === 400) {
            this.resetFilters();
            return;
          }
          this.operationError = error?.error?.message ?? 'Errore caricamento consegne';
        },
      });

    this.consegneService.stats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
    });

    this.loadBoard();
  }

  onPage(event: { offset: number }): void {
    this.refreshData(event.offset + 1);
  }

  onActivate(event: { type: string; row: ConsegnaRecord }): void {
    if (event.type !== 'click') return;
    this.selectedRow = event.row;
    this.loadDetail(event.row.id);
  }

  loadDetail(id: number): void {
    this.loadingDetails = true;
    this.consegneService.getById(id).subscribe({
      next: (detail) => {
        this.selectedDetail = detail as ConsegnaRecord;
        this.transitionModel.toStatus = '';
        this.transitionModel.note = '';
        this.loadingDetails = false;
        const wasAlreadyOpen = this.detailModalOpen;
        this.detailModalOpen = true;
        if (!wasAlreadyOpen) this.activeDetailTab = 'dettagli';
        this.camSnapshot = (detail as ConsegnaRecord).camSiNo ?? false;
        this.detailSectionsSnapshot = this.serializeDetailSections();
        this.operaiSnapshot = this.serializeOperaiSelection();
        this.loadHistory(id);
        this.loadAttachments(id);
        this.loadLookupLists();
        this.loadCementiAccessoriForDetail(id);
      },
      error: () => {
        this.loadingDetails = false;
      },
    });
  }

  private serializeDettagli(): string {
    return JSON.stringify({
      rif: this.formModel.rif,
      cliente: this.formModel.cliente,
      tipoImpianto: this.formModel.tipoImpianto,
      dataConsegna: this.formModel.dataConsegna,
      cantiere: this.formModel.cantiere,
      dataOrdine: this.formModel.dataOrdine,
      referente: this.formModel.referente,
      telefono: this.formModel.telefono,
      referente2: this.formModel.referente2,
      telefono2: this.formModel.telefono2,
      stato: this.formModel.stato,
      note: this.formModel.note,
      trasporto: this.formModel.trasporto,
      scaricoCarico: this.formModel.scaricoCarico,
      accontoPagato: this.formModel.accontoPagato,
      commercialeId: this.formModel.commercialeId,
      responsabileInternoId: this.formModel.responsabileInternoId,
      folderLinkDocumenti: this.formModel.folderLinkDocumenti,
      folderLinkFoto: this.formModel.folderLinkFoto,
    });
  }

  private serializeCementi(): string {
    return JSON.stringify(this.cementiSelections.map(s => ({ tipoId: s.tipoId, selezionato: s.selezionato, ordinata: s.ordinata, fatta: s.fatta })));
  }

  private serializeAccessori(): string {
    return JSON.stringify(this.accessoriSelections.map(s => ({ tipoId: s.tipoId, selezionato: s.selezionato, ordinata: s.ordinata, fatta: s.fatta })));
  }

  private serializeDetailSections(): string {
    return JSON.stringify({
      folderLinkDocumenti: this.selectedDetail?.folderLinkDocumenti ?? '',
      folderLinkFoto: this.selectedDetail?.folderLinkFoto ?? '',
      disegnoSpeditoAt: this.selectedDetail?.disegnoSpeditoAt ?? '',
      disegnoMittenteId: this.selectedDetail?.disegnoMittenteId ?? null,
      disegnoNote: this.selectedDetail?.disegnoNote ?? '',
      disegnoApprovatoAt: this.selectedDetail?.disegnoApprovatoAt ?? '',
      massicciataNota: this.selectedDetail?.massicciataNota ?? '',
      tipoCariciNota: this.selectedDetail?.tipoCariciNota ?? '',
      lavorazioneAssegnataAt: this.selectedDetail?.lavorazioneAssegnataAt ?? '',
      consegnaDataEffettiva: this.selectedDetail?.consegnaDataEffettiva ?? '',
      vettoreId: this.selectedDetail?.vettoreId ?? null,
      bilici: this.selectedDetail?.bilici ?? 0,
      ddtPronti: !!this.selectedDetail?.ddtPronti,
      bancale: !!this.selectedDetail?.bancale,
      chiusini: !!this.selectedDetail?.chiusini,
      caricoVerificato: !!this.selectedDetail?.caricoVerificato,
      camSiNo: !!this.selectedDetail?.camSiNo,
      cementiNote: this.selectedDetail?.cementiNote ?? '',
    });
  }

  private serializeOperaiSelection(): string {
    return JSON.stringify((this.selectedDetail?.operaiAssegnati ?? []).map((o) => o.id));
  }

  hasPendingChanges(): boolean {
    const dettagliDirty = this.editMode && this.serializeDettagli() !== this.dettagliSnapshot;
    const detailSectionsDirty = this.selectedDetail !== null && this.serializeDetailSections() !== this.detailSectionsSnapshot;
    const operaiDirty = this.selectedDetail !== null && this.serializeOperaiSelection() !== this.operaiSnapshot;
    const cementiDirty = this.cementiSelections.length > 0 && this.serializeCementi() !== this.cementiSnapshot;
    const accessoriDirty = this.accessoriSelections.length > 0 && this.serializeAccessori() !== this.accessoriSnapshot;
    return dettagliDirty || detailSectionsDirty || operaiDirty || cementiDirty || accessoriDirty;
  }

  closeDetailModal(): void {
    if (this.hasPendingChanges()) {
      this.closeConfirmOpen = true;
      return;
    }
    this.doCloseDetailModal();
  }

  doCloseDetailModal(): void {
    const returnView = this.detailReturnView;
    this.closeConfirmOpen = false;
    this.detailModalOpen = false;
    this.selectedDetail = null;
    this.history = [];
    this.attachments = [];
    this.cementiSnapshot = '';
    this.accessoriSnapshot = '';
    this.detailSectionsSnapshot = '';
    this.operaiSnapshot = '';
    this.camSnapshot = null;
    this.editMode = false;
    this.dettagliSnapshot = '';
    this.detailReturnView = null;
    if (returnView && returnView !== this.activeView) {
      this.changeView(returnView);
    }
  }

  changeView(view: ViewMode): void {
    if ((view === 'audit' || view === 'anagrafiche' || view === 'settings') && !this.isAdmin) return;
    if (view === 'settings') {
      this.loadSettings();
    }
    this.operationError = '';
    this.operationSuccess = '';
    this.activeView = view;
    if (view === 'dashboard') {
      this.ensureDashboardChartsLoaded();
    } else if (view === 'kanban') {
      this.loadBoard();
    } else if (view === 'audit') {
      this.loadAudit(1);
    } else if (view === 'anagrafiche') {
      this.loadActiveRegistryTab();
    }
  }

  setRegistryTab(tab: RegistryTab): void {
    if (!this.isAdmin) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.generatedPassword = null;
    this.generatedPasswordForUser = null;
    this.activeRegistryTab = tab;
    this.loadActiveRegistryTab();
  }

  setPersoneSubTab(tab: string): void {
    if (!this.isAdmin) return;
    this.activePersoneSubTab = tab;
    this.loadPersoneSubTab(tab);
  }

  setProduzioneSubTab(tab: string): void {
    if (!this.isAdmin) return;
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

  selectFromBoard(row: ConsegnaRecord): void {
    this.detailReturnView = 'kanban';
    this.selectedRow = row;
    this.loadDetail(row.id);
  }

  openOrderFromDashboard(row: Pick<ConsegnaRecord, 'id'>): void {
    this.detailReturnView = 'dashboard';
    if (this.activeView !== 'kanban') {
      this.changeView('kanban');
    }
    this.selectedRow = row;
    this.loadDetail(row.id);
  }

  get boardDropListIds(): string[] {
    return this.boardColumns
      .filter((col) => this.isColumnVisible(col.status))
      .map((column) => this.dropListId(column.status));
  }

  dropListId(status: string): string {
    return `status-${status.replace(/\s+/g, '-').replace(/[^A-Za-z0-9-_]/g, '').toLowerCase()}`;
  }

  columnClass(status: string): string {
    return statusClass(status);
  }

  columnShortLabel(status: ConsegnaStatus): string {
    return statusShortLabel(status);
  }

  isColumnVisible(status: ConsegnaStatus): boolean {
    return this.visibleStatuses.has(status);
  }

  toggleColumnVisibility(status: ConsegnaStatus): void {
    if (this.visibleStatuses.has(status)) {
      if (this.visibleStatuses.size > 1) {
        this.visibleStatuses.delete(status);
      }
    } else {
      this.visibleStatuses.add(status);
    }
    localStorage.setItem(
      this.userScopedStorageKey('carra_kanban_visible_cols'),
      JSON.stringify([...this.visibleStatuses])
    );
    this.scheduleKanbanScrollSync();
  }

  lateCount(items: ConsegnaRecord[]): number {
    return items.filter((item) => this.isLate(item)).length;
  }

  filteredKanbanItems(items: ConsegnaRecord[]): ConsegnaRecord[] {
    if (!this.showOnlyLateInKanban) return items;
    return items.filter((item) => this.isLate(item));
  }

  visibleKanbanCount(items: ConsegnaRecord[]): number {
    return this.filteredKanbanItems(items).length;
  }

  weekGroups(items: ConsegnaRecord[]): Array<{ label: string; key: number; items: ConsegnaRecord[] }> {
    const filtered = this.filteredKanbanItems(items);
    const map = new Map<number, { label: string; key: number; items: ConsegnaRecord[] }>();
    const noDate: ConsegnaRecord[] = [];
    const compareDateDesc = (a: string | null | undefined, b: string | null | undefined): number => {
      const aTime = a ? new Date(a).getTime() : Number.NEGATIVE_INFINITY;
      const bTime = b ? new Date(b).getTime() : Number.NEGATIVE_INFINITY;
      return bTime - aTime;
    };
    for (const item of filtered) {
      if (!item.dataConsegna) { noDate.push(item); continue; }
      const d = new Date(item.dataConsegna);
      const week = this._isoWeek(d);
      const year = this._isoWeekYear(d);
      const key = year * 100 + week;
      if (!map.has(key)) {
        const { mon, sun } = this._weekRange(d);
        map.set(key, { key, label: `Sett. ${String(week).padStart(2, '0')} — dal ${mon} al ${sun}`, items: [] });
      }
      map.get(key)!.items.push(item);
    }
    const sorted = [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, g]) => ({
        ...g,
        items: [...g.items].sort((a, b) => compareDateDesc(a.dataConsegna, b.dataConsegna)),
      }));
    if (noDate.length) sorted.push({ key: 0, label: 'Data non definita', items: noDate });
    return sorted;
  }

  private _isoWeek(d: Date): number {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil(((dt.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  }

  private _isoWeekYear(d: Date): number {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    return dt.getUTCFullYear();
  }

  private _weekRange(d: Date): { mon: string; sun: string } {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = dt.getUTCDay() || 7;
    const mon = new Date(dt); mon.setUTCDate(dt.getUTCDate() - day + 1);
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
    const fmt = (x: Date) => `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
    return { mon: fmt(mon), sun: fmt(sun) };
  }

  lateCountByStatus(status: ConsegnaStatus): number {
    const column = this.boardColumns.find((item) => item.status === status);
    return this.lateCount(column?.items ?? []);
  }

  showLateCountBadge(status: ConsegnaStatus): boolean {
    const visibleFrom = this.statusFlow.indexOf('PRONTI & AVVISATI');
    return this.statusFlow.indexOf(status) >= visibleFrom && this.lateCountByStatus(status) > 0;
  }

  get totalLateCount(): number {
    return this.boardColumns.reduce((acc, column) => acc + this.lateCount(column.items), 0);
  }

  isLate(item: ConsegnaRecord): boolean {
    if (!item.dataConsegna) return false;
    if (item.stato === 'CONCLUSI') return false;
    const dueDate = new Date(item.dataConsegna);
    if (Number.isNaN(dueDate.getTime())) return false;
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  showLateBadge(item: ConsegnaRecord): boolean {
    return ['PRONTI & AVVISATI', 'CONSEGNA PIANIFICATA', 'CONSEGNA EFFETTUATA'].includes(item.stato) && this.isLate(item);
  }

  lateDays(item: ConsegnaRecord): number {
    if (!this.isLate(item) || !item.dataConsegna) return 0;
    const dueDate = new Date(item.dataConsegna);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(1, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
  }

  orderWarnings(item: ConsegnaRecord): string[] {
    return orderWarningsHelper(item, (order) => this.isLate(order), (order) => this.lateDays(order));
  }

  boardCementiSummary(item: ConsegnaRecord): Array<{ nome: string; ordinata: boolean; fatta: boolean }> {
    return boardCementiSummaryHelper(item);
  }

  boardOperaiSummary(item: ConsegnaRecord): string[] {
    return boardOperaiSummaryHelper(item);
  }

  boardOperaiWarning(item: ConsegnaRecord): string | null {
    return boardOperaiWarningHelper(item);
  }

  boardConclusiBadge(item: ConsegnaRecord): string | null {
    return boardConclusiBadgeHelper(item, (value) => this.conclusiWeekLabel(value));
  }

  detailMissingItems(item: ConsegnaRecord): string[] {
    return detailMissingItemsHelper(item);
  }

  nextStatusLabel(status: string): string {
    return this.allowedNextStatuses(status)[0] ?? 'Ordine completato';
  }

  cementoBadgeClass(sel: { selezionato: boolean; ordinata: boolean; fatta: boolean }): string {
    return cementoBadgeClassHelper(sel);
  }

  cementoBadgeClassFromFlags(sel: { ordinata: boolean; fatta: boolean }): string {
    return cementoBadgeClassFromFlagsHelper(sel);
  }

  onCementoOrdinataChange(sel: { ordinata: boolean; fatta: boolean }): void {
    onCementoOrdinataChangeHelper(sel);
  }

  onCementoFattaChange(sel: { ordinata: boolean; fatta: boolean }, checked: boolean): void {
    onCementoFattaChangeHelper(sel, checked);
  }

  goToTransitionPanel(): void {
    this.activeDetailTab = 'gestione';
  }

  openNextStatusConfirm(): void {
    if (!this.canWrite || !this.selectedDetail || this.pendingTransitionId) return;
    const nextStatus = this.allowedNextStatuses(this.selectedDetail.stato)[0];
    if (!nextStatus) return;
    this.openTransitionModal(this.selectedDetail, this.selectedDetail.stato as ConsegnaStatus, nextStatus);
  }

  onKanbanDrop(event: CdkDragDrop<ConsegnaRecord[]>, targetStatus: ConsegnaStatus): void {
    if (!this.canWrite || this.pendingTransitionId || this.dropTransitionModal.open) {
      return;
    }

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.syncBoardCounts();
      return;
    }

    const moved = event.previousContainer.data[event.previousIndex];
    if (!moved || moved.stato === targetStatus) {
      return;
    }

    const fromStatus = moved.stato as ConsegnaStatus;
    if (!this.canTransition(fromStatus, targetStatus)) {
      this.notifyError(`Transizione non consentita: ${fromStatus} -> ${targetStatus}`);
      return;
    }

    this.openTransitionModal(moved, fromStatus, targetStatus);
  }

  closeDropTransitionModal(): void {
    this.dropTransitionModal = {
      open: false,
      order: null,
      fromStatus: '',
      toStatus: '',
      disegnoSpeditoAt: '',
      disegnoMittenteId: null,
      disegnoApprovatoAt: '',
      lavorazioneAssegnataAt: '',
      consegnaDataEffettiva: '',
      vettoreId: null,
      bilici: null,
      operaiIds: [],
      skipAssegnazione: false,
      conclusiMode: 'week',
      conclusiWeek: '',
      conclusiDate: '',
      accontoPagato: false,
      note: '',
      error: '',
    };
  }

  private openTransitionModal(order: ConsegnaRecord, fromStatus: ConsegnaStatus, toStatus: ConsegnaStatus, note = ''): void {
    const conclusiMode = order.conclusiMode ?? 'week';
    const transitionsNeedLookupLists = ['DISEGNO IN GESTIONE', 'ASSEGNATO', 'CONSEGNA PIANIFICATA'].includes(toStatus);
    this.dropTransitionModal = {
      open: true,
      order,
      fromStatus,
      toStatus,
      disegnoSpeditoAt: toStatus === 'DISEGNO IN GESTIONE' ? (order.disegnoSpeditoAt ?? this.todayIsoDate()) : '',
      disegnoMittenteId: toStatus === 'DISEGNO IN GESTIONE' ? (order.disegnoMittenteId ?? null) : null,
      disegnoApprovatoAt: toStatus === 'DISEGNO APPROVATO' ? (order.disegnoApprovatoAt ?? this.todayIsoDate()) : '',
      lavorazioneAssegnataAt: toStatus === 'ASSEGNATO' ? (order.lavorazioneAssegnataAt ?? this.todayIsoDate()) : '',
      consegnaDataEffettiva: ['CONSEGNA PIANIFICATA', 'CONSEGNA EFFETTUATA'].includes(toStatus) ? (order.consegnaDataEffettiva ?? order.dataConsegna ?? this.todayIsoDate()) : '',
      vettoreId: ['CONSEGNA PIANIFICATA'].includes(toStatus) ? (order.vettoreId ?? null) : null,
      bilici: ['CONSEGNA PIANIFICATA'].includes(toStatus) ? (order.bilici ?? 0) : null,
      operaiIds: toStatus === 'ASSEGNATO' ? (order.operaiAssegnati ?? []).map((op) => op.id) : [],
      skipAssegnazione: false,
      conclusiMode,
      conclusiWeek: ['CONCLUSI', 'PRONTI & AVVISATI'].includes(toStatus) ? (order.conclusiMode === 'week' ? order.conclusiWeek ?? this.todayIsoWeek() : order.conclusiWeek ?? this.todayIsoWeek()) : '',
      conclusiDate: ['CONCLUSI', 'PRONTI & AVVISATI'].includes(toStatus) ? (order.conclusiMode === 'date' ? order.conclusiDate ?? this.todayIsoDate() : order.conclusiDate ?? this.todayIsoDate()) : '',
      accontoPagato: toStatus === 'CONSEGNA PIANIFICATA' ? !!order.accontoPagato : false,
      note,
      error: '',
    };
    if (transitionsNeedLookupLists) {
      this.loadLookupLists();
    }
  }

  confirmDropTransition(skipAssegnazione = false): void {
    const modal = this.dropTransitionModal;
    if (!modal.open || !modal.order || !modal.fromStatus || !modal.toStatus) return;
    const orderId = modal.order.id;
    const validationError = validateTransitionState({ ...modal, skipAssegnazione });
    if (validationError) {
      this.dropTransitionModal.error = validationError;
      return;
    }

    this.pendingTransitionId = orderId;
    this.consegneService.transition(orderId, modal.toStatus, modal.note.trim() || undefined, {
      disegnoSpeditoAt: modal.toStatus === 'DISEGNO IN GESTIONE' ? modal.disegnoSpeditoAt : undefined,
      disegnoMittenteId: modal.toStatus === 'DISEGNO IN GESTIONE' ? modal.disegnoMittenteId : undefined,
      disegnoApprovatoAt: modal.toStatus === 'DISEGNO APPROVATO' ? modal.disegnoApprovatoAt : undefined,
      lavorazioneAssegnataAt: modal.toStatus === 'ASSEGNATO' && !skipAssegnazione ? modal.lavorazioneAssegnataAt : undefined,
      consegnaDataEffettiva: ['CONSEGNA PIANIFICATA', 'CONSEGNA EFFETTUATA'].includes(modal.toStatus) ? modal.consegnaDataEffettiva : undefined,
      vettoreId: modal.toStatus === 'CONSEGNA PIANIFICATA' ? modal.vettoreId : undefined,
      bilici: modal.toStatus === 'CONSEGNA PIANIFICATA' ? modal.bilici : undefined,
      accontoPagato: modal.toStatus === 'CONSEGNA PIANIFICATA' ? modal.accontoPagato : undefined,
      operaiIds: modal.toStatus === 'ASSEGNATO' && !skipAssegnazione ? modal.operaiIds : undefined,
      skipAssegnazione,
      conclusiMode: ['CONCLUSI', 'PRONTI & AVVISATI'].includes(modal.toStatus) ? modal.conclusiMode : undefined,
      conclusiWeek: ['CONCLUSI', 'PRONTI & AVVISATI'].includes(modal.toStatus) && modal.conclusiMode === 'week' ? modal.conclusiWeek : undefined,
      conclusiDate: ['CONCLUSI', 'PRONTI & AVVISATI'].includes(modal.toStatus) && modal.conclusiMode === 'date' ? modal.conclusiDate : undefined,
    }).subscribe({
      next: () => {
        this.notifySuccess(`Stato aggiornato a ${modal.toStatus}`);
        this.pendingTransitionId = null;
        this.closeDropTransitionModal();
        this.refreshData(this.page, false);
        if (this.selectedDetail?.id === orderId) {
          this.loadDetail(orderId);
        }
      },
      error: (error) => {
        this.notifyError(error?.error?.message ?? 'Errore transizione stato');
        this.pendingTransitionId = null;
        this.dropTransitionModal.error = this.operationError;
      },
    });
  }

  applyFilters(): void {
    this.savePreset();
    this.refreshData(1);
  }

  resetFilters(): void {
    this.filters = {
      q: '',
      cliente: '',
      stato: '',
      responsabileInternoId: '',
      fromDate: '',
      toDate: '',
    };
    this.showOnlyLateInKanban = false;
    localStorage.removeItem(this.userScopedStorageKey('carra_filters_preset'));
    this.refreshData(1, false);
  }

  exportCsv(): void {
    this.consegneService
      .exportCsv({
        ...this.filters,
        sortBy: 'dataConsegna',
        sortDir: 'desc',
      })
      .subscribe({
        next: (csv) => {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `consegne_${new Date().toISOString().slice(0, 10)}.csv`;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (error) => {
          this.operationError = error?.error?.message ?? 'Errore export CSV';
        },
      });
  }

  exportXlsx(): void {
    this.consegneService.exportXlsx().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `consegne_${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore export Excel';
      },
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.formModel = this.emptyForm();
    this.formVisible = true;
  }

  openEdit(): void {
    if (!this.selectedDetail) return;
    this.formModel = {
      rif: this.selectedDetail.rif ?? '',
      cliente: this.selectedDetail.cliente ?? '',
      tipoImpianto: this.selectedDetail.tipoImpianto ?? '',
      dataConsegna: this.selectedDetail.dataConsegna ?? '',
      cantiere: this.selectedDetail.cantiere ?? '',
      dataOrdine: this.selectedDetail.dataOrdine ?? '',
      referente: this.selectedDetail.referente ?? '',
      telefono: this.selectedDetail.telefono ?? '',
      referente2: this.selectedDetail.referente2 ?? '',
      telefono2: this.selectedDetail.telefono2 ?? '',
      scarico: this.selectedDetail.scarico ?? '',
      vascheCav: this.selectedDetail.vascheCav ?? '',
      accessori: '',
      operai: '',
      stato: this.selectedDetail.stato ?? '',
      note: this.selectedDetail.note ?? '',
      trasporto: this.selectedDetail.trasporto ?? false,
      scaricoCarico: this.selectedDetail.scaricoCarico ?? false,
      accontoPagato: this.selectedDetail.accontoPagato ?? false,
      commercialeId: this.selectedDetail.commercialeId ?? null,
      responsabileInternoId: this.selectedDetail.responsabileInternoId ?? null,
      folderLinkDocumenti: this.selectedDetail.folderLinkDocumenti ?? '',
      folderLinkFoto: this.selectedDetail.folderLinkFoto ?? '',
      cementiNote: this.selectedDetail.cementiNote ?? '',
    };
    this.dettagliSnapshot = this.serializeDettagli();
    this.editMode = true;
    this.activeDetailTab = 'dettagli';
  }

  cancelEdit(): void {
    this.editMode = false;
    this.dettagliSnapshot = '';
  }

  closeForm(): void {
    this.formVisible = false;
  }

  saveForm(): void {
    if (this.savingForm) return;
    const payload = {
      rif: this.formModel.rif,
      cliente: this.formModel.cliente,
      tipoImpianto: this.formModel.tipoImpianto || null,
      dataConsegna: this.formModel.dataConsegna || null,
      cantiere: this.formModel.cantiere || null,
      dataOrdine: this.formModel.dataOrdine || null,
      referente: this.formModel.referente || null,
      telefono: this.formModel.telefono || null,
      referente2: this.formModel.referente2 || null,
      telefono2: this.formModel.telefono2 || null,
      scarico: this.formModel.scarico || null,
      vascheCav: this.formModel.vascheCav || null,
      accessori: this.formModel.accessori || null,
      operai: this.formModel.operai || null,
      stato: this.formModel.stato || 'IN CORSO',
      note: this.formModel.note || null,
      trasporto: this.formModel.trasporto,
      scaricoCarico: this.formModel.scaricoCarico,
      accontoPagato: this.formModel.accontoPagato,
      commercialeId: this.formModel.commercialeId,
      responsabileInternoId: this.formModel.responsabileInternoId,
      folderLinkDocumenti: this.formModel.folderLinkDocumenti || null,
      folderLinkFoto: this.formModel.folderLinkFoto || null,
      cementiNote: this.formModel.cementiNote || null,
    };

    if (this.editingId) {
      this.savingForm = true;
      this.consegneService.update(this.editingId, payload).subscribe({
        next: (result) => {
          this.savingForm = false;
          this.formVisible = false;
          this.notifySuccess('Consegna aggiornata');
          this.refreshData(1);
          const createdOrUpdated = result as ConsegnaRecord;
          if (createdOrUpdated?.id) {
            this.loadDetail(createdOrUpdated.id);
          }
        },
        error: (error) => {
          this.savingForm = false;
          this.notifyError(error?.error?.message ?? 'Errore salvataggio');
        },
      });
      return;
    }

    this.createOrderWithDuplicateCheck(payload);
  }

  private createOrderWithDuplicateCheck(payload: Record<string, unknown>): void {
    this.savingForm = true;
    this.consegneService.create(payload).subscribe({
      next: (result) => {
        this.savingForm = false;
        this.formVisible = false;
        this.notifySuccess('Consegna creata');
        this.refreshData(1);
        const created = result as ConsegnaRecord;
        if (created?.id) {
          this.loadDetail(created.id);
        }
      },
      error: (error) => {
        this.savingForm = false;
        const duplicateResponse = error?.error as DuplicateOrderResponse | undefined;
        if (error?.status === 409 && duplicateResponse?.code === 'DUPLICATE_ORDER' && duplicateResponse.duplicates?.length) {
          this.openConfirm({
            title: 'Possibile ordine duplicato',
            message: 'Esiste già almeno un ordine con lo stesso cliente e tipo impianto. Verifica i dettagli sotto e conferma solo se vuoi creare comunque il nuovo ordine.',
            details: this.formatDuplicateDetails(duplicateResponse.duplicates),
            confirmLabel: 'Conferma creazione',
            onConfirm: () => this.createOrderWithDuplicateCheck({ ...payload, forceCreateDuplicate: true }),
          });
          return;
        }
        this.notifyError(error?.error?.message ?? 'Errore salvataggio');
      },
    });
  }

  private formatDuplicateDetails(duplicates: DuplicateOrderCandidate[]): string[] {
    return duplicates.slice(0, 5).map((item) => {
      const dataOrdine = item.dataOrdine ? this.formatShortDate(item.dataOrdine) : 'n/d';
      const dataConsegna = item.dataConsegna ? this.formatShortDate(item.dataConsegna) : 'n/d';
      const tipo = item.tipoImpianto || '—';
      const rif = item.rif || `ID ${item.id}`;
      return `${rif} | ${item.cliente || 'Cliente n/d'} | ${tipo} | stato ${item.stato || 'n/d'} | ordine ${dataOrdine} | consegna ${dataConsegna}`;
    });
  }

  private formatShortDate(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('it-IT');
  }

  openConfirm(messageOrConfig: string | (Omit<ConfirmModalState, 'onConfirm'> & { onConfirm: () => void }), onConfirm?: () => void): void {
    if (typeof messageOrConfig === 'string') {
      this.confirmModal = {
        title: 'Conferma operazione',
        message: messageOrConfig,
        onConfirm: onConfirm ?? (() => {}),
      };
      return;
    }
    this.confirmModal = {
      title: messageOrConfig.title,
      message: messageOrConfig.message,
      details: messageOrConfig.details,
      confirmLabel: messageOrConfig.confirmLabel,
      onConfirm: messageOrConfig.onConfirm,
    };
  }

  doConfirm(): void {
    this.confirmModal?.onConfirm();
    this.confirmModal = null;
  }

  closeConfirm(): void {
    this.confirmModal = null;
  }

  deleteSelected(): void {
    if (!this.selectedDetail) return;
    this.deleteConfirmOpen = true;
  }

  confirmDelete(): void {
    if (!this.selectedDetail) return;
    this.deleteConfirmOpen = false;
    this.consegneService.delete(this.selectedDetail.id).subscribe({
      next: () => {
        this.notifySuccess('Consegna eliminata');
        this.selectedRow = null;
        this.selectedDetail = null;
        this.detailModalOpen = false;
        this.history = [];
        this.attachments = [];
        this.refreshData(1);
      },
      error: (error) => {
        this.notifyError(error?.error?.message ?? 'Errore eliminazione');
      },
    });
  }

  applyTransition(): void {
    if (!this.selectedDetail || !this.transitionModel.toStatus || this.pendingTransitionId) return;
    const currentStatus = this.selectedDetail.stato as ConsegnaStatus;
    if (!this.canTransition(currentStatus, this.transitionModel.toStatus)) {
      this.notifyError(`Transizione non consentita: ${currentStatus} -> ${this.transitionModel.toStatus}`);
      return;
    }
    if (this.transitionModel.toStatus === 'SOSPESO' && !this.transitionModel.note.trim()) {
      this.notifyError('Sospensione richiede un motivo');
      return;
    }

    this.openTransitionModal(this.selectedDetail, currentStatus, this.transitionModel.toStatus, this.transitionModel.note || '');
  }

  allowedNextStatuses(currentStatus: string): ConsegnaStatus[] {
    return allowedNextStatuses(currentStatus);
  }

  todayIsoDate(): string {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  }

  todayIsoWeek(): string {
    const now = new Date();
    const week = this._isoWeek(now);
    const year = this._isoWeekYear(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  onAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedUploadFile = input.files?.[0] ?? null;
  }

  uploadAttachment(): void {
    if (!this.selectedDetail || !this.selectedUploadFile) return;
    this.consegneService.uploadAttachment(this.selectedDetail.id, this.selectedUploadFile).subscribe({
      next: () => {
        this.notifySuccess('Allegato caricato');
        this.selectedUploadFile = null;
        this.loadAttachments(this.selectedDetail!.id);
        this.loadHistory(this.selectedDetail!.id);
      },
      error: (error) => {
        this.notifyError(error?.error?.message ?? 'Errore upload allegato');
      },
    });
  }

  openAttachment(attachment: AttachmentRecord): void {
    if (!this.selectedDetail) return;
    this.consegneService.downloadAttachment(this.selectedDetail.id, attachment.id).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      },
      error: () => {
        this.notifyError('Impossibile aprire l\'allegato.');
      },
    });
  }

  downloadAttachment(item: AttachmentRecord): void {
    if (!this.selectedDetail) return;
    this.consegneService.downloadAttachment(this.selectedDetail.id, item.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.fileName;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => {
        this.notifyError(error?.error?.message ?? 'Errore download allegato');
      },
    });
  }

  deleteAttachment(item: AttachmentRecord): void {
    if (!this.selectedDetail) return;
    const id = this.selectedDetail.id;
    this.openConfirm(`Eliminare allegato "${item.fileName}"?`, () => {
      this.consegneService.deleteAttachment(id, item.id).subscribe({
        next: () => {
          this.notifySuccess('Allegato eliminato');
          this.loadAttachments(this.selectedDetail!.id);
          this.loadHistory(this.selectedDetail!.id);
        },
        error: (error) => {
          this.notifyError(error?.error?.message ?? 'Errore eliminazione allegato');
        },
      });
    });
  }

  loadAudit(page = this.auditPage): void {
    if (!this.isAdmin) return;
    this.auditLoading = true;
    this.auditPage = page;
    this.saveAuditPreset();
    this.consegneService
      .listAudit({
        page: this.auditPage,
        pageSize: this.auditPageSize,
        username: this.auditFilters.username || undefined,
        action: this.auditFilters.action || undefined,
        entity: this.auditFilters.entity || undefined,
        success: this.auditFilters.success || undefined,
        fromDate: this.auditFilters.fromDate || undefined,
        toDate: this.auditFilters.toDate || undefined,
      })
      .subscribe({
        next: (response) => {
          this.auditRows = response.data;
          this.auditTotal = response.pagination.total;
          if (this.selectedAuditRow) {
            this.selectedAuditRow = this.auditRows.find((row) => row.id === this.selectedAuditRow?.id) ?? this.selectedAuditRow;
          }
          this.auditLoading = false;
        },
        error: (error) => {
          this.auditLoading = false;
          this.operationError = error?.error?.message ?? 'Errore caricamento audit';
        },
      });
  }

  resetAuditFilters(): void {
    this.auditFilters = {
      username: '',
      action: '',
      entity: '',
      success: '',
      fromDate: '',
      toDate: '',
    };
    localStorage.removeItem(this.userScopedStorageKey('carra_audit_filters_preset'));
    this.selectedAuditRow = null;
    this.loadAudit(1);
  }

  loadUsers(): void {
    if (!this.isAdmin) return;
    this.usersLoading = true;
    this.consegneService.listUsers().subscribe({
      next: (response) => {
        this.usersRows = response.data;
        this.usersLoading = false;
      },
      error: (error) => {
        this.usersLoading = false;
        this.operationError = error?.error?.message ?? 'Errore caricamento utenti';
      },
    });
  }

  createUser(): void {
    if (!this.isAdmin) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.generatedPassword = null;
    this.consegneService.createUser({
      username: this.newUserModel.username.trim(),
      role: this.newUserModel.role,
      isActive: this.newUserModel.isActive,
    }).subscribe({
      next: (result) => {
        this.generatedPassword = result.generatedPassword;
        this.generatedPasswordForUser = result.username;
        this.newUserModel = { username: '', role: 'operativo', isActive: true };
        this.loadUsers();
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore creazione utente';
      },
    });
  }

  copyGeneratedPassword(): void {
    if (!this.generatedPassword) return;
    navigator.clipboard.writeText(this.generatedPassword).then(() => {
      this.operationSuccess = 'Password copiata negli appunti';
      setTimeout(() => { this.operationSuccess = ''; }, 2500);
    });
  }

  updateUserRole(userId: number, role: 'admin' | 'operativo' | 'lettura'): void {
    if (!this.isAdmin) return;
    this.consegneService.updateUser(userId, { role }).subscribe({
      next: () => {
        this.operationSuccess = 'Ruolo utente aggiornato';
        this.loadUsers();
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore aggiornamento ruolo';
      },
    });
  }

  toggleUserActive(user: AppUserRecord): void {
    if (!this.isAdmin) return;
    this.consegneService.updateUser(user.id, { isActive: !user.isActive }).subscribe({
      next: () => {
        this.operationSuccess = `Utente ${!user.isActive ? 'attivato' : 'disattivato'}`;
        this.loadUsers();
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore aggiornamento stato utente';
      },
    });
  }

  openPasswordReset(userId: number): void {
    this.passwordResetModel = { userId, password: '' };
  }

  resetUserPassword(): void {
    if (!this.isAdmin || !this.passwordResetModel.userId) return;
    this.consegneService.resetUserPassword(this.passwordResetModel.userId, this.passwordResetModel.password).subscribe({
      next: () => {
        this.operationSuccess = 'Password utente aggiornata';
        this.passwordResetModel = { userId: null, password: '' };
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore reset password';
      },
    });
  }

  selectAuditRow(item: AuditLogRecord): void {
    this.selectedAuditRow = item;
  }

  closeAuditDetail(): void {
    this.selectedAuditRow = null;
  }

  openHistoryModal(order: ConsegnaRecord): void {
    this.historyModalTitle = `${order.rif} — ${order.cliente}`;
    this.historyModalEvents = [];
    this.loadingHistoryModal = true;
    this.consegneService.history(order.id).subscribe({
      next: (response) => {
        this.historyModalEvents = response.data;
        this.loadingHistoryModal = false;
      },
      error: () => {
        this.historyModalEvents = [];
        this.loadingHistoryModal = false;
      },
    });
  }

  closeHistoryModal(): void {
    this.historyModalTitle = '';
    this.historyModalEvents = [];
  }

  openOrderFromAudit(entityId: number): void {
    const found = this.rows.find((r) => r.id === entityId);
    this.historyModalTitle = found ? `${found.rif} — ${found.cliente}` : `Ordine #${entityId}`;
    this.historyModalEvents = [];
    this.loadingHistoryModal = true;
    this.consegneService.history(entityId).subscribe({
      next: (response) => {
        this.historyModalEvents = response.data;
        this.loadingHistoryModal = false;
      },
      error: () => {
        this.historyModalEvents = [];
        this.loadingHistoryModal = false;
      },
    });
  }

  eventTypeLabel(type: string): string {
    const map: Record<string, string> = {
      ORDER_CREATED: 'Creato',
      ORDER_UPDATED: 'Modificato',
      STATUS_CHANGED: 'Cambio stato',
      STATUS_SUSPENDED: 'Sospeso',
      ATTACHMENT_ADDED: 'Allegato aggiunto',
      ATTACHMENT_REMOVED: 'Allegato rimosso',
    };
    return map[type] ?? type;
  }

  eventTypeClass(type: string): string {
    const map: Record<string, string> = {
      ORDER_CREATED: 'event--created',
      ORDER_UPDATED: 'event--updated',
      STATUS_CHANGED: 'event--status',
      STATUS_SUSPENDED: 'event--suspended',
      ATTACHMENT_ADDED: 'event--attachment',
      ATTACHMENT_REMOVED: 'event--attachment',
    };
    return map[type] ?? 'event--default';
  }

  auditActionLabel(action: string): string {
    const map: Record<string, string> = {
      ORDER_CREATED: 'Ordine creato',
      ORDER_UPDATED: 'Ordine modificato',
      ORDER_DELETED: 'Ordine eliminato',
      STATUS_CHANGED: 'Cambio stato',
      STATUS_SUSPENDED: 'Sospensione',
      ATTACHMENT_ADDED: 'Allegato aggiunto',
      ATTACHMENT_REMOVED: 'Allegato rimosso',
      CONSEGNE_LIST: 'Lista consegne',
      CONSEGNE_EXPORT: 'Export CSV consegne',
      CONSEGNE_EXPORT_XLSX: 'Export Excel consegne',
      USER_CREATED: 'Utente creato',
      USER_UPDATED: 'Utente modificato',
      USER_PASSWORD_RESET: 'Reset password',
      AUTH_LOGIN_SUCCESS: 'Login',
      AUTH_LOGIN_FAILED: 'Login fallito',
    };
    return map[action] ?? action;
  }

  auditActionClass(action: string): string {
    if (action.includes('FAIL') || action.includes('ERROR')) return 'audit-badge--error';
    if (action === 'ORDER_CREATED' || action === 'USER_CREATED') return 'audit-badge--created';
    if (action === 'ORDER_DELETED') return 'audit-badge--error';
    if (action === 'STATUS_CHANGED' || action === 'STATUS_SUSPENDED') return 'audit-badge--status';
    if (action.includes('LOGIN')) return 'audit-badge--auth';
    if (action.includes('ATTACHMENT')) return 'audit-badge--attachment';
    if (action === 'ORDER_UPDATED' || action === 'USER_UPDATED' || action === 'USER_PASSWORD_RESET') return 'audit-badge--updated';
    return 'audit-badge--default';
  }

  getDiffEntries(event: OrderEvent): Array<{ field: string; from: string; to: string }> {
    let raw: unknown = event.details;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { return []; }
    }
    const details = raw as { diff?: Record<string, { from: unknown; to: unknown }> } | null;
    if (!details?.diff) return [];
    return Object.entries(details.diff).map(([field, val]) => ({
      field: this.fieldLabel(field),
      from: this.resolveDiffValue(field, val.from),
      to: this.resolveDiffValue(field, val.to),
    }));
  }

  private resolveDiffValue(field: string, value: unknown): string {
    if (value == null) return '—';
    if (field === 'commercialeId') return this.nomeCommerciale(Number(value));
    if (field === 'responsabileInternoId') return this.nomeResponsabile(Number(value));
    return String(value);
  }

  diffSummary(event: OrderEvent): string {
    const entries = this.getDiffEntries(event);
    if (!entries.length) return '';
    return entries.map((e) => e.field).join(', ');
  }

  private fieldLabel(field: string): string {
    const map: Record<string, string> = {
      rif: 'Riferimento',
      cliente: 'Cliente',
      tipoImpianto: 'Tipo impianto',
      dataConsegna: 'Data consegna',
      cantiere: 'Cantiere',
      dataOrdine: 'Data ordine',
      scarico: 'Scarico',
      vascheCav: 'Vasche/Cav.',
      accessori: 'Accessori',
      operai: 'Operai',
      stato: 'Stato',
      note: 'Note',
      trasporto: 'Trasporto ns. carico',
      scaricoCarico: 'Scarico ns. carico',
      accontoPagato: 'Acconto pagato',
      commercialeId: 'Commerciale',
      responsabileInternoId: 'Responsabile',
    };
    return map[field] ?? field;
  }

  exportAuditCsv(): void {
    if (!this.isAdmin) return;
    this.consegneService
      .exportAuditCsv({
        username: this.auditFilters.username || undefined,
        action: this.auditFilters.action || undefined,
        entity: this.auditFilters.entity || undefined,
        success: this.auditFilters.success || undefined,
        fromDate: this.auditFilters.fromDate || undefined,
        toDate: this.auditFilters.toDate || undefined,
      })
      .subscribe({
        next: (csv) => {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (error) => {
          this.operationError = error?.error?.message ?? 'Errore export audit CSV';
        },
      });
  }

  loadCommerciali(): void {
    this.commercialiLoading = true;
    this.consegneService.listCommerciali().subscribe({
      next: (response) => {
        this.commercialiRows = response.data;
        this.commercialiLoading = false;
      },
      error: (error) => {
        this.commercialiLoading = false;
        this.operationError = error?.error?.message ?? 'Errore caricamento commerciali';
      },
    });
  }

  createCommerciale(): void {
    if (!this.isAdmin || !this.newComercialeModel.nome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.createCommerciale({ nome: this.newComercialeModel.nome.trim() }).subscribe({
      next: () => {
        this.operationSuccess = `Commerciale "${this.newComercialeModel.nome}" creato`;
        this.newComercialeModel = { nome: '' };
        this.loadCommerciali();
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore creazione commerciale';
      },
    });
  }

  deleteCommerciale(id: number): void {
    if (!this.isAdmin) return;
    const item = this.commercialiRows.find((c) => c.id === id);
    this.openConfirm(`Eliminare il commerciale "${item?.nome}"?`, () => {
      this.consegneService.deleteCommerciale(id).subscribe({
        next: () => { this.operationSuccess = 'Commerciale eliminato'; this.loadCommerciali(); },
        error: (error) => { this.operationError = error?.error?.message ?? 'Errore eliminazione commerciale'; },
      });
    });
  }

  loadResponsabili(): void {
    this.responsabiliLoading = true;
    this.consegneService.listResponsabili().subscribe({
      next: (response) => {
        this.responsabiliRows = response.data;
        this.responsabiliLoading = false;
      },
      error: (error) => {
        this.responsabiliLoading = false;
        this.operationError = error?.error?.message ?? 'Errore caricamento responsabili';
      },
    });
  }

  createResponsabile(): void {
    if (!this.isAdmin || !this.newResponsabileModel.nome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.createResponsabile({ nome: this.newResponsabileModel.nome.trim() }).subscribe({
      next: () => {
        this.operationSuccess = `Responsabile "${this.newResponsabileModel.nome}" creato`;
        this.newResponsabileModel = { nome: '' };
        this.loadResponsabili();
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore creazione responsabile';
      },
    });
  }

  deleteResponsabile(id: number): void {
    if (!this.isAdmin) return;
    const item = this.responsabiliRows.find((r) => r.id === id);
    this.openConfirm(`Eliminare il responsabile "${item?.nome}"?`, () => {
      this.consegneService.deleteResponsabile(id).subscribe({
        next: () => { this.operationSuccess = 'Responsabile eliminato'; this.loadResponsabili(); },
        error: (error) => { this.operationError = error?.error?.message ?? 'Errore eliminazione responsabile'; },
      });
    });
  }

  nomeCommerciale(id: number | null): string {
    return this.commercialiRows.find((c) => c.id === id)?.nome ?? '-';
  }

  nomeResponsabile(id: number | null): string {
    return this.responsabiliRows.find((r) => r.id === id)?.nome ?? '-';
  }

  nomeMittente(id: number | null | undefined): string {
    if (!id) return '—';
    return this.mittentiDisegno.find((m) => m.id === id)?.nome ?? `#${id}`;
  }

  // ── Mittenti Disegno CRUD ─────────────────────────────────────────────────

  nomeVettore(id: number | null | undefined): string {
    if (!id) return '—';
    return this.vettoriList.find((v) => v.id === id)?.nome ?? `#${id}`;
  }

  loadMittentiDisegnoAdmin(): void {
    this.mittentiDisegnoLoading = true;
    this.consegneService.listMittentiDisegno().subscribe({
      next: (response) => { this.mittentiDisegnoRows = response.data; this.mittentiDisegnoLoading = false; },
      error: (error) => { this.mittentiDisegnoLoading = false; this.operationError = error?.error?.message ?? 'Errore caricamento mittenti disegno'; },
    });
  }

  createMittenteDisegno(): void {
    if (!this.isAdmin || !this.newMittenteDisegnoNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.createMittenteDisegno({ nome: this.newMittenteDisegnoNome.trim() }).subscribe({
      next: () => {
        this.operationSuccess = `Mittente "${this.newMittenteDisegnoNome}" creato`;
        this.newMittenteDisegnoNome = '';
        this.loadMittentiDisegnoAdmin();
        this.mittentiDisegno = [];
        this.consegneService.listMittentiDisegno().subscribe({ next: (r) => { this.mittentiDisegno = r.data; }, error: () => {} });
      },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore creazione mittente disegno'; },
    });
  }

  startEditMittenteDisegno(item: MittenteDisegno): void {
    this.editingMittenteDisegno = item;
    this.editMittenteDisegnoNome = item.nome;
  }

  saveMittenteDisegno(): void {
    if (!this.editingMittenteDisegno || !this.editMittenteDisegnoNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.updateMittenteDisegno(this.editingMittenteDisegno.id, { nome: this.editMittenteDisegnoNome.trim() }).subscribe({
      next: () => {
        this.operationSuccess = 'Mittente aggiornato';
        this.editingMittenteDisegno = null;
        this.editMittenteDisegnoNome = '';
        this.loadMittentiDisegnoAdmin();
        this.mittentiDisegno = [];
        this.consegneService.listMittentiDisegno().subscribe({ next: (r) => { this.mittentiDisegno = r.data; }, error: () => {} });
      },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore aggiornamento mittente disegno'; },
    });
  }

  cancelEditMittenteDisegno(): void {
    this.editingMittenteDisegno = null;
    this.editMittenteDisegnoNome = '';
  }

  deleteMittenteDisegno(item: MittenteDisegno): void {
    if (!this.isAdmin) return;
    this.openConfirm(`Eliminare il mittente "${item.nome}"?`, () => {
    this.consegneService.deleteMittenteDisegno(item.id).subscribe({
      next: () => {
        this.operationSuccess = 'Mittente eliminato';
        this.loadMittentiDisegnoAdmin();
        this.mittentiDisegno = [];
        this.consegneService.listMittentiDisegno().subscribe({ next: (r) => { this.mittentiDisegno = r.data; }, error: () => {} });
      },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore eliminazione mittente disegno'; },
    });
    });
  }

  // ── Operai CRUD ───────────────────────────────────────────────────────────

  loadOperaiAdmin(): void {
    this.operaiLoading = true;
    this.consegneService.listOperai().subscribe({
      next: (response) => { this.operaiRows = response.data; this.operaiLoading = false; },
      error: (error) => { this.operaiLoading = false; this.operationError = error?.error?.message ?? 'Errore caricamento operai'; },
    });
  }

  createOperaio(): void {
    if (!this.isAdmin || !this.newOperaioNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.createOperaio({ nome: this.newOperaioNome.trim() }).subscribe({
      next: () => {
        this.operationSuccess = `Operaio "${this.newOperaioNome}" creato`;
        this.newOperaioNome = '';
        this.loadOperaiAdmin();
        this.operaiList = [];
        this.consegneService.listOperai().subscribe({ next: (r) => { this.operaiList = r.data; }, error: () => {} });
      },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore creazione operaio'; },
    });
  }

  startEditOperaio(item: Operaio): void {
    this.editingOperaio = item;
    this.editOperaioNome = item.nome;
  }

  saveOperaio(): void {
    if (!this.editingOperaio || !this.editOperaioNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.updateOperaio(this.editingOperaio.id, { nome: this.editOperaioNome.trim() }).subscribe({
      next: () => {
        this.operationSuccess = 'Operaio aggiornato';
        this.editingOperaio = null;
        this.editOperaioNome = '';
        this.loadOperaiAdmin();
        this.operaiList = [];
        this.consegneService.listOperai().subscribe({ next: (r) => { this.operaiList = r.data; }, error: () => {} });
      },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore aggiornamento operaio'; },
    });
  }

  cancelEditOperaio(): void {
    this.editingOperaio = null;
    this.editOperaioNome = '';
  }

  deleteOperaio(item: Operaio): void {
    if (!this.isAdmin) return;
    this.openConfirm(`Eliminare l'operaio "${item.nome}"?`, () => {
      this.consegneService.deleteOperaio(item.id).subscribe({
        next: () => {
          this.operationSuccess = 'Operaio eliminato';
          this.loadOperaiAdmin();
          this.operaiList = [];
          this.consegneService.listOperai().subscribe({ next: (r) => { this.operaiList = r.data; }, error: () => {} });
        },
        error: (error) => { this.operationError = error?.error?.message ?? 'Errore eliminazione operaio'; },
      });
    });
  }

  // ── Vettori CRUD ──────────────────────────────────────────────────────────

  loadVettoriAdmin(): void {
    this.vettoriLoading = true;
    this.consegneService.listVettori().subscribe({
      next: (response) => { this.vettoriRows = response.data; this.vettoriLoading = false; },
      error: (error) => { this.vettoriLoading = false; this.operationError = error?.error?.message ?? 'Errore caricamento vettori'; },
    });
  }

  createVettore(): void {
    if (!this.isAdmin || !this.newVettoreNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.createVettore({ nome: this.newVettoreNome.trim() }).subscribe({
      next: () => {
        this.operationSuccess = `Vettore "${this.newVettoreNome}" creato`;
        this.newVettoreNome = '';
        this.loadVettoriAdmin();
        this.vettoriList = [];
        this.consegneService.listVettori().subscribe({ next: (r) => { this.vettoriList = r.data; }, error: () => {} });
      },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore creazione vettore'; },
    });
  }

  startEditVettore(item: Vettore): void {
    this.editingVettore = item;
    this.editVettoreNome = item.nome;
  }

  saveVettore(): void {
    if (!this.editingVettore || !this.editVettoreNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.updateVettore(this.editingVettore.id, { nome: this.editVettoreNome.trim() }).subscribe({
      next: () => {
        this.operationSuccess = 'Vettore aggiornato';
        this.editingVettore = null;
        this.editVettoreNome = '';
        this.loadVettoriAdmin();
        this.vettoriList = [];
        this.consegneService.listVettori().subscribe({ next: (r) => { this.vettoriList = r.data; }, error: () => {} });
      },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore aggiornamento vettore'; },
    });
  }

  cancelEditVettore(): void {
    this.editingVettore = null;
    this.editVettoreNome = '';
  }

  deleteVettore(item: Vettore): void {
    if (!this.isAdmin) return;
    this.openConfirm(`Eliminare il vettore "${item.nome}"?`, () => {
      this.consegneService.deleteVettore(item.id).subscribe({
        next: () => {
          this.operationSuccess = 'Vettore eliminato';
          this.loadVettoriAdmin();
          this.vettoriList = [];
          this.consegneService.listVettori().subscribe({ next: (r) => { this.vettoriList = r.data; }, error: () => {} });
        },
        error: (error) => { this.operationError = error?.error?.message ?? 'Errore eliminazione vettore'; },
      });
    });
  }

  // ── Tipi Cemento CRUD ─────────────────────────────────────────────────────

  loadCementiTipiAdmin(): void {
    this.cementiTipiLoading = true;
    this.consegneService.listCementiTipi().subscribe({
      next: (response) => { this.cementiTipiRows = response.data; this.cementiTipiLoading = false; },
      error: (error) => { this.cementiTipiLoading = false; this.operationError = error?.error?.message ?? 'Errore caricamento tipi cemento'; },
    });
  }

  createCementoTipo(): void {
    if (!this.isAdmin || !this.newCementoTipoNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.createCementoTipo({ nome: this.newCementoTipoNome.trim(), ordine: this.newCementoTipoOrdine }).subscribe({
      next: () => { this.operationSuccess = `Tipo cemento "${this.newCementoTipoNome}" creato`; this.newCementoTipoNome = ''; this.newCementoTipoOrdine = 0; this.loadCementiTipiAdmin(); },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore creazione tipo cemento'; },
    });
  }

  startEditCementoTipo(item: CementoTipo): void {
    this.editingCementoTipo = item;
    this.editCementoTipoNome = item.nome;
    this.editCementoTipoOrdine = item.ordine;
  }

  saveCementoTipo(): void {
    if (!this.editingCementoTipo || !this.editCementoTipoNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.updateCementoTipo(this.editingCementoTipo.id, { nome: this.editCementoTipoNome.trim(), ordine: this.editCementoTipoOrdine }).subscribe({
      next: () => { this.operationSuccess = 'Tipo cemento aggiornato'; this.editingCementoTipo = null; this.editCementoTipoNome = ''; this.editCementoTipoOrdine = 0; this.loadCementiTipiAdmin(); },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore aggiornamento tipo cemento'; },
    });
  }

  cancelEditCementoTipo(): void {
    this.editingCementoTipo = null;
    this.editCementoTipoNome = '';
    this.editCementoTipoOrdine = 0;
  }

  deleteCementoTipo(item: CementoTipo): void {
    if (!this.isAdmin) return;
    this.openConfirm(`Eliminare il tipo cemento "${item.nome}"?`, () => {
      this.consegneService.deleteCementoTipo(item.id).subscribe({
        next: () => { this.operationSuccess = 'Tipo cemento eliminato'; this.loadCementiTipiAdmin(); },
        error: (error) => { this.operationError = error?.error?.message ?? 'Errore eliminazione tipo cemento'; },
      });
    });
  }

  // ── Tipi Accessorio CRUD ──────────────────────────────────────────────────

  loadAccessoriTipiAdmin(): void {
    this.accessoriTipiLoading = true;
    this.consegneService.listAccessoriTipi().subscribe({
      next: (response) => { this.accessoriTipiRows = response.data; this.accessoriTipiLoading = false; },
      error: (error) => { this.accessoriTipiLoading = false; this.operationError = error?.error?.message ?? 'Errore caricamento tipi accessorio'; },
    });
  }

  createAccessorioTipo(): void {
    if (!this.isAdmin || !this.newAccessorioTipoNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.createAccessorioTipo({ nome: this.newAccessorioTipoNome.trim(), ordine: this.newAccessorioTipoOrdine }).subscribe({
      next: () => { this.operationSuccess = `Tipo accessorio "${this.newAccessorioTipoNome}" creato`; this.newAccessorioTipoNome = ''; this.newAccessorioTipoOrdine = 0; this.loadAccessoriTipiAdmin(); },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore creazione tipo accessorio'; },
    });
  }

  startEditAccessorioTipo(item: AccessorioTipo): void {
    this.editingAccessorioTipo = item;
    this.editAccessorioTipoNome = item.nome;
    this.editAccessorioTipoOrdine = item.ordine;
  }

  saveAccessorioTipo(): void {
    if (!this.editingAccessorioTipo || !this.editAccessorioTipoNome.trim()) return;
    this.operationError = '';
    this.operationSuccess = '';
    this.consegneService.updateAccessorioTipo(this.editingAccessorioTipo.id, { nome: this.editAccessorioTipoNome.trim(), ordine: this.editAccessorioTipoOrdine }).subscribe({
      next: () => { this.operationSuccess = 'Tipo accessorio aggiornato'; this.editingAccessorioTipo = null; this.editAccessorioTipoNome = ''; this.editAccessorioTipoOrdine = 0; this.loadAccessoriTipiAdmin(); },
      error: (error) => { this.operationError = error?.error?.message ?? 'Errore aggiornamento tipo accessorio'; },
    });
  }

  cancelEditAccessorioTipo(): void {
    this.editingAccessorioTipo = null;
    this.editAccessorioTipoNome = '';
    this.editAccessorioTipoOrdine = 0;
  }

  deleteAccessorioTipo(item: AccessorioTipo): void {
    if (!this.isAdmin) return;
    this.openConfirm(`Eliminare il tipo accessorio "${item.nome}"?`, () => {
      this.consegneService.deleteAccessorioTipo(item.id).subscribe({
        next: () => { this.operationSuccess = 'Tipo accessorio eliminato'; this.loadAccessoriTipiAdmin(); },
        error: (error) => { this.operationError = error?.error?.message ?? 'Errore eliminazione tipo accessorio'; },
      });
    });
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes < 1024) return `${bytes ?? 0} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  auditDetailsAsJson(item: AuditLogRecord | null): string {
    if (!item?.details) return '-';
    try {
      return JSON.stringify(item.details, null, 2);
    } catch {
      return String(item.details);
    }
  }

  auditReadableSummary(item: AuditLogRecord): string {
    const d = item.details as Record<string, unknown> | null;
    switch (item.action) {
      case 'CONSEGNE_LIST': return `Lista consegne: trovati ${d?.['total'] ?? '?'} risultati`;
      case 'ORDER_CREATED': return 'Nuovo ordine inserito nel sistema';
      case 'ORDER_UPDATED': return 'Dati ordine modificati';
      case 'ORDER_DELETED': return `Ordine eliminato${d?.['rif'] ? `: ${d['rif']}` : ''}`;
      case 'STATUS_CHANGED': return `Stato cambiato: ${d?.['from'] ?? '?'} → ${d?.['to'] ?? '?'}`;
      case 'STATUS_SUSPENDED': return 'Ordine messo in sospensione';
      case 'AUTH_LOGIN_SUCCESS': return 'Accesso effettuato con successo';
      case 'AUTH_LOGIN_FAILED': return 'Tentativo di accesso con credenziali errate';
      case 'ATTACHMENT_ADDED': return `Allegato aggiunto${d?.['fileName'] ? ': ' + d['fileName'] : ''}`;
      case 'ATTACHMENT_REMOVED': return `Allegato rimosso${d?.['fileName'] ? ': ' + d['fileName'] : ''}`;
      case 'USER_CREATED': return 'Nuovo utente creato';
      case 'USER_UPDATED': return 'Dati utente modificati';
      case 'USER_PASSWORD_RESET': return 'Password utente reimpostata';
      case 'CONSEGNE_EXPORT': return 'Export CSV consegne eseguito';
      default: return '';
    }
  }

  private syncBoardCounts(): void {
    this.boardColumns = this.boardColumns.map((column) => ({
      ...column,
      count: column.items.length,
    }));
  }

  private loadBoard(): void {
    this.loadingBoard = true;
    this.consegneService.board(this.filters).subscribe({
      next: (response) => {
        this.boardColumns = response.columns;
        this.loadingBoard = false;
        this.scheduleKanbanScrollSync();
      },
      error: () => {
        this.loadingBoard = false;
      },
    });
  }

  onKanbanMainScroll(): void {
    if (!this.kanbanMainScrollEl || !this.kanbanBottomScrollEl) return;
    const left = this.kanbanMainScrollEl.scrollLeft;
    if (this.kanbanBottomScrollEl.scrollLeft !== left) {
      this.kanbanBottomScrollEl.scrollLeft = left;
    }
  }

  onKanbanBottomScroll(): void {
    if (!this.kanbanMainScrollEl || !this.kanbanBottomScrollEl) return;
    const left = this.kanbanBottomScrollEl.scrollLeft;
    if (this.kanbanMainScrollEl.scrollLeft !== left) {
      this.kanbanMainScrollEl.scrollLeft = left;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleKanbanScrollSync();
  }

  private scheduleKanbanScrollSync(): void {
    if (this.kanbanScrollSyncRaf !== null) {
      cancelAnimationFrame(this.kanbanScrollSyncRaf);
    }
    this.kanbanScrollSyncRaf = requestAnimationFrame(() => {
      this.kanbanScrollSyncRaf = null;
      this.syncKanbanScrollbars();
    });
  }

  private syncKanbanScrollbars(): void {
    const main = this.kanbanMainScrollEl;
    const bottom = this.kanbanBottomScrollEl;
    if (!main || !bottom) return;

    this.kanbanScrollContentWidth = main.scrollWidth;
    bottom.scrollLeft = main.scrollLeft;
    if (Math.abs(main.scrollLeft - bottom.scrollLeft) > 1) {
      main.scrollLeft = bottom.scrollLeft;
    }
  }

  private loadHistory(id: number): void {
    this.loadingHistory = true;
    this.consegneService.history(id).subscribe({
      next: (response) => {
        this.history = response.data;
        this.loadingHistory = false;
      },
      error: () => {
        this.history = [];
        this.loadingHistory = false;
      },
    });
  }

  private loadLookupLists(): void {
    if (!this.mittentiDisegno.length) {
      this.consegneService.listMittentiDisegno().subscribe({
        next: (r) => { this.mittentiDisegno = r.data; },
        error: () => {},
      });
    }
    if (!this.operaiList.length) {
      this.consegneService.listOperai().subscribe({
        next: (r) => { this.operaiList = r.data; },
        error: () => {},
      });
    }
    if (!this.vettoriList.length) {
      this.consegneService.listVettori().subscribe({
        next: (r) => { this.vettoriList = r.data; },
        error: () => {},
      });
    }
  }

  private loadAttachments(orderId: number): void {
    this.loadingAttachments = true;
    this.consegneService.listAttachments(orderId).subscribe({
      next: (response) => {
        this.attachments = response.data;
        this.loadingAttachments = false;
      },
      error: () => {
        this.attachments = [];
        this.loadingAttachments = false;
      },
    });
  }

  private canTransition(fromStatus: ConsegnaStatus, toStatus: ConsegnaStatus): boolean {
    return allowedNextStatuses(fromStatus).includes(toStatus);
  }

  private loadFilters(): void {
    this.consegneService.filters().subscribe((filters) => {
      this.availableFilters = filters;
      this.normalizeFiltersAgainstAvailableOptions();
    });
  }

  // ── ERP SQL Server import — metodi ─────────────────────────────────────────

  openSqlImportModal(): void {
    if (!this.canWrite) return;
    this.sqlImportModalOpen = true;
    this.sqlImportError = '';
    this.sqlImportResult = null;
    this.sqlImportPreview = [];
    this.sqlImportSelected = new Set();
    this.sqlImportLoading = true;

    this.consegneService.getImportConfig().subscribe({
      next: (config) => {
        this.sqlImportLastDate = config.lastImportDate;
        this.sqlImportDateEdit = config.lastImportDate;
        this.runSqlPreview();
      },
      error: (err: { error?: { message?: string } }) => {
        this.sqlImportLoading = false;
        this.sqlImportError = err?.error?.message ?? 'Errore caricamento configurazione';
      },
    });
  }

  runSqlPreview(): void {
    this.sqlImportLoading = true;
    this.sqlImportError = '';
    this.consegneService.previewErpImport().subscribe({
      next: (result) => {
        this.sqlImportPreview = result.orders;
        this.sqlImportLastDate = result.lastImportDate;
        this.sqlImportAlreadyImportedCount = result.alreadyImportedCount;
        this.sqlImportTruncated = result.isTruncated;
        this.sqlImportSelected = new Set(result.orders.map((o) => o.externalRef));
        this.sqlImportLoading = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.sqlImportLoading = false;
        this.sqlImportError = err?.error?.message ?? 'Errore connessione ERP SQL Server';
      },
    });
  }

  saveSqlImportDate(): void {
    if (!this.sqlImportDateEdit) return;
    this.consegneService.updateImportConfig(this.sqlImportDateEdit).subscribe({
      next: () => {
        this.sqlImportLastDate = this.sqlImportDateEdit;
        this.runSqlPreview();
      },
      error: (err: { error?: { message?: string } }) => {
        this.sqlImportError = err?.error?.message ?? 'Errore aggiornamento data';
      },
    });
  }

  toggleSqlImportSelection(externalRef: string): void {
    if (this.sqlImportSelected.has(externalRef)) {
      this.sqlImportSelected.delete(externalRef);
    } else {
      this.sqlImportSelected.add(externalRef);
    }
    // Forza change detection su Set (Angular non traccia Set natively)
    this.sqlImportSelected = new Set(this.sqlImportSelected);
  }

  selectAllSqlImport(): void {
    this.sqlImportSelected = new Set(this.sqlImportPreview.map((o) => o.externalRef));
  }

  deselectAllSqlImport(): void {
    this.sqlImportSelected = new Set();
  }

  executeSqlImport(): void {
    if (!this.sqlImportSelectedCount) return;
    this.sqlImportConfirmOpen = true;
  }

  confirmSqlImport(): void {
    this.sqlImportConfirmOpen = false;
    const selectedOrders = this.sqlImportPreview.filter((o) =>
      this.sqlImportSelected.has(o.externalRef),
    );
    if (!selectedOrders.length) return;

    this.sqlImportExecuting = true;
    this.sqlImportError = '';

    this.consegneService.executeErpImport(selectedOrders).subscribe({
      next: (result) => {
        this.sqlImportResult = result;
        this.sqlImportExecuting = false;
        // Ricarica sempre entrambe le viste, indipendentemente da quella attiva
        this.refreshData(1);
        this.loadBoard();
      },
      error: (err: { error?: { message?: string } }) => {
        this.sqlImportExecuting = false;
        this.sqlImportError = err?.error?.message ?? 'Errore durante importazione';
      },
    });
  }

  cancelSqlImportConfirm(): void {
    this.sqlImportConfirmOpen = false;
  }

  closeSqlImportModal(): void {
    // Se c'è stato un import con successo, ricarica dati alla chiusura
    if (this.sqlImportResult && this.sqlImportResult.imported > 0) {
      this.refreshData(1);
      this.loadBoard();
    }
    this.sqlImportModalOpen = false;
    this.sqlImportPreview = [];
    this.sqlImportSelected = new Set();
    this.sqlImportResult = null;
    this.sqlImportError = '';
    this.sqlImportConfirmOpen = false;
  }

  private emptyForm(): EditableConsegna {
    return {
      rif: '',
      cliente: '',
      tipoImpianto: '',
      dataConsegna: '',
      cantiere: '',
      dataOrdine: '',
      referente: '',
      telefono: '',
      referente2: '',
      telefono2: '',
      scarico: '',
      vascheCav: '',
      accessori: '',
      operai: '',
      stato: 'IN CORSO',
      note: '',
      trasporto: false,
      scaricoCarico: false,
      accontoPagato: false,
      commercialeId: null,
      responsabileInternoId: null,
      folderLinkDocumenti: '',
      folderLinkFoto: '',
      cementiNote: '',
    };
  }

  // ── Operai multi-select helpers ───────────────────────────────────────────

  isOperaioSelected(id: number): boolean {
    return this.selectedDetail?.operaiAssegnati?.some((o) => o.id === id) ?? false;
  }

  operaiNomiLabel(operai: { nome: string }[] | undefined): string {
    return operai?.length ? operai.map((o) => o.nome).join(', ') : '—';
  }

  conclusiWeekLabel(value: string | null | undefined): string {
    if (!value) return '—';
    const match = /^(\d{4})-W(\d{2})$/.exec(value);
    if (!match) return value;
    return `Settimana ${match[2]} / ${match[1]}`;
  }

  conclusiDateLabel(value: string | null | undefined): string {
    return value ? value : '—';
  }

  toggleOperaio(id: number): void {
    if (!this.selectedDetail) return;
    const existing = this.selectedDetail.operaiAssegnati ?? [];
    if (this.isOperaioSelected(id)) {
      this.selectedDetail = { ...this.selectedDetail, operaiAssegnati: existing.filter((o) => o.id !== id) };
    } else {
      const operaio = this.operaiList.find((o) => o.id === id);
      if (operaio) {
        this.selectedDetail = { ...this.selectedDetail, operaiAssegnati: [...existing, { id: operaio.id, nome: operaio.nome }] };
      }
    }
  }

  // ── Detail tab methods ────────────────────────────────────────────────────

  setDetailTab(tab: 'dettagli' | 'cementi' | 'accessori' | 'cam' | 'gestione'): void {
    this.activeDetailTab = tab;
  }

  private loadCementiAccessoriForDetail(orderId: number): void {
    // Load tipi lists (cached after first load)
    if (!this.cementiTipiList.length) {
      this.consegneService.listCementiTipi().subscribe({
        next: (response) => {
          this.cementiTipiList = response.data;
          this.loadOrderCementi(orderId);
        },
        error: () => {},
      });
    } else {
      this.loadOrderCementi(orderId);
    }

    if (!this.accessoriTipiList.length) {
      this.consegneService.listAccessoriTipi().subscribe({
        next: (response) => {
          this.accessoriTipiList = response.data;
          this.loadOrderAccessori(orderId);
        },
        error: () => {},
      });
    } else {
      this.loadOrderAccessori(orderId);
    }
  }

  private loadOrderCementi(orderId: number): void {
    this.consegneService.getOrderCementi(orderId).subscribe({
      next: (response) => {
        const existing = response.data;
        this.cementiSelections = this.cementiTipiList.map((tipo) => {
          const found = existing.find((c: OrderCemento) => c.tipoId === tipo.id);
          return {
            tipoId: tipo.id,
            nome: tipo.nome,
            selezionato: !!found,
            ordinata: found?.ordinata ?? false,
            fatta: found?.fatta ?? false,
          };
        });
        this.cementiSnapshot = this.serializeCementi();
      },
      error: () => {
        this.cementiSelections = this.cementiTipiList.map((tipo) => ({
          tipoId: tipo.id,
          nome: tipo.nome,
          selezionato: false,
          ordinata: false,
          fatta: false,
        }));
        this.cementiSnapshot = this.serializeCementi();
      },
    });
  }

  private loadOrderAccessori(orderId: number): void {
    this.consegneService.getOrderAccessori(orderId).subscribe({
      next: (response) => {
        const existing = response.data;
        this.accessoriSelections = this.accessoriTipiList.map((tipo) => {
          const found = existing.find((a: OrderAccessorio) => a.tipoId === tipo.id);
          return {
            tipoId: tipo.id,
            nome: tipo.nome,
            selezionato: !!found,
            ordinata: found?.ordinata ?? false,
            fatta: found?.fatta ?? false,
          };
        });
        this.accessoriSnapshot = this.serializeAccessori();
      },
      error: () => {
        this.accessoriSelections = this.accessoriTipiList.map((tipo) => ({
          tipoId: tipo.id,
          nome: tipo.nome,
          selezionato: false,
          ordinata: false,
          fatta: false,
        }));
        this.accessoriSnapshot = this.serializeAccessori();
      },
    });
  }

  saveAll(): void {
    if (!this.selectedDetail) return;
    const id = this.selectedDetail.id;

    const dettagliDirty = this.editMode && this.serializeDettagli() !== this.dettagliSnapshot;
    const detailSectionsDirty = this.serializeDetailSections() !== this.detailSectionsSnapshot;
    const operaiDirty = this.serializeOperaiSelection() !== this.operaiSnapshot;
    const cementiDirty = this.cementiSelections.length > 0 && this.serializeCementi() !== this.cementiSnapshot;
    const accessoriDirty = this.accessoriSelections.length > 0 && this.serializeAccessori() !== this.accessoriSnapshot;

    if (!dettagliDirty && !detailSectionsDirty && !operaiDirty && !cementiDirty && !accessoriDirty) return;

    const taskObs: Observable<unknown>[] = [];
    const payload: Partial<ConsegnaRecord> = {};

    if (dettagliDirty) {
      Object.assign(payload, {
        rif: this.formModel.rif,
        cliente: this.formModel.cliente,
        tipoImpianto: this.formModel.tipoImpianto || null,
        dataConsegna: this.formModel.dataConsegna || null,
        cantiere: this.formModel.cantiere || null,
        dataOrdine: this.formModel.dataOrdine || null,
        referente: this.formModel.referente || null,
        telefono: this.formModel.telefono || null,
        referente2: this.formModel.referente2 || null,
        telefono2: this.formModel.telefono2 || null,
        stato: this.formModel.stato || this.selectedDetail.stato,
        note: this.formModel.note || null,
        trasporto: this.formModel.trasporto,
        scaricoCarico: this.formModel.scaricoCarico,
        accontoPagato: this.formModel.accontoPagato,
        commercialeId: this.formModel.commercialeId,
        responsabileInternoId: this.formModel.responsabileInternoId,
        folderLinkDocumenti: this.formModel.folderLinkDocumenti || null,
        folderLinkFoto: this.formModel.folderLinkFoto || null,
      });
    }
    if (detailSectionsDirty) {
      Object.assign(payload, {
        folderLinkDocumenti: this.selectedDetail.folderLinkDocumenti || null,
        folderLinkFoto: this.selectedDetail.folderLinkFoto || null,
        disegnoSpeditoAt: this.selectedDetail.disegnoSpeditoAt || null,
        disegnoMittenteId: this.selectedDetail.disegnoMittenteId || null,
        disegnoNote: this.selectedDetail.disegnoNote || null,
        disegnoApprovatoAt: this.selectedDetail.disegnoApprovatoAt || null,
        massicciataNota: this.selectedDetail.massicciataNota || null,
        tipoCariciNota: this.selectedDetail.tipoCariciNota || null,
        lavorazioneAssegnataAt: this.selectedDetail.lavorazioneAssegnataAt || null,
        consegnaDataEffettiva: this.selectedDetail.consegnaDataEffettiva || null,
        vettoreId: this.selectedDetail.vettoreId || null,
        bilici: this.selectedDetail.bilici,
        ddtPronti: this.selectedDetail.ddtPronti,
        bancale: this.selectedDetail.bancale,
        chiusini: this.selectedDetail.chiusini,
        caricoVerificato: this.selectedDetail.caricoVerificato,
        camSiNo: this.selectedDetail.camSiNo,
        cementiNote: this.selectedDetail.cementiNote || null,
      });
    }
    if (cementiDirty) {
      const items = this.cementiSelections.filter(s => s.selezionato).map(s => ({ tipoId: s.tipoId, ordinata: s.ordinata, fatta: s.fatta }));
      taskObs.push(this.consegneService.updateOrderCementi(id, items));
    }
    if (accessoriDirty) {
      const items = this.accessoriSelections.filter(s => s.selezionato).map(s => ({ tipoId: s.tipoId, ordinata: s.ordinata, fatta: s.fatta }));
      taskObs.push(this.consegneService.updateOrderAccessori(id, items));
    }
    if (Object.keys(payload).length > 0) {
      taskObs.push(this.consegneService.update(id, payload));
    }
    if (operaiDirty) {
      const operaiIds = this.selectedDetail.operaiAssegnati?.map((o) => o.id) ?? [];
      taskObs.push(this.consegneService.updateOperai(id, operaiIds));
    }

    forkJoin(taskObs).subscribe({
      next: () => {
        if (dettagliDirty) {
          // Aggiorna selectedDetail con i valori salvati e chiudi editMode
          Object.assign(this.selectedDetail!, {
            rif: this.formModel.rif,
            cliente: this.formModel.cliente,
            tipoImpianto: this.formModel.tipoImpianto || null,
            dataConsegna: this.formModel.dataConsegna || null,
            cantiere: this.formModel.cantiere || null,
            dataOrdine: this.formModel.dataOrdine || null,
            referente: this.formModel.referente || null,
            telefono: this.formModel.telefono || null,
            referente2: this.formModel.referente2 || null,
            telefono2: this.formModel.telefono2 || null,
            stato: this.formModel.stato,
            note: this.formModel.note || null,
            trasporto: this.formModel.trasporto,
            scaricoCarico: this.formModel.scaricoCarico,
            accontoPagato: this.formModel.accontoPagato,
            commercialeId: this.formModel.commercialeId,
            responsabileInternoId: this.formModel.responsabileInternoId,
            folderLinkDocumenti: this.formModel.folderLinkDocumenti || null,
            folderLinkFoto: this.formModel.folderLinkFoto || null,
            cementiNote: this.formModel.cementiNote || null,
          });
          this.dettagliSnapshot = this.serializeDettagli();
          this.refreshData(1);
        }
        this.detailSectionsSnapshot = this.serializeDetailSections();
        this.operaiSnapshot = this.serializeOperaiSelection();
        if (cementiDirty) this.cementiSnapshot = this.serializeCementi();
        if (accessoriDirty) this.accessoriSnapshot = this.serializeAccessori();
        if (cementiDirty || accessoriDirty) this.loadBoard();
        if (this.editMode) this.editMode = false;
        this.operationSuccess = 'Modifiche salvate';
        setTimeout(() => { this.operationSuccess = ''; }, 3000);
      },
      error: (err: { error?: { message?: string } }) => {
        this.operationError = err?.error?.message ?? 'Errore nel salvataggio';
        setTimeout(() => { this.operationError = ''; }, 3000);
      },
    });
  }

  copyFolderLink(path: string): void {
    navigator.clipboard.writeText(path);
  }

  pasteFolderPath(field: 'documenti' | 'foto'): void {
    navigator.clipboard.readText().then(text => {
      const trimmed = text?.trim();
      if (trimmed) this.saveFolderPath(field, trimmed);
    }).catch(() => {
      this.operationError = 'Impossibile leggere gli appunti — usa Ctrl+V nel campo';
      setTimeout(() => { this.operationError = ''; }, 3000);
    });
  }

  saveFolderPath(field: 'documenti' | 'foto', path: string): void {
    if (!this.selectedDetail) return;
    const trimmedPath = path?.trim() || null;
    if (field === 'documenti') {
      this.selectedDetail.folderLinkDocumenti = trimmedPath;
      this.formModel.folderLinkDocumenti = trimmedPath ?? '';
    } else {
      this.selectedDetail.folderLinkFoto = trimmedPath;
      this.formModel.folderLinkFoto = trimmedPath ?? '';
    }
  }

  clearFolderPath(field: 'documenti' | 'foto'): void {
    this.saveFolderPath(field, '');
  }

  openFolder(path: string | null | undefined): void {
    const trimmedPath = path?.trim();
    if (!trimmedPath) return;

    this.consegneService.openFolder(trimmedPath).subscribe({
      error: (err: { error?: { message?: string } }) => {
        this.operationError = err?.error?.message ?? 'Impossibile aprire la cartella';
        setTimeout(() => { this.operationError = ''; }, 3000);
      },
    });
  }

  private savePreset(): void {
    localStorage.setItem(this.userScopedStorageKey('carra_filters_preset'), JSON.stringify(this.filters));
  }

  private restorePreset(): void {
    try {
      const raw = localStorage.getItem(this.userScopedStorageKey('carra_filters_preset'));
      if (!raw) return;
      this.filters = { ...this.filters, ...(JSON.parse(raw) as ConsegnaFilters) };
      this.normalizeDateFilters();
    } catch {
      localStorage.removeItem(this.userScopedStorageKey('carra_filters_preset'));
    }
  }

  private saveAuditPreset(): void {
    localStorage.setItem(this.userScopedStorageKey('carra_audit_filters_preset'), JSON.stringify(this.auditFilters));
  }

  private restoreAuditPreset(): void {
    try {
      const raw = localStorage.getItem(this.userScopedStorageKey('carra_audit_filters_preset'));
      if (!raw) return;
      this.auditFilters = { ...this.auditFilters, ...(JSON.parse(raw) as typeof this.auditFilters) };
      const isValidDate = (value?: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
      if (!isValidDate(this.auditFilters.fromDate)) this.auditFilters.fromDate = '';
      if (!isValidDate(this.auditFilters.toDate)) this.auditFilters.toDate = '';
    } catch {
      localStorage.removeItem(this.userScopedStorageKey('carra_audit_filters_preset'));
    }
  }

  private userScopedStorageKey(key: string): string {
    return this.user?.username ? `${key}_${this.user.username}` : key;
  }

  private _restoreVisibleColumns(): void {
    try {
      const raw = localStorage.getItem(this.userScopedStorageKey('carra_kanban_visible_cols'));
      if (!raw) return;
      const parsed = JSON.parse(raw) as ConsegnaStatus[];
      const valid = parsed.filter((s) => this.statusFlow.includes(s));
      if (valid.length > 0) {
        const missingDefaults = this.statusFlow.filter((s) => !valid.includes(s));
        this.visibleStatuses = new Set([...valid, ...missingDefaults]);
      }
    } catch {
      // ignore corrupt storage
    }
  }

  private normalizeFiltersAgainstAvailableOptions(): void {
    if (this.filters.cliente && !this.availableFilters.clienti.includes(this.filters.cliente)) this.filters.cliente = '';
    if (this.filters.stato && !this.availableFilters.stati.includes(this.filters.stato)) this.filters.stato = '';
    if (this.filters.responsabileInternoId) {
      const id = Number(this.filters.responsabileInternoId);
      if (!Number.isFinite(id) || id <= 0 || (this.responsabiliRows.length > 0 && !this.responsabiliRows.some((item) => item.id === id))) {
        this.filters.responsabileInternoId = '';
      }
    }
    this.normalizeDateFilters();
  }

  private normalizeDateFilters(): void {
    const isValidDate = (value?: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!isValidDate(this.filters.fromDate)) this.filters.fromDate = '';
    if (!isValidDate(this.filters.toDate)) this.filters.toDate = '';
  }

  private async ensureDashboardChartsLoaded(): Promise<void> {
    if (this.dashboardChartsComponent || this.loadingDashboardCharts) return;
    this.loadingDashboardCharts = true;
    try {
      const module = await import('./dashboard-charts.component');
      this.dashboardChartsComponent = module.DashboardChartsComponent;
    } finally {
      this.loadingDashboardCharts = false;
    }
  }

  private loadActiveRegistryTab(): void {
    if (this.activeRegistryTab === 'persone') {
      this.loadPersoneSubTab(this.activePersoneSubTab);
    } else if (this.activeRegistryTab === 'produzione') {
      this.loadProduzioneSubTab(this.activeProduzioneSubTab);
    }
  }

  // ── Settings ERP — metodi ────────────────────────────────────────────────────

  loadSettings(): void {
    if (!this.isAdmin) return;
    this.settingsLoading = true;
    this.settingsError = '';
    this.settingsSuccess = '';
    this.settingsTestResult = null;
    this.settingsEditMode = false;
    this.settingsService.getSqlServerConfig().subscribe({
      next: (config) => {
        this.settingsConfig = config;
        this.settingsForm = {
          host: config.host.value,
          port: config.port.value,
          database: config.database.value,
          user: config.user.value,
          password: '***',
          timeoutMs: config.timeoutMs.value,
        };
        this.settingsLoading = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.settingsLoading = false;
        this.settingsError = err?.error?.message ?? 'Errore caricamento configurazione';
      },
    });
  }

  enableSettingsEdit(): void {
    if (!this.isAdmin) return;
    this.settingsError = '';
    this.settingsSuccess = '';
    this.settingsTestResult = null;
    this.settingsEditMode = true;
  }

  cancelSettingsEdit(): void {
    if (!this.isAdmin) return;
    this.loadSettings();
  }

  saveSettings(): void {
    if (!this.isAdmin || !this.settingsEditMode) return;
    this.settingsSaving = true;
    this.settingsError = '';
    this.settingsSuccess = '';
    const payload: SqlServerConfigSavePayload = {
      host: this.settingsForm.host,
      port: this.settingsForm.port,
      database: this.settingsForm.database,
      user: this.settingsForm.user,
      password: this.settingsForm.password === '***' ? '' : this.settingsForm.password,
      timeoutMs: this.settingsForm.timeoutMs,
    };
    this.settingsService.saveSqlServerConfig(payload).subscribe({
      next: () => {
        this.settingsSaving = false;
        this.settingsEditMode = false;
        this.settingsSuccess = 'Configurazione salvata.';
      },
      error: (err: { error?: { message?: string } }) => {
        this.settingsSaving = false;
        this.settingsError = err?.error?.message ?? 'Errore salvataggio';
      },
    });
  }

  testSettings(): void {
    if (!this.isAdmin) return;
    this.settingsTesting = true;
    this.settingsTestResult = null;
    this.settingsError = '';
    this.settingsService.testSqlServerConnection().subscribe({
      next: (result) => {
        this.settingsTesting = false;
        this.settingsTestResult = result;
      },
      error: (err: { error?: { message?: string } }) => {
        this.settingsTesting = false;
        this.settingsTestResult = { ok: false, message: err?.error?.message ?? 'Errore test' };
      },
    });
  }

  get settingsOriginLabel(): string {
    if (!this.settingsConfig) return '';
    const sources = [
      this.settingsConfig.host.source,
      this.settingsConfig.port.source,
      this.settingsConfig.database.source,
      this.settingsConfig.user.source,
      this.settingsConfig.password.source,
    ];
    const allDb = sources.every((s) => s === 'db');
    const allEnv = sources.every((s) => s === 'env');
    if (allDb) return 'Da database';
    if (allEnv) return 'Da .env (default)';
    return 'Mista (DB + .env)';
  }
}
