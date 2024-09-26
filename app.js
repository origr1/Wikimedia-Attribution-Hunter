import puppeteer from 'puppeteer';
import fs from 'fs';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import pLimit from 'p-limit';

// Get filename, mode, and limit from command-line arguments
const inputFile = process.argv[2];
const outputMode = process.argv[3]; // either "--update" or "--newfile"
const limitRecords = parseInt(process.argv[4]) || 10; // Limit the number of records to process

if (!inputFile || !outputMode) {
  console.error('Usage: node app.js <input-file.csv> <--update|--newfile> [limit]');
  process.exit(1);
}

const outputFile = outputMode === '--update' ? inputFile : 'new_output_file.csv';

// CSV Writer setup for new file or for updating the same file
const csvWriter = createObjectCsvWriter({
  path: outputFile,
  header: [
    { id: 'image_url', title: 'Image URL' },
    { id: 'hebrew_name', title: 'HebrewName' },
    { id: 'commons_url', title: 'Wikimedia Commons URL' },
    { id: 'credit_source', title: 'credit_source' },
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
async function fetchAttribution(imageUrl, hebrewName, credit_source, commonsUrl, existingAttribution) {
  if (existingAttribution) {
    console.log(`Skipping image URL (attribution already exists): ${imageUrl}`);
    return { image_url: imageUrl, hebrew_name: hebrewName, commons_url: commonsUrl, credit_source, attribution: existingAttribution };
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
      return { image_url: imageUrl, hebrew_name: hebrewName, commons_url: commonsUrl, credit_source, attribution: null };
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
            return { image_url: imageUrl, hebrew_name: hebrewName, commons_url: commonsUrl, credit_source, attribution: attributionValue };
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
  return { image_url: imageUrl, hebrew_name: hebrewName, commons_url: commonsUrl, credit_source, attribution: null };
}

// Function to process the input CSV and fetch attribution in parallel with a limit
async function processImages() {
  const imageUrls = [];
  const originalData = [];

  // Read the CSV file and push only those with missing Attribution, up to the defined limit
  let recordCount = 0;
  fs.createReadStream(inputFile)
    .pipe(csvParser())
    .on('data', (row) => {
      originalData.push(row); // Collect all original data
      if (recordCount < limitRecords) {
        imageUrls.push({
          image_url: row['Image URL'] || row['image_url'],
          hebrew_name: row.HebrewName,
          credit_source: row.credit_source || null,
          commons_url: row['Wikimedia Commons URL'] || null,
          attribution: row.Attribution || null
        });
        recordCount++;
      }
    })
    .on('end', async () => {
      console.log(`CSV processed. Found ${recordCount} records to process. Starting Puppeteer...`);

      if (imageUrls.length === 0) {
        console.log('No records require updates.');
        return;
      }

      // Limit the number of concurrent fetches
      const limit = pLimit(5);
      
      // Process the images in parallel, limiting to 5 at a time
      const results = await Promise.all(
        imageUrls.map((entry) => 
          limit(async () => {
            return await fetchAttribution(entry.image_url, entry.hebrew_name, entry.credit_source, entry.commons_url, entry.attribution);
          })
        )
      );

      if (outputMode === '--update') {
        // Update the original file
        const updatedData = originalData.map(row => {
          // Find the updated record for each row
          const result = results.find(res => res.image_url === row['Image URL']);
          if (result) {
            return { ...row, Attribution: result.attribution, 'Wikimedia Commons URL': result.commons_url, credit_source: result.credit_source };
          }
          return row; // Keep original row if not updated
        });

        const updatedWriter = createObjectCsvWriter({
          path: inputFile,
          header: Object.keys(originalData[0]).map(key => ({ id: key, title: key }))
        });

        await updatedWriter.writeRecords(updatedData);
        console.log(`Results saved to ${outputFile}`);
      } else if (outputMode === '--newfile') {
        // Write all records (even those without attributions) to a new file
        await csvWriter.writeRecords(results);
        console.log(`All records (including missing attributions) saved to ${outputFile}`);
      }
    });
}

// Run the CSV processing
processImages();
