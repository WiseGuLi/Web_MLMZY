/* 革命文艺视频类页面：电影、舞蹈共用列表与 B 站预览逻辑。 */
(function () {
    'use strict';

    var page = document.querySelector('.media-page');
    if (!page) return;

    var CSV_URL = page.getAttribute('data-csv');
    var LABEL = page.getAttribute('data-label') || '视频';
    var CATEGORIES = String(page.getAttribute('data-categories') || '').split(',')
        .map(function (item) { return item.trim(); })
        .filter(Boolean);

    var filter = document.getElementById('mediaFilter');
    var status = document.getElementById('mediaStatus');
    var listCard = document.getElementById('mediaListCard');
    var list = document.getElementById('mediaList');
    var listTitle = document.getElementById('mediaListTitle');
    var listCount = document.getElementById('mediaListCount');
    var empty = document.getElementById('mediaEmpty');
    var emptyTitle = document.getElementById('mediaEmptyTitle');
    var emptyNote = document.getElementById('mediaEmptyNote');

    var modal = document.getElementById('mediaModal');
    var modalTitle = document.getElementById('mediaModalTitle');
    var modalCategory = document.getElementById('mediaModalCategory');
    var modalSource = document.getElementById('mediaModalSource');
    var modalClose = document.getElementById('mediaModalClose');
    var player = document.getElementById('mediaPlayer');
    var fallback = document.getElementById('mediaFallback');
    var external = document.getElementById('mediaExternal');

    var videos = [];
    var currentCategory = CATEGORIES[0] || '';
    var lastFocus = null;

    function parseCsv(text) {
        var input = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
        var rows = [];
        var row = [];
        var field = '';
        var inQuotes = false;

        for (var i = 0; i < input.length; i++) {
            var ch = input.charAt(i);
            if (inQuotes) {
                if (ch === '"') {
                    if (input.charAt(i + 1) === '"') {
                        field += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field += ch;
                }
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(field);
                field = '';
            } else if (ch === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            } else {
                field += ch;
            }
        }

        if (field.length || row.length) {
            row.push(field);
            rows.push(row);
        }

        return rows.filter(function (cells) {
            return cells.some(function (cell) { return String(cell).trim() !== ''; });
        });
    }

    function extractUrl(value) {
        var match = String(value || '').match(/https?:\/\/[^\s，。；;、<>"']+/i);
        return match ? match[0].replace(/[),.;，。；、]+$/, '') : '';
    }

    function cleanTitle(value) {
        return String(value || '')
            .replace(/[【】\[\]]/g, ' ')
            .replace(/[“”"']/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isBilibili(url) {
        return /bilibili\.com|b23\.tv/i.test(url);
    }

    function toEmbedUrl(url) {
        var bv = url.match(/[?&]bvid=(BV[0-9A-Za-z]+)/i) || url.match(/\/video\/(BV[0-9A-Za-z]+)/i);
        if (bv) {
            return 'https://player.bilibili.com/player.html?bvid=' + bv[1] +
                '&page=1&high_quality=1&danmaku=0&autoplay=1';
        }
        var av = url.match(/[?&]aid=(\d+)/i) || url.match(/\/video\/av(\d+)/i);
        if (av) {
            return 'https://player.bilibili.com/player.html?aid=' + av[1] +
                '&page=1&high_quality=1&danmaku=0&autoplay=1';
        }
        return '';
    }

    function parseVideos(rows) {
        if (!rows.length) return [];
        var headers = rows[0].map(function (cell) { return String(cell || '').trim(); });
        var result = [];
        var seen = Object.create(null);

        function add(title, url, category) {
            var cleanUrl = extractUrl(url);
            if (!cleanUrl) return;
            var cleanCategory = String(category || '').trim();
            if (CATEGORIES.indexOf(cleanCategory) === -1) cleanCategory = CATEGORIES[0];
            var key = cleanUrl + '|' + cleanCategory;
            if (seen[key]) return;
            seen[key] = true;
            result.push({
                title: cleanTitle(title) || 'B 站视频',
                category: cleanCategory,
                url: cleanUrl
            });
        }

        var nameIndex = -1;
        var urlIndex = -1;
        var categoryIndex = -1;
        headers.forEach(function (header, index) {
            if (nameIndex === -1 && ['视频名称', '名称', '标题', 'title', 'name'].indexOf(header) !== -1) nameIndex = index;
            if (urlIndex === -1 && ['视频链接', '链接', '地址', 'url', 'link'].indexOf(header) !== -1) urlIndex = index;
            if (categoryIndex === -1 && ['分类', '类别', '栏目', 'category'].indexOf(header) !== -1) categoryIndex = index;
        });

        if (nameIndex !== -1 && urlIndex !== -1) {
            for (var r = 1; r < rows.length; r++) {
                add(rows[r][nameIndex], rows[r][urlIndex],
                    categoryIndex === -1 ? CATEGORIES[0] : rows[r][categoryIndex]);
            }
            return result;
        }

        for (var rowIndex = 1; rowIndex < rows.length; rowIndex++) {
            var cells = rows[rowIndex];
            for (var column = 0; column < cells.length; column++) {
                var category = headers[column];
                if (CATEGORIES.indexOf(category) === -1) continue;
                var cell = String(cells[column] || '').trim();
                var url = extractUrl(cell);
                if (!url) continue;
                add(cell.replace(url, ''), url, category);
            }
        }

        return result;
    }

    function sourceLabel(url) {
        return isBilibili(url) ? 'B 站' : '外部链接';
    }

    function updateSlider() {
        if (!filter.offsetParent) return;
        var checked = filter.querySelector('input[name="media-category"]:checked');
        if (!checked) return;
        var label = filter.querySelector('label[for="' + checked.id + '"]');
        if (!label) return;
        var filterRect = filter.getBoundingClientRect();
        var labelRect = label.getBoundingClientRect();
        var slider = filter.querySelector('.media-filter-slider');
        if (!slider) return;
        slider.style.left = (labelRect.left - filterRect.left) + 'px';
        slider.style.width = labelRect.width + 'px';
    }

    function buildFilter() {
        filter.innerHTML = '';
        var slider = document.createElement('span');
        slider.className = 'media-filter-slider';
        slider.setAttribute('aria-hidden', 'true');
        filter.appendChild(slider);

        CATEGORIES.forEach(function (category, index) {
            var input = document.createElement('input');
            input.type = 'radio';
            input.name = 'media-category';
            input.id = 'media-category-' + index;
            input.value = category;
            input.checked = index === 0;

            var label = document.createElement('label');
            label.setAttribute('for', input.id);
            label.textContent = category;

            filter.appendChild(input);
            filter.appendChild(label);
        });
    }

    function renderList() {
        var filtered = videos.filter(function (video) {
            return video.category === currentCategory;
        });

        list.innerHTML = '';
        listTitle.textContent = currentCategory;
        listCount.textContent = filtered.length ? '共 ' + filtered.length + ' 个' : '';
        listCard.hidden = false;
        list.hidden = !filtered.length;
        empty.hidden = Boolean(filtered.length);

        if (!filtered.length) {
            emptyTitle.textContent = currentCategory;
            emptyNote.textContent = '该分类的' + LABEL + '正在整理中，敬请期待。';
            return;
        }

        filtered.forEach(function (video) {
            var item = document.createElement('li');
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'media-item';
            button.setAttribute('aria-label', '打开' + LABEL + '：' + video.title);

            var play = document.createElement('span');
            play.className = 'media-play';
            play.setAttribute('aria-hidden', 'true');
            play.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"></path></svg>';

            var body = document.createElement('span');
            body.className = 'media-item-body';
            var title = document.createElement('span');
            title.className = 'media-item-title';
            title.textContent = video.title;
            var meta = document.createElement('span');
            meta.className = 'media-item-meta';
            meta.textContent = sourceLabel(video.url) + ' · ' + video.category;
            body.appendChild(title);
            body.appendChild(meta);

            var arrow = document.createElement('span');
            arrow.className = 'media-item-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '→';

            button.appendChild(play);
            button.appendChild(body);
            button.appendChild(arrow);
            button.addEventListener('click', function () { openVideo(video); });
            item.appendChild(button);
            list.appendChild(item);
        });
    }

    function setStatus(text, loading, isError) {
        status.hidden = !text;
        status.className = 'media-status' +
            (loading ? ' is-loading' : '') +
            (isError ? ' media-status--error' : '');
        status.textContent = text;
    }

    function loadVideos() {
        setStatus('正在加载' + LABEL + '…', true, false);
        listCard.hidden = true;

        fetch(CSV_URL + '?t=' + Date.now(), { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.text();
            })
            .then(function (text) {
                videos = parseVideos(parseCsv(text));
                if (!videos.length) {
                    setStatus(LABEL + '正在整理中，敬请期待。', false, false);
                    return;
                }
                status.hidden = true;
                renderList();
            })
            .catch(function (error) {
                console.warn(LABEL + '列表加载失败:', error);
                setStatus(LABEL + '列表加载失败，请尝试刷新网页。', false, true);
            });
    }

    function openVideo(video) {
        lastFocus = document.activeElement;
        modalTitle.textContent = video.title;
        modalCategory.textContent = video.category;
        modalSource.textContent = '视频来源：' + sourceLabel(video.url);
        external.href = video.url;
        external.textContent = isBilibili(video.url) ? '在 B 站打开 ↗' : '打开原视频 ↗';

        modal.hidden = false;
        document.body.classList.add('media-modal-open');

        var embed = toEmbedUrl(video.url);
        if (embed) {
            fallback.hidden = true;
            player.hidden = false;
            player.src = embed;
        } else {
            player.hidden = true;
            player.src = 'about:blank';
            fallback.hidden = false;
        }

        window.requestAnimationFrame(function () { modalClose.focus(); });
    }

    function closeVideo() {
        if (modal.hidden) return;
        modal.hidden = true;
        document.body.classList.remove('media-modal-open');
        player.src = 'about:blank';
        if (lastFocus && document.contains(lastFocus) && typeof lastFocus.focus === 'function') {
            lastFocus.focus();
        }
    }

    buildFilter();

    filter.addEventListener('change', function (event) {
        if (!event.target.matches('input[name="media-category"]')) return;
        currentCategory = event.target.value;
        if (videos.length) renderList();
        updateSlider();
    });

    modal.addEventListener('click', function (event) {
        if (event.target.closest('[data-media-close]')) closeVideo();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !modal.hidden) closeVideo();
    });

    window.addEventListener('resize', updateSlider);
    window.requestAnimationFrame(updateSlider);
    loadVideos();
})();
