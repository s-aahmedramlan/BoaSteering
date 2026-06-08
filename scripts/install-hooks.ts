// ts-node: --project tsconfig.scripts.json
import * as fs from 'fs';
import * as path from 'path';

function main(): void {
  const hooksDir = path.resolve(process.cwd(), '.git', 'hooks');

  if (!fs.existsSync(hooksDir)) {
    console.log('not a git repo');
    process.exit(1);
  }

  const hookPath = path.join(hooksDir, 'post-merge');
  const scriptPath = path.resolve(__dirname, '../scripts/post-merge.ts');
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.scripts.json');

  const hookContent = `#!/bin/sh\nnpx ts-node --project ${tsconfigPath} ${scriptPath}\n`;

  try {
    fs.writeFileSync(hookPath, hookContent, { encoding: 'utf8' });
    fs.chmodSync(hookPath, '755');
    console.log('[boa] post-merge hook installed at .git/hooks/post-merge');
  } catch (err) {
    console.error('[boa] failed to install hook:', err);
    process.exit(1);
  }
}

main();
