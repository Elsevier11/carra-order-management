import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, ElementRef, HostListener, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardColumn, ConsegnaFilters, ConsegnaRecord } from './consegne.types';
import type { ConsegnaStatus } from '../../../src/shared/order-flow';

export interface KanbanBoardHost {
  activeFiltersCount: number;
  availableFilters: { clienti: string[]; stati: string[] };
  boardColumns: BoardColumn[];
  boardConclusiBadge(item: ConsegnaRecord): string | null;
  boardCementiSummary(item: ConsegnaRecord): Array<{ nome: string; ordinata: boolean; fatta: boolean }>;
  boardDropListIds: string[];
  canWrite: boolean;
  cementoBadgeClassFromFlags(sel: { ordinata: boolean; fatta: boolean }): string;
  columnClass(status: string): string;
  columnShortLabel(status: ConsegnaStatus): string;
  dropListId(status: string): string;
  filteredKanbanItems(items: ConsegnaRecord[]): ConsegnaRecord[];
  filters: ConsegnaFilters;
  exportXlsx(): void;
  isReadOnly: boolean;
  isColumnVisible(status: ConsegnaStatus): boolean;
  isLate(item: ConsegnaRecord): boolean;
  kanbanCompactMode: boolean;
  kanbanScrollContentWidth: number;
  responsabiliRows: Array<{ id: number; nome: string }>;
  loadingBoard: boolean;
  boardOperaiSummary(item: ConsegnaRecord): string[];
  boardOperaiWarning(item: ConsegnaRecord): string | null;
  onFilterSelectChange(): void;
  onFilterTextChange(): void;
  onKanbanBottomScroll(): void;
  onKanbanDrop(event: CdkDragDrop<ConsegnaRecord[]>, targetStatus: ConsegnaStatus): void;
  onKanbanMainScroll(): void;
  openCreate(): void;
  openHistoryModal(item: ConsegnaRecord): void;
  openSqlImportModal(): void;
  orderWarnings(item: ConsegnaRecord): string[];
  resetFilters(): void;
  selectFromBoard(item: ConsegnaRecord): void;
  showFiltersPanel: boolean;
  statusFlow: ConsegnaStatus[];
  toggleColumnVisibility(status: ConsegnaStatus): void;
  toggleFiltersPanel(): void;
  visibleKanbanCount(items: ConsegnaRecord[]): number;
  weekGroups(items: ConsegnaRecord[]): Array<{ label: string; key: number; items: ConsegnaRecord[] }>;
}

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDropList, CdkDrag],
  templateUrl: './kanban-board.component.html',
})
export class KanbanBoardComponent {
  @Input({ required: true }) app!: KanbanBoardHost;

  @ViewChild('kanbanMainScroll') private mainScrollRef?: ElementRef<HTMLElement>;
  @ViewChild('kanbanBottomScroll') private bottomScrollRef?: ElementRef<HTMLElement>;

  private syncRaf: number | null = null;

  ngAfterViewInit(): void {
    this.scheduleScrollSync();
  }

  ngAfterViewChecked(): void {
    this.scheduleScrollSync();
  }

  ngOnDestroy(): void {
    if (this.syncRaf !== null) {
      cancelAnimationFrame(this.syncRaf);
      this.syncRaf = null;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleScrollSync();
  }

  onMainScroll(): void {
    const main = this.mainScrollRef?.nativeElement;
    const bottom = this.bottomScrollRef?.nativeElement;
    if (!main || !bottom) return;
    const left = main.scrollLeft;
    if (bottom.scrollLeft !== left) bottom.scrollLeft = left;
  }

  onBottomScroll(): void {
    const main = this.mainScrollRef?.nativeElement;
    const bottom = this.bottomScrollRef?.nativeElement;
    if (!main || !bottom) return;
    const left = bottom.scrollLeft;
    if (main.scrollLeft !== left) main.scrollLeft = left;
  }

  requestScrollSync(): void {
    this.scheduleScrollSync();
  }

  private scheduleScrollSync(): void {
    if (this.syncRaf !== null) return;
    this.syncRaf = requestAnimationFrame(() => {
      this.syncRaf = null;
      this.syncScrollbars();
    });
  }

  private syncScrollbars(): void {
    const main = this.mainScrollRef?.nativeElement;
    const bottom = this.bottomScrollRef?.nativeElement;
    if (!main || !bottom) return;
    const width = main.scrollWidth;
    this.app.kanbanScrollContentWidth = width;
    bottom.scrollLeft = main.scrollLeft;
  }
}
