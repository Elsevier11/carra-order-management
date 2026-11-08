import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { AuthService } from './auth.service';
import type { ConsegnaRecord } from './consegne.types';
import { OrderDetailGestioneComponent } from './order-detail-gestione.component';

describe('Completed delivery date editing', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderDetailGestioneComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: {} },
      ],
    }).compileComponents();
  });

  it('sends the edited date when saving and preserves all other deliveries', fakeAsync(() => {
    const app = TestBed.runInInjectionContext(() => new AppComponent());
    const http = TestBed.inject(HttpTestingController);
    const otherDeliveries = [
      { data: '2026-11-15', vettoreId: 8, bilici: 2 },
      { data: '2026-11-20', vettoreId: 9, bilici: 3 },
      { data: '2026-11-25', vettoreId: 10, bilici: 4 },
    ];
    app.selectedDetail = {
      id: 398,
      rif: '398/26',
      cliente: 'Cliente test',
      tipoImpianto: null,
      dataConsegna: null,
      dataConsegnaTassativa: null,
      consegnaTassativa: false,
      cantiere: null,
      dataOrdine: '2026-09-18',
      referente: null,
      telefono: null,
      referente2: null,
      telefono2: null,
      scarico: null,
      vascheCav: null,
      note: null,
      trasporto: false,
      scaricoCarico: false,
      accontoRichiesto: false,
      accontoPagato: false,
      commercialeId: null,
      responsabileInternoId: null,
      folderLinkDocumenti: null,
      folderLinkFoto: null,
      disegnoSpeditoAt: null,
      disegnoMittenteId: null,
      disegnoNote: null,
      disegnoApprovatoAt: null,
      massicciataNota: null,
      tipoCariciNota: null,
      lavorazioneAssegnataAt: null,
      lavorazioneParziale: false,
      attesaMateriale: false,
      residuiLavorazioneNote: null,
      problemiScaricoNota: null,
      ddtPronti: false,
      bancale: false,
      chiusini: false,
      caricoVerificato: false,
      camSiNo: false,
      cementiNote: null,
      stato: 'CONSEGNA EFFETTUATA',
      consegnaDataEffettiva: '2026-10-27',
      consegnaDataEffettivaSeconda: '2026-11-15',
      vettoreId: 7,
      bilici: 1,
      vettoreSecondoId: 8,
      biliciSecondi: 2,
      deliveryPlan: [{ data: '2026-10-27', vettoreId: 7, bilici: 1 }, ...otherDeliveries],
      operaiAssegnati: [],
      cementi: [],
      accessori: [],
    } satisfies ConsegnaRecord;
    app.canWrite = true;
    app.editMode = true;
    app.activeDetailTab = 'gestione';
    app['dettagliSnapshot'] = app['serializeDettagli']();
    app['detailSectionsSnapshot'] = app['serializeDetailSections']();
    app['operaiSnapshot'] = app['serializeOperaiSelection']();

    const fixture = TestBed.createComponent(OrderDetailGestioneComponent);
    fixture.componentRef.setInput('app', app);
    fixture.componentRef.setInput('detail', app.selectedDetail);
    fixture.detectChanges();
    tick();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="date"]')!;
    expect(input.value).toBe('2026-10-27');
    input.value = '2026-11-10';
    input.dispatchEvent(new Event('input'));
    tick();
    app.saveAll();

    const update = http.expectOne((req) => req.method === 'PUT' && req.url.endsWith('/consegne/398'));
    expect(update.request.body.consegnaDataEffettiva).toBe('2026-11-10');
    expect(update.request.body.deliveryPlan).toEqual([
      { data: '2026-11-10', vettoreId: 7, bilici: 1 },
      ...otherDeliveries,
    ]);
    expect(update.request.body.consegnaDataEffettivaSeconda).toBe('2026-11-15');
    expect(update.request.body.vettoreSecondoId).toBe(8);
    expect(update.request.body.biliciSecondi).toBe(2);
    expect(app.selectedDetail?.stato).toBe('CONSEGNA EFFETTUATA');
    update.flush({ ...app.selectedDetail, ...update.request.body });

    http.expectOne((req) => req.method === 'GET' && req.url.endsWith('/consegne/board')).flush({ columns: [] });
    http.expectOne((req) => req.method === 'DELETE' && req.url.includes('/consegne/398/')).flush({});
    expect(app.selectedDetail?.consegnaDataEffettiva).toBe('2026-11-10');
    expect(app.selectedDetail?.deliveryPlan?.slice(1)).toEqual(otherDeliveries);
    expect(app.editMode).toBeFalse();
    tick(3000);
    http.verify();
  }));
});
