/**
 * Verificação simples de robots.txt (grupos User-agent, Allow/Disallow com prefixo e curingas "*" e "$").
 * Em caso de dúvida (arquivo inacessível com 5xx), a coleta daquela fonte é adiada.
 */

export const USER_AGENT = 'ProjectGTAIVBot/0.1 (+https://github.com/lucasllimati/gtaiv-site)';
const UA_TOKEN = 'projectgtaivbot';

interface Rule {
  allow: boolean;
  pattern: string;
}

export function parseRobots(body: string): Map<string, Rule[]> {
  const groups = new Map<string, Rule[]>();
  let agents: string[] = [];
  let lastWasAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) agents = [];
      agents.push(value.toLowerCase());
      for (const a of agents) if (!groups.has(a)) groups.set(a, []);
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'allow' || key === 'disallow') {
      for (const a of agents) groups.get(a)!.push({ allow: key === 'allow', pattern: value });
    }
  }
  return groups;
}

function matches(pattern: string, path: string): number {
  if (!pattern) return -1;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp('^' + body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''));
  return re.test(path) ? body.length : -1;
}

/** Retorna true se o caminho pode ser acessado pelo nosso agente. A regra mais específica vence. */
export function isAllowed(groups: Map<string, Rule[]>, path: string): boolean {
  const rules = [...groups.entries()].find(([a]) => a !== '*' && UA_TOKEN.includes(a))?.[1] ?? groups.get('*') ?? [];
  let best: Rule | null = null;
  let bestLen = -1;
  for (const r of rules) {
    const len = matches(r.pattern, path);
    if (len > bestLen || (len === bestLen && r.allow)) {
      best = r;
      bestLen = len;
    }
  }
  return !best || best.allow || bestLen < 0;
}

const cache = new Map<string, { at: number; groups: Map<string, Rule[]> | 'deny' }>();

export async function robotsAllows(url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const u = new URL(url);
  const origin = u.origin;
  const cached = cache.get(origin);
  let groups = cached && Date.now() - cached.at < 6 * 3_600_000 ? cached.groups : undefined;
  if (!groups) {
    try {
      const res = await fetchImpl(`${origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000), redirect: 'follow' });
      if (res.status >= 500) groups = 'deny';
      else if (!res.ok) groups = new Map(); // 4xx: sem restrições declaradas
      else groups = parseRobots((await res.text()).slice(0, 500_000));
    } catch {
      groups = 'deny';
    }
    cache.set(origin, { at: Date.now(), groups });
  }
  if (groups === 'deny') return false;
  return isAllowed(groups, u.pathname + u.search);
}

export function clearRobotsCache(): void {
  cache.clear();
}
