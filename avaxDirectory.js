const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');

// Read the JSON file containing contract addresses
const fileData = fs.readFileSync('avax-indexed/indexed.json');
const collections = JSON.parse(fileData).collections;

// Initialize ethers.js
const provider = new ethers.JsonRpcProvider('https://avalanche.rpc.thirdweb.com');

// Define a function to get contract metadata
async function getContractMetadata(contractAddress) {
    const contract = new ethers.Contract(contractAddress, [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function tokenURI(uint256 tokenId) view returns (string)',
    ], provider);

    try {
        const name = await contract.name();
        const symbol = await contract.symbol();
        const tokenUri = await contract.tokenURI(1);

        // Fetch and parse token metadata
        let imageUrl = '';
        if (tokenUri) {
            const tokenMetadataUrl = tokenUri.startsWith('ipfs://')
                ? tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
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
    let collectionAddresses = collections; // Already an array of addresses

    // Try to read existing metadata file if it exists
    try {
        const existingData = fs.readFileSync('avax-directory/directory.json', 'utf8');
        allMetadata = JSON.parse(existingData); // This should be an array of metadata objects
        console.log('Read existing metadata file');
    } catch (error) {
        console.error('Error reading existing metadata file:', error);
    }

    // Fetch new metadata
    for (const address of collectionAddresses) {
        if (!allMetadata.some(entry => entry.contract === address)) {
            const metadata = await getContractMetadata(address);
            if (metadata) {
                allMetadata.push(metadata);
            }
        }
    }

    // Write updated metadata to file
    fs.writeFileSync('avax-directory/directory.json', JSON.stringify(allMetadata, null, 2));
}

fetchAllMetadata();

module.exports = { fetchAllMetadata };