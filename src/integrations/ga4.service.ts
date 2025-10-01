import { Injectable } from '@nestjs/common';

@Injectable()
export class Ga4Service {
  async connectOAuth() {
    return { connected: true, provider: 'GA4' };
  }

  /**
   * Consulta GA4 para obtener eventCount por eventName en el rango de días indicado.
   * Si falta propertyId o accessToken, devuelve 0 para todos.
   */
  async verifyEvents(
    accessToken: string | null | undefined,
    propertyId: string | null | undefined,
    eventNames: string[],
    days: number = 7,
  ) {
    const safeNames = Array.from(new Set(eventNames.filter(Boolean)));
    if (!propertyId || !accessToken || safeNames.length === 0) {
      return {
        propertyId: propertyId || null,
        results: safeNames.map((name) => ({ name, eventCount: 0 })),
        skipped: true,
        reason: !propertyId ? 'missing-property' : !accessToken ? 'missing-token' : 'no-events',
      } as any;
    }

    // Construir payload del reporte
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - Math.max(1, days - 1));

    const body = {
      dateRanges: [
        {
          startDate: start.toISOString().slice(0, 10),
          endDate: today.toISOString().slice(0, 10),
        },
      ],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: safeNames },
        },
      },
      keepEmptyRows: true,
      limit: 1000,
    } as any;

    // Normalizar propertyId: aceptar "properties/123" o solo el número
    let pid = String(propertyId);
    if (pid.startsWith('properties/')) {
      pid = pid.replace(/^properties\//, '');
    }
    const digits = pid.match(/\d{4,}/)?.[0] || pid;
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(digits)}:runReport`;

    try {
      const f: any = (globalThis as any).fetch;
      if (typeof f !== 'function') {
        return {
          propertyId,
          results: safeNames.map((name) => ({ name, eventCount: 0 })),
          error: 'no-fetch-runtime',
        } as any;
      }
      const resp = await f(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        // Si falla (401, 403, etc.), devolver ceros, evitando falsos positivos
        return {
          propertyId,
          results: safeNames.map((name) => ({ name, eventCount: 0 })),
          error: `ga4_http_${resp.status}`,
        } as any;
      }
      const data = (await resp.json()) as any;
      const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
      const map = new Map<string, number>();
      for (const n of safeNames) map.set(n, 0);
      for (const r of rows) {
        const dim = Array.isArray(r.dimensionValues) ? r.dimensionValues[0]?.value : undefined;
        const metRaw = Array.isArray(r.metricValues) ? r.metricValues[0]?.value : undefined;
        const count = metRaw ? Number(metRaw) : 0;
        if (dim && map.has(dim)) map.set(dim, Number.isFinite(count) ? count : 0);
      }
      const results = safeNames.map((name) => ({ name, eventCount: map.get(name) || 0 }));
      return { propertyId, results };
    } catch (err: any) {
      // Fallback a ceros ante errores de red/parsing
      return {
        propertyId,
        results: safeNames.map((name) => ({ name, eventCount: 0 })),
        error: 'ga4_fetch_error',
        message: err?.message,
      } as any;
    }
  }
}
