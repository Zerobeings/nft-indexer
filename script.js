function openNetwork(networkName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.add("hidden");
        tabcontent[i].classList.remove("shown");
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    document.getElementById(networkName).classList.add("shown");
    document.getElementById(networkName).classList.remove("hidden");
    document.getElementById(networkName.toLowerCase() + 'Tab').classList.add("active");

    loadData(networkName);
}

document.addEventListener('DOMContentLoaded', () => {
    const ethereumTab = document.getElementById('ethereumTab');
    const polygonTab = document.getElementById('polygonTab');
    const avalancheTab = document.getElementById('avalancheTab');
    const fantomTab = document.getElementById('fantomTab');
    const twethereumTab = document.getElementById('twethereumTab');
    const twpolygonTab = document.getElementById('twpolygonTab');
    const twavalancheTab = document.getElementById('twavalancheTab');
    const twfantomTab = document.getElementById('twfantomTab');

    ethereumTab.addEventListener('click', () => openNetwork('Ethereum'));
    polygonTab.addEventListener('click', () => openNetwork('Polygon'));
    avalancheTab.addEventListener('click', () => openNetwork('Avalanche'));
    fantomTab.addEventListener('click', () => openNetwork('Fantom'));
    twethereumTab.addEventListener('click', () => openNetwork('twEthereum'));
    twpolygonTab.addEventListener('click', () => openNetwork('twPolygon'));
    twavalancheTab.addEventListener('click', () => openNetwork('twAvalanche'));
    twfantomTab.addEventListener('click', () => openNetwork('twFantom'));

    // Initial load
    openNetwork('Ethereum');
});

// Load data from JSON and create cards
async function loadData(network) {
    let directoryPath;
    switch(network) {
        case 'Ethereum':
            directoryPath = 'eth-directory/directory.json';
            break;
        case 'Polygon':
            directoryPath = 'poly-directory/directory.json';
            break;
        case 'Avalanche':
            directoryPath = 'avax-directory/directory.json';
            break;
        case 'Fantom':
            directoryPath = 'ftm-directory/directory.json';
            break;
        case 'twEthereum':
            directoryPath = 'eth-directory/twdirectory.json';
            break;
        case 'twPolygon':
            directoryPath = 'poly-directory/twdirectory.json';
            break;
        case 'twAvalanche':
            directoryPath = 'avax-directory/twdirectory.json';
            break;
        case 'twFantom':
            directoryPath = 'ftm-directory/twdirectory.json';
            break;
        default:
            directoryPath = 'eth-directory/directory.json';
            break;
    }
    const response = await fetch(directoryPath);
    const data = await response.json();

    const container = document.getElementById(network);
    container.innerHTML = ''; // Clear existing content
    data.forEach(item => {
        const card = createCard(item);
        container.appendChild(card);
    });
}

function createCard(data) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div class="title">${data.name}</div>
        <div class="symbol">${data.symbol}</div>
        <div class="contract-address">${data.contract}</div>
    `;

    return card;
}