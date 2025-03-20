// import scrollreveal from 'scrollreveal';
// import ScrollEjuk from './scrollejuk.js';
import menu from './components/menu';
import scrollHeader from './components/scroll-header';
// import swiperTravel from './components/swiper-travel';
// import scrollUp from './components/scroll-up';
// import scrollActiveLink from './components/scroll-active-link';

menu();
scrollHeader();
// scrollUp();
// scrollActiveLink();

// swiperTravel();

// const sr = scrollreveal({
//     origin: 'top',
//     distance: '80px',
//     duration: 2500,
//     delay: 300,
//     // reset: true,
// });

// sr.reveal(`.home__data, .travel__swiper, .contact__container`);
// sr.reveal(`.home__img`, { origin: 'bottom' });
// sr.reveal(`.home__ovni`, { delay: 800 });
// sr.reveal(`.explore__img`, { origin: 'left' });
// sr.reveal(`.explore__data`, { origin: 'right' });
// sr.reveal(`.explore__planet`, { origin: 'right', delay: 800 });
// sr.reveal(`.history__card`, { interval: 100 });
// sr.reveal(`.history__planet--1`, { origin: 'left', delay: 1000 });
// sr.reveal(`.history__planet--2`, { origin: 'right', delay: 1200 });
// sr.reveal(`.footer__planet--1`, { origin: 'bottom', delay: 600 });
// sr.reveal(`.footer__planet--2`, { delay: 800 });

// const ej = new ScrollEjuk({
//     origin: 'top',
//     distance: '80px',
//     duration: 2200,
//     delay: 200,
// });
// ej.reveal(`.home__data, .travel__swiper`);
// ej.reveal(`.home__img`, { origin: 'top', rotate: { z: 10 } });
// ej.reveal(`.home__ovni`, { delay: 800, rotate: { z: -10 } });
// ej.reveal(`.explore__img`, { origin: 'left', rotate: { z: -10 } });
// ej.reveal(`.explore__data`, { origin: 'right' });
// ej.reveal(`.explore__planet`, { origin: 'right', delay: 800, rotate: { z: 10 } });

// ej.reveal(`.history__card`, { 
//     interval: 200,
//     origin: 'left',
//     rotate: { z: 5 }
// });

// ej.reveal(`.history__planet--1`, { 
//     origin: 'left', 
//     delay: 1000,
//     rotate: { z: 90 },
//     beforeReveal: (el) => console.log('Анимация planet-1 началась в', new Date().getTime())
// });

// ej.reveal(`.history__planet--2`, { 
//     origin: 'right', 
//     delay: 1200,
//     rotate: { z: 90 },
//     // respectPositioning: true,
//     beforeReveal: (el) => console.log('Анимация planet-2 началась в', new Date().getTime())
// });

// ej.reveal(`.contact__form`, { 
//     origin: 'bottom', 
//     distance: '0',
//     scale: 0.6,
// });

// ej.reveal(`.footer__planet--1`, { origin: 'bottom', delay: 600 });
// ej.reveal(`.footer__planet--2`, { delay: 800 });
