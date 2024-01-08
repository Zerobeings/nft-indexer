// Please note this script is not tested yet and is still in development

const Mixtape = require('mixtapejs');
const fetch = require('cross-fetch');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const readlineSync = require('readline-sync');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);
const { exec } = require('child_process');
const mixtape = new Mixtape();
require('dotenv').config();
const directory = require('./directory');

async function updateIndexedCollections(contractAddress, network){
  try {
      // Determine the correct directory based on the network
      let dirPath;

      switch (network) {
        case 'ethereum':
          dirPath = 'eth-indexed';
          break;
        case 'polygon':
          dirPath = 'poly-indexed';
          break;
        case 'avalanche':
          dirPath = 'avax-indexed';
          break;
        case 'fantom':
          dirPath = 'ftm-indexed';
          break;
        default:
          throw new Error(`Unsupported network: ${network}`);
      }

      const filePath = path.join(__dirname, dirPath, 'indexed.json');
      const twFilePath = path.join(__dirname, dirPath, 'twindexed.json');

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
      fs.writeFileSync(twFilePath, JSON.stringify(indexedCollections, null, 2));
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
  const gateway = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  return `${gateway}`;
};


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

const parseDataUri = (dataUri) => {
  const jsonPart = dataUri.split('utf-8,')[1];
  try {
    return JSON.parse(jsonPart);
  } catch (error) {
    console.error(`Error parsing JSON: ${error.message}`);
    throw error;
  }
};

  const fetchTokenMetadata = async (contractAddress, tokenId, provider, network) => {
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
    return null; 
  };


const createMixtapeForContract = async ( contractAddress, startToken, endToken, network ) => {
  console.log(`Creating mixtape for ${contractAddress}...${network}`);

  let provider;
  provider = new ethers.JsonRpcProvider(`https://${network}.rpc.thirdweb.com`);
  
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

  // Batch size for fetching tokens
  const batchSize = 10;

  for (let batchStart = startToken; batchStart <= endToken; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize - 1, endToken);
    const batchPromises = [];

    for (let tokenId = batchStart; tokenId <= batchEnd; tokenId++) {
        batchPromises.push(fetchTokenMetadata(contractAddress, tokenId, provider, network));
    }

    try {
        const batchResults = await Promise.all(batchPromises);
        for (const metadata of batchResults) {
            if (metadata) {
                await mixtape.write("metadata", metadata);
            }
        }
    } catch (error) {
        console.error(`Error in batch ${batchStart}-${batchEnd}: ${error.message}`);
    }
  }

  console.log(`Finished fetching all tokens for ${contractAddress}.`);
};

const pushToGitHub = (network) => {
  return new Promise((resolve, reject) => {
    exec(`git add . && git commit -m "Added mixtape for ${network}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Git commit error: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.log(`Git commit status: ${stderr}`);
      }
      console.log(`Git commit output: ${stdout}`);

      exec(`git push`, (pushError, pushStdout, pushStderr) => {
        if (pushError) {
          console.error(`Git push error: ${pushError.message}`);
          return reject(pushError);
        }
        if (pushStderr) {
          console.log(`Git push status: ${pushStderr}`);
        }
        console.log(`Git push output: ${pushStdout}`);
        resolve(pushStdout);
      });
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
      // Update directory
      try {
        await directory.fetchAllMetadata(network);
      } catch (error) {
        console.error(`Error writing metadata for ${contractAddress}: ${error.message}`);
      }

      //Push to GitHub
      try {
        await pushToGitHub(network);
      } catch (error) {
        console.error(`Error pushing to GitHub: ${error.message}`);
      }
    } else {
      console.log(`No changes made for ${network} network.`);
    }
};

const delay = 1 * 60 * 1000; // 1 minutes in milliseconds

// Run for all networks in a loop
function runScriptsInLoop() {
  runScriptForNetwork('ethereum').then(() => {
      setTimeout(() => {
          runScriptForNetwork('polygon').then(() => {
              setTimeout(() => {
                  runScriptForNetwork('avalanche').then(() => {
                      setTimeout(() => {
                          runScriptForNetwork('fantom').then(() => {
                              setTimeout(runScriptsInLoop, delay);
                          });
                      }, delay);
                  });
              }, delay);
          });
      }, delay);
  });
}

runScriptsInLoop();

module.exports = { updateIndexedCollections, fetchDataFromRequest, runScriptForNetwork };