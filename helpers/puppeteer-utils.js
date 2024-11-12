import { downloadImage } from './image-utils.js';
import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

export async function findCommonsUrlsOnGoogle(imageUrl) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en'
        });
        await page.goto('https://images.google.com/?hl=en');
        await page.waitForSelector('div[aria-label="Search by image"]', { timeout: 20000 });
        console.log("Google Images page loaded.");

        // Click the 'Search by image' button
        await page.click('div[aria-label="Search by image"]');
        await page.waitForTimeout(3000);

        // Enter the image URL into the search field
        const [urlInput] = await page.$x('/html/body/div[1]/div[3]/form/div[1]/div[1]/div[3]/c-wiz/div[2]/div/div[3]/div[2]/c-wiz/div[2]/input');
        if (urlInput) {
            await urlInput.type(imageUrl);
            await urlInput.press('Enter');
            console.log(`Image URL pasted: ${imageUrl}`);
        } else {
            console.error("Image URL input field not found!");
            return null;
        }

        // Wait for search results to load and look for a Wikimedia Commons link
        await page.waitForTimeout(5000);
        const commonsLinks = await page.$$eval('a[href*="commons.wikimedia.org"]', links =>
            links.map(link => link.href)
        );

        console.log(`Found ${commonsLinks.length} Wikimedia links.`);
        return commonsLinks;
    } catch (error) {
        console.error('Error during Google Image search:', error);
        await browser.close();
        return null;
    } finally {
        await browser.close();
    }
}

export async function fetchImageFromWikimedia(commonsUrl, baseFilename) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Go to the Wikimedia Commons page
        await page.goto(commonsUrl, { waitUntil: 'domcontentloaded' });

        // Find the link to the full-resolution image
        const imageUrl = await page.evaluate(() => {
            const imgLink = document.querySelector('.fullImageLink a');
            return imgLink ? imgLink.href : null;
        });

        await browser.close();

        if (!imageUrl) {
            console.error('Could not find the direct image link on the Wikimedia page.');
            return null;
        }

        // Download the image from the actual image URL
        const uniqueFilename = `${baseFilename}-${uuidv4()}.jpg`;
        return await downloadImage(imageUrl, uniqueFilename);

    } catch (error) {
        console.error('Error fetching image from Wikimedia Commons:', error);
        await browser.close();
        return null;
    } finally {
        await browser.close();
    }
}

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

// Retrieve attribution value from the Wikimedia Commons page
export async function getAttributionValue(commonsUrl, imageUrl, label) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--lang=en-GB', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en' });

    try {
        await page.goto(commonsUrl, { waitUntil: 'domcontentloaded' });
        console.log("Wikimedia Commons page loaded.");

        for (let attempt = 1; attempt <= 3; attempt++) {
            const useFileButton = await page.$x("//a[following-sibling::small[text()='on the web']]");
            if (useFileButton.length > 0) {
                console.log("'Use this file' button found, attempting to click.");
                const clicked = await retryClick(useFileButton[0], page);
                if (clicked) {
                    console.log("'Use this file' button clicked.");
                    await page.waitForTimeout(3000);

                    const attributionInput = await page.$$('input[type="text"]');
                    if (attributionInput && attributionInput.length >= 4) {
                        const attributionValue = await page.evaluate(el => el.value, attributionInput[3]);
                        console.log(`Attribution value: ${attributionValue}`);
                        await browser.close();
                        return attributionValue
                    } else {
                        console.log("Attribution input field not found.");
                    }
                } else {
                    console.log("Failed to click 'Use this file' button.");
                }
                break;
            } else {
                console.log(`'Use this file' button not found on attempt ${attempt}. Retrying...`);
                await page.waitForTimeout(2000);
            }
        }
    } catch (error) {
        console.error("Error retrieving attribution value:", error);
    } finally {
        await browser.close();
    }
    return null;
}