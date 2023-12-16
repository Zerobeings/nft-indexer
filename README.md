# nft-indexer
mixtapeIndexer.js is a utility script for fetching and processing token metadata from a given Ethereum contract. It uses the [mixtapejs](https://www.npmjs.com/package/mixtapejs?activeTab=readme) library to handle the metadata and the ethers.js library to interact with the Ethereum contract.

The mixtape databases are designed to be used with nft-fetcher, a library for fetching NFT metadata from a database. You can find more information about nft-fetcher [here](https://www.npmjs.com/package/nft-fetcher).

There are three methods of indexing a collection to this repository:
1. Make an index request at [https://indexer.locatia.app/request](https://indexer.locatia.app/request) (Recommended).
2. Use the [mixtapeIndexer.js](#mixtapeIndexer) script to index a collection (Recommended to add your collection quickly).
    - Fork this repo and run the mixtapeIndexer.js script locally.
    - Submit a pull request to this repo with the output of the mixtapeIndexer.js script.
    - Pull request requirements: 
        - Must meet the content policy requirements outlined here: [https://indexer.locatia.app/request](https://indexer.locatia.app/request).
        - The output of the script should be saved in a file named `mixtape.db`.
        - The file should be saved in a folder named after the contract address.
        - The folder should be saved in a folder named of the collections respective network.
        - Submit an index request at [https://indexer.locatia.app/request](https://indexer.locatia.app/request) to add to the index record.
3. Advanced: Use the [continuousIndexer.js](#continuousIndexer) script to continuously index a collection.
    - Fork this repo and run the continuousIndexer.js script locally.
    - Submit a pull request to this repo with the output of the continuousIndexer.js script.
    - Pull request requirements:
        - Must meet the content policy requirements outlined here: [https://indexer.locatia.app/request](https://indexer.locatia.app/request).
        - Submit the index request for each collection added at [https://indexer.locatia.app/request](https://indexer.locatia.app/request) to add to the index record.

# mixtapeIndexer.js
This script is used to fetch and process metadata for a range of tokens from a specific Ethereum contract. It uses the Mixtape library to store the fetched metadata.

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

# continuousIndexer.js

This JavaScript file is a utility script for continuously fetching and processing token metadata from Ethereum and Polygon contracts. It uses the Mixtape library to handle the metadata and the ethers.js library to interact with the Ethereum and Polygon contracts.

## Dependencies

- `mixtapejs`: A library for handling metadata.
- `cross-fetch`: A library to perform HTTP requests.
- `fs` and `path`: Node.js built-in modules for file system operations.
- `ethers`: A library to interact with Ethereum and Polygon blockchain and their smart contracts.
- `readline-sync`: A library to read user input from the console.
- `util`: Node.js built-in module, used here to promisify the pipeline function from the 'stream' module.
- `child_process`: Node.js built-in module, used here to execute shell commands for Git operations.

## How it works

1. The script initializes an instance of Mixtape.
2. It defines a list of IPFS gateways and a function to cycle through these gateways.
3. It defines a function to fetch data from a URL with a timeout.
4. It defines a function to check if a URL is an IPFS URL and another function to get the corresponding HTTP URL for an IPFS URL.
5. It defines a function to get the token URI from a contract.
6. The script then fetches data from a request using an API key and network as parameters.
7. For each contract in the fetched data, it checks if a folder for the contract exists. If not, it updates the indexed collections and creates a Mixtape for the contract.
8. The fetched metadata is written to the Mixtape instance.
9. The script logs the progress and any errors to the console.
10. After processing all contracts for a network, it commits and pushes the changes to a Git repository.
11. The script runs for the Ethereum network, waits for 15 minutes, and then runs for the Polygon network.

## Usage

Run the script in Node.js. The script will fetch and process the metadata for each contract in the fetched data and log the progress to the console.

```bash
node continuousIndexer.js
```

Please ensure that all the required dependencies are installed in your project. You can install them using npm:

```bash
npm install mixtapejs cross-fetch ethers readline-sync
```

## License
MIT