const Mixtape = require('nft-mixtapejs');
const fetch = require('cross-fetch');
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

(async () => {
  await mixtape.init({
    config: {
      metadata: { schema: "migrate" }
    }
  });

  for (let i = 1; i < 11; i++) {
    console.log(`${i} of 10`);
    let success = false;
    let attempts = 0;
    let metadata;

    while (!success && attempts < 3) { // Retry up to 3 times
      try {
        const CID = "bafybeidc2pl57wy4ppifwylrlu5vinb6pia57gahfnid227mcgzahwiq4a"
        url = `https://${CID}.ipfs.nftstorage.link/${i}`;
        const response = await fetchWithTimeout(url);
        const responseText = await response.text();
        metadata = JSON.parse(responseText);

        metadata.index = i;
        success = true;
      } catch (error) {
        attempts++;
        console.log(`Attempt ${attempts} failed for item ${i}: ${error.message}`);
        if (attempts >= 3) {
          throw new Error(`Failed to fetch metadata for item ${i} after multiple attempts`);
        }
      }
    }

    await mixtape.write("metadata", metadata);
  }
  console.log('Finished fetching all tokens.');
  process.exit(0); 
})();