// ============================================================
// synthetic-auth.connector.ts
//
// Implementação de IAuthLoginConnector que emite um token fixo
// sem chamar o Protheus real. Ativada via PROTHEUS_MODE=synthetic
// — usada no piloto sandbox Target Flex. O login de usuário do
// governa-core não depende deste conector (auth própria, E7);
// este endpoint só existe para completude do contrato do gateway.
// ============================================================

import { IAuthLoginConnector, LoginParams, LoginResult } from '../auth/auth-login.connector'

export class SyntheticAuthConnector implements IAuthLoginConnector {
  async execute(_params: LoginParams): Promise<LoginResult> {
    return { token: 'synthetic-sandbox-token', expiresIn: 3600 }
  }
}
