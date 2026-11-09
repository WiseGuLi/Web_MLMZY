/* 顶栏“更多”下拉：点击外部或页面滚动时关闭。 */
(function () {
    'use strict';

    function closeMore() {
        var openMenus = document.querySelectorAll('.nav-more details[open]');
        for (var i = 0; i < openMenus.length; i++) {
            openMenus[i].open = false;
        }
    }

    function isWideScreen() {
        /* 交互判断以顶栏实际状态为准：汉堡按钮隐藏时才是宽屏模式 */
        var toggle = document.getElementById('nav-toggle');
        if (toggle) {
            return window.getComputedStyle(toggle).display === 'none';
        }
        return window.matchMedia('(min-width: 1200px)').matches;
    }

    var wideQuery = window.matchMedia('(min-width: 1200px)');
    var lastMode = wideQuery.matches ? 'wide' : 'narrow';

    function resetModeIfChanged() {
        var mode = wideQuery.matches ? 'wide' : 'narrow';
        if (mode === lastMode) return;

        closeMore();
        var toggle = document.getElementById('nav-toggle');
        if (toggle) toggle.checked = false;
        lastMode = mode;
    }

    if (typeof wideQuery.addEventListener === 'function') {
        wideQuery.addEventListener('change', resetModeIfChanged);
    } else if (typeof wideQuery.addListener === 'function') {
        wideQuery.addListener(resetModeIfChanged);
    }

    window.addEventListener('resize', resetModeIfChanged, { passive: true });

    /* 某些嵌入式/缩放场景下 resize 不触发，用尺寸监听兜底 */
    if (typeof window.ResizeObserver === 'function') {
        new window.ResizeObserver(resetModeIfChanged).observe(document.documentElement);
    }

    document.addEventListener('click', function (event) {
        if (!isWideScreen()) return;
        var openMenus = document.querySelectorAll('.nav-more details[open]');
        for (var i = 0; i < openMenus.length; i++) {
            if (!openMenus[i].contains(event.target)) {
                openMenus[i].open = false;
            }
        }
    });

    window.addEventListener('scroll', function () {
        if (isWideScreen()) closeMore();
    }, { passive: true });

    window.addEventListener('wheel', function () {
        if (isWideScreen()) closeMore();
    }, { passive: true });

    window.addEventListener('touchmove', function () {
        if (isWideScreen()) closeMore();
    }, { passive: true });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeMore();
        }
    });

    /* 收起手机菜单时，同时收起所有下拉列表 */
    document.addEventListener('change', function (event) {
        if (event.target && event.target.id === 'nav-toggle' && !event.target.checked) {
            closeMore();
        }
    });
})();

/* PWA：注册 Service Worker，并接管“安装到电脑桌面”入口。 */
(function () {
    'use strict';

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(function (error) {
            console.warn('Service Worker 注册失败:', error);
        });
    }

    var deferredInstallPrompt = null;

    window.addEventListener('beforeinstallprompt', function (event) {
        /* 不调用 preventDefault，保留 Chrome 地址栏右侧的原生安装图标。 */
        deferredInstallPrompt = event;
    });

    window.addEventListener('appinstalled', function () {
        deferredInstallPrompt = null;
    });

    function showInstallHelp() {
        window.alert('当前浏览器没有给出安装提示。请使用 Chrome、Edge 等 Chromium 内核的浏览器，并确认本站尚未安装到桌面。你也可以点击浏览器地址栏右侧的“安装应用程序”图标，或使用浏览器菜单中的“保存和共享 → 安装页面为应用”。');
    }

    document.addEventListener('click', function (event) {
        var trigger = event.target && event.target.closest
            ? event.target.closest('[data-install-app]')
            : null;
        if (!trigger) return;

        event.preventDefault();

        var details = trigger.closest('details');
        if (details) details.open = false;

        if (window.matchMedia('(display-mode: standalone)').matches) {
            window.alert('本站已经安装到桌面。');
            return;
        }

        if (!deferredInstallPrompt) {
            showInstallHelp();
            return;
        }

        var promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;

        try {
            var promptResult = promptEvent.prompt();
            if (promptResult && typeof promptResult.catch === 'function') {
                promptResult.catch(function () {
                    showInstallHelp();
                });
            }
        } catch (error) {
            console.warn('网站安装提示不可用:', error);
            showInstallHelp();
            return;
        }

        promptEvent.userChoice.then(function (choice) {
            if (choice.outcome !== 'accepted') {
                console.info('用户取消了网站安装。');
            }
        }).catch(function (error) {
            console.warn('网站安装失败:', error);
        });
    });
})();

/* 全站回到顶部按钮 */
(function () {
    'use strict';

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function updateBackToTop() {
        var button = document.querySelector('.site-back-to-top');
        if (!button) return;
        button.classList.toggle('is-visible', window.scrollY > 360);
    }

    document.addEventListener('click', function (event) {
        var trigger = event.target && event.target.closest
            ? event.target.closest('[data-back-to-top]')
            : null;
        if (!trigger) return;

        window.scrollTo({
            top: 0,
            behavior: reducedMotion.matches ? 'auto' : 'smooth'
        });
    });

    window.addEventListener('scroll', updateBackToTop, { passive: true });
    window.addEventListener('load', updateBackToTop);

    var placeholder = document.getElementById('nav-placeholder');
    if (placeholder && typeof window.MutationObserver === 'function') {
        new window.MutationObserver(updateBackToTop).observe(placeholder, {
            childList: true,
            subtree: true
        });
    }

    updateBackToTop();
})();

/* 外观：仅保存并显示当前选择，暂不真正切换页面主题或字体。 */
(function () {
    'use strict';

    var THEME_KEY = 'mlmzy-appearance-theme';
    var FONT_KEY = 'mlmzy-appearance-font';
    var THEME_TEXT = { light: '亮色模式', dark: '暗色模式' };
    var FONT_TEXT = { serif: '衬线字体', sans: '系统字体' };

    function readValue(key, allowed, fallback) {
        try {
            var value = window.localStorage.getItem(key);
            return allowed.indexOf(value) !== -1 ? value : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function saveValue(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            /* 隐私模式下无法写入时，保留本次页面内的选择 */
        }
    }

    function renderToggle(button, value, labels) {
        var label = button.querySelector('[data-appearance-label]');
        if (label) label.textContent = labels[value];
        button.setAttribute('data-value', value);
        button.setAttribute('aria-label', labels[value] + '，点击切换');
    }

    function initAppearance() {
        var wrapper = document.querySelector('.nav-appearance');
        if (!wrapper || wrapper.getAttribute('data-appearance-ready') === 'true') return;

        var themeButton = wrapper.querySelector('[data-appearance-toggle="theme"]');
        var fontButton = wrapper.querySelector('[data-appearance-toggle="font"]');
        if (!themeButton || !fontButton) return;

        wrapper.setAttribute('data-appearance-ready', 'true');

        var theme = readValue(THEME_KEY, ['light', 'dark'], 'light');
        var font = readValue(FONT_KEY, ['serif', 'sans'], 'serif');

        renderToggle(themeButton, theme, THEME_TEXT);
        renderToggle(fontButton, font, FONT_TEXT);

        themeButton.addEventListener('click', function () {
            theme = theme === 'light' ? 'dark' : 'light';
            saveValue(THEME_KEY, theme);
            renderToggle(themeButton, theme, THEME_TEXT);
        });

        fontButton.addEventListener('click', function () {
            font = font === 'serif' ? 'sans' : 'serif';
            saveValue(FONT_KEY, font);
            renderToggle(fontButton, font, FONT_TEXT);
        });
    }

    initAppearance();
    document.addEventListener('DOMContentLoaded', initAppearance);
    window.addEventListener('load', initAppearance);

    var navPlaceholder = document.getElementById('nav-placeholder');
    if (navPlaceholder && typeof window.MutationObserver === 'function') {
        new window.MutationObserver(initAppearance).observe(navPlaceholder, {
            childList: true,
            subtree: true
        });
    }
})();
