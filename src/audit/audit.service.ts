import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  async log(_actorId: string, _action: string, _target: string, _meta?: any) {
    // TODO: persist in AuditLog collection
    return { ok: true };
  }
}
