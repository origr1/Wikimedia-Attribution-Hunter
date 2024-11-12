import { program } from 'commander';
import processImages from './helpers/attribution.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup command-line options
program
    .option('--file <path>', 'Input CSV or XLSX file')
    .option('--newfile', 'Create a new file with updated records')
    .option('--update', 'Update the existing file with new attributions')
    .option('--limit <number>', 'Limit the number of records processed', parseInt)
    .option('--offset <number>', 'Offset the number of records processed', parseInt)
    .option('--labelColumn <name>', 'Specify the label column (e.g., AlternateName)', 'label')
    .parse(process.argv);

const options = program.opts();

if (!options.file) {
    console.error('Error: No input file provided. Use --file to specify the CSV or XLSX file.');
    process.exit(1);
}

// Run the process
processImages(options).catch(console.error);
