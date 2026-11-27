/* 全站字体模式：读取用户选择，并在页面绘制前设置 html[data-font]。 */
(function () {
    'use strict';

    var KEY = 'mlmzy-appearance-font';
    var NAV_KEY = 'mlmzy-appearance-nav-position';
    var DEFAULT_FONT = 'serif';
    var DEFAULT_NAV_POSITION = 'top';
    var LOADING_MASKS = [
        '/icons/加载动画/加载1.svg',
        '/icons/加载动画/加载2.svg',
        '/icons/加载动画/加载3.svg'
    ];

    function readFont() {
        try {
            var value = window.localStorage.getItem(KEY);
            return value === 'sans' || value === 'serif' ? value : DEFAULT_FONT;
        } catch (error) {
            return DEFAULT_FONT;
        }
    }

    function applyFont(value) {
        var font = value === 'sans' ? 'sans' : 'serif';
        document.documentElement.setAttribute('data-font', font);
        return font;
    }

    function readNavPosition() {
        try {
            var value = window.localStorage.getItem(NAV_KEY);
            return value === 'bottom' || value === 'top' ? value : DEFAULT_NAV_POSITION;
        } catch (error) {
            return DEFAULT_NAV_POSITION;
        }
    }

    function applyNavPosition(value) {
        var position = value === 'bottom' ? 'bottom' : 'top';
        document.documentElement.setAttribute('data-nav-position', position);
        return position;
    }

    applyFont(readFont());
    applyNavPosition(readNavPosition());

    function randomizeLoadingMask() {
        var loadingMask = LOADING_MASKS[Math.floor(Math.random() * LOADING_MASKS.length)];
        document.documentElement.style.setProperty('--loading-mask', 'url("' + loadingMask + '")');
        return loadingMask;
    }

    randomizeLoadingMask();

    var activeLoadingNodes = [];

    function visibleLoadingNodes() {
        return Array.prototype.filter.call(document.querySelectorAll('.is-loading'), function (node) {
            return !node.hidden;
        });
    }

    function syncLoadingNodes(randomizeNew) {
        var current = visibleLoadingNodes();
        var shouldRandomize = false;
        current.forEach(function (node) {
            if (activeLoadingNodes.indexOf(node) === -1) shouldRandomize = true;
        });
        activeLoadingNodes = current;
        if (randomizeNew && shouldRandomize) randomizeLoadingMask();
    }

    function initLoadingRandomizer() {
        /* 初始加载状态使用页面绘制前选中的图案。 */
        syncLoadingNodes(false);
        if (typeof window.MutationObserver !== 'function') return;

        var observer = new window.MutationObserver(function () {
            syncLoadingNodes(true);
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'hidden']
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLoadingRandomizer);
    } else {
        initLoadingRandomizer();
    }

    window.addEventListener('storage', function (event) {
        if (event.key === KEY) {
            applyFont(event.newValue === 'sans' ? 'sans' : 'serif');
        } else if (event.key === NAV_KEY) {
            applyNavPosition(event.newValue === 'bottom' ? 'bottom' : 'top');
        }
    });

    /* 供顶栏脚本调用；即使没有这个对象，nav.js 也会直接设置属性。 */
    window.SiteFont = {
        key: KEY,
        navKey: NAV_KEY,
        read: readFont,
        apply: applyFont,
        readNavPosition: readNavPosition,
        applyNavPosition: applyNavPosition,
        randomizeLoading: randomizeLoadingMask
    };
})();
