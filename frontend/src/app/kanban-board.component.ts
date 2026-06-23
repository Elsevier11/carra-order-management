import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, Input } from '@angular/core';
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
  lateCount(items: ConsegnaRecord[]): number;
  lateCountByStatus(status: ConsegnaStatus): number;
  lateDays(item: ConsegnaRecord): number;
  loadingBoard: boolean;
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
  showOnlyLateInKanban: boolean;
  statusFlow: ConsegnaStatus[];
  totalLateCount: number;
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
}
