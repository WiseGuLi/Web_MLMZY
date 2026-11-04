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
        return window.matchMedia('(min-width: 961px)').matches;
    }

    var wideQuery = window.matchMedia('(min-width: 961px)');
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
        event.preventDefault();
        deferredInstallPrompt = event;
        document.documentElement.classList.add('pwa-install-ready');
    });

    window.addEventListener('appinstalled', function () {
        deferredInstallPrompt = null;
        document.documentElement.classList.remove('pwa-install-ready');
    });

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
            window.alert('当前浏览器没有提供安装入口。请使用 Chrome 或 Edge 打开本站，再点击地址栏右侧的“安装”图标。');
            return;
        }

        var promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        promptEvent.prompt();
        promptEvent.userChoice.then(function (choice) {
            if (choice.outcome !== 'accepted') {
                console.info('用户取消了网站安装。');
            }
        }).catch(function (error) {
            console.warn('网站安装失败:', error);
        });
    });
})();
