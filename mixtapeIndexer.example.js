// Usage: node mixtapeIndexer.example.js
// This script will fetch the metadata for a given contract and token range, and create a database of the metadata.

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

const isIPFS = (url) => {
  return url.startsWith('ipfs://') || url.includes('ipfs/');
};

const getIPFSUrl = (url) => {
  const CID = url.replace('ipfs://', '').split('/')[0];
  const gateway = getNextIPFSGateway();
  return `${gateway}${CID}`;
};

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

  const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/API_KEY');
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
      metadata.index = tokenId; // Add id to metadata

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
