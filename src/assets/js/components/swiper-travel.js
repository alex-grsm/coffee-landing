// import Swiper from 'swiper/bundle';
import Swiper from 'swiper';
import { Pagination } from 'swiper/modules';

/*=============== SWIPER PLANETS ===============*/
const swiperTravel = () => {
    const swiper = new Swiper('.travel__swiper', {
        modules: [Pagination],
        loop: true,
        spaceBetween: 32,
        grabCursor: true,
        slidesPerView: 'auto',
        centeredSlides: true,
    
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
    
        breakpoints: {
            600: {
                slidesPerView: 2,
            },
            900: {
                slidesPerView: 3,
            },
        },
    });
};


export default swiperTravel;