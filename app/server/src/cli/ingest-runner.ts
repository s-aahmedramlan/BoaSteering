import 'dotenv/config';
import { ingest } from './ingest';

const dirPath = process.argv[2];
if (!dirPath) {
  console.error('Usage: boa-ingest <directory>');
  process.exit(1);
}

ingest(dirPath)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
