const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');

// Read the JSON file containing contract addresses
const fileData = fs.readFileSync('poly-indexed/indexed.json');
const collections = JSON.parse(fileData).collections;

// Initialize ethers.js
const provider = new ethers.JsonRpcProvider('https://polygon.rpc.thirdweb.com');

// Define a function to get contract metadata
async function getContractMetadata(contractAddress) {
    const contract = new ethers.Contract(contractAddress, [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function uri(uint256 tokenId) view returns (string)',
    ], provider);

    try {
        const name = await contract.name();
        const symbol = await contract.symbol();
        const tokenUri = await contract.uri(0);

        // Fetch and parse token metadata
        let imageUrl = '';
        if (tokenUri) {
            const tokenMetadataUrl = tokenUri.startsWith('ipfs://')
                ? `https://ipfs.io/ipfs/${tokenUri.slice(7)}`
                : tokenUri;

            const tokenMetadataResponse = await axios.get(tokenMetadataUrl);
            if (tokenMetadataResponse.data && tokenMetadataResponse.data.image) {
                imageUrl = tokenMetadataResponse.data.image;
            }
        }

        return { contract: contractAddress, name, symbol, image: imageUrl };
    } catch (error) {
        console.error('Error fetching metadata for address:', contractAddress, error);
    }
}

// Function to fetch all metadata
async function fetchAllMetadata() {
    let allMetadata = [];

    // Read existing metadata file if it exists
    try {
        const existingData = fs.readFileSync('poly-directory/directory.json');
        allMetadata = JSON.parse(existingData);
    } catch (error) {
        console.error('Error reading existing metadata file:', error);
    }

    // Fetch new metadata
    for (const address of collections) {
        if (!allMetadata.some(entry => entry.contract === address)) {
            const metadata = await getContractMetadata(address);
            if (metadata) {
                allMetadata.push(metadata);
            }
        }
    }

    // Write updated metadata to file
    fs.writeFileSync('poly-directory/directory.json', JSON.stringify(allMetadata, null, 2));
}

fetchAllMetadata();
