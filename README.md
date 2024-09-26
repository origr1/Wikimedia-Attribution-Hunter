# Credit Hunter - Wikimedia Attribution Finder

This open-source tool automates the process of finding attributions for images by searching Google Images and Wikimedia Commons. It reads input from a CSV, processes image URLs, and either updates missing attributions or writes them to a new file.

## Features
- Process images from a CSV file.
- Automatically fetch attributions and Wikimedia Commons links.
- Update the original CSV file or create a new file with updated records.
- Limits concurrent processing to avoid overload.

## Usage

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the script:
   ```bash
   node app.js <input-file.csv> <--update|--newfile> [limit]
   ```

   Example:
   ```bash
   node app.js images.csv --update 10
   ```

## License
Licensed under the MIT License.
