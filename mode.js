const darkModeToggle = document.getElementById('darkModeToggle');
const iconSun = darkModeToggle.querySelector('.fa-sun');
const iconMoon = darkModeToggle.querySelector('.fa-moon');

darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    iconSun.classList.toggle('hidden');
    iconMoon.classList.toggle('hidden');
});

// Initialize the correct icon
iconSun.classList.toggle('hidden', document.body.classList.contains('dark-mode'));
iconMoon.classList.toggle('hidden', !document.body.classList.contains('dark-mode'));