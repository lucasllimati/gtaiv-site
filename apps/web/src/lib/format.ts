const TZ = 'America/Sao_Paulo';

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' }): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: TZ, ...opts });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatMoney(cents: number, currency = 'BRL'): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });
}

export function relativeDays(iso: string, now = new Date()): string {
  const days = Math.round((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return formatDate(iso);
}

/** Dias inteiros até uma data (no fuso de São Paulo). Negativo se já passou. */
export function daysUntil(isoDate: string, now = new Date()): number {
  const target = Date.parse(`${isoDate}T00:00:00-03:00`);
  const today = new Date(now.toLocaleDateString('en-CA', { timeZone: TZ }) + 'T00:00:00-03:00').getTime();
  return Math.round((target - today) / 86_400_000);
}

const MONTHS: Record<string, string> = {
  janeiro: '01', fevereiro: '02', março: '03', marco: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

/** Extrai uma data ISO de textos como "19 de novembro de 2026" (fato configurado no painel). */
export function parsePtDate(text: string): string | null {
  const m = /(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i.exec(text);
  if (!m) return null;
  const month = MONTHS[m[2]!.toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1]!.padStart(2, '0')}`;
}
