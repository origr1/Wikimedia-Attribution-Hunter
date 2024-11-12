import { readFileAndProcess, writeFile } from './file-utils.js';
import { findCommonsUrlsOnGoogle, getAttributionValue } from './puppeteer-utils.js';
import { isExactMatch, downloadImage } from './image-utils.js';
import pLimit from 'p-limit';
import fs from 'fs';

async function processImages(options) {
    const { originalData, imageUrls } = await readFileAndProcess(options);

    if (imageUrls.length === 0) {
        console.log('No records require updates.');
        return;
    }

    console.log(`Processing ${imageUrls.length} records...`);

    const limitConcurrency = pLimit(5);

    const results = await Promise.all(
        imageUrls.map((entry) =>
            limitConcurrency(async () => {
                return await fetchAttribution(entry);
            })
        )
    );

    if (options.update) {
        console.log('Updating the original file with new attributions...');
        
        // Update the original file with the new results
        const updatedData = originalData.map(row => {
            const rowImageUrl = row['Image URL'] || row['image_url'];
            const result = results.find(res => res.image_url === rowImageUrl);
            if (result) {
                return { ...row, Attribution: result.attribution, 'Wikimedia Commons URL': result.commons_url };
            }
            return row;
        });

        // Write back to CSV or XLSX as required
        await writeFile(updatedData, options.file);
    } else if (options.newfile) {
        console.log('Creating a new file with records...');
        await writeFile(results, 'output_with_credits.csv');
    }
}

async function fetchAttribution({ image_url, label, commons_url, attribution }) {
    let originalImagePath;
    const maxAttempts = 3;
    let attemptCount = 0;

    try {
        originalImagePath = await downloadImage(image_url, 'original_image');
        if (!originalImagePath) {
            console.log("Failed to download the original image.");
            return { image_url, label, commons_url: null, attribution: null };
        }

        // Get all potential Wikimedia URLs from Google search
        const commonsUrls = commons_url ? [commons_url] : await findCommonsUrlsOnGoogle(image_url);


        for (const currentUrl of commonsUrls.slice(0, maxAttempts)) {
            console.log(`Attempt ${++attemptCount}: Trying Wikimedia link: ${currentUrl}`);


            // Validate the match by comparing image hashes
            const isMatch = await isExactMatch(originalImagePath, currentUrl);
            if (isMatch) {
                console.log(`Match found for ${image_url} with ${currentUrl}.`);
                const attributionValue = await getAttributionValue(currentUrl, image_url, label);
                return {
                    image_url,
                    label,
                    commons_url: currentUrl,
                    attribution: attributionValue
                };
            } else {
                console.log(`Match validation failed for ${image_url} with ${currentUrl}.`);
            }

        }

        console.log(`No matching Wikimedia link found for ${image_url} after ${maxAttempts} attempts.`);
        return { image_url, label, commons_url: null, attribution: null };
    } catch (error) {
        console.error("Error during attribution fetching process:", error);
        return { image_url, label, commons_url: null, attribution: null };
    } finally {
        if (originalImagePath && fs.existsSync(originalImagePath)) fs.unlinkSync(originalImagePath);
    }
}

export default processImages;
