import { execSync } from 'child_process';

const cache = new Map<string, string>();

export async function detectRepo(cwd?: string): Promise<string> {
  const dir = cwd ?? process.cwd();

  if (cache.has(dir)) {
    return cache.get(dir)!;
  }

  let result = '';
  try {
    const raw = execSync('git remote get-url origin', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    result = normalizeRemoteUrl(raw);
  } catch {
    // Not a git repo or no origin remote — return '' silently
  }

  cache.set(dir, result);
  return result;
}

function normalizeRemoteUrl(url: string): string {
  // SSH: git@github.com:org/repo.git -> org/repo
  const sshMatch = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];

  // HTTPS: https://github.com/org/repo.git -> org/repo
  const httpsMatch = url.match(/^https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  // Already plain or unrecognised — strip trailing .git
  return url.replace(/\.git$/, '');
}
