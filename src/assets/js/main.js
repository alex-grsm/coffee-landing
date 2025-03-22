import ScrollEjuk from './scrollejuk.js';
import menu from './components/menu';
import scrollHeader from './components/scroll-header';
import swiperPopular from './components/swiper-popular';
import scrollUp from './components/scroll-up';
import scrollActiveLink from './components/scroll-active-link';

menu();
scrollHeader();
scrollUp();
scrollActiveLink();

swiperPopular();

const ej = new ScrollEjuk({
    origin: 'top',
    distance: '60px',
    duration: 2000,
    delay: 300,
    observerOptions: { 
        rootMargin: '10px',
        threshold: 0.1
    }
});

ej.reveal(`.popular__swiper, .footer__container, .footer__copy`);

ej.reveal(`.home__shape`, { origin: 'bottom' });
ej.reveal(`.home__coffee`, { delay: 1000, distance: '200px', duration: 1500 });
ej.reveal(`.home__splash`, { delay: 1600, scale: '0', duration: 1500 });
ej.reveal(`.home__bean-1, .home__bean-2`, { delay: 2200, scale: '0', duration: 1500, rotate: { z: 180 } });
ej.reveal(`.home__ice-1, .home__ice-2`, { delay: 2600, scale: '0', duration: 1500, rotate: { z: 180 } });
ej.reveal(`.home__leaf`, { delay: 2800, scale: '0', duration: 1500, rotate: { z: 90 } });
ej.reveal(`.home__title`, { delay: 3500 });
ej.reveal(`.home__data, .home__sticker`, { delay: 4000 });

ej.reveal(`.about__data`, { origin: 'left' });
ej.reveal(`.about__images`, { origin: 'right' });
ej.reveal(`.about__coffee`, { delay: 1000 });
ej.reveal(`.about__leaf-1, .about__leaf-2`, { delay: 1400, rotate: { z: 90 } });

ej.reveal(`.products__card, .contact__info`, { interval: 100 });
ej.reveal(`.contact__shape`, { delay: 600, scale: 0 });
ej.reveal(`.contact__delivery`, { delay: 1200, scale: 0 });
