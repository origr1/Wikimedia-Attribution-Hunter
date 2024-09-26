# Image Attribution Finder

This script helps automate the process of finding attribution information for images from the Wikimedia Commons and other sources by searching Google Images using URLs from a CSV file. The tool can either update missing attributions in an existing CSV file or generate a new CSV file with the fetched attributions.

## Features
- Process image URLs from a CSV file.
- Automatically search Google Images for Wikimedia Commons links.
- Extract and insert attribution details.
- Supports both updating an existing CSV file and generating a new file with missing or updated attribution information.
- Limits the number of records processed at once for large datasets.

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/your-username/image-attribution-finder.git
    cd image-attribution-finder
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

## CSV File Format

The CSV file should contain the following fields:
- `image_url`: The URL of the image that needs attribution.
- `HebrewName` (optional): The Hebrew name associated with the image (can be replaced with any other relevant label).
- `commons_url` (optional): The Wikimedia Commons URL, if already available.
- `attribution` (optional): The attribution text, if available.

### Example:

| image_url                          | HebrewName     | commons_url                                     | attribution                  |
| ----------------------------------- | -------------- | ----------------------------------------------- | ---------------------------- |
| https://example.com/image1.jpg      | Some Name      |                                                 |                              |
| https://example.com/image2.jpg      | Another Name   | https://commons.wikimedia.org/wiki/File:Image2  | Attribution text             |

## Usage

Run the script with the following command:

```bash
node app.js <input-file.csv> <--update|--newfile> [limit]
```

To update missing attributions in the same file and limit to 20 top images:

```bash
node app.js <input-file.csv> --update 20
```

To generate a new file with only the updated records limit to 10 top images:

```bash
node app.js <input-file.csv> --newfile 10
```

## Contribution

Feel free to fork this project and make improvements! Pull requests are welcome.

## License

Licensed under the MIT License.
