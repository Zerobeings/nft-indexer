const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');

// Define a function to get contract metadata
async function getContractMetadata(contractAddress, network, provider) {

    if (network === 'ethereum' || network === 'avalanche') {
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
    } else if (network === "polygon" || network ==="fantom") {
        const contract = new ethers.Contract(contractAddress, [
            'function name() view returns (string)',
            'function symbol() view returns (string)',
            'function uri(uint256 tokenId) view returns (string)',
        ], provider);

        try {
            const name = await contract.name();
            const symbol = await contract.symbol();
            const tokenUri = await contract.uri(1);

            // Fetch and parse token metadata
            let imageUrl = '';
            if (tokenUri) {
                const fetchURI = isIPFS(uri) ? getIPFSUrl(uri) : uri;

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

}
// Function to fetch all metadata
async function fetchAllMetadata(network) {
    // Determine network
    let dirNetwork;
    switch (network) {
        case 'ethereum':
            dirNetwork = 'eth';
            break;
        case 'fantom':
            dirNetwork = 'ftm';
            break;
        case 'polygon':
            dirNetwork = 'poly';
            break;
        case 'avalanche':
            dirNetwork = 'avax';
            break;
        default:
            console.error('Invalid network:', network);
            return;
    }

    let allMetadata = [];

    // Initialize ethers.js
    const provider = new ethers.JsonRpcProvider(`https://${network}.rpc.thirdweb.com`);

    // Try to read existing metadata file if it exists
    try {
        const existingData = fs.readFileSync(`${dirNetwork}-directory/directory.json`, 'utf8');
        allMetadata = JSON.parse(existingData); // This should be an array of metadata objects
        console.log('Read existing metadata file');
    } catch (error) {
        console.error('Error reading existing metadata file:', error);
    }

    // Fetch new metadata
    for (const address of collections) {
        if (!allMetadata.some(entry => entry.contract === address)) {
            const metadata = await getContractMetadata(address, network, provider);
            if (metadata) {
                allMetadata.push(metadata);
            }
        }
    }

    // Write updated metadata to file
    fs.writeFileSync(`${dirNetwork}-directory/directory.json`, JSON.stringify(allMetadata, null, 2));
}

module.exports = { fetchAllMetadata };