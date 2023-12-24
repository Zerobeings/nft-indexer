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
    document.getElementById(networkName + 'Tab').classList.add("active");
}

document.addEventListener('DOMContentLoaded', () => {
    const ethereumTab = document.getElementById('ethereum');
    const polygonTab = document.getElementById('polygon');

    ethereumTab.addEventListener('click', () => openNetwork('ethereum'));
    polygonTab.addEventListener('click', () => openNetwork('polygon'));

    // Initial load
    openNetwork('ethereum');
});


// Load data from JSON and create cards
async function loadData(network) {
    const directoryPath = network === 'Ethereum' ? 'eth-directory/directory.json' : 'poly-directory/directory.json';
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
        <div class="contract-address">${truncateAddress(data.contract)}</div>
    `;

    return card;
}

function truncateAddress(address) {
    return address.length > 20 ? address.substring(0, 10) + '...' + address.substring(address.length - 10) : address;
}
