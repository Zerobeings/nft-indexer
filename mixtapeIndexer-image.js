// Usage: node mixtapeIndexer-image.js
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
  const gateway = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  return `${gateway}`;
};

const getIPFSImageUrl = (url) => {
  const gateway = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  return `${gateway}`;
}

const getContractURI = async (contractAddress, tokenId, provider, network) => {
  console.log(network)
  if (network === 'ethereum' || network === 'avalanche') {
    const contract = new ethers.Contract(contractAddress, [
      'function tokenURI(uint256 tokenId) view returns (string)'
    ], provider);
    try {
      return await contract.tokenURI(tokenId);
    } catch (error) {
      console.error(`Error fetching tokenURI for ${contractAddress} and ${tokenId}: ${error.message}`);
    }
  } else {
    const contract = new ethers.Contract(contractAddress, [
      'function uri(uint256 tokenId) external view returns (string memory)'
    ], provider);
    try {
      return await contract.uri(tokenId);
    } catch (error) {
      try {
        if (contractSpecial) {
        return await contractSpecial.uri(tokenId);
        }
      } catch (error) {
        console.error(`Error fetching tokenURI for ${contractAddress} and ${tokenId}: ${error.message}`);
      }
    }
  }
};

(async () => {
  await mixtape.init({
    config: {
      metadata: { schema: "migrate" }
    }
  });
  
  const network = readlineSync.question('Enter the network (e.g., "ethereum", "polygon", "avalanche", "fantom"): ');
  const contractAddress = readlineSync.question('Enter the contract address: ');
  const startToken = parseInt(readlineSync.question('Enter the starting token ID: '), 10);
  const endToken = parseInt(readlineSync.question('Enter the ending token ID: '), 10);

  const provider = new ethers.JsonRpcProvider(`https://${network}.rpc.thirdweb.com`);

  for (let tokenId = startToken; tokenId <= endToken; tokenId++) {
    let success = false;
    let attempts = 0;
    let metadata;
    while (!success && attempts < 15) {
      try {
          const uri = await getContractURI(contractAddress, tokenId, provider, network);
          const fetchURI = isIPFS(uri) ? getIPFSUrl(uri) : uri;
          console.log(`Fetching metadata for token ${tokenId}`);
  
          if (uri.startsWith('data:application/json')) {
              metadata = parseDataUri(uri);
          } else {
              try {
                  const response = await axios.get(fetchURI.endsWith('.json') ? fetchURI : `${fetchURI}.json`);
                  metadata = response.data;
                  if (metadata.image && metadata.image.startsWith('https://gateway.pinata.cloud/ipfs/')) {
                      metadata.image = metadata.image.replace('https://gateway.pinata.cloud/ipfs/', 'ipfs://');
                  }
              } catch (error) {
                  console.error(`Error fetching metadata: ${error.message}`);
                  if (!fetchURI.endsWith('.json')) {
                      try {
                          const responseWithoutExtension = await axios.get(fetchURI);
                          metadata = responseWithoutExtension.data;
                      } catch (errorWithoutExtension) {
                          attempts++;
                          console.error(`Error fetching without .json extension: ${errorWithoutExtension.message}`);
                      }
                  }
              }
          }
          if (metadata) {
              metadata.index = tokenId;
              await mixtape.write("metadata", metadata);
              success = true;
              console.log(`Fetched and processed token ${tokenId}`);
          }
      } catch (error) {
          attempts++;
          console.log(`Attempt ${attempts} failed for token ${tokenId}: ${error.message}`);
          if (error.message.includes('revert') || error.message.includes('nonexistent token')) {
              console.error(`Token ${tokenId} not found, stopping.`);
              break;
          }
  
          if (attempts >= 15) {
              console.error(`Failed to fetch metadata for token ${tokenId} after multiple attempts, stopping.`);
              break;
          }
      }
    }
  }

console.log('Finished fetching all tokens.');
process.exit(0); 

})();
