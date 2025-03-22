/**
 * @license ScrollEjuk v2.1.0
 * Licensed under the MIT License.
 * https://opensource.org/licenses/MIT
 */

class ScrollEjuk {
    static #instance = null;
    
    /**
     * Получение экземпляра ScrollEjuk (паттерн Singleton)
     * @param {Object} options - Настройки
     * @returns {ScrollEjuk} - Экземпляр ScrollEjuk
     */
    static getInstance(options = {}) {
        if (!ScrollEjuk.#instance) {
            ScrollEjuk.#instance = new ScrollEjuk(options);
        }
        return ScrollEjuk.#instance;
    }

    constructor(options = {}) {
        // Проверка на существующий экземпляр (Singleton)
        if (ScrollEjuk.#instance) {
            console.warn('ScrollEjuk уже инициализирован. Используйте ScrollEjuk.getInstance()');
            return ScrollEjuk.#instance;
        }

        // Проверка на предпочтение уменьшенного движения
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Настройки по умолчанию
        this.options = {
            delay: 0,
            distance: '0',
            duration: prefersReducedMotion ? 0 : 600,
            easing: 'cubic-bezier(0.5, 0, 0, 1)',
            interval: 0,
            opacity: 0,
            origin: 'bottom',
            rotate: { x: 0, y: 0, z: 0 },
            scale: 1,
            cleanup: false,
            reset: false,
            viewFactor: 0.1,
            viewOffset: { top: 0, right: 0, bottom: 0, left: 0 },
            animationStrategy: 'css', // 'css' или 'waap'
            observerOptions: { rootMargin: '0px', threshold: 0 },
            performance: {
                useIntersectionObserver: true,
                passiveEvents: true
            },
            respectPositioning: false, // Учитывать существующее позиционирование элемента
            forceAnimation: false, // Принудительная анимация даже при reduced-motion
            afterReveal: () => {},
            afterReset: () => {},
            beforeReveal: () => {},
            beforeReset: () => {},
            ...options
        };
        
        // Принудительное включение анимации, если установлен forceAnimation
        if (this.options.forceAnimation && prefersReducedMotion) {
            this.options.duration = options.duration || 600;
        }

        // Кэширование селекторов
        this.selectorCache = new Map();
        
        // Хранилище элементов и их настроек
        this.store = new Map();
        
        // Кэш для трансформаций
        this.transformCache = new Map();
        
        // IntersectionObserver
        this.observer = null;
        
        // Fallback для скролла
        this.fallbackScrollHandler = null;
        
        // Инициализация
        this.initObserver();
        
        // MutationObserver для отслеживания удаления элементов
        this.initMutationObserver();
        
        // Установка экземпляра
        ScrollEjuk.#instance = this;
    }

    /**
     * Инициализация IntersectionObserver или резервного метода
     */
    initObserver() {
        if (!this.options.performance.useIntersectionObserver || !('IntersectionObserver' in window)) {
            console.warn('IntersectionObserver не поддерживается, переключение на резервный механизм.');
            this.fallbackScrollHandler = this.handleScroll.bind(this);
            window.addEventListener('scroll', this.fallbackScrollHandler, 
                this.options.performance.passiveEvents ? { passive: true } : false);
            // Начальная проверка видимости всех элементов
            window.addEventListener('load', () => {
                this.handleScroll();
            });
            return;
        }

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const el = entry.target;
                if (entry.isIntersecting) {
                    this.revealElement(el);
                } else if (this.options.reset) {
                    this.resetElement(el);
                }
            });
        }, this.options.observerOptions);
    }
    
    /**
     * Инициализация MutationObserver для отслеживания удаления элементов
     */
    initMutationObserver() {
        if ('MutationObserver' in window) {
            this.mutationObserver = new MutationObserver(this.handleDOMMutations.bind(this));
            this.mutationObserver.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
        }
    }
    
    /**
     * Обработчик мутаций DOM для очистки удаленных элементов
     * @param {MutationRecord[]} mutations - Записи мутаций
     */
    handleDOMMutations(mutations) {
        mutations.forEach(mutation => {
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    this.cleanupRemovedElement(node);
                    // Проверка дочерних элементов
                    if (node.querySelectorAll) {
                        node.querySelectorAll('[data-scroll-ejuk-id]').forEach(
                            child => this.cleanupRemovedElement(child)
                        );
                    }
                }
            });
        });
    }
    
    /**
     * Очистка ресурсов для удаленного элемента
     * @param {HTMLElement} el - Удаленный элемент
     */
    cleanupRemovedElement(el) {
        if (this.store.has(el)) {
            if (this.observer) this.observer.unobserve(el);
            this.store.delete(el);
        }
    }
    
    /**
     * Обработчик события скролла (резервный метод)
     */
    handleScroll() {
        // Использование requestAnimationFrame для оптимизации производительности
        requestAnimationFrame(() => {
            // Проверка всех элементов в хранилище
            this.store.forEach((options, el) => {
                if (this.isElementInViewport(el, options.viewFactor)) {
                    this.revealElement(el);
                } else if (options.reset) {
                    this.resetElement(el);
                }
            });
        });
    }
    
    /**
     * Проверка видимости элемента (для резервного метода)
     * @param {HTMLElement} el - Элемент для проверки
     * @param {number} viewFactor - Коэффициент видимости
     * @returns {boolean} - Видим ли элемент
     */
    isElementInViewport(el, viewFactor) {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        
        // Элемент считается видимым, если он находится в пределах экрана с учетом viewFactor
        const threshold = viewFactor * rect.height;
        
        return (
            rect.bottom >= threshold && 
            rect.top <= windowHeight - threshold
        );
    }

    /**
     * Отображение элементов
     * @param {string|HTMLElement|HTMLElement[]} target - Селектор или элементы
     * @param {Object} options - Настройки
     */
    reveal(target, options = {}) {
        // Кэширование DOM-запросов
        let elements;
        
        if (typeof target === 'string') {
            // Проверка кэша селекторов
            if (!this.selectorCache.has(target)) {
                this.selectorCache.set(target, Array.from(document.querySelectorAll(target)));
            }
            elements = this.selectorCache.get(target);
        } else {
            elements = Array.isArray(target) ? target : [target];
        }

        if (elements.length === 0) {
            console.warn(`ScrollEjuk: Не найдено элементов для "${target}"`);
            return;
        }

        elements.forEach((el, index) => {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
            
            if (!el.hasAttribute('data-scroll-ejuk-id')) {
                el.setAttribute('data-scroll-ejuk-id', `scroll-ejuk-${Date.now()}-${index}`);
            }

            const finalOptions = { ...this.options, ...options };
            finalOptions.calculatedDelay = finalOptions.delay + (index * finalOptions.interval);
            this.store.set(el, finalOptions);

            this.prepareElement(el, finalOptions);

            if (this.observer) {
                this.observer.observe(el);
            } else {
                // Для резервного метода проверяем видимость сразу
                if (this.isElementInViewport(el, finalOptions.viewFactor)) {
                    this.revealElement(el);
                }
            }
        });
    }

    /**
     * Подготовка элемента к анимации
     * @param {HTMLElement} el - Элемент
     * @param {Object} options - Настройки
     */
    prepareElement(el, options) {
        if (el.hasAttribute('data-scroll-ejuk-initialized')) return;

        const styles = {
            opacity: options.opacity,
            visibility: 'visible',
            transform: this.computeTransform(options, el) // Передаем элемент для учета его позиционирования
        };

        Object.assign(el.style, styles);
        el.setAttribute('data-scroll-ejuk-initialized', 'true');
    }

    /**
     * Вычисление CSS-трансформации
     * @param {Object} options - Настройки
     * @returns {string} - CSS трансформация
     */
    computeTransform(options, el = null) {
        // Использование кэша для идентичных опций
        const key = JSON.stringify({
            distance: options.distance, 
            origin: options.origin,
            rotate: options.rotate,
            scale: options.scale,
            respectPositioning: options.respectPositioning
        });
        
        if (this.transformCache.has(key) && !options.respectPositioning) {
            return this.transformCache.get(key);
        }
        
        const transforms = [];
        
        // Обработка трансформации с учетом позиционирования
        if (options.distance) {
            // Если нужно учитывать позиционирование и есть DOM-элемент
            if (options.respectPositioning && el) {
                // Проверяем стиль позиционирования элемента
                const computedStyle = window.getComputedStyle(el);
                const position = computedStyle.position;
                const hasPositioning = position === 'absolute' || position === 'fixed' || position === 'relative';
                
                // Если у элемента есть свойство, которое может конфликтовать с трансформацией, 
                // не добавляем соответствующую трансформацию
                if (hasPositioning) {
                    if (options.origin === 'left' && computedStyle.left !== 'auto') {
                        // Пропускаем translateX для элементов с установленным left
                    } 
                    else if (options.origin === 'right' && computedStyle.right !== 'auto') {
                        // Пропускаем translateX для элементов с установленным right
                    }
                    else if (options.origin === 'top' && computedStyle.top !== 'auto') {
                        // Пропускаем translateY для элементов с установленным top
                    }
                    else if (options.origin === 'bottom' && computedStyle.bottom !== 'auto') {
                        // Пропускаем translateY для элементов с установленным bottom
                    }
                    else {
                        // В остальных случаях применяем стандартную трансформацию
                        const direction = {
                            'top': `translateY(-${options.distance})`,
                            'bottom': `translateY(${options.distance})`,
                            'left': `translateX(-${options.distance})`,
                            'right': `translateX(${options.distance})`
                        };
                        transforms.push(direction[options.origin] || direction['bottom']);
                    }
                } else {
                    // Если у элемента нет конфликтующего позиционирования, применяем стандартную трансформацию
                    const direction = {
                        'top': `translateY(-${options.distance})`,
                        'bottom': `translateY(${options.distance})`,
                        'left': `translateX(-${options.distance})`,
                        'right': `translateX(${options.distance})`
                    };
                    transforms.push(direction[options.origin] || direction['bottom']);
                }
            } else {
                // Стандартная трансформация без учета позиционирования
                const direction = {
                    'top': `translateY(-${options.distance})`,
                    'bottom': `translateY(${options.distance})`,
                    'left': `translateX(-${options.distance})`,
                    'right': `translateX(${options.distance})`
                };
                transforms.push(direction[options.origin] || direction['bottom']);
            }
        }
        
        if (options.rotate.x) transforms.push(`rotateX(${options.rotate.x}deg)`);
        if (options.rotate.y) transforms.push(`rotateY(${options.rotate.y}deg)`);
        if (options.rotate.z) transforms.push(`rotateZ(${options.rotate.z}deg)`);
        
        if (options.scale !== 1) transforms.push(`scale(${options.scale})`);
        
        const result = transforms.join(' ');
        
        // Кэшируем результат только если не учитываем позиционирование
        if (!options.respectPositioning) {
            this.transformCache.set(key, result);
        }
        
        return result;
    }

    /**
     * Отображение элемента
     * @param {HTMLElement} el - Элемент
     */
    revealElement(el) {
        if (!el || !this.store.has(el)) return;
        
        const options = this.store.get(el);
        
        // Проверяем, не был ли элемент уже обработан
        if (el.hasAttribute('data-scroll-ejuk-complete')) return;
        
        if (typeof options.beforeReveal === 'function') options.beforeReveal(el);

        if (options.animationStrategy === 'waap' && window.Animation && el.animate) {
            this.animateWithWAAP(el, options);
        } else {
            this.animateWithCSS(el, options);
        }

        // Если reset не требуется и используется IntersectionObserver, отключаем наблюдение
        if (!options.reset && this.observer) {
            this.observer.unobserve(el);
        }
        
        // Маркируем элемент как обработанный
        el.setAttribute('data-scroll-ejuk-complete', 'true');
    }

    /**
     * Анимация с использованием CSS
     * @param {HTMLElement} el - Элемент
     * @param {Object} options - Настройки
     */
    animateWithCSS(el, options) {
        if (options.duration === 0) {
            // Мгновенное отображение для случаев без анимации
            if (options.respectPositioning) {
                // Для элементов с учетом позиционирования обновляем только opacity
                el.style.opacity = '1';
                // Сохраняем только ротацию и масштаб, если они есть
                const keepTransforms = [];
                if (options.rotate.x) keepTransforms.push(`rotateX(0deg)`);
                if (options.rotate.y) keepTransforms.push(`rotateY(0deg)`);
                if (options.rotate.z) keepTransforms.push(`rotateZ(0deg)`);
                if (options.scale !== 1) keepTransforms.push(`scale(1)`);
                
                if (keepTransforms.length > 0) {
                    el.style.transform = keepTransforms.join(' ');
                }
            } else {
                // Стандартное поведение для обычных элементов
                Object.assign(el.style, {
                    opacity: '1',
                    transform: 'none'
                });
            }
            
            if (typeof options.afterReveal === 'function') options.afterReveal(el);
            if (options.cleanup) this.cleanupElement(el);
            return;
        }
        
        setTimeout(() => {
            // Использование requestAnimationFrame для оптимизации производительности
            requestAnimationFrame(() => {
                if (options.respectPositioning) {
                    // Для элементов с учетом позиционирования
                    const computedStyle = window.getComputedStyle(el);
                    const position = computedStyle.position;
                    const hasPositioning = position === 'absolute' || position === 'fixed' || position === 'relative';
                    
                    if (hasPositioning) {
                        // Обрабатываем только opacity и возможную ротацию/масштаб
                        el.style.transition = `opacity ${options.duration}ms ${options.easing}, transform ${options.duration}ms ${options.easing}`;
                        el.style.opacity = '1';
                        
                        // Обновляем только части transform, которые не конфликтуют с позиционированием
                        const keepTransforms = [];
                        if (options.rotate.x) keepTransforms.push(`rotateX(0deg)`);
                        if (options.rotate.y) keepTransforms.push(`rotateY(0deg)`);
                        if (options.rotate.z) keepTransforms.push(`rotateZ(0deg)`);
                        if (options.scale !== 1) keepTransforms.push(`scale(1)`);
                        
                        if (keepTransforms.length > 0) {
                            el.style.transform = keepTransforms.join(' ');
                        }
                    } else {
                        // Стандартное поведение для элементов без конфликтующего позиционирования
                        Object.assign(el.style, {
                            transition: `opacity ${options.duration}ms ${options.easing}, transform ${options.duration}ms ${options.easing}`,
                            opacity: '1',
                            transform: 'none'
                        });
                    }
                } else {
                    // Стандартное поведение
                    Object.assign(el.style, {
                        transition: `opacity ${options.duration}ms ${options.easing}, transform ${options.duration}ms ${options.easing}`,
                        opacity: '1',
                        transform: 'none'
                    });
                }

                setTimeout(() => {
                    if (typeof options.afterReveal === 'function') options.afterReveal(el);
                    if (options.cleanup) this.cleanupElement(el);
                }, options.duration);
            });
        }, options.calculatedDelay);
    }

    /**
     * Анимация с использованием Web Animation API
     * @param {HTMLElement} el - Элемент
     * @param {Object} options - Настройки
     */
    animateWithWAAP(el, options) {
        if (options.duration === 0) {
            // Мгновенное отображение для случаев без анимации
            if (options.respectPositioning) {
                // Для элементов с учетом позиционирования
                el.style.opacity = '1';
                // Сохраняем только ротацию и масштаб, если они есть
                const keepTransforms = [];
                if (options.rotate.x) keepTransforms.push(`rotateX(0deg)`);
                if (options.rotate.y) keepTransforms.push(`rotateY(0deg)`);
                if (options.rotate.z) keepTransforms.push(`rotateZ(0deg)`);
                if (options.scale !== 1) keepTransforms.push(`scale(1)`);
                
                if (keepTransforms.length > 0) {
                    el.style.transform = keepTransforms.join(' ');
                }
            } else {
                // Стандартное поведение
                el.style.opacity = '1';
                el.style.transform = 'none';
            }
            
            if (typeof options.afterReveal === 'function') options.afterReveal(el);
            if (options.cleanup) this.cleanupElement(el);
            return;
        }
        
        let fromTransform, toTransform;
        
        if (options.respectPositioning) {
            // Для элементов с учетом позиционирования
            const computedStyle = window.getComputedStyle(el);
            const position = computedStyle.position;
            const hasPositioning = position === 'absolute' || position === 'fixed' || position === 'relative';
            
            if (hasPositioning) {
                // Начальная трансформация с учетом позиционирования
                const initialTransforms = [];
                if (options.rotate.x) initialTransforms.push(`rotateX(${options.rotate.x}deg)`);
                if (options.rotate.y) initialTransforms.push(`rotateY(${options.rotate.y}deg)`);
                if (options.rotate.z) initialTransforms.push(`rotateZ(${options.rotate.z}deg)`);
                if (options.scale !== 1) initialTransforms.push(`scale(${options.scale})`);
                fromTransform = initialTransforms.join(' ');
                
                // Конечная трансформация только для ротации и масштаба
                const finalTransforms = [];
                if (options.rotate.x) finalTransforms.push(`rotateX(0deg)`);
                if (options.rotate.y) finalTransforms.push(`rotateY(0deg)`);
                if (options.rotate.z) finalTransforms.push(`rotateZ(0deg)`);
                if (options.scale !== 1) finalTransforms.push(`scale(1)`);
                toTransform = finalTransforms.length > 0 ? finalTransforms.join(' ') : '';
            } else {
                // Стандартные трансформации для элементов без конфликтующего позиционирования
                fromTransform = this.computeTransform(options);
                toTransform = 'none';
            }
        } else {
            // Стандартные трансформации
            fromTransform = this.computeTransform(options);
            toTransform = 'none';
        }
        
        const animation = el.animate([
            { opacity: options.opacity, transform: fromTransform },
            { opacity: 1, transform: toTransform }
        ], {
            duration: options.duration,
            easing: options.easing,
            delay: options.calculatedDelay,
            fill: 'forwards'
        });
        
        animation.onfinish = () => {
            // Применяем стили напрямую после завершения анимации
            el.style.opacity = '1';
            if (toTransform) {
                el.style.transform = toTransform;
            } else {
                el.style.transform = '';
            }
            
            if (typeof options.afterReveal === 'function') options.afterReveal(el);
            if (options.cleanup) this.cleanupElement(el);
        };
    }

    /**
     * Сброс элемента (для опции reset)
     * @param {HTMLElement} el - Элемент
     */
    resetElement(el) {
        if (!el || !this.store.has(el)) return;
        
        const options = this.store.get(el);
        
        // Снимаем маркер обработки для повторного отображения
        el.removeAttribute('data-scroll-ejuk-complete');
        
        if (typeof options.beforeReset === 'function') options.beforeReset(el);

        if (options.animationStrategy === 'waap' && window.Animation && el.animate) {
            el.animate([
                { opacity: '1', transform: 'none' },
                { opacity: options.opacity, transform: this.computeTransform(options) }
            ], {
                duration: options.duration,
                easing: options.easing,
                fill: 'forwards'
            }).onfinish = () => {
                if (typeof options.afterReset === 'function') options.afterReset(el);
            };
        } else {
            el.style.transition = `opacity ${options.duration}ms ${options.easing}, transform ${options.duration}ms ${options.easing}`;
            el.style.opacity = options.opacity;
            el.style.transform = this.computeTransform(options);

            setTimeout(() => {
                if (typeof options.afterReset === 'function') options.afterReset(el);
            }, options.duration);
        }
    }

    /**
     * Очистка стилей элемента
     * @param {HTMLElement} el - Элемент
     */
    cleanupElement(el) {
        if (!el) return;
        
        el.style.transition = '';
        el.style.transform = '';
    }

    /**
     * Синхронизация (переоценка) всех элементов
     */
    sync() {
        // Очистка кэша селекторов
        this.selectorCache.clear();
        
        if (this.observer) {
            this.store.forEach((_, el) => {
                this.observer.unobserve(el);
                this.observer.observe(el);
            });
        } else if (this.fallbackScrollHandler) {
            // Для резервного метода выполняем проверку видимости
            this.handleScroll();
        }
    }

    /**
     * Уничтожение экземпляра и очистка ресурсов
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        
        if (this.fallbackScrollHandler) {
            window.removeEventListener('scroll', this.fallbackScrollHandler);
        }
        
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        // Очистка кэшей
        this.store.clear();
        this.selectorCache.clear();
        this.transformCache.clear();
        
        // Сброс экземпляра
        ScrollEjuk.#instance = null;
    }
    
}

export default ScrollEjuk;