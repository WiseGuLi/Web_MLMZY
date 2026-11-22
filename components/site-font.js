/* 全站字体模式：读取用户选择，并在页面绘制前设置 html[data-font]。 */
(function () {
    'use strict';

    var KEY = 'mlmzy-appearance-font';
    var DEFAULT_FONT = 'serif';

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

    applyFont(readFont());

    window.addEventListener('storage', function (event) {
        if (event.key !== KEY) return;
        applyFont(event.newValue === 'sans' ? 'sans' : 'serif');
    });

    /* 供顶栏脚本调用；即使没有这个对象，nav.js 也会直接设置属性。 */
    window.SiteFont = {
        key: KEY,
        read: readFont,
        apply: applyFont
    };
})();
