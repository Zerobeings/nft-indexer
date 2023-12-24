function openNetwork(evt, networkName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(networkName).style.display = "block";
    evt.currentTarget.className += " active";

    // Load data for the selected network
    loadData(networkName);
}

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
    // <img src="${data.image}" alt="${data.name}">
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

// Initial load
openNetwork({ currentTarget: document.getElementsByClassName("tablinks")[0] }, 'Ethereum');
