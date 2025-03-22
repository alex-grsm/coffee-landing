// import Swiper from 'swiper/bundle';
import Swiper from 'swiper';
// import { Pagination } from 'swiper/modules';

const swiperPopular = () => {
    const swiper = new Swiper('.popular__swiper', {
        // modules: [Pagination],
        loop: true,
        grabCursor: true,
        spaceBetween: 32,
        slidesPerView: 'auto',
        centeredSlides: true,
    
        // pagination: {
        //     el: '.swiper-pagination',
        //     clickable: true,
        // },
    
        breakpoints: {
            1150: {
                spaceBetween: 80,
            },
        },
    });
};


export default swiperPopular;