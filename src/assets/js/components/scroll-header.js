const scrollHeader = () => {
    /*=============== ADD SCROLL HEADER ===============*/
    const header = document.getElementById('header');
    
    // Проверка существования элемента header
    if (!header) return;
    
    // Используем requestAnimationFrame для оптимизации производительности
    let ticking = false;
    
    const scrollHeaderF = () => {
        if (window.scrollY >= 50) {
            header.classList.add('scroll-header');
        } else {
            header.classList.remove('scroll-header');
        }
        ticking = false;
    };
    
    const onScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(scrollHeaderF);
            ticking = true;
        }
    };
    
    // Добавляем обработчик события прокрутки с параметром passive для улучшения производительности
    window.addEventListener('scroll', onScroll, { passive: true });
    
    // Установка начального состояния
    scrollHeaderF();
    
    // Возвращаем функцию для удаления обработчика при необходимости
    return () => {
        window.removeEventListener('scroll', onScroll);
    };
};

export default scrollHeader;