# Wikimedia Attribution Hunter

This script helps automate the process of finding attribution information for images from the Wikimedia Commons by searching Google Images using URLs from a CSV file. The tool can either update missing attributions in an existing CSV file or generate a new CSV file with the fetched attributions.

## Features
- Process image URLs from a CSV file.
- Automatically search Google Images for Wikimedia Commons links.
- Extract and insert attribution details.
- Supports both updating an existing CSV file and generating a new file with fetched attributions.
- Allows user-defined limits on the number of records processed at once for large datasets.
- Supports custom label columns to replace the default HebrewName with any other relevant label (optional).
- Ability to offset the start point of processing from the CSV file.
- Options to either update the same file or save missing attributions to a new file.


## Installation

1. Clone the repository:
    ```bash
    git clone git@github.com:origr1/Wikimedia-Attribution-Hunter.git
    cd Wikimedia-Attribution-Hunter
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

## CSV File Format

The CSV file should contain the following fields:
- `image_url`: The URL of the image that needs attribution.
- `label` (optional): Any label associated with the image. The column name can be configured, e.g., AlternateName, etc.
- `commons_url` (optional): The Wikimedia Commons URL, if already available.
- `attribution` (optional): The attribution text, if available.

### Example:

| image_url                          | label     | commons_url                                     | attribution                  |
| ----------------------------------- | -------------- | ----------------------------------------------- | ---------------------------- |
| https://example.com/image1.jpg      | Some Name      |                                                 |                              |
| https://example.com/image2.jpg      | Another Name   | https://commons.wikimedia.org/wiki/File:Image2  | Attribution text             |

## Usage

Run the script with the following command:

```bash
node app.js --file <input-file.csv> [--update|--newfile] [--limit <number>] [--offset <number>] [--labelColumn <name>]
```

### Options:
- `--file`: Specifies the input CSV file.
- `--update`: Updates the existing CSV file by adding the missing attribution and Wikimedia Commons links.
- `--newfile`: Creates a new CSV file with updated attributions.
- `--limit <number>`: Limits the number of records processed (optional).
- `--offset <number>`: Offsets the starting point of the record processing (optional).
- `--labelColumn <name>`: Specifies the label column name in the CSV (defaults to label).

### Examples:
Update the existing CSV file, processing only 20 images starting from record 0:

```bash
node app.js --file images.csv --update --limit 20
```

Create a new CSV file with updated attributions, but only for the first 10 images:

```bash
node app.js --file images.csv --newfile --limit 10
```

Process a specific range from an offset of 10, processing the next 30 images:

```bash
node app.js --file images.csv --update --limit 30 --offset 10
```

Change the label column to AlternateName instead of the default label:
```bash
node app.js --file images.csv --update --labelColumn AlternateName
```

## Notes:
- When using the `--update` option, the script will preserve all existing records and only update the missing `attribution` or `commons_url` fields. It won't overwrite existing values.
- If no limit is specified, the script processes all records from the CSV.
- Both `--update` and `--newfile` options cannot be used simultaneously. If both are provided, the script will exit with an error.

## Contribution

Feel free to fork this project and make improvements! Pull requests are welcome.

## License

Licensed under the MIT License.
