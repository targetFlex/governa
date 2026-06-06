// ============================================================
// auth.interceptor.spec.ts
//
// Testes unitários do AuthInterceptor (functional).
// Cenários cobertos:
//   - requisição ao gateway COM token → injeta Authorization header
//   - requisição ao gateway SEM token → não injeta header
//   - requisição para domínio externo → não injeta header
// ============================================================

import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { signal } from '@angular/core';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../auth/auth.service';
import { environment } from '@env/environment';

const GATEWAY_URL = `${environment.gatewayBaseUrl}/pedidos`;
const EXTERNAL_URL = 'https://external.api.com/data';

describe('authInterceptor', () => {
  let http:        HttpClient;
  let httpMock:    HttpTestingController;
  let tokenSignal: ReturnType<typeof signal<string | null>>;

  function setup(token: string | null) {
    tokenSignal = signal(token);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        {
          provide: AuthService,
          useValue: {
            getToken: () => tokenSignal(),
          },
        },
      ],
    });

    http     = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
    jest.clearAllMocks();
  });

  it('deve injetar Authorization header em requisição ao gateway com token', () => {
    setup('jwt.token.here');

    http.get(GATEWAY_URL).subscribe();

    const req = httpMock.expectOne(GATEWAY_URL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt.token.here');
    req.flush([]);
  });

  it('não deve injetar Authorization header sem token', () => {
    setup(null);

    http.get(GATEWAY_URL).subscribe();

    const req = httpMock.expectOne(GATEWAY_URL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('não deve injetar Authorization header em requisição para domínio externo', () => {
    setup('jwt.token.here');

    http.get(EXTERNAL_URL).subscribe();

    const req = httpMock.expectOne(EXTERNAL_URL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
