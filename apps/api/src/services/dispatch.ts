import type { Config } from '../config.ts';

/**
 * Pede ao GitHub Actions que gere e publique novamente o site estático
 * (evento repository_dispatch "content-updated"). Opcional: sem token, apenas retorna false.
 */
export async function requestSiteRebuild(cfg: Config, reason: string): Promise<boolean> {
  if (!cfg.GITHUB_DISPATCH_TOKEN || !cfg.GITHUB_REPOSITORY) return false;
  try {
    const res = await fetch(`https://api.github.com/repos/${cfg.GITHUB_REPOSITORY}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.GITHUB_DISPATCH_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'project-gta-iv-api',
      },
      body: JSON.stringify({ event_type: 'content-updated', client_payload: { reason: reason.slice(0, 100) } }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.status === 204;
  } catch {
    return false;
  }
}
