const menu = () => {
    /*======================= MENU =======================*/
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    const navClose = document.getElementById('nav-close');

    // Use event delegation for more efficient event handling
    const toggleMenu = (show) => {
        navMenu.classList.toggle('show-menu', show);
    };

    // Open menu
    navToggle?.addEventListener('click', () => toggleMenu(true));

    // Close menu
    navClose?.addEventListener('click', () => toggleMenu(false));

    // Use event delegation for menu links and outside clicks
    document.addEventListener('click', (event) => {
        // Check if menu is currently open
        const isMenuOpen = navMenu.classList.contains('show-menu');

        // Determine if click is outside menu and toggle button
        const isOutsideMenu =
            !navMenu.contains(event.target) &&
            !navToggle.contains(event.target);

        // Close menu if it's open and clicked outside
        if (isMenuOpen && isOutsideMenu) {
            toggleMenu(false);
        }

        // Close menu when a nav link is clicked
        if (event.target.matches('#nav-menu a')) {
            toggleMenu(false);
        }
    });
};

export default menu;
