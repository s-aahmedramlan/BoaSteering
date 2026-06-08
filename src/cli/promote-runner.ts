import 'dotenv/config';
import { promoteFacts } from './promote';

const isGlobal = process.argv.includes('--global');
const repoRoot = process.argv.slice(2).find((a) => !a.startsWith('-'));

if (isGlobal) {
  console.log('Writing to ~/.claude/CLAUDE.md (global mode)');
}

promoteFacts(repoRoot, isGlobal).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
