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
const ethDirectory = require('./ethDirectory');
const polyDirectory = require('./polyDirectory');
// const avaxDirectory = require('./avaxDirectory');
// const ftmDirectory = require('./ftmDirectory');

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

const getContractURI = async (contractAddress, tokenId, provider, network) => {
    let abiSpecial;
    let providerI;
    console.log(network)
    // todo: add other networks and confirm contract calls for those networks
    if (network === 'ethereum') {
      const contract = new ethers.Contract(contractAddress, [
        'function tokenURI(uint256 tokenId) view returns (string)'
      ], provider);
      try {
        return await contract.tokenURI(tokenId);
      } catch (error) {
        console.error(`Error fetching tokenURI for ${contractAddress} and ${tokenId}: ${error.message}`);
        try {
          abiSpecial = [
            'function tokenURI(uint256 tokenId) view returns (string)'
          ];
          const contractSpecial = new ethers.Contract(contractAddress, abiSpecial, providerI);

          return await contractSpecial.tokenURI(tokenId);
        } catch (error) {
          console.error(`Error fetching tokenURI for ${contractAddress} and ${tokenId}: ${error.message}`);
        }
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
            } else if (uri.startsWith('https://gateway.pinata.cloud/ipfs/')) {
              try {
                url = uri.replace('https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/');
                const response = await fetchWithTimeout(url);
                const responseText = await response.text();
                metadata = JSON.parse(responseText); // Parse the response text into JSON
                metadata.image = metadata.image.replace('https://gateway.pinata.cloud/ipfs/', 'ipfs://');
              } catch (error) {
                console.error(`Error fetching from Pinata: ${error.message}`);
              }
            } else if (uri.startsWith('https://')) {
              try {
                console.log(`Fetching with https from: ${uri}`);
                const response = await fetchWithTimeout(uri);
                const responseText = await response.text();
                metadata = JSON.parse(responseText); // Parse the response text into JSON
              } catch (error) {
                console.error(`Error fetching without json extension from: ${error.message}`);
                try {
                  const response = await fetchWithTimeout(`${uri}.json`);
                  const responseText = await response.text();
                  metadata = JSON.parse(responseText); // Parse the response text into JSON
                } catch (error) {
                  console.error(`Error fetching with json extension from: ${error.message}`);
                }     
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

        } catch (error) {
          attempts++;
          console.error(`Attempt ${attempts} failed for item ${tokenId}: ${error.message}`);
          if (attempts >= 15) {
            throw new Error(`Failed to fetch metadata for item ${tokenId} after multiple attempts`);
          }
        }
    }
    return null; 
  };


const createMixtapeForContract = async ( contractAddress, startToken, endToken, network ) => {
  console.log(`Creating mixtape for ${contractAddress}...${network}`);

  let provider;

  switch (network) {
    case 'polygon':
      provider = new ethers.JsonRpcProvider('https://polygon.rpc.thirdweb.com');
      break;
    case 'ethereum':
      provider = new ethers.JsonRpcProvider('https://ethereum.rpc.thirdweb.com');
      break;
    case 'avalanche':
      provider = new ethers.JsonRpcProvider('https://avalanche.rpc.thirdweb.com');
      break;
    case 'fantom':
      provider = new ethers.JsonRpcProvider('https://fantom.rpc.thirdweb.com');
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

const delay = 1 * 60 * 1000; // 1 minutes in milliseconds


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
         if (network === 'ethereum') {
          try {
            await ethDirectory.fetchAllMetadata();
          } catch (error) {
            console.error(`Error writing metadata for ${contractAddress}: ${error.message}`);
          }
        } else if (network === 'polygon') {
          try {
            await polyDirectory.fetchAllMetadata();
          } catch (error) {
            console.error(`Error writing metadata for ${contractAddress}: ${error.message}`);
          }
        } 
        // else if (network === 'avalanche') {
        //   try {
        //     await avaxDirectory.fetchAllMetadata();
        //   } catch (error) {
        //     console.error(`Error writing metadata for ${contractAddress}: ${error.message}`);
        //   }
        // }
        // else if (network === 'fantom') {
        //   try {
        //     await ftmDirectory.fetchAllMetadata();
        //   } catch (error) {
        //     console.error(`Error writing metadata for ${contractAddress}: ${error.message}`);
        //   }
        // }

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

// Run for all networks in a loop
function runScriptsInLoop() {
  runScriptForNetwork('fantom').then(() => {
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