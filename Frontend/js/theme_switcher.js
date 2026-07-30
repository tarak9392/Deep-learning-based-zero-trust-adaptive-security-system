// Frontend/js/theme_switcher.js

const THEMES = {
    'indigo': {
        name: 'Indigo Cyber',
        class: 'theme-indigo'
    },
    'emerald': {
        name: 'Emerald Sentinel',
        class: 'theme-emerald'
    },
    'platinum': {
        name: 'Platinum Light',
        class: 'theme-platinum'
    }
};

function applyTheme(themeKey) {
    const key = THEMES[themeKey] ? themeKey : 'indigo';
    document.body.classList.remove('theme-indigo', 'theme-emerald', 'theme-platinum');
    document.body.classList.add(THEMES[key].class);
    localStorage.setItem('zt_theme', key);
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
        if (btn.getAttribute('data-theme') === key) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('zt_theme') || 'indigo';
    applyTheme(savedTheme);
});
