/* 顶栏“更多”下拉：点击外部或页面滚动时关闭。 */
var navCloseSuppressUntil = 0;

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
        return window.matchMedia('(min-width: 1100px)').matches;
    }

    var wideQuery = window.matchMedia('(min-width: 1100px)');
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
        /* 切换字体可能引起页面轻微回流滚动，此时不要关闭已经打开的外观菜单。 */
        if (navCloseSuppressUntil && Date.now() < navCloseSuppressUntil) return;
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

    /* 禁用尚未开放的功能：阻止下拉展开和链接跳转 */
    document.addEventListener('click', function (event) {
        var disabled = event.target.closest
            ? event.target.closest('.nav-disabled, .nav-disabled-link')
            : null;
        if (!disabled) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);

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
    var NAV_KEY = 'mlmzy-appearance-nav-position';
    var THEME_TEXT = { light: '亮色模式', dark: '暗色模式' };
    var FONT_TEXT = { serif: '衬线字体', sans: '默认字体' };
    var NAV_TEXT = { top: '导航位置：顶部', bottom: '导航位置：底部' };
    var theme = null;
    var font = null;
    var navPosition = null;

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

    function ensureState() {
        if (theme === null) {
            theme = readValue(THEME_KEY, ['light', 'dark'], 'light');
        }
        if (font === null) {
            font = readValue(FONT_KEY, ['serif', 'sans'], 'serif');
        }
        if (navPosition === null) {
            navPosition = readValue(NAV_KEY, ['top', 'bottom'], 'top');
        }
    }

    function getText(type) {
        if (type === 'theme') return THEME_TEXT[theme];
        if (type === 'nav') return NAV_TEXT[navPosition];
        return FONT_TEXT[font];
    }

    function syncButton(button) {
        if (button.disabled) return;

        var type = button.getAttribute('data-appearance-toggle');
        if (type !== 'theme' && type !== 'font' && type !== 'nav') return;

        var text = getText(type);
        var value = type === 'theme' ? theme : (type === 'nav' ? navPosition : font);
        button.setAttribute('data-value', value);

        var label = button.querySelector('[data-appearance-label]');
        if (label && label.textContent !== text) label.textContent = text;

        var hint = text + '，单击切换';
        button.setAttribute('aria-label', hint);
        button.setAttribute('title', hint);
    }

    function applyAppearance() {
        document.documentElement.setAttribute('data-font', font);
        document.documentElement.setAttribute('data-nav-position', navPosition);
    }

    function syncAll() {
        ensureState();
        applyAppearance();
        var buttons = document.querySelectorAll('[data-appearance-toggle]');
        for (var i = 0; i < buttons.length; i++) {
            syncButton(buttons[i]);
        }
    }

    function flashButtons(type) {
        var buttons = document.querySelectorAll('[data-appearance-toggle="' + type + '"]');
        for (var i = 0; i < buttons.length; i++) {
            (function (button) {
                button.classList.remove('is-switching');
                /* 强制回流，保证连续点击也能重新播放动画 */
                void button.offsetWidth;
                button.classList.add('is-switching');
                window.clearTimeout(button.appearanceTimer);
                button.appearanceTimer = window.setTimeout(function () {
                    button.classList.remove('is-switching');
                }, 380);
            })(buttons[i]);
        }
    }

    function initAppearance() {
        if (!document.querySelector('[data-appearance-toggle]')) return;
        syncAll();
    }

    document.addEventListener('click', function (event) {
        var trigger = event.target && event.target.closest
            ? event.target.closest('[data-appearance-toggle]')
            : null;
        if (!trigger) return;

        ensureState();
        var type = trigger.getAttribute('data-appearance-toggle');
        if (type === 'theme') {
            theme = theme === 'light' ? 'dark' : 'light';
            saveValue(THEME_KEY, theme);
        } else if (type === 'font') {
            navCloseSuppressUntil = Date.now() + 1200;
            font = font === 'serif' ? 'sans' : 'serif';
            saveValue(FONT_KEY, font);
        } else if (type === 'nav') {
            navCloseSuppressUntil = Date.now() + 1200;
            navPosition = navPosition === 'top' ? 'bottom' : 'top';
            saveValue(NAV_KEY, navPosition);
        } else {
            return;
        }

        syncAll();
        flashButtons(type);
    });

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

/* 手机端外观按钮：展开/收起外观面板。 */
(function () {
    'use strict';

    function panel() {
        return document.getElementById('mobileAppearanceMenu');
    }

    function trigger() {
        return document.querySelector('.nav-appearance-trigger');
    }

    function closePanel() {
        var menu = panel();
        var button = trigger();
        if (!menu) return;
        menu.hidden = true;
        menu.classList.remove('is-open');
        if (button) button.setAttribute('aria-expanded', 'false');
    }

    document.addEventListener('click', function (event) {
        var button = event.target.closest ? event.target.closest('.nav-appearance-trigger') : null;
        if (button) {
            var menu = panel();
            if (!menu) return;
            if (menu.hidden) {
                menu.hidden = false;
                menu.classList.add('is-open');
                button.setAttribute('aria-expanded', 'true');
            } else {
                closePanel();
            }
            return;
        }

        if (event.target.closest && event.target.closest('#mobileAppearanceMenu')) return;
        closePanel();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closePanel();
    });

    window.addEventListener('resize', function () {
        if (window.matchMedia('(min-width: 1100px)').matches) closePanel();
    });
})();
