// Usage: node mixtapeIndexer-image.example.js
// This script will fetch the metadata for a given contract and token range, download the images to the images/ folder, and create a database.

const Mixtape = require('mixtapejs');
const fetch = require('cross-fetch');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const readlineSync = require('readline-sync');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);
const mixtape = new Mixtape();

const ipfsGateways = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
];

let currentGatewayIndex = 0;

const getNextIPFSGateway = () => {
  const gateway = ipfsGateways[currentGatewayIndex];
  currentGatewayIndex = (currentGatewayIndex + 1) % ipfsGateways.length;
  return gateway;
};

const fetchWithTimeout = async (url, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const downloadImage = async (url, filename) => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    
    // Check if the response is an image (e.g., "image/png", "image/jpeg")
    if (contentType && contentType.startsWith('image')) {
      const fileStream = fs.createWriteStream(filename);
      const stream = response.body.pipe(fileStream);

      return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(filename));
        stream.on('error', (error) => reject(error));
      });
    } else {
      throw new Error(`Received non-image content type: ${contentType}`);
    }
  } catch (error) {
    throw error;
  }
};



const isIPFS = (url) => {
  return url.startsWith('ipfs://') || url.includes('ipfs/');
};

const getIPFSUrl = (url) => {
  const CID = url.replace('ipfs://', '').split('/')[0];
  const gateway = getNextIPFSGateway();
  return `${gateway}${CID}`;
};

const getIPFSImageUrl = (url) => {
  const CID = url.replace('ipfs://', '').split('/')[0];
  const imageName = url.split('/').pop();
  const gateway = getNextIPFSGateway();
  return `${gateway}${CID}/${imageName}`;
}

const getContractURI = async (contractAddress, tokenId, provider) => {
  const contract = new ethers.Contract(contractAddress, [
    'function tokenURI(uint256 tokenId) external view returns (string memory)'
  ], provider);

  return await contract.tokenURI(tokenId);
};

(async () => {
  await mixtape.init({
    config: {
      metadata: { schema: "migrate" }
    }
  });

  const provider = new ethers.JsonRpcProvider('https://ethereum.rpc.thirdweb.com');
  const contractAddress = readlineSync.question('Enter the contract address: ');
  const startToken = parseInt(readlineSync.question('Enter the starting token ID: '), 10);
  const endToken = parseInt(readlineSync.question('Enter the ending token ID: '), 10);

for (let tokenId = startToken; tokenId <= endToken; tokenId++) {
  let success = false;
  let attempts = 0;
  while (!success && attempts < 5) {
    try {
      const uri = await getContractURI(contractAddress, tokenId, provider);
      const fetchURI = isIPFS(uri) ? getIPFSUrl(uri) : uri;
      let metadata = await fetchWithTimeout(fetchURI + `/${tokenId}.json`).then((r) => r.json());
      metadata.index = tokenId; // Add index to metadata

      let imageUrl = metadata.image;
      if (isIPFS(imageUrl)) {
        imageUrl = getIPFSImageUrl(imageUrl);
        console.log(imageUrl);
      }

      // Update metadata with the new image URL
      metadata.image = imageUrl;

      const filename = path.join('images', `${tokenId}${path.extname(new URL(imageUrl).pathname)}`);
      await downloadImage(imageUrl, filename);

      await mixtape.write("metadata", metadata);

      success = true;
      console.log(`Fetched and processed token ${tokenId}`);
    } catch (error) {
      attempts++;
      console.log(`Attempt ${attempts} failed for token ${tokenId}: ${error.message}`);

      if (error.message.includes('revert') || error.message.includes('nonexistent token')) {
        console.error(`Token ${tokenId} not found, stopping.`);
        break;
      }
      
      if (attempts >= 5) {
        console.error(`Failed to fetch metadata for token ${tokenId} after multiple attempts, stopping.`);
        break;
      }
    }
  }
}

console.log('Finished fetching all tokens.');
process.exit(0); 

})();
