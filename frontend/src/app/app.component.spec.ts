import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { AppComponent } from './app.component';
import { ConsegneService } from './consegne.service';
import { AuthService } from './auth.service';

describe('AppComponent', () => {
  const userSubject = new BehaviorSubject({ username: 'admin', role: 'admin' as const });

  const serviceMock: Partial<ConsegneService> = {
    list: () =>
      of({
        data: [],
        pagination: { page: 1, pageSize: 15, total: 0, totalPages: 0 },
      }),
    stats: () =>
      of({
        kpi: { consegneSettimanaCorrente: 0, consegneProssimaSettimana: 0, ritardi: 0, totaleAttivi: 0, accontiDaIncassare: 0 },
        byCarrier: [],
        byCarrierWithLate: [],
        byStatus: [],
        pipelineConRitardi: [],
        weeklyTrend: [],
        upcomingByWeek: [],
        byClienteAttivi: [],
      }),
    filters: () => of({ clienti: [], vettori: [], stati: [] }),
    board: () => of({ columns: [] }),
    history: () => of({ data: [] }),
    listAttachments: () => of({ data: [] }),
    uploadAttachment: () => of({}),
    downloadAttachment: () => of(new Blob(['x'])),
    deleteAttachment: () => of(undefined),
    listAudit: () => of({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
    exportAuditCsv: () => of('id,action'),
    listUsers: () => of({ data: [] }),
    createUser: () => of({ id: 1, username: 'u', role: 'operativo', isActive: true, createdAt: null, updatedAt: null }),
    updateUser: () => of({ id: 1, username: 'u', role: 'operativo', isActive: true, createdAt: null, updatedAt: null }),
    resetUserPassword: () => of(undefined),
    exportCsv: () => of('rif,cliente'),
    transition: () => of({}),
    getById: () => of({}),
    create: () => of({ id: 1 }),
    update: () => of({ id: 1 }),
    delete: () => of({}),
  };

  const authMock: Partial<AuthService> = {
    user: { username: 'admin', role: 'admin' },
    user$: userSubject.asObservable(),
    login: () => of({ username: 'admin', role: 'admin' }),
    logout: () => undefined,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: ConsegneService, useValue: serviceMock },
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render dashboard title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Dashboard Consegne Carra');
  });
});
