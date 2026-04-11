import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnInit, Type, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { AuthService } from './auth.service';
import { ConsegneService } from './consegne.service';
import {
  AttachmentRecord,
  AuditLogRecord,
  AuthUser,
  BoardColumn,
  ConsegnaFilters,
  ConsegnaRecord,
  ConsegnaStats,
  ConsegnaStatus,
  OrderEvent,
} from './consegne.types';

type EditableConsegna = {
  rif: string;
  cliente: string;
  tipoImpianto: string;
  dataConsegna: string;
  cantiere: string;
  dataOrdine: string;
  vettore: string;
  scarico: string;
  vascheCav: string;
  accessori: string;
  operai: string;
  stato: string;
  note: string;
};

type ViewMode = 'dashboard' | 'kanban' | 'audit';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, NgxDatatableModule, CdkDropList, CdkDrag],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly consegneService = inject(ConsegneService);
  private readonly authService = inject(AuthService);

  rows: ConsegnaRecord[] = [];
  total = 0;
  page = 1;
  pageSize = 15;
  loading = false;
  loadingDetails = false;
  selectedRow: ConsegnaRecord | null = null;
  selectedDetail: ConsegnaRecord | null = null;
  attachments: AttachmentRecord[] = [];
  loadingAttachments = false;
  selectedUploadFile: File | null = null;
  operationError = '';
  operationSuccess = '';
  activeView: ViewMode = 'dashboard';

  loginState = {
    username: '',
    password: '',
    error: '',
  };

  user: AuthUser | null = null;
  canWrite = false;

  readonly statusFlow: ConsegnaStatus[] = ['IN CORSO', 'IN LAVORAZIONE', 'PRONTI & AVVISATI', 'CONCLUSI', 'SOSPESO'];
  readonly transitionRules: Record<ConsegnaStatus, ConsegnaStatus[]> = {
    'IN CORSO': ['IN LAVORAZIONE', 'SOSPESO'],
    'IN LAVORAZIONE': ['PRONTI & AVVISATI', 'SOSPESO'],
    'PRONTI & AVVISATI': ['CONCLUSI', 'SOSPESO'],
    CONCLUSI: [],
    SOSPESO: ['IN CORSO', 'IN LAVORAZIONE'],
  };

  boardColumns: BoardColumn[] = [];
  loadingBoard = false;
  showOnlyLateInKanban = false;
  history: OrderEvent[] = [];
  loadingHistory = false;

  transitionModel = {
    toStatus: '' as ConsegnaStatus | '',
    note: '',
  };

  pendingTransitionId: number | null = null;
  dashboardChartsComponent: Type<unknown> | null = null;
  loadingDashboardCharts = false;

  dropTransitionModal: {
    open: boolean;
    order: ConsegnaRecord | null;
    fromStatus: ConsegnaStatus | '';
    toStatus: ConsegnaStatus | '';
    note: string;
    error: string;
  } = {
    open: false,
    order: null,
    fromStatus: '',
    toStatus: '',
    note: '',
    error: '',
  };

  formVisible = false;
  editingId: number | null = null;
  formModel: EditableConsegna = this.emptyForm();

  filters: ConsegnaFilters = {
    q: '',
    cliente: '',
    vettore: '',
    stato: '',
    fromDate: '',
    toDate: '',
  };

  availableFilters = {
    clienti: [] as string[],
    vettori: [] as string[],
    stati: [] as string[],
  };

  stats: ConsegnaStats = {
    kpi: { consegneSettimanaCorrente: 0, ritardi: 0 },
    byCarrier: [],
    byStatus: [],
    weeklyTrend: [],
  };

  auditRows: AuditLogRecord[] = [];
  auditLoading = false;
  auditPage = 1;
  auditPageSize = 20;
  auditTotal = 0;
  auditFilters: { username: string; action: string; entity: string; success: string; fromDate: string; toDate: string } = {
    username: '',
    action: '',
    entity: '',
    success: '',
    fromDate: '',
    toDate: '',
  };

  readonly columns = [
    { name: 'Rif', prop: 'rif' },
    { name: 'Cliente', prop: 'cliente' },
    { name: 'Tipo Impianto', prop: 'tipoImpianto' },
    { name: 'Data Consegna', prop: 'dataConsegna' },
    { name: 'Vettore', prop: 'vettore' },
    { name: 'Stato', prop: 'stato' },
  ];

  get isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  ngOnInit(): void {
    this.user = this.authService.user;
    this.canWrite = this.user?.role === 'admin' || this.user?.role === 'operativo';

    this.authService.user$.subscribe((user) => {
      this.user = user;
      this.canWrite = user?.role === 'admin' || user?.role === 'operativo';
      if (user) {
        this.loginState.error = '';
        this.restorePreset();
        this.loadFilters();
        this.refreshData();
        this.ensureDashboardChartsLoaded();
      }
    });

    if (this.user) {
      this.restorePreset();
      this.loadFilters();
      this.refreshData();
      this.ensureDashboardChartsLoaded();
    }
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
    this.attachments = [];
    this.formVisible = false;
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
        this.loadHistory(id);
        this.loadAttachments(id);
      },
      error: () => {
        this.loadingDetails = false;
      },
    });
  }

  changeView(view: ViewMode): void {
    if (view === 'audit' && !this.isAdmin) return;
    this.activeView = view;
    if (view === 'dashboard') {
      this.ensureDashboardChartsLoaded();
    } else if (view === 'kanban') {
      this.loadBoard();
    } else {
      this.loadAudit(1);
    }
  }

  selectFromBoard(row: ConsegnaRecord): void {
    this.selectedRow = row;
    this.loadDetail(row.id);
  }

  get boardDropListIds(): string[] {
    return this.boardColumns.map((column) => this.dropListId(column.status));
  }

  dropListId(status: string): string {
    return `status-${status.replace(/\s+/g, '-').replace(/[^A-Za-z0-9-_]/g, '').toLowerCase()}`;
  }

  columnClass(status: string): string {
    const map: Record<string, string> = {
      'IN CORSO': 'status-in-corso',
      'IN LAVORAZIONE': 'status-in-lavorazione',
      'PRONTI & AVVISATI': 'status-pronti-avvisati',
      CONCLUSI: 'status-conclusi',
      SOSPESO: 'status-sospeso',
    };
    return map[status] ?? '';
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

  lateCountByStatus(status: ConsegnaStatus): number {
    const column = this.boardColumns.find((item) => item.status === status);
    return this.lateCount(column?.items ?? []);
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

  lateDays(item: ConsegnaRecord): number {
    if (!this.isLate(item) || !item.dataConsegna) return 0;
    const dueDate = new Date(item.dataConsegna);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(1, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
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
      this.operationError = `Transizione non consentita: ${fromStatus} -> ${targetStatus}`;
      return;
    }

    this.dropTransitionModal = {
      open: true,
      order: moved,
      fromStatus,
      toStatus: targetStatus,
      note: '',
      error: '',
    };
  }

  closeDropTransitionModal(): void {
    this.dropTransitionModal = {
      open: false,
      order: null,
      fromStatus: '',
      toStatus: '',
      note: '',
      error: '',
    };
  }

  confirmDropTransition(): void {
    const modal = this.dropTransitionModal;
    if (!modal.open || !modal.order || !modal.fromStatus || !modal.toStatus) return;
    const orderId = modal.order.id;

    if (modal.toStatus === 'SOSPESO' && !modal.note.trim()) {
      this.dropTransitionModal.error = 'Inserisci il motivo della sospensione.';
      return;
    }

    this.pendingTransitionId = orderId;
    this.consegneService.transition(orderId, modal.toStatus, modal.note.trim() || undefined).subscribe({
      next: () => {
        this.operationSuccess = `Stato aggiornato a ${modal.toStatus}`;
        this.pendingTransitionId = null;
        this.closeDropTransitionModal();
        this.refreshData(this.page, false);
        if (this.selectedDetail?.id === orderId) {
          this.loadDetail(orderId);
        }
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore transizione stato';
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
      vettore: '',
      stato: '',
      fromDate: '',
      toDate: '',
    };
    localStorage.removeItem('carra_filters_preset');
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

  openCreate(): void {
    this.editingId = null;
    this.formModel = this.emptyForm();
    this.formVisible = true;
  }

  openEdit(): void {
    if (!this.selectedDetail) return;
    this.editingId = this.selectedDetail.id;
    this.formModel = {
      rif: this.selectedDetail.rif ?? '',
      cliente: this.selectedDetail.cliente ?? '',
      tipoImpianto: this.selectedDetail.tipoImpianto ?? '',
      dataConsegna: this.selectedDetail.dataConsegna ?? '',
      cantiere: this.selectedDetail.cantiere ?? '',
      dataOrdine: this.selectedDetail.dataOrdine ?? '',
      vettore: this.selectedDetail.vettore ?? '',
      scarico: this.selectedDetail.scarico ?? '',
      vascheCav: this.selectedDetail.vascheCav ?? '',
      accessori: this.selectedDetail.accessori ?? '',
      operai: this.selectedDetail.operai ?? '',
      stato: this.selectedDetail.stato ?? '',
      note: this.selectedDetail.note ?? '',
    };
    this.formVisible = true;
  }

  closeForm(): void {
    this.formVisible = false;
  }

  saveForm(): void {
    const payload = {
      rif: this.formModel.rif,
      cliente: this.formModel.cliente,
      tipoImpianto: this.formModel.tipoImpianto || null,
      dataConsegna: this.formModel.dataConsegna || null,
      cantiere: this.formModel.cantiere || null,
      dataOrdine: this.formModel.dataOrdine || null,
      vettore: this.formModel.vettore || null,
      scarico: this.formModel.scarico || null,
      vascheCav: this.formModel.vascheCav || null,
      accessori: this.formModel.accessori || null,
      operai: this.formModel.operai || null,
      stato: this.formModel.stato || 'IN CORSO',
      note: this.formModel.note || null,
    };

    const req = this.editingId ? this.consegneService.update(this.editingId, payload) : this.consegneService.create(payload);
    req.subscribe({
      next: (result) => {
        this.formVisible = false;
        this.operationSuccess = this.editingId ? 'Consegna aggiornata' : 'Consegna creata';
        this.refreshData(1);
        const createdOrUpdated = result as ConsegnaRecord;
        if (createdOrUpdated?.id) {
          this.loadDetail(createdOrUpdated.id);
        }
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore salvataggio';
      },
    });
  }

  deleteSelected(): void {
    if (!this.selectedDetail) return;
    const ok = confirm(`Confermi eliminazione consegna ${this.selectedDetail.rif}?`);
    if (!ok) return;
    this.consegneService.delete(this.selectedDetail.id).subscribe({
      next: () => {
        this.operationSuccess = 'Consegna eliminata';
        this.selectedRow = null;
        this.selectedDetail = null;
        this.history = [];
        this.attachments = [];
        this.refreshData(1);
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore eliminazione';
      },
    });
  }

  applyTransition(): void {
    if (!this.selectedDetail || !this.transitionModel.toStatus) return;
    const currentStatus = this.selectedDetail.stato as ConsegnaStatus;
    if (!this.canTransition(currentStatus, this.transitionModel.toStatus)) {
      this.operationError = `Transizione non consentita: ${currentStatus} -> ${this.transitionModel.toStatus}`;
      return;
    }
    if (this.transitionModel.toStatus === 'SOSPESO' && !this.transitionModel.note.trim()) {
      this.operationError = 'Sospensione richiede un motivo';
      return;
    }
    this.consegneService
      .transition(this.selectedDetail.id, this.transitionModel.toStatus, this.transitionModel.note || undefined)
      .subscribe({
        next: () => {
          this.operationSuccess = `Stato aggiornato a ${this.transitionModel.toStatus}`;
          this.transitionModel = { toStatus: '', note: '' };
          this.loadDetail(this.selectedDetail!.id);
          this.refreshData(this.page);
        },
        error: (error) => {
          this.operationError = error?.error?.message ?? 'Errore transizione stato';
        },
      });
  }

  allowedNextStatuses(currentStatus: string): ConsegnaStatus[] {
    const casted = currentStatus as ConsegnaStatus;
    return this.transitionRules[casted] ?? [];
  }

  onAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedUploadFile = input.files?.[0] ?? null;
  }

  uploadAttachment(): void {
    if (!this.selectedDetail || !this.selectedUploadFile) return;
    this.consegneService.uploadAttachment(this.selectedDetail.id, this.selectedUploadFile).subscribe({
      next: () => {
        this.operationSuccess = 'Allegato caricato';
        this.selectedUploadFile = null;
        this.loadAttachments(this.selectedDetail!.id);
        this.loadHistory(this.selectedDetail!.id);
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore upload allegato';
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
        this.operationError = error?.error?.message ?? 'Errore download allegato';
      },
    });
  }

  deleteAttachment(item: AttachmentRecord): void {
    if (!this.selectedDetail) return;
    const ok = confirm(`Eliminare allegato ${item.fileName}?`);
    if (!ok) return;
    this.consegneService.deleteAttachment(this.selectedDetail.id, item.id).subscribe({
      next: () => {
        this.operationSuccess = 'Allegato eliminato';
        this.loadAttachments(this.selectedDetail!.id);
        this.loadHistory(this.selectedDetail!.id);
      },
      error: (error) => {
        this.operationError = error?.error?.message ?? 'Errore eliminazione allegato';
      },
    });
  }

  loadAudit(page = this.auditPage): void {
    if (!this.isAdmin) return;
    this.auditLoading = true;
    this.auditPage = page;
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
    this.loadAudit(1);
  }

  private syncBoardCounts(): void {
    this.boardColumns = this.boardColumns.map((column) => ({
      ...column,
      count: column.items.length,
    }));
  }

  private loadBoard(): void {
    this.loadingBoard = true;
    this.consegneService.board().subscribe({
      next: (response) => {
        this.boardColumns = response.columns;
        this.loadingBoard = false;
      },
      error: () => {
        this.loadingBoard = false;
      },
    });
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
    return this.transitionRules[fromStatus]?.includes(toStatus) ?? false;
  }

  private loadFilters(): void {
    this.consegneService.filters().subscribe((filters) => {
      this.availableFilters = filters;
      this.normalizeFiltersAgainstAvailableOptions();
    });
  }

  private emptyForm(): EditableConsegna {
    return {
      rif: '',
      cliente: '',
      tipoImpianto: '',
      dataConsegna: '',
      cantiere: '',
      dataOrdine: '',
      vettore: '',
      scarico: '',
      vascheCav: '',
      accessori: '',
      operai: '',
      stato: 'IN CORSO',
      note: '',
    };
  }

  private savePreset(): void {
    localStorage.setItem('carra_filters_preset', JSON.stringify(this.filters));
  }

  private restorePreset(): void {
    try {
      const raw = localStorage.getItem('carra_filters_preset');
      if (!raw) return;
      this.filters = { ...this.filters, ...(JSON.parse(raw) as ConsegnaFilters) };
      this.normalizeDateFilters();
    } catch {
      localStorage.removeItem('carra_filters_preset');
    }
  }

  private normalizeFiltersAgainstAvailableOptions(): void {
    if (this.filters.cliente && !this.availableFilters.clienti.includes(this.filters.cliente)) this.filters.cliente = '';
    if (this.filters.vettore && !this.availableFilters.vettori.includes(this.filters.vettore)) this.filters.vettore = '';
    if (this.filters.stato && !this.availableFilters.stati.includes(this.filters.stato)) this.filters.stato = '';
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
}
