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
