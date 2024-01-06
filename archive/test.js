// test.js
const fs = require('fs');
const path = require('path');
const nock = require('nock');
const { fetchDataFromRequest, updateIndexedCollections, runScriptForNetwork } = require('./continuousIndexer');
require('dotenv').config();

describe('fetchDataFromRequest', () => {
  it('fetches data from the API', async () => {
    const mockData = [{"contractAddress": "0x8f170F73076b7A45749677B1681b13366B3C80f7", "endToken": 115, "policyConfirmation": true, "requested": true, "startToken": 1, "wallet": "0xbCdbe666a43437333CcC375C1E33461E260B57E6"}, {"contractAddress": "0x8FbA3ebe77D3371406a77EEaf40c89C1Ed55364a", "endToken": 6583, "policyConfirmation": true, "requested": true, "startToken": 1, "wallet": "0xbCdbe666a43437333CcC375C1E33461E260B57E6"}];
    nock('https://api.example.com')
      .get('/?network=ethereum')
      .reply(200, mockData);

    const data = await fetchDataFromRequest('ethereum');
    expect(data).toEqual(mockData);
  });
});

describe('updateIndexedCollections', () => {
  const contractAddress = '0x8FbA3ebe77D3371406a77EEaf40c89C1Ed55364a';
  const network = 'ethereum';
  const dirPath = path.join(__dirname, network === 'ethereum' ? 'eth-indexed' : 'poly-indexed');
  const filePath = path.join(dirPath, 'indexed.json');

  beforeEach(() => {
    // Ensure the directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });

  it('creates a new file if it does not exist', async () => {
    await updateIndexedCollections(contractAddress, network);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('adds the contract address to the collections array', async () => {
    await updateIndexedCollections(contractAddress, network);
    const fileData = fs.readFileSync(filePath, 'utf8');
    const indexedCollections = JSON.parse(fileData);
    expect(indexedCollections.collections).toContain(contractAddress);
  });

  it('does not add the contract address to the collections array if it already exists', async () => {
    const indexedCollections = {
      collections: [contractAddress],
    };
    fs.writeFileSync(filePath, JSON.stringify(indexedCollections, null, 2));
    await updateIndexedCollections(contractAddress, network);
    const fileData = fs.readFileSync(filePath, 'utf8');
    const updatedIndexedCollections = JSON.parse(fileData);
    expect(updatedIndexedCollections.collections).toEqual([contractAddress]);
  });

  it('adds the mixtape database to the collection folder', async () => {
    const network = 'ethereum';
    await runScriptForNetwork(network);
    const mixtapeDatabasePath = path.join(network, contractAddress, 'mixtape.db');
    console.log(mixtapeDatabasePath);
    expect(fs.existsSync(mixtapeDatabasePath)).toBe(true);
  });
});
