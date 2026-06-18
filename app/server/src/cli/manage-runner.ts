import 'dotenv/config';
import { listFacts, deleteFact, verifyFact } from './manage';

const [,, command, id] = process.argv;

async function main() {
  if (command === 'list') await listFacts();
  else if (command === 'delete' && id) await deleteFact(id);
  else if (command === 'verify' && id) await verifyFact(id);
  else {
    console.log('Usage:');
    console.log('  npm run boa list');
    console.log('  npm run boa delete <id>');
    console.log('  npm run boa verify <id>');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
