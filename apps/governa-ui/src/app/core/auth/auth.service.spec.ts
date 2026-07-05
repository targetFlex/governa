// ============================================================
// auth.service.spec.ts
//
// Testes unitários do AuthService.
// Cenários cobertos:
//   - estado inicial: não autenticado, token null
//   - login com sucesso: token setado, isAuthenticated true
//   - login com erro: token permanece null
//   - logout: token limpo, router navega para /login
//   - getToken: retorna o token em memória
// ============================================================

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService, LoginCredentials, AuthTokenPayload } from './auth.service';
import { environment } from '@env/environment';

// ── Helpers ───────────────────────────────────────────────────

const CREDENTIALS: LoginCredentials = {
  email:    'admin@governa.com',
  password: 'secret123',
};

const TOKEN_RESPONSE: AuthTokenPayload = {
  token:     'jwt.token.here',
  expiresIn: 3600,
};

// ── Testes ───────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let http:    HttpTestingController;
  let router:  { navigate: jest.Mock };

  beforeEach(() => {
    router = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(AuthService);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    jest.clearAllMocks();
  });

  // ── Estado inicial ─────────────────────────────────────────

  describe('estado inicial', () => {
    it('não deve estar autenticado', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('token deve ser null', () => {
      expect(service.getToken()).toBeNull();
    });
  });

  // ── login() ───────────────────────────────────────────────

  describe('login()', () => {
    it('deve fazer POST para /auth/login', () => {
      service.login(CREDENTIALS).subscribe();

      const req = http.expectOne(`${environment.gatewayBaseUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(CREDENTIALS);

      req.flush(TOKEN_RESPONSE);
    });

    it('deve setar o token no signal após sucesso', () => {
      service.login(CREDENTIALS).subscribe();

      const req = http.expectOne(`${environment.gatewayBaseUrl}/auth/login`);
      req.flush(TOKEN_RESPONSE);

      expect(service.getToken()).toBe(TOKEN_RESPONSE.token);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('deve manter token null após erro de rede', () => {
      let errorEmitted = false;

      service.login(CREDENTIALS).subscribe({
        error: () => { errorEmitted = true; },
      });

      const req = http.expectOne(`${environment.gatewayBaseUrl}/auth/login`);
      req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      expect(service.getToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(errorEmitted).toBe(true);
    });

    it('deve emitir o payload de resposta no observable', (done) => {
      service.login(CREDENTIALS).subscribe((payload) => {
        expect(payload).toEqual(TOKEN_RESPONSE);
        done();
      });

      const req = http.expectOne(`${environment.gatewayBaseUrl}/auth/login`);
      req.flush(TOKEN_RESPONSE);
    });
  });

  // ── logout() ─────────────────────────────────────────────

  describe('logout()', () => {
    beforeEach(() => {
      // Pré-autentica
      service.login(CREDENTIALS).subscribe();
      const req = http.expectOne(`${environment.gatewayBaseUrl}/auth/login`);
      req.flush(TOKEN_RESPONSE);
    });

    it('deve limpar o token', () => {
      service.logout();
      expect(service.getToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('deve navegar para /login', () => {
      service.logout();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  // ── getToken() ────────────────────────────────────────────

  describe('getToken()', () => {
    it('deve retornar null antes do login', () => {
      expect(service.getToken()).toBeNull();
    });

    it('deve retornar o token após login bem-sucedido', () => {
      service.login(CREDENTIALS).subscribe();
      http.expectOne(`${environment.gatewayBaseUrl}/auth/login`).flush(TOKEN_RESPONSE);

      expect(service.getToken()).toBe(TOKEN_RESPONSE.token);
    });
  });

  // ── userId computed ───────────────────────────────────────

  describe('userId', () => {
    it('deve retornar null quando não autenticado', () => {
      expect(service.userId()).toBeNull();
    });

    it('deve extrair userId do payload JWT após login', () => {
      // JWT com payload { userId: 'user-abc', tenantId: 'tenant-1' }
      const payload = btoa(JSON.stringify({ userId: 'user-abc', tenantId: 'tenant-1' }));
      const jwtWithUserId = `header.${payload}.signature`;

      service.login(CREDENTIALS).subscribe();
      http.expectOne(`${environment.gatewayBaseUrl}/auth/login`).flush({
        token: jwtWithUserId,
        expiresIn: 3600,
      });

      expect(service.userId()).toBe('user-abc');
    });

    it('deve retornar null quando payload não tem userId', () => {
      const payload = btoa(JSON.stringify({ tenantId: 'tenant-1' }));
      const jwtWithoutUserId = `header.${payload}.signature`;

      service.login(CREDENTIALS).subscribe();
      http.expectOne(`${environment.gatewayBaseUrl}/auth/login`).flush({
        token: jwtWithoutUserId,
        expiresIn: 3600,
      });

      expect(service.userId()).toBeNull();
    });

    it('deve retornar null quando token é malformado (sem payload base64 válido)', () => {
      service.login(CREDENTIALS).subscribe();
      http.expectOne(`${environment.gatewayBaseUrl}/auth/login`).flush({
        token: 'token-invalido-sem-pontos',
        expiresIn: 3600,
      });

      expect(service.userId()).toBeNull();
    });
  });
});
