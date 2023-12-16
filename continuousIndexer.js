const Mixtape = require('mixtapejs');
const fetch = require('cross-fetch');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const readlineSync = require('readline-sync');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);
const { exec } = require('child_process');
const mixtape = new Mixtape();
require('dotenv').config();

const ipfsGateways = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
];

let currentGatewayIndex = 0;

async function updateIndexedCollections(contractAddress, network){
  try {
      // Determine the correct directory based on the network
      const dirPath = network === 'ethereum' ? 'eth-indexed' : 'poly-indexed';
      const filePath = path.join(__dirname, dirPath, 'indexed.json');

      // Initialize indexedCollections
      let indexedCollections = {};

      // Check if the file exists and read the existing data
      if (fs.existsSync(filePath)) {
          const fileData = fs.readFileSync(filePath, 'utf8');
          indexedCollections = JSON.parse(fileData);
      }

      // Update the collections data
      if (!indexedCollections.collections) {
          indexedCollections.collections = [];
      }
      if (!indexedCollections.collections.includes(contractAddress)) {
          indexedCollections.collections.push(contractAddress);
      }

      // Write the updated data back to the file
      fs.writeFileSync(filePath, JSON.stringify(indexedCollections, null, 2));
      console.log(`Updated indexed collections for ${network} network.`);
  } catch (error) {
      console.error(`An error occurred while updating indexed collections: ${error.message}`);
  }
}

const fetchDataFromRequest = async (network) => {
  const response = await fetch(`${process.env.API_KEY}network=${encodeURIComponent(network)}`);
  const newData = await response.json();
  return newData;
};

const checkIfFolderExists = (contractAddress, network) => {
  const directoryPath = path.join(__dirname, network);
  if (!fs.existsSync(directoryPath)) {
      return false;
  }
  const folderPath = path.join(directoryPath, contractAddress);
  return fs.existsSync(folderPath);
};

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



const createMixtapeForContract = async ( contractAddress, startToken, endToken, network ) => {
  console.log(`Creating mixtape for ${contractAddress}...${network}`);

  let provider;

  if (network === 'polygon') {
      provider = new ethers.providers.JsonRpcProvider('https://polygon.rpc.thirdweb.com');
  }
  if (network === 'ethereum') {
      provider = new ethers.JsonRpcProvider('https://ethereum.rpc.thirdweb.com');
  }
  
    const networkDirPath = path.join(__dirname, network);
    if (!fs.existsSync(networkDirPath)) {
        fs.mkdirSync(networkDirPath);
    }
  
    const dirPath = path.join(networkDirPath, contractAddress);
    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath);
    }

  await mixtape.init({
    path: path.join(__dirname, network, contractAddress, 'mixtape.db'),
    config: {
      metadata: { schema: "migrate" }
    }
  });

  for (let tokenId = startToken; tokenId <= endToken; tokenId++) {
    let success = false;
    let attempts = 0;
    while (!success && attempts < 5) {
      try {
        const uri = await getContractURI(contractAddress, tokenId, provider);
        const fetchURI = isIPFS(uri) ? getIPFSUrl(uri) : uri;
        let metadata = await fetchWithTimeout(fetchURI + `/${tokenId}.json`).then((r) => r.json());
        metadata.index = tokenId; // Add index to metadata


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

  console.log(`Finished fetching all tokens for ${contractAddress}.`);
};

const delay = 15 * 60 * 1000; // 15 minutes in milliseconds

const runScriptForNetwork = async (network) => {
    console.log(`Running script for the ${network} network...`);
    // Fetch data from the sheet
    const data = await fetchDataFromRequest(network);
    // Loop through the data and process it
    for (const item of data) {
        // Check if the folder exists
        if (!checkIfFolderExists(item.contractAddress, network)) {
            // If not, update collections and create mixtape
            await updateIndexedCollections(item.contractAddress, network);
            await createMixtapeForContract(item.contractAddress, item.startToken, item.endToken, network);
        }
    }
    // After mixtape creation is complete
    await pushToGitHub(network);
};

const pushToGitHub = (network) => {
    return new Promise((resolve, reject) => {
        exec(`git add . && git commit -m "Added mixtape for ${network}" && git push`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return reject(error);
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                return reject(stderr);
            }
            console.log(`Stdout: ${stdout}`);
            resolve(stdout);
        });
    });
};

// Run for Ethereum, then wait 15 minutes and run for Polygon
runScriptForNetwork('ethereum').then(() => {
    setTimeout(() => runScriptForNetwork('polygon'), delay);
});

module.exports = { updateIndexedCollections, fetchDataFromRequest, runScriptForNetwork };