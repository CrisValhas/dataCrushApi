import { Injectable } from '@nestjs/common';

@Injectable()
export class TokensService {
  // Stub for refresh token rotation / revocation lists
  async revokeRefreshToken(_userId: string) {
    return { ok: true };
  }
}
