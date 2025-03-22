const customCursor = () => {
    const iceElement = document.querySelector('.ice-cube-cursor');
    if (!iceElement) return; // Если элемент не найден, прерываем выполнение

    // Кэшируем SVG-путь для смены градиента
    const mainPath = iceElement.querySelector('svg path:first-of-type');

    // Объекты для отслеживания позиций
    const mouse = { x: 0, y: 0 };
    const previousMouse = { x: 0, y: 0 };
    const ice = { x: 0, y: 0 };

    // Переменные для масштабирования и вращения
    let currentScale = 0;
    let currentAngle = 0;
    let isHovering = false;

    // Функция для получения текущего уровня масштабирования
    const getZoomLevel = () => {
        const zoom = window.getComputedStyle(document.body).zoom;
        return zoom && zoom !== 'normal' ? parseFloat(zoom) : 1;
    };

    // Обновляем позицию мыши с учетом зума, используя опцию passive для повышения производительности
    window.addEventListener(
        'mousemove',
        e => {
            const zoomLevel = getZoomLevel();
            mouse.x = e.x / zoomLevel;
            mouse.y = e.y / zoomLevel;
        },
        { passive: true }
    );

    // Селектор для кликабельных элементов
    const interactiveElements = document.querySelectorAll(
        'a, button, [role="button"], input[type="submit"], input[type="button"], input[type="text"], input[type="email"], input[type="password"], textarea, select, .clickable, [data-clickable="true"]'
    );

    // Добавляем обработчики событий для интерактивных элементов
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            iceElement.classList.add('clickable');
            isHovering = true;
            if (mainPath) {
                mainPath.setAttribute('fill', 'url(#iceGradientHover)');
            }
        });

        el.addEventListener('mouseleave', () => {
            iceElement.classList.remove('clickable');
            isHovering = false;
            if (mainPath) {
                mainPath.setAttribute('fill', 'url(#iceGradient)');
            }
        });
    });

    // Эффекты при клике
    document.addEventListener('mousedown', () => {
        iceElement.classList.add('clicking');
    });
    document.addEventListener('mouseup', () => {
        iceElement.classList.remove('clicking');
    });

    // Коэффициент сглаживания для анимации
    const speed = 0.17;

    // Функция анимации
    const tick = () => {
        // Плавное перемещение курсора
        ice.x += (mouse.x - ice.x) * speed;
        ice.y += (mouse.y - ice.y) * speed;

        // Расчёт изменения позиции мыши
        const deltaMouseX = mouse.x - previousMouse.x;
        const deltaMouseY = mouse.y - previousMouse.y;
        previousMouse.x = mouse.x;
        previousMouse.y = mouse.y;

        // Вычисляем скорость мыши и ограничиваем её
        const mouseVelocity = Math.min(Math.hypot(deltaMouseX, deltaMouseY) * 4, 150);
        const scaleValue = (mouseVelocity / 150) * 0.5;
        currentScale += (scaleValue - currentScale) * speed;

        // Применяем масштабирование, если курсор не наведен на интерактивный элемент
        const scaleTransform = !isHovering ? `scale3d(${1 + currentScale * 0.3}, ${1 - currentScale * 0.3}, 1)` : '';

        // Вычисляем угол для вращения и обновляем его при достаточной скорости
        const angle = (Math.atan2(deltaMouseY, deltaMouseX) * 180) / Math.PI;
        if (mouseVelocity > 20) {
            currentAngle = angle;
        }
        const rotateTransform = !isHovering ? `rotate3d(0, 0, 1, ${currentAngle * 0.1}deg)` : '';

        // Применяем трансформации к элементу
        iceElement.style.transform = `translate3d(${ice.x}px, ${ice.y}px, 0) ${rotateTransform} ${scaleTransform}`;

        window.requestAnimationFrame(tick);
    };

    tick();
};

export default customCursor;
