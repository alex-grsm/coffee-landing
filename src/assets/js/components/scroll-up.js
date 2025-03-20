/*=============== SHOW SCROLL UP ===============*/
const scrollUp = () => {
    const scrollUp = document.getElementById('scroll-up');
    
    if (!scrollUp) return;
    
    requestAnimationFrame(() => {
        scrollUp.classList.toggle('show-scroll', window.scrollY >= 350);
    });
}

window.addEventListener('scroll', scrollUp, { passive: true });

export default scrollUp;