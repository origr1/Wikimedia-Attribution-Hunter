import puppeteer from 'puppeteer';
import fs from 'fs';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import pLimit from 'p-limit';
import { program } from 'commander';

// Setup command-line options
program
    .option('--file <path>', 'Input CSV file')
    .option('--newfile', 'Create a new file with updated records')
    .option('--update', 'Update the existing file with new attributions')
    .option('--limit <number>', 'Limit the number of records processed', parseInt)
    .option('--offset <number>', 'Offset the number of records processed', parseInt)
    .option('--labelColumn <name>', 'Specify the label column (e.g., AlternateName)', 'label')
    .parse(process.argv);

const options = program.opts();
const inputCsvFile = options.file;
const outputCsvFile = options.newfile ? 'output_with_credits.csv' : inputCsvFile;
const limit = options.limit ? parseInt(options.limit, 10) : null;
const offset = options.offset ? parseInt(options.offset, 10) : 0;
const labelColumn = options.labelColumn || 'label';
const outputMode = options.update ? 'update' : 'newfile';

// // Get filename, mode, and limit from command-line arguments
// const inputFile = process.argv[2];
// const outputMode = process.argv[3]; // either "--update" or "--newfile"
// const limitRecords = parseInt(process.argv[4]) || 10; // Limit the number of records to process

if (options.update && options.newfile) {
    console.error('Error: You cannot use both --update and --newfile options simultaneously.');
    process.exit(1);
}

if (!options.file) {
    console.error('Error: No input file provided. Use --file to specify the CSV file.');
    process.exit(1);
}

// CSV Writer setup for new file or for updating the same file
const csvWriter = createObjectCsvWriter({
    path: outputCsvFile,
    header: [
        { id: 'image_url', title: 'Image URL' },
        { id: 'label', title: labelColumn },
        { id: 'commons_url', title: 'Wikimedia Commons URL' },
        { id: 'attribution', title: 'Attribution' }
    ]
});

// Retry logic for clicking with error handling
async function retryClick(element, page, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            await element.scrollIntoView();
            await element.click();
            return true;
        } catch (error) {
            console.log(`Retry ${attempt + 1}: Click failed, retrying...`);
            await page.waitForTimeout(2000);
        }
    }
    return false;
}

// Main function to process the image URL
async function fetchAttribution(imageUrl, label, commonsUrl, existingAttribution) {
    if (existingAttribution) {
        console.log(`Skipping image URL (attribution already exists): ${imageUrl}`);
        return { image_url: imageUrl, label, commons_url: commonsUrl, attribution: existingAttribution };
    }

    console.log(`Processing image URL: ${imageUrl}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--lang=en-GB', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();

    try {
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en'
        });
        await page.goto('https://images.google.com/?hl=en');
        await page.setDefaultTimeout(90000);
        await page.waitForSelector('div[aria-label="Search by image"]', { timeout: 20000 });
        console.log("Google Images page loaded.");

        await page.click('div[aria-label="Search by image"]');
        console.log("Clicked 'Search by image' button.");

        await page.waitForTimeout(3000);
        const [urlInput] = await page.$x('/html/body/div[1]/div[3]/form/div[1]/div[1]/div[3]/c-wiz/div[2]/div/div[3]/div[2]/c-wiz/div[2]/input');
        if (urlInput) {
            await urlInput.type(imageUrl);
            await urlInput.press('Enter');
            console.log(`Image URL pasted: ${imageUrl}`);
        } else {
            console.error("Image URL input field not found!");
            return { image_url: imageUrl, label, commons_url: commonsUrl, attribution: null };
        }

        await page.waitForTimeout(5000);

        const commonsLink = await page.$('a[href*="commons.wikimedia.org"]');
        if (commonsLink) {
            commonsUrl = await page.evaluate(el => el.href, commonsLink);
            console.log(`Found Wikimedia link: ${commonsUrl}`);
            await commonsLink.click();

            await page.waitForTimeout(3000);
            const pages = await browser.pages();
            const newTab = pages[pages.length - 1];
            await newTab.bringToFront();
            await newTab.waitForSelector('h1.firstHeading', { timeout: 60000 });
            console.log("Wikimedia Commons page loaded.");

            const useFileButton = await newTab.$x("//a[following-sibling::small[text()='on the web']]");
            if (useFileButton.length > 0) {
                console.log("'Use this file' button found, attempting to click.");
                const clicked = await retryClick(useFileButton[0], newTab);
                if (clicked) {
                    console.log("'Use this file' button clicked.");
                    await newTab.waitForTimeout(3000);

                    const attributionInput = await newTab.$$('input[type="text"]');
                    if (attributionInput && attributionInput.length >= 4) {
                        const attributionValue = await newTab.evaluate(el => el.value, attributionInput[3]);
                        console.log(`Attribution value: ${attributionValue}`);
                        await browser.close();
                        return { image_url: imageUrl, label, commons_url: commonsUrl, attribution: attributionValue };
                    } else {
                        console.log("Attribution input field not found.");
                    }
                } else {
                    console.log("Failed to click 'Use this file' button.");
                }
            } else {
                console.log("'Use this file' button not found.");
            }
        } else {
            console.log('No Wikimedia Commons link found for this image.');
        }
    } catch (error) {
        if (error.message.includes('ProtocolError')) {
            console.error('Error: ProtocolError encountered. Retrying...');
        } else {
            console.error('Error:', error);
        }
    } finally {
        await browser.close();
    }
    return { image_url: imageUrl, label, commons_url: commonsUrl, attribution: null };
}

// Function to process the input CSV and fetch attribution in parallel with a limit
async function processImages() {
    const imageUrls = [];
    const originalData = [];

    // Read the CSV file and push only those with missing Attribution, up to the defined limit
    let recordCount = 0;
    fs.createReadStream(inputCsvFile)
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
        .on('end', async () => {
            console.log(`CSV processed. Found ${recordCount} records to process. Starting Puppeteer...`);

            if (imageUrls.length === 0) {
                console.log('No records require updates.');
                return;
            }

            // Limit the number of concurrent fetches
            const limitConcurrency = pLimit(5);

            // Process the images in parallel, limiting to 5 at a time
            const results = await Promise.all(
                imageUrls.map((entry) =>
                    limitConcurrency(async () => {
                        return await fetchAttribution(entry.image_url, entry.label, entry.commons_url, entry.attribution);
                    })
                )
            );

            if (outputMode === 'update') {
                // Update the original file
                const updatedData = originalData.map(row => {
                    // Find the updated record for each row
                    const result = results.find(res => res.image_url === row['Image URL']);
                    if (result) {
                        return { ...row, Attribution: result.attribution, 'Wikimedia Commons URL': result.commons_url };
                    }
                    return row; // Keep original row if not updated
                });

                const updatedWriter = createObjectCsvWriter({
                    path: inputCsvFile,
                    header: Object.keys(originalData[0]).map(key => ({ id: key, title: key }))
                });

                await updatedWriter.writeRecords(updatedData);
                console.log(`Results saved to ${outputCsvFile}`);
            } else if (outputMode === 'newfile') {
                // Write all records (even those without attributions) to a new file
                await csvWriter.writeRecords(results);
                console.log(`All records (including missing attributions) saved to ${outputCsvFile}`);
            }
        });
}

// Run the CSV processing
processImages();
