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
  const gateway = 'https://ipfs.io/ipfs/';
  return `${gateway}${CID}`;
};

const getContractURI = async (contractAddress, tokenId, provider, providerI) => {

    if (network === 'ethereum') {
    const contract = new ethers.Contract(contractAddress, [
      'function tokenURI(uint256 tokenId) external view returns (string memory)'
    ], provider);

    abiSpecial = [
      'function tokenURI(uint256 tokenId) view returns (string)'
    ];

    const contractSpecial = new ethers.Contract(contractAddress, abiSpecial, providerI);
  } else {
    const contract = new ethers.Contract(contractAddress, [
      'function uri(uint256 tokenId) external view returns (string memory)'
    ], provider);
  }

  try {
    return await contract.tokenURI(tokenId);
  } catch (error) {
    try {
      return await contractSpecial.tokenURI(tokenId);
    } catch (error) {
      console.error(`Error fetching tokenURI for ${contractAddress} and ${tokenId}: ${error.message}`);
    }
  }
};

const parseDataUri = (dataUri) => {
  const jsonPart = dataUri.split('utf-8,')[1];
  try {
    return JSON.parse(jsonPart);
  } catch (error) {
    console.error(`Error parsing JSON: ${error.message}`);
    throw error;
  }
};

const createMixtapeForContract = async ( contractAddress, startToken, endToken, network ) => {
  console.log(`Creating mixtape for ${contractAddress}...${network}`);

  let provider;
  let providerI;

  switch (network) {
    case 'polygon':
      provider = new ethers.JsonRpcProvider('https://polygon.rpc.thirdweb.com');
      break;
    case 'ethereum':
      provider = new ethers.JsonRpcProvider('https://ethereum.rpc.thirdweb.com');
      providerI = new ethers.JsonRpcProvider(process.env.INFURA_URL);
      break;
    default:
      throw new Error(`Unsupported network: ${network}`);
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
    path: path.join(__dirname, network, contractAddress),
    config: {
      metadata: { schema: "migrate" }
    }
  });

  for (let tokenId = startToken; tokenId <= endToken; tokenId++) {
    let success = false;
    let attempts = 0;
    let metadata;
    while (!success && attempts < 15) {
        try {
            const uri = await getContractURI(contractAddress, tokenId, provider, providerI);
            const fetchURI = isIPFS(uri) ? getIPFSUrl(uri) : uri;
            console.log(`Fetching metadata for token ${tokenId}`);

            if (uri.startsWith('data:application/json')) {
                metadata = parseDataUri(uri);
            } else if (uri.startsWith('https://')) {
              try {
                const response = await fetchWithTimeout(uri);
                const responseText = await response.text();
                metadata = JSON.parse(responseText); // Parse the response text into JSON
              } catch (error) {
                console.error(`Error fetching from: ${error.message}`);
              }     
            } else {
                try {
                  const responseWithExtension = await fetchWithTimeout(`${fetchURI}/${tokenId}.json`);
                  metadata = await responseWithExtension.json();
                } catch (errorWithExtension) {
                  console.error(`Error fetching with .json extension: ${errorWithExtension.message}`);
                  try {
                    const responseWithoutExtension = await fetchWithTimeout(`${fetchURI}/${tokenId}`);
                    const responseText = await responseWithoutExtension.text();
                    metadata = JSON.parse(responseText); // Parse the response text into JSON
                  } catch (errorWithoutExtension) {
                    attempts++;
                    console.error(`Error fetching without .json extension: ${errorWithoutExtension.message}`);
                  }
                }
            }

            if (metadata) {
                metadata.index = tokenId; // Add index to metadata
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

  console.log(`Finished fetching all tokens for ${contractAddress}.`);
};

const delay = 15 * 60 * 1000; // 15 minutes in milliseconds


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
  }).catch((error) => {
      console.error(`Error pushing to GitHub: ${error.message}`);
  });
};

const runScriptForNetwork = async (network) => {
    console.log(`Running script for the ${network} network...`);
    let changesMade = false;
    // Fetch data from the sheet
    const data = await fetchDataFromRequest(network);
    // Loop through the data and process it
    for (const item of data) {
        // Check if the folder exists
        if (!checkIfFolderExists(item.contractAddress, network)) {
            changesMade = true;
            // If not, update collections and create mixtape
            await updateIndexedCollections(item.contractAddress, network);
            await createMixtapeForContract(item.contractAddress, item.startToken, item.endToken, network);
        }
    }
    // After mixtape creation is complete
    if (changesMade) {
        // Push to GitHub
        try {
          await pushToGitHub(network);
        } catch (error) {
          console.error(`Error pushing to GitHub: ${error.message}`);
        }
    } else {
        console.log(`No changes made for ${network} network.`);
    }
};

// Run for Ethereum, then wait 15 minutes and run for Polygon
runScriptForNetwork('polygon').then(() => {
    setTimeout(() => runScriptForNetwork('ethereum'), delay);
});

module.exports = { updateIndexedCollections, fetchDataFromRequest, runScriptForNetwork };