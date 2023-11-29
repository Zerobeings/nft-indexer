# nft-indexer
mixtapeIndexer.js is a utility script for fetching and processing token metadata from a given Ethereum contract. It uses the Mixtape library to handle the metadata and the ethers.js library to interact with the Ethereum contract.

## Dependencies

- `mixtapejs`: A library for handling metadata.
- `cross-fetch`: A library to perform HTTP requests.
- `fs` and `path`: Node.js built-in modules for file system operations.
- `ethers`: A library to interact with Ethereum blockchain and its smart contracts.
- `readline-sync`: A library to read user input from the console.
- `util`: Node.js built-in module, used here to promisify the pipeline function from the 'stream' module.

## How it works

1. The script initializes an instance of Mixtape.
2. It defines a list of IPFS gateways and a function to cycle through these gateways.
3. It defines a function to fetch data from a URL with a timeout.
4. It defines a function to check if a URL is an IPFS URL and another function to get the corresponding HTTP URL for an IPFS URL.
5. It defines a function to get the token URI from a contract.
6. The script then asks the user to input the contract address and the range of token IDs to process.
7. For each token in the range, it tries to fetch and process the token's metadata. If the fetch fails, it retries up to 5 times before giving up on that token.
8. The fetched metadata is written to the Mixtape instance.
9. The script logs the progress and any errors to the console.

## Usage

Run the script in Node.js. When prompted, enter the contract address and the range of token IDs to process. The script will fetch and process the metadata for each token in the range and log the progress to the console.

```bash
node mixtapeIndexer.js
```

Please ensure that all the required dependencies are installed in your project. You can install them using npm:

```bash
yarn add mixtapejs cross-fetch ethers readline-sync
```

# mixtapeIndexer-image.js

This JavaScript file is an extension of the `mixtapeIndexer.js` script, designed to handle scenarios where you not only want to fetch and process token metadata, but also download all associated images. 

After fetching the metadata for each token, it checks if the image URL is an IPFS URL and converts it to an HTTP URL if necessary. It then downloads the image and saves it locally. The metadata is updated to point to the local image file instead of the original URL. 

This script is particularly useful if you are running the database directly on your website and want to ensure fast load times for images. However, it does not contribute to the creation of the overall index of NFTs.

## Usage

Run the script in Node.js. When prompted, enter the contract address and the range of token IDs to process. The script will fetch and process the metadata for each token in the range, download the associated images, and log the progress to the console.

```bash
node mixtapeIndexer-image.js
```

Please ensure that all the required dependencies are installed in your project. You can install them using npm:

```bash
npm install mixtapejs cross-fetch ethers readline-sync
```

## License
MIT