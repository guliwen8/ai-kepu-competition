import { Injectable } from '@nestjs/common';

type Key = string;

function labelEscape(v: string) {
  return v
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('"', '\\"');
}

function safePath(p: string) {
  const q = p.indexOf('?');
  const raw = q >= 0 ? p.slice(0, q) : p;
  const segs = raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  const masked = segs.map((s) => {
    const lower = s.toLowerCase();
    if (/^[0-9]+$/.test(s) && s.length >= 4) return ':id';
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        lower,
      )
    )
      return ':id';
    if (/^c[0-9a-z]{20,}$/.test(lower)) return ':id';
    if (/^[0-9a-z]{24,}$/.test(lower)) return ':id';
    return s;
  });
  const path = `/${masked.join('/')}`;
  if (path.length > 200) return path.slice(0, 200);
  return path;
}

@Injectable()
export class MetricsService {
  private readonly startedAtMs = Date.now();
  private readonly counts = new Map<Key, number>();

  observe(args: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
  }) {
    const method = args.method.toUpperCase();
    const path = safePath(args.path);
    const status = String(args.status);

    const inc = (k: Key, n = 1) =>
      this.counts.set(k, (this.counts.get(k) ?? 0) + n);

    inc(`requests_total|method=${method}|path=${path}|status=${status}`);
    inc(`requests_total|method=${method}|path=${path}|status=all`);
    inc(`requests_total|method=${method}|path=all|status=all`);

    if (args.status >= 500)
      inc(`requests_5xx_total|method=${method}|path=${path}`);

    const ms = Math.max(0, args.durationMs);
    inc(`request_duration_ms_sum|method=${method}|path=${path}`, ms);
    inc(`request_duration_ms_count|method=${method}|path=${path}`, 1);
  }

  observeDb(args: {
    model: string;
    action: string;
    durationMs: number;
    ok: boolean;
  }) {
    const model = args.model || 'unknown';
    const action = args.action || 'unknown';

    const inc = (k: Key, n = 1) =>
      this.counts.set(k, (this.counts.get(k) ?? 0) + n);

    inc(
      `db_queries_total|model=${model}|action=${action}|ok=${args.ok ? '1' : '0'}`,
    );
    inc(`db_queries_total|model=${model}|action=${action}|ok=all`);

    const ms = Math.max(0, args.durationMs);
    inc(`db_query_duration_ms_sum|model=${model}|action=${action}`, ms);
    inc(`db_query_duration_ms_count|model=${model}|action=${action}`, 1);

    if (ms >= 500) inc(`db_slow_queries_total|model=${model}|action=${action}`);
  }

  renderProm() {
    const lines: string[] = [];
    const now = Date.now();
    const up = Math.round((now - this.startedAtMs) / 1000);

    lines.push('# HELP api_uptime_seconds Process uptime seconds');
    lines.push('# TYPE api_uptime_seconds gauge');
    lines.push(`api_uptime_seconds ${up}`);

    lines.push('# HELP api_requests_total HTTP requests total');
    lines.push('# TYPE api_requests_total counter');

    for (const [k, v] of this.counts.entries()) {
      if (!k.startsWith('requests_total|')) continue;
      const parts = k.split('|').slice(1);
      const labels: Record<string, string> = {};
      for (const p of parts) {
        const idx = p.indexOf('=');
        if (idx <= 0) continue;
        labels[p.slice(0, idx)] = p.slice(idx + 1);
      }
      const labelStr = `{method="${labelEscape(labels.method ?? '')}",path="${labelEscape(labels.path ?? '')}",status="${labelEscape(labels.status ?? '')}"}`;
      lines.push(`api_requests_total${labelStr} ${v}`);
    }

    lines.push('# HELP api_requests_5xx_total HTTP 5xx requests total');
    lines.push('# TYPE api_requests_5xx_total counter');
    for (const [k, v] of this.counts.entries()) {
      if (!k.startsWith('requests_5xx_total|')) continue;
      const parts = k.split('|').slice(1);
      const labels: Record<string, string> = {};
      for (const p of parts) {
        const idx = p.indexOf('=');
        if (idx <= 0) continue;
        labels[p.slice(0, idx)] = p.slice(idx + 1);
      }
      const labelStr = `{method="${labelEscape(labels.method ?? '')}",path="${labelEscape(labels.path ?? '')}"}`;
      lines.push(`api_requests_5xx_total${labelStr} ${v}`);
    }

    lines.push('# HELP api_request_duration_ms Request duration (ms)');
    lines.push('# TYPE api_request_duration_ms summary');
    for (const [k, v] of this.counts.entries()) {
      if (!k.startsWith('request_duration_ms_sum|')) continue;
      const parts = k.split('|').slice(1);
      const labels: Record<string, string> = {};
      for (const p of parts) {
        const idx = p.indexOf('=');
        if (idx <= 0) continue;
        labels[p.slice(0, idx)] = p.slice(idx + 1);
      }
      const labelStr = `{method="${labelEscape(labels.method ?? '')}",path="${labelEscape(labels.path ?? '')}"}`;
      const count =
        this.counts.get(
          `request_duration_ms_count|method=${labels.method}|path=${labels.path}`,
        ) ?? 0;
      lines.push(`api_request_duration_ms_sum${labelStr} ${v}`);
      lines.push(`api_request_duration_ms_count${labelStr} ${count}`);
    }

    lines.push('# HELP api_db_queries_total DB queries total');
    lines.push('# TYPE api_db_queries_total counter');
    for (const [k, v] of this.counts.entries()) {
      if (!k.startsWith('db_queries_total|')) continue;
      const parts = k.split('|').slice(1);
      const labels: Record<string, string> = {};
      for (const p of parts) {
        const idx = p.indexOf('=');
        if (idx <= 0) continue;
        labels[p.slice(0, idx)] = p.slice(idx + 1);
      }
      const labelStr = `{model="${labelEscape(labels.model ?? '')}",action="${labelEscape(labels.action ?? '')}",ok="${labelEscape(labels.ok ?? '')}"}`;
      lines.push(`api_db_queries_total${labelStr} ${v}`);
    }

    lines.push('# HELP api_db_query_duration_ms DB query duration (ms)');
    lines.push('# TYPE api_db_query_duration_ms summary');
    for (const [k, v] of this.counts.entries()) {
      if (!k.startsWith('db_query_duration_ms_sum|')) continue;
      const parts = k.split('|').slice(1);
      const labels: Record<string, string> = {};
      for (const p of parts) {
        const idx = p.indexOf('=');
        if (idx <= 0) continue;
        labels[p.slice(0, idx)] = p.slice(idx + 1);
      }
      const labelStr = `{model="${labelEscape(labels.model ?? '')}",action="${labelEscape(labels.action ?? '')}"}`;
      const count =
        this.counts.get(
          `db_query_duration_ms_count|model=${labels.model}|action=${labels.action}`,
        ) ?? 0;
      lines.push(`api_db_query_duration_ms_sum${labelStr} ${v}`);
      lines.push(`api_db_query_duration_ms_count${labelStr} ${count}`);
    }

    lines.push(
      '# HELP api_db_slow_queries_total DB slow queries total (>=500ms)',
    );
    lines.push('# TYPE api_db_slow_queries_total counter');
    for (const [k, v] of this.counts.entries()) {
      if (!k.startsWith('db_slow_queries_total|')) continue;
      const parts = k.split('|').slice(1);
      const labels: Record<string, string> = {};
      for (const p of parts) {
        const idx = p.indexOf('=');
        if (idx <= 0) continue;
        labels[p.slice(0, idx)] = p.slice(idx + 1);
      }
      const labelStr = `{model="${labelEscape(labels.model ?? '')}",action="${labelEscape(labels.action ?? '')}"}`;
      lines.push(`api_db_slow_queries_total${labelStr} ${v}`);
    }

    return lines.join('\n') + '\n';
  }
}
