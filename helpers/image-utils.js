import imghash from 'imghash';
import { fileTypeFromFile } from 'file-type';
import { fetchImageFromWikimedia } from './puppeteer-utils.js';
import axios from 'axios';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export async function downloadImage(url, baseFilename = 'image') {
    const uniqueFilename = `${baseFilename}-${uuidv4()}.jpg`;
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(uniqueFilename, response.data);
        console.log(`Image downloaded to ${uniqueFilename}`);
        return uniqueFilename;
    } catch (error) {
        return null;
    }
}

export async function getImageHash(imagePath) {
    const fileType = await fileTypeFromFile(imagePath);
    if (!fileType || !fileType.mime.startsWith('image/')) return null;

    try {
        return await imghash.hash(imagePath);
    } catch {
        return null;
    }
}

export async function isExactMatch(originalImagePath, commonsUrl) {
    const commonsImagePath = await fetchImageFromWikimedia(commonsUrl, 'commons_image');
    if (!commonsImagePath) return false;

    const originalHash = await getImageHash(originalImagePath);
    const commonsHash = await getImageHash(commonsImagePath);

    fs.unlinkSync(commonsImagePath);

    return originalHash === commonsHash;
}
