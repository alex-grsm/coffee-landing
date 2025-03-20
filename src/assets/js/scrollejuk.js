/**
 * @license ScrollEjuk v3.0.0
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
        } else if (Object.keys(options).length > 0) {
            // Если экземпляр уже существует, но переданы новые опции, обновляем настройки
            ScrollEjuk.#instance.updateOptions(options);
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
            respectPositioning: false, // Учитывать существующее позиционирование элемента
            forceAnimation: false, // Принудительная анимация даже при reduced-motion
            afterReveal: () => {},
            afterReset: () => {},
            beforeReveal: () => {},
            beforeReset: () => {},
            // Расширенные настройки производительности
            performance: {
                useIntersectionObserver: true,
                passiveEvents: true,
                useGPU: true,                   // Использование GPU-ускорения
                lazyInit: true,                 // Ленивая инициализация элементов
                batchProcessing: true,          // Пакетная обработка DOM-операций
                virtualizeOffscreen: true,      // Виртуализация невидимых элементов
                inactivityTimeout: 1000,        // Время бездействия до оптимизации (мс)
                throttleDelay: 16,              // Задержка для тротлинга (≈60fps)
                adaptiveTiming: true,           // Адаптивная настройка времени
                useWebWorker: 'auto',           // Использование Web Workers
                predictiveLoading: true,        // Предиктивная загрузка
                maxActiveElements: 100,         // Максимальное число активных элементов
                devicePerformance: 'auto',      // Автоопределение производительности устройства
            },
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
        
        // Кэши и хранилища для производительности
        this.batchQueue = [];               // Очередь для пакетной обработки
        this.elementsQueue = [];            // Очередь элементов для инициализации
        this.elementsPriority = new Map();  // Приоритеты элементов
        this.performanceStats = {           // Статистика производительности
            fps: 0,
            lastFrameTime: 0,
            frameCount: 0,
            lowFpsCount: 0
        };
        
        // Определение производительности устройства
        this.detectDevicePerformance();
        
        // Инициализация
        this.initObserver();
        
        // Инициализация Web Worker если возможно и необходимо
        this.initWebWorker();
        
        // MutationObserver для отслеживания удаления элементов
        this.initMutationObserver();
        
        // Обработчики оптимизации
        this.setupPerformanceHandlers();
        
        // Установка экземпляра
        ScrollEjuk.#instance = this;
    }

    /**
     * Обновление настроек существующего экземпляра
     * @param {Object} options - Новые настройки
     */
    updateOptions(options) {
        // Объединение настроек
        this.options = {
            ...this.options,
            ...options,
            performance: {
                ...this.options.performance,
                ...(options.performance || {})
            }
        };
        
        // Переинициализация обсерверов при необходимости
        if (options.observerOptions || 
            (options.performance && 
             (options.performance.useIntersectionObserver !== undefined ||
              options.performance.passiveEvents !== undefined))) {
            
            // Пересоздаем IntersectionObserver
            if (this.observer) {
                // Сохраняем текущие наблюдаемые элементы
                const observedElements = [];
                this.store.forEach((_, el) => {
                    if (el.hasAttribute('data-scroll-ejuk-observed')) {
                        observedElements.push(el);
                    }
                });
                
                this.observer.disconnect();
                this.initObserver();
                
                // Восстанавливаем наблюдение
                observedElements.forEach(el => {
                    if (this.observer) this.observer.observe(el);
                });
            } else {
                this.initObserver();
            }
        }
    }
    
    /**
     * Определение производительности устройства
     */
    detectDevicePerformance() {
        if (this.options.performance.devicePerformance !== 'auto') return;
        
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const memory = navigator.deviceMemory || (mobile ? 2 : 8);
        const processors = navigator.hardwareConcurrency || (mobile ? 2 : 4);
        const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Расчет оценки производительности (от 1 до 10)
        let performanceScore = Math.min(10, (memory / 2) + (processors / 2));
        
        // Коррекция для мобильных устройств
        if (mobile) performanceScore *= 0.7;
        
        // Установка производительности
        if (performanceScore < 3) {
            this.options.performance.devicePerformance = 'low';
        } else if (performanceScore < 7) {
            this.options.performance.devicePerformance = 'medium';
        } else {
            this.options.performance.devicePerformance = 'high';
        }
        
        // Автоматическая настройка параметров на основе производительности
        this.adjustSettingsForPerformance();
        
        console.log(`ScrollEjuk: определен уровень производительности устройства: ${this.options.performance.devicePerformance}`);
    }
    
    /**
     * Настройка параметров на основе производительности устройства
     */
    adjustSettingsForPerformance() {
        const performance = this.options.performance.devicePerformance;
        
        if (performance === 'low') {
            // Настройки для низкопроизводительных устройств
            this.options.performance.useGPU = true;
            this.options.performance.lazyInit = true;
            this.options.performance.virtualizeOffscreen = true;
            this.options.performance.throttleDelay = 32; // ~30fps
            this.options.performance.useWebWorker = false;
            this.options.performance.predictiveLoading = false;
            this.options.performance.maxActiveElements = 30;
            
            // Изменение анимации для повышения производительности
            if (typeof this.options.distance === 'string' && /px$/.test(this.options.distance)) {
                const distanceValue = parseFloat(this.options.distance);
                if (!isNaN(distanceValue)) {
                    this.options.distance = Math.min(distanceValue, 50) + 'px';
                }
            }
            this.options.duration = Math.min(this.options.duration, 400);
            this.options.interval = Math.max(this.options.interval, 50);
        } else if (performance === 'medium') {
            // Настройки для устройств со средней производительностью
            this.options.performance.throttleDelay = 20; // ~50fps
            this.options.performance.maxActiveElements = 60;
            
            // Умеренная настройка анимации
            this.options.duration = Math.min(this.options.duration, 800);
        }
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
     * Инициализация Web Worker для тяжелых вычислений
     */
    initWebWorker() {
        if (this.options.performance.useWebWorker === false || 
            typeof Worker === 'undefined') return;
            
        try {
            const workerCode = `
                self.onmessage = function(e) {
                    const { type, data } = e.data;
                    
                    if (type === 'computeTransform') {
                        const { options } = data;
                        const transforms = [];
                        
                        if (options.distance) {
                            const direction = {
                                'top': 'translateY(-' + options.distance + ')',
                                'bottom': 'translateY(' + options.distance + ')',
                                'left': 'translateX(-' + options.distance + ')',
                                'right': 'translateX(' + options.distance + ')'
                            };
                            transforms.push(direction[options.origin] || direction['bottom']);
                        }
                        
                        if (options.rotate.x) transforms.push('rotateX(' + options.rotate.x + 'deg)');
                        if (options.rotate.y) transforms.push('rotateY(' + options.rotate.y + 'deg)');
                        if (options.rotate.z) transforms.push('rotateZ(' + options.rotate.z + 'deg)');
                        
                        if (options.scale !== 1) transforms.push('scale(' + options.scale + ')');
                        
                        self.postMessage({
                            type: 'transformResult',
                            data: {
                                id: data.id,
                                transform: transforms.join(' ')
                            }
                        });
                    }
                };
            `;
            
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            
            this.worker = new Worker(workerUrl);
            this.worker.onmessage = (e) => this.handleWorkerMessage(e);
            
            // Очистка URL после создания воркера
            URL.revokeObjectURL(workerUrl);
            
            this.workerTasks = new Map();
            console.log('ScrollEjuk: Web Worker инициализирован для улучшения производительности');
        } catch (e) {
            console.warn('ScrollEjuk: не удалось инициализировать Web Worker', e);
            this.options.performance.useWebWorker = false;
        }
    }
    
    /**
     * Обработка сообщений от Web Worker
     */
    handleWorkerMessage(e) {
        const { type, data } = e.data;
        
        if (type === 'transformResult') {
            const { id, transform } = data;
            if (this.workerTasks.has(id)) {
                const { key, resolve } = this.workerTasks.get(id);
                this.transformCache.set(key, transform);
                resolve(transform);
                this.workerTasks.delete(id);
            }
        }
    }
    
    /**
     * Настройка обработчиков оптимизации производительности
     */
    setupPerformanceHandlers() {
        // Оптимизация прокрутки с использованием тротлинга
        if (this.options.performance.throttleDelay > 0) {
            this.handleScroll = this.throttle(this.handleScroll.bind(this), 
                this.options.performance.throttleDelay);
        }
        
        // Отслеживание неактивности для дополнительной оптимизации
        this.inactivityTimer = null;
        window.addEventListener('scroll', () => this.resetInactivityTimer(), 
            this.options.performance.passiveEvents ? { passive: true } : false);
        
        // Мониторинг FPS если включен режим адаптивной оптимизации
        if (this.options.performance.adaptiveTiming) {
            this.monitorPerformance();
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
                // Пропускаем уже обработанные элементы без reset
                if (el.hasAttribute('data-scroll-ejuk-complete') && !options.reset) return;
                
                if (this.isElementInViewport(el, options.viewFactor)) {
                    this.revealElement(el);
                } else if (options.reset) {
                    this.resetElement(el);
                }
            });
            
            // Виртуализация элементов вне области видимости для экономии ресурсов
            if (this.options.performance.virtualizeOffscreen) {
                this.virtualizeOffscreenElements();
            }
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
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        
        // Учет viewOffset из настроек
        const offset = this.store.get(el)?.viewOffset || this.options.viewOffset;
        
        // Элемент считается видимым, если он находится в пределах экрана с учетом viewFactor
        const threshold = viewFactor * rect.height;
        
        const top = rect.top + offset.top;
        const left = rect.left + offset.left;
        const right = rect.right - offset.right;
        const bottom = rect.bottom - offset.bottom;
        
        return (
            bottom >= threshold && 
            top <= windowHeight - threshold &&
            right >= threshold &&
            left <= windowWidth - threshold
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

        const finalOptions = { ...this.options, ...options };
        
        // Если включена ленивая инициализация и много элементов
        if (finalOptions.performance.lazyInit && elements.length > 10) {
            // Вычисляем приоритеты элементов на основе их положения
            this.calculateElementPriorities(elements);
            
            // Добавляем элементы в очередь для инициализации
            elements.forEach((el, index) => {
                if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
                
                const priority = this.elementsPriority.get(el) || 999999;
                this.elementsQueue.push({
                    el,
                    index,
                    options: finalOptions,
                    priority
                });
            });
            
            // Сортируем очередь по приоритету (сначала элементы с низким значением)
            this.elementsQueue.sort((a, b) => a.priority - b.priority);
            
            // Запускаем процесс инициализации элементов
            this.processElementsQueue();
        } else {
            // Стандартная инициализация для небольшого количества элементов
            elements.forEach((el, index) => {
                if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
                
                if (!el.hasAttribute('data-scroll-ejuk-id')) {
                    el.setAttribute('data-scroll-ejuk-id', `scroll-ejuk-${Date.now()}-${index}`);
                }
                
                // Клонирование options для каждого элемента и расчет задержки
                const elementOptions = { ...finalOptions };
                elementOptions.calculatedDelay = elementOptions.delay + (index * elementOptions.interval);
                this.store.set(el, elementOptions);
                
                // Применение GPU-ускорения если включено
                if (finalOptions.performance.useGPU) {
                    this.applyGPUAcceleration(el);
                }
                
                // Подготовка элемента
                this.prepareElement(el, elementOptions);
                
                // Наблюдение за элементом
                if (this.observer) {
                    this.observer.observe(el);
                    el.setAttribute('data-scroll-ejuk-observed', 'true');
                } else if (this.isElementInViewport(el, elementOptions.viewFactor)) {
                    this.revealElement(el);
                }
            });
        }
    }
    
    /**
     * Обработка очереди элементов с ленивой инициализацией
     */
    processElementsQueue() {
        const processStart = performance.now();
        let processedCount = 0;
        
        // Обрабатываем элементы пока не превысим лимит времени (10 мс на пакет)
        while (this.elementsQueue.length > 0 && 
              (performance.now() - processStart < 10) && 
              (processedCount < 20)) {
            
            const item = this.elementsQueue.shift();
            const { el, index, options } = item;
            
            if (!el || el.nodeType !== Node.ELEMENT_NODE) continue;
            
            if (!el.hasAttribute('data-scroll-ejuk-id')) {
                el.setAttribute('data-scroll-ejuk-id', `scroll-ejuk-${Date.now()}-${index}`);
            }
            
            // Клонирование options и расчет задержки
            const elementOptions = { ...options };
            elementOptions.calculatedDelay = elementOptions.delay + (index * elementOptions.interval);
            this.store.set(el, elementOptions);
            
            // Применение GPU-ускорения если включено
            if (options.performance.useGPU) {
                this.applyGPUAcceleration(el);
            }
            
            // Подготовка элемента
            this.prepareElement(el, elementOptions);
            
            // Наблюдение за элементом
            if (this.observer) {
                this.observer.observe(el);
                el.setAttribute('data-scroll-ejuk-observed', 'true');
            } else if (this.isElementInViewport(el, elementOptions.viewFactor)) {
                this.revealElement(el);
            }
            
            processedCount++;
        }
        
        // Если в очереди остались элементы, планируем следующий пакет
        if (this.elementsQueue.length > 0) {
            requestAnimationFrame(() => this.processElementsQueue());
        }
    }
    
    /**
     * Расчет приоритетов элементов на основе их видимости
     */
    calculateElementPriorities(elements) {
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        elements.forEach(el => {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
            
            const rect = el.getBoundingClientRect();
            const distance = Math.abs((rect.top + rect.height / 2) - (viewportHeight / 2));
            
            // Чем ближе к центру экрана, тем выше приоритет (меньше значение)
            this.elementsPriority.set(el, distance);
        });
    }
    
    /**
     * Применение GPU-ускорения к элементу
     */
    applyGPUAcceleration(el) {
        if (!el || !this.options.performance.useGPU) return;
        
        // Устанавливаем will-change для предупреждения браузера
        el.style.willChange = 'opacity, transform';
        
        // Добавляем микро-трансформацию для принудительного использования GPU
        // translateZ(0) заставляет браузер использовать аппаратное ускорение
        const currentTransform = el.style.transform || '';
        if (!currentTransform.includes('translateZ')) {
            el.style.transform = currentTransform + ' translateZ(0)';
        }
        
        // Планируем очистку will-change после завершения анимации
        const options = this.store.get(el);
        if (options) {
            const totalDuration = options.calculatedDelay + options.duration + 100; // +100ms запас
            
            setTimeout(() => {
                // Очищаем will-change если больше не нужно
                if (!el.hasAttribute('data-scroll-ejuk-active')) {
                    el.style.willChange = '';
                }
            }, totalDuration);
        }
    }
    
    /**
     * Виртуализация элементов вне зоны видимости
     */
    virtualizeOffscreenElements() {
        if (!this.options.performance.virtualizeOffscreen) return;
        
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const margin = viewportHeight * 2; // Запас в два экрана
        
        // Подсчет активных элементов
        let activeElements = 0;
        
        this.store.forEach((options, el) => {
            // Пропускаем уже обработанные элементы
            if (el.hasAttribute('data-scroll-ejuk-complete') && !options.reset) return;
            
            const rect = el.getBoundingClientRect();
            const elementTop = rect.top + scrollTop;
            const elementBottom = elementTop + rect.height;
            
            // Элемент далеко вверху или внизу от зоны видимости
            const isFarAbove = elementBottom < scrollTop - margin;
            const isFarBelow = elementTop > scrollTop + viewportHeight + margin;
            
            if (isFarAbove || isFarBelow) {
                if (this.observer && el.hasAttribute('data-scroll-ejuk-observed')) {
                    // Временно прекращаем наблюдение за удаленными элементами
                    this.observer.unobserve(el);
                    el.removeAttribute('data-scroll-ejuk-observed');
                    el.setAttribute('data-scroll-ejuk-virtualized', 'true');
                }
            } else {
                // Возобновляем наблюдение, если элемент приближается к зоне видимости
                if (this.observer && el.hasAttribute('data-scroll-ejuk-virtualized')) {
                    this.observer.observe(el);
                    el.setAttribute('data-scroll-ejuk-observed', 'true');
                    el.removeAttribute('data-scroll-ejuk-virtualized');
                }
                activeElements++;
            }
        });
        
        // Если активных элементов слишком много, применяем более агрессивную оптимизацию
        if (activeElements > this.options.performance.maxActiveElements) {
            this.applyAggressiveOptimization(activeElements);
        }
    }
    
    /**
     * Более агрессивная оптимизация при большом количестве активных элементов
     */
    applyAggressiveOptimization(activeCount) {
        // Временно увеличиваем задержку тротлинга
        const originalDelay = this.options.performance.throttleDelay;
        this.options.performance.throttleDelay = Math.min(50, originalDelay * 1.5);
        
        // Уменьшаем величину margin для виртуализации
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const reducedMargin = viewportHeight; // Один экран вместо двух
        
        // Временно не наблюдаем за элементами дальше от области видимости
        this.store.forEach((options, el) => {
            if (el.hasAttribute('data-scroll-ejuk-complete') && !options.reset) return;
            
            const rect = el.getBoundingClientRect();
            const elementTop = rect.top + scrollTop;
            const elementBottom = elementTop + rect.height;
            
            const isFarAbove = elementBottom < scrollTop - reducedMargin;
            const isFarBelow = elementTop > scrollTop + viewportHeight + reducedMargin;
            
            if ((isFarAbove || isFarBelow) && this.observer && 
                el.hasAttribute('data-scroll-ejuk-observed')) {
                this.observer.unobserve(el);
                el.removeAttribute('data-scroll-ejuk-observed');
                el.setAttribute('data-scroll-ejuk-virtualized', 'true');
            }
        });
        
        // Восстанавливаем исходную задержку тротлинга через некоторое время
        setTimeout(() => {
            this.options.performance.throttleDelay = originalDelay;
        }, 1000);
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
     * @param {HTMLElement} el - Элемент для анализа позиционирования
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
     * Асинхронное вычисление трансформации с использованием Web Worker
     */
    async computeTransformAsync(options) {
        return new Promise((resolve) => {
            const key = JSON.stringify({
                distance: options.distance, 
                origin: options.origin,
                rotate: options.rotate,
                scale: options.scale
            });
            
            if (this.transformCache.has(key)) {
                resolve(this.transformCache.get(key));
                return;
            }
            
            if (this.worker && this.options.performance.useWebWorker) {
                const taskId = Date.now() + Math.random().toString(36).substr(2, 5);
                
                this.workerTasks.set(taskId, { key, resolve });
                
                this.worker.postMessage({
                    type: 'computeTransform',
                    data: {
                        id: taskId,
                        options
                    }
                });
            } else {
                // Резервный метод вычисления, если worker недоступен
                resolve(this.computeTransform(options));
            }
        });
    }

    /**
     * Отображение элемента
     * @param {HTMLElement} el - Элемент
     */
    revealElement(el) {
        if (!el || !this.store.has(el)) return;
        
        const options = this.store.get(el);
        
        // Проверяем, не был ли элемент уже обработан
        if (el.hasAttribute('data-scroll-ejuk-complete') && !options.reset) return;
        
        if (typeof options.beforeReveal === 'function') options.beforeReveal(el);

        // Отмечаем элемент как активный для анимации
        el.setAttribute('data-scroll-ejuk-active', 'true');

        if (options.animationStrategy === 'waap' && window.Animation && el.animate) {
            this.animateWithWAAP(el, options);
        } else {
            this.animateWithCSS(el, options);
        }

        // Если reset не требуется и используется IntersectionObserver, отключаем наблюдение
        if (!options.reset && this.observer) {
            this.observer.unobserve(el);
            el.removeAttribute('data-scroll-ejuk-observed');
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
            
            // Снимаем маркер активности
            el.removeAttribute('data-scroll-ejuk-active');
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
                    
                    // Снимаем маркер активности
                    el.removeAttribute('data-scroll-ejuk-active');
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
            
            // Снимаем маркер активности
            el.removeAttribute('data-scroll-ejuk-active');
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
            
            // Снимаем маркер активности
            el.removeAttribute('data-scroll-ejuk-active');
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

        // Отмечаем элемент как активный для анимации
        el.setAttribute('data-scroll-ejuk-active', 'true');

        if (options.animationStrategy === 'waap' && window.Animation && el.animate) {
            // Определение трансформации для анимации
            let toTransform;
            
            if (options.respectPositioning) {
                // Для элементов с учетом позиционирования
                const computedStyle = window.getComputedStyle(el);
                const position = computedStyle.position;
                const hasPositioning = position === 'absolute' || position === 'fixed' || position === 'relative';
                
                if (hasPositioning) {
                    // Конечная трансформация только для ротации и масштаба
                    const finalTransforms = [];
                    if (options.rotate.x) finalTransforms.push(`rotateX(${options.rotate.x}deg)`);
                    if (options.rotate.y) finalTransforms.push(`rotateY(${options.rotate.y}deg)`);
                    if (options.rotate.z) finalTransforms.push(`rotateZ(${options.rotate.z}deg)`);
                    if (options.scale !== 1) finalTransforms.push(`scale(${options.scale})`);
                    toTransform = finalTransforms.length > 0 ? finalTransforms.join(' ') : '';
                } else {
                    toTransform = this.computeTransform(options);
                }
            } else {
                toTransform = this.computeTransform(options);
            }
            
            el.animate([
                { opacity: '1', transform: 'none' },
                { opacity: options.opacity, transform: toTransform }
            ], {
                duration: options.duration,
                easing: options.easing,
                fill: 'forwards'
            }).onfinish = () => {
                // Устанавливаем стили напрямую после завершения анимации
                el.style.opacity = options.opacity;
                el.style.transform = toTransform;
                
                if (typeof options.afterReset === 'function') options.afterReset(el);
                
                // Снимаем маркер активности
                el.removeAttribute('data-scroll-ejuk-active');
            };
        } else {
            el.style.transition = `opacity ${options.duration}ms ${options.easing}, transform ${options.duration}ms ${options.easing}`;
            el.style.opacity = options.opacity;
            
            // Определение трансформации с учетом позиционирования
            if (options.respectPositioning) {
                const computedStyle = window.getComputedStyle(el);
                const position = computedStyle.position;
                const hasPositioning = position === 'absolute' || position === 'fixed' || position === 'relative';
                
                if (hasPositioning) {
                    // Конечная трансформация только для ротации и масштаба
                    const transforms = [];
                    if (options.rotate.x) transforms.push(`rotateX(${options.rotate.x}deg)`);
                    if (options.rotate.y) transforms.push(`rotateY(${options.rotate.y}deg)`);
                    if (options.rotate.z) transforms.push(`rotateZ(${options.rotate.z}deg)`);
                    if (options.scale !== 1) transforms.push(`scale(${options.scale})`);
                    
                    if (transforms.length > 0) {
                        el.style.transform = transforms.join(' ');
                    }
                } else {
                    el.style.transform = this.computeTransform(options);
                }
            } else {
                el.style.transform = this.computeTransform(options);
            }

            setTimeout(() => {
                if (typeof options.afterReset === 'function') options.afterReset(el);
                
                // Снимаем маркер активности
                el.removeAttribute('data-scroll-ejuk-active');
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
        el.style.willChange = '';
        
        // Удаляем служебные атрибуты
        el.removeAttribute('data-scroll-ejuk-initialized');
        el.removeAttribute('data-scroll-ejuk-complete');
        el.removeAttribute('data-scroll-ejuk-observed');
        el.removeAttribute('data-scroll-ejuk-virtualized');
        el.removeAttribute('data-scroll-ejuk-active');
    }
    
    /**
     * Сброс таймера неактивности
     */
    resetInactivityTimer() {
        clearTimeout(this.inactivityTimer);
        
        if (this.options.performance.inactivityTimeout > 0) {
            this.inactivityTimer = setTimeout(() => {
                this.optimizeForInactivity();
            }, this.options.performance.inactivityTimeout);
        }
    }
    
    /**
     * Оптимизация при неактивности пользователя
     */
    optimizeForInactivity() {
        // Применяем виртуализацию для элементов вне области видимости
        this.virtualizeOffscreenElements();
        
        // Очищаем неиспользуемые кэши
        if (this.selectorCache.size > 50) {
            this.selectorCache.clear();
        }
        
        // Очистка transform-кэша если он стал слишком большим
        if (this.transformCache.size > 100) {
            // Оставляем только 30 последних вычислений
            const entries = Array.from(this.transformCache.entries());
            this.transformCache.clear();
            
            entries.slice(-30).forEach(([key, value]) => {
                this.transformCache.set(key, value);
            });
        }
    }
    
    /**
     * Мониторинг производительности для адаптивной оптимизации
     */
    monitorPerformance() {
        let lastFrameTime = performance.now();
        let frameCount = 0;
        let fpsUpdateTime = lastFrameTime;
        
        const updateFps = () => {
            const now = performance.now();
            frameCount++;
            
            // Обновляем FPS каждую секунду
            if (now - fpsUpdateTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (now - fpsUpdateTime));
                this.performanceStats.fps = fps;
                this.performanceStats.frameCount = frameCount;
                
                // Счетчик низкого FPS
                if (fps < 30) {
                    this.performanceStats.lowFpsCount++;
                    
                    // Если FPS постоянно низкий, применяем дополнительную оптимизацию
                    if (this.performanceStats.lowFpsCount >= 3) {
                        this.applyAdaptiveOptimizations();
                    }
                } else {
                    this.performanceStats.lowFpsCount = Math.max(0, this.performanceStats.lowFpsCount - 1);
                }
                
                fpsUpdateTime = now;
                frameCount = 0;
            }
            
            lastFrameTime = now;
            requestAnimationFrame(updateFps);
        };
        
        requestAnimationFrame(updateFps);
    }
    
    /**
     * Адаптивная оптимизация при низком FPS
     */
    applyAdaptiveOptimizations() {
        // Если оптимизации уже применены, не дублируем
        if (this.adaptiveOptimizationsApplied) return;
        this.adaptiveOptimizationsApplied = true;
        
        console.log('ScrollEjuk: применение адаптивных оптимизаций из-за низкого FPS');
        
        // Снижаем сложность анимации
        this.store.forEach((options, el) => {
            if (!el.hasAttribute('data-scroll-ejuk-complete')) {
                // Сокращаем длительность анимации
                options.duration = Math.floor(options.duration * 0.8);
                
                // Уменьшаем величину смещения
                if (options.distance && typeof options.distance === 'string' && /px$/.test(options.distance)) {
                    const distance = parseFloat(options.distance);
                    if (!isNaN(distance)) {
                        options.distance = Math.floor(distance * 0.8) + 'px';
                    }
                }
                
                // Упрощаем вращение
                if (options.rotate) {
                    options.rotate.x = Math.floor(options.rotate.x * 0.8);
                    options.rotate.y = Math.floor(options.rotate.y * 0.8);
                    options.rotate.z = Math.floor(options.rotate.z * 0.8);
                }
            }
        });
        
        // Увеличиваем задержку тротлинга
        this.options.performance.throttleDelay = Math.min(32, this.options.performance.throttleDelay * 1.5);
        
        // Активируем виртуализацию, если она не была включена
        this.options.performance.virtualizeOffscreen = true;
        this.virtualizeOffscreenElements();
        
        // Увеличиваем интервал между элементами для каскадных анимаций
        this.options.interval = Math.max(50, this.options.interval * 1.5);
    }
    
    /**
     * Функция тротлинга для ограничения частоты вызовов
     */
    throttle(func, delay) {
        let lastCall = 0;
        let timeoutId = null;
        
        return function(...args) {
            const now = performance.now();
            const delta = now - lastCall;
            
            if (delta >= delay) {
                // Если прошло достаточно времени, вызываем функцию немедленно
                lastCall = now;
                func.apply(this, args);
            } else {
                // Иначе отменяем предыдущий тайм-аут и ставим новый
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    lastCall = performance.now();
                    func.apply(this, args);
                }, delay - delta);
            }
        };
    }
    
    /**
     * Пакетная обработка DOM-операций
     */
    batchDOMOperation(callback) {
        if (!this.options.performance.batchProcessing) {
            callback();
            return;
        }
        
        // Добавляем в очередь
        this.batchQueue.push(callback);
        
        // Если нет запланированной обработки, планируем
        if (this.batchQueue.length === 1) {
            requestAnimationFrame(() => {
                const operations = [...this.batchQueue];
                this.batchQueue = [];
                
                // Используем DocumentFragment для оптимизации
                const fragment = document.createDocumentFragment();
                
                // Выполняем все накопленные операции
                operations.forEach(operation => operation(fragment));
            });
        }
    }

    /**
     * Синхронизация (переоценка) всех элементов
     */
    sync() {
        // Очистка кэша селекторов
        this.selectorCache.clear();
        
        if (this.observer) {
            this.store.forEach((_, el) => {
                if (el.hasAttribute('data-scroll-ejuk-virtualized')) {
                    // Восстанавливаем наблюдение за виртуализированными элементами
                    this.observer.observe(el);
                    el.setAttribute('data-scroll-ejuk-observed', 'true');
                    el.removeAttribute('data-scroll-ejuk-virtualized');
                } else if (el.hasAttribute('data-scroll-ejuk-observed')) {
                    // Обновляем наблюдение
                    this.observer.unobserve(el);
                    this.observer.observe(el);
                }
            });
        } else if (this.fallbackScrollHandler) {
            // Для резервного метода выполняем проверку видимости
            this.handleScroll();
        }
        
        // Принудительная оптимизация для неактивных элементов
        if (this.options.performance.virtualizeOffscreen) {
            this.virtualizeOffscreenElements();
        }
    }
    
    /**
     * Отображение анимации для конкретного селектора
     * @param {string} selector - CSS-селектор
     */
    refresh(selector) {
        if (typeof selector !== 'string') return;
        
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(el => {
            if (this.store.has(el)) {
                // Сбрасываем состояние элемента
                el.removeAttribute('data-scroll-ejuk-complete');
                
                // Проверяем видимость и отображаем при необходимости
                if (this.isElementInViewport(el, this.store.get(el).viewFactor)) {
                    this.revealElement(el);
                } else if (this.observer) {
                    // Обновляем наблюдение
                    this.observer.unobserve(el);
                    this.observer.observe(el);
                    el.setAttribute('data-scroll-ejuk-observed', 'true');
                }
            }
        });
    }

    /**
     * Уничтожение экземпляра и очистка ресурсов
     */
    destroy() {
        // Отключение всех наблюдателей
        if (this.observer) {
            this.observer.disconnect();
        }
        
        if (this.fallbackScrollHandler) {
            window.removeEventListener('scroll', this.fallbackScrollHandler);
        }
        
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        // Очистка таймеров
        clearTimeout(this.inactivityTimer);
        
        // Завершение Web Worker
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        // Очистка will-change и других временных стилей
        this.store.forEach((_, el) => {
            el.style.willChange = '';
            el.removeAttribute('data-scroll-ejuk-virtualized');
            el.removeAttribute('data-scroll-ejuk-observed');
            el.removeAttribute('data-scroll-ejuk-initialized');
            el.removeAttribute('data-scroll-ejuk-complete');
            el.removeAttribute('data-scroll-ejuk-active');
        });
        
        // Очистка кэшей и хранилищ
        this.store.clear();
        this.selectorCache.clear();
        this.transformCache.clear();
        this.elementsPriority.clear();
        this.batchQueue = [];
        this.elementsQueue = [];
        
        if (this.workerTasks) {
            this.workerTasks.clear();
        }
        
        // Сброс экземпляра
        ScrollEjuk.#instance = null;
    }
}

export default ScrollEjuk;