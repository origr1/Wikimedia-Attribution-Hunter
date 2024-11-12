import fs from 'fs';
import csvParser from 'csv-parser';
import xlsx from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';

export async function readFileAndProcess(options) {
    const fileExtension = options.file.split('.').pop().toLowerCase();
    const imageUrls = [];
    const originalData = [];
    const offset = options.offset || 0;
    const limit = options.limit;
    const labelColumn = options.labelColumn || 'label';
    let recordCount = 0;

    if (fileExtension === 'csv') {
        // Process CSV file
        return new Promise((resolve) => {
            fs.createReadStream(options.file)
                .pipe(csvParser())
                .on('data', (row) => {
                    originalData.push(row); // Collect all original data

                    if (recordCount >= offset && (!limit || recordCount < offset + limit)) {
                        imageUrls.push({
                            image_url: row['Image URL'] || row['image_url'],
                            label: row[labelColumn] || null,
                            commons_url: row['Wikimedia Commons URL'] || null,
                            attribution: row.Attribution || null
                        });
                    }
                    recordCount++;
                })
                .on('end', () => {
                    resolve({ originalData, imageUrls });
                });
        });
    } else if (fileExtension === 'xlsx') {
        // Process XLSX file
        const workbook = xlsx.readFile(options.file);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);

        jsonData.forEach((row, index) => {
            originalData.push(row); // Collect all original data

            if (index >= offset && (!limit || index < offset + limit)) {
                imageUrls.push({
                    image_url: row['Image URL'] || row['image_url'],
                    label: row[labelColumn] || null,
                    commons_url: row['Wikimedia Commons URL'] || null,
                    attribution: row.Attribution || null
                });
            }
        });

        return { originalData, imageUrls };
    } else {
        throw new Error('Unsupported file format. Please provide a .csv or .xlsx file.');
    }
}

export async function writeFile(data, filePath) {
    console.log(`Writing ${data.length} records to ${filePath}...`);
    const fileExtension = filePath.split('.').pop().toLowerCase();
    if (fileExtension === 'csv') {
        const csvWriter = createObjectCsvWriter({
            path: filePath,
            header: Object.keys(data[0]).map(key => ({ id: key, title: key }))
        });
        await csvWriter.writeRecords(data);
    } else if (fileExtension === 'xlsx') {
        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        xlsx.writeFile(workbook, filePath);
    }
}
