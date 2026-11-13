/* 文章页：读取 /data/文章.csv，按分类展示文章，并从 R2 拉取 Markdown 正文。 */
(function () {
    'use strict';

    var CONFIG_URL = '/data/文章.csv';
    var API_URL = '/api/article';
    var R2_BASE = 'https://files.mlmzy.org/文章/';

    var tabs = document.getElementById('categoryTabs');
    var view = document.getElementById('articleView');
    var backLink = document.getElementById('backLink');
    var articlePage = document.querySelector('.article-page');
    var sidebarToggle = document.getElementById('sidebarToggle');
    var sidebarToggleLabel = sidebarToggle.querySelector('.sidebar-toggle-label');

    var CATEGORIES = [];
    var configLoaded = false;
    var markdownCache = Object.create(null);
    var articleRequestToken = 0;

    function setSidebarHidden(hidden) {
        articlePage.classList.toggle('sidebar-hidden', hidden);
        sidebarToggle.setAttribute('aria-expanded', String(!hidden));
        sidebarToggleLabel.textContent = hidden ? '显示侧栏' : '隐藏侧栏';
        sidebarToggle.title = hidden ? '显示文章分类侧栏' : '隐藏文章分类侧栏';
    }

    setSidebarHidden(false);

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char];
        });
    }

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
            return cells.some(function (cell) { return cell.trim() !== ''; });
        });
    }

    function splitTags(value) {
        return String(value || '')
            .split(/[,，、;；]+/)
            .map(function (tag) { return tag.trim(); })
            .filter(Boolean);
    }

    function buildCategories(rows) {
        if (rows.length < 2) return [];

        var headers = rows[0].map(function (cell) { return cell.trim(); });
        var titleIndex = headers.indexOf('文章名');
        var categoryIndex = headers.indexOf('分类');
        var tagsIndex = headers.indexOf('标签');
        if (titleIndex === -1 || categoryIndex === -1) return [];

        var categories = [];
        var byName = Object.create(null);

        rows.slice(1).forEach(function (cells) {
            var title = String(cells[titleIndex] || '').trim();
            var categoryName = String(cells[categoryIndex] || '').trim();
            if (!title || !categoryName) return;

            var category = byName[categoryName];
            if (!category) {
                category = {
                    slug: categoryName,
                    name: categoryName,
                    intro: '',
                    articles: []
                };
                byName[categoryName] = category;
                categories.push(category);
            }

            category.articles.push({
                slug: title,
                title: title,
                tags: tagsIndex === -1 ? [] : splitTags(cells[tagsIndex])
            });
        });

        categories.forEach(function (category) {
            category.intro = '本分类共收录 ' + category.articles.length + ' 篇文章。';
        });

        return categories;
    }

    function categoryHref(category) {
        return '/article/' + encodeURIComponent(category.slug);
    }

    function articleHref(category, article) {
        return categoryHref(category) + '/' + encodeURIComponent(article.slug);
    }

    function findCategory(slug) {
        return CATEGORIES.find(function (category) {
            return category.slug === slug;
        });
    }

    function findArticle(category, slug) {
        return category.articles.find(function (article) {
            return article.slug === slug;
        });
    }

    function getRouteSegments() {
        var path = window.location.pathname.replace(/\/+$/, '');
        var parts = path.split('/').filter(Boolean);
        if (!parts.length || parts[0] !== 'article') return [];

        return parts.slice(1).map(function (part) {
            try {
                return decodeURIComponent(part);
            } catch (error) {
                return part;
            }
        }).filter(function (part) {
            return part !== 'index.html';
        });
    }

    function setPageTitle(title) {
        document.title = title + ' | GuLi 马列毛主义学习站';
    }

    function renderTabs(activeSlug) {
        tabs.innerHTML = CATEGORIES.map(function (category) {
            var href = categoryHref(category);
            var active = category.slug === activeSlug;
            return '<a href="' + href + '" data-route="' + href + '"' +
                (active ? ' class="is-active" aria-current="page"' : '') +
                '>' + escapeHtml(category.name) + '</a>';
        }).join('');
    }

    function setBackTarget(target) {
        if (!target) {
            backLink.hidden = true;
            backLink.removeAttribute('data-target');
            return;
        }

        backLink.hidden = false;
        backLink.setAttribute('data-target', target);
    }

    function renderHome() {
        renderTabs(null);
        setBackTarget(null);
        setPageTitle('文章');

        var mobileCategories = CATEGORIES.map(function (category) {
            var href = categoryHref(category);
            return '<a href="' + href + '" data-route="' + href + '">' +
                escapeHtml(category.name) + '</a>';
        }).join('');

        var total = CATEGORIES.reduce(function (count, category) {
            return count + category.articles.length;
        }, 0);

        view.innerHTML =
            '<h1 class="mobile-page-title">文章</h1>' +
            '<div class="home-intro">' +
                '<p class="eyebrow">文章栏目</p>' +
                '<h2>在阅读中把理论变成方法</h2>' +
                '<p>这里按主题整理理论学习、历史与现实相关的文章，目前共收录 ' + total + ' 篇，分为 ' + CATEGORIES.length + ' 个分类。</p>' +
                '<p>可以按左侧分类浏览，或从下方分类入口进入。</p>' +
            '</div>' +
            '<nav class="mobile-category-list" aria-label="文章分类">' + mobileCategories + '</nav>';
    }

    function renderCategory(category) {
        renderTabs(category.slug);
        setBackTarget('/article');
        setPageTitle(category.name + ' · 文章');

        var articles = category.articles.length
            ? '<ul class="article-list">' + category.articles.map(function (article) {
                var href = articleHref(category, article);
                return '<li class="article-row">' +
                    '<h2 class="article-row-title">' + escapeHtml(article.title) + '</h2>' +
                    '<a class="read-btn" href="' + href + '" data-route="' + href + '">阅读</a>' +
                '</li>';
            }).join('') + '</ul>'
            : '<p class="empty-note">这个分类暂时还没有文章。</p>';

        view.innerHTML =
            '<h1 class="category-title">' + escapeHtml(category.name) + '</h1>' +
            '<p class="category-intro">' + escapeHtml(category.intro) + '</p>' +
            articles;
    }

    function renderArticleHeading(category, article) {
        var tags = article.tags.length
            ? '<div class="article-tags" aria-label="文章标签">' + article.tags.map(function (tag) {
                return '<span class="article-tag">' + escapeHtml(tag) + '</span>';
            }).join('') + '</div>'
            : '';

        return '<p class="article-kicker">' + escapeHtml(category.name) + '</p>' +
            '<h1 class="article-page-title">' + escapeHtml(article.title) + '</h1>' +
            tags +
            '<div class="article-body markdown-body" id="articleBody"></div>';
    }

    function renderArticleLoading(category, article) {
        renderTabs(category.slug);
        setBackTarget(categoryHref(category));
        setPageTitle(article.title);

        view.innerHTML = renderArticleHeading(category, article) +
            '<p class="article-state" id="articleState">正在加载正文…</p>';

        var body = document.getElementById('articleBody');
        if (body) body.hidden = true;
    }

    function renderArticleError(category, article, message) {
        var body = document.getElementById('articleBody');
        var state = document.getElementById('articleState');
        if (state) {
            state.className = 'article-state article-state--error';
            state.innerHTML = escapeHtml(message) +
                ' <button class="article-retry" type="button">重试</button>';
        }
        if (body) body.hidden = true;
    }

    function safeUrl(value) {
        var url = String(value || '').trim();
        if (/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url)) return url;
        return '#';
    }

    function inlineMarkdown(value) {
        var codeTokens = [];
        var text = String(value || '');

        text = text.replace(/`([^`]+)`/g, function (match, code) {
            var token = '\u0000CODE' + codeTokens.length + '\u0000';
            codeTokens.push('<code>' + escapeHtml(code) + '</code>');
            return token;
        });

        text = escapeHtml(text);

        text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, function (match, alt, src) {
            return '<img src="' + safeUrl(src) + '" alt="' + alt + '" loading="lazy">';
        });

        text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, function (match, label, href) {
            return '<a href="' + safeUrl(href) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
        });

        text = text
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_]+)__/g, '<strong>$1</strong>')
            .replace(/~~([^~]+)~~/g, '<del>$1</del>')
            .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
            .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

        text = text.replace(/\u0000CODE(\d+)\u0000/g, function (match, index) {
            return codeTokens[Number(index)] || '';
        });

        return text;
    }

    function isBlockStart(line) {
        return /^\s*(#{1,6}\s+|>\s?|```|([-*+]|\d+[.)])\s+)/.test(line) ||
            /^ {0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line) ||
            /^<div\s+align=/i.test(line);
    }

    function splitTableRow(line) {
        return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (cell) {
            return cell.trim();
        });
    }

    function renderMarkdown(markdown) {
        var lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
        var html = [];
        var i = 0;

        while (i < lines.length) {
            var line = lines[i];

            if (!line.trim()) {
                i++;
                continue;
            }

            if (/^```/.test(line)) {
                var language = line.replace(/^```/, '').trim();
                var codeLines = [];
                i++;
                while (i < lines.length && !/^```/.test(lines[i])) {
                    codeLines.push(lines[i]);
                    i++;
                }
                i++;
                html.push('<pre><code' +
                    (language ? ' class="language-' + escapeHtml(language) + '"' : '') +
                    '>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
                continue;
            }

            var heading = line.match(/^(#{1,6})\s+(.*)$/);
            if (heading) {
                var level = heading[1].length;
                html.push('<h' + level + '>' + inlineMarkdown(heading[2]) + '</h' + level + '>');
                i++;
                continue;
            }

            if (/^ {0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) {
                html.push('<hr>');
                i++;
                continue;
            }

            var alignBlock = line.match(/^<div\s+align=["']?(left|center|right)["']?\s*>(.*)<\/div>\s*$/i);
            if (alignBlock) {
                html.push('<div class="markdown-div-' + alignBlock[1] + '">' +
                    inlineMarkdown(alignBlock[2]) + '</div>');
                i++;
                continue;
            }

            if (line.indexOf('|') !== -1 && i + 1 < lines.length &&
                /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
                var headerCells = splitTableRow(line);
                var aligns = splitTableRow(lines[i + 1]).map(function (cell) {
                    if (/^:-+:$/.test(cell)) return 'center';
                    if (/-+:$/.test(cell)) return 'right';
                    return 'left';
                });
                i += 2;
                var tableRows = [];
                while (i < lines.length && lines[i].indexOf('|') !== -1 && lines[i].trim()) {
                    tableRows.push(splitTableRow(lines[i]));
                    i++;
                }
                html.push('<div class="markdown-table-wrap"><table><thead><tr>' +
                    headerCells.map(function (cell, index) {
                        return '<th style="text-align:' + (aligns[index] || 'left') + '">' +
                            inlineMarkdown(cell) + '</th>';
                    }).join('') +
                    '</tr></thead><tbody>' +
                    tableRows.map(function (cells) {
                        return '<tr>' + cells.map(function (cell, index) {
                            return '<td style="text-align:' + (aligns[index] || 'left') + '">' +
                                inlineMarkdown(cell) + '</td>';
                        }).join('') + '</tr>';
                    }).join('') +
                    '</tbody></table></div>');
                continue;
            }

            if (/^\s*>/.test(line)) {
                var quoteLines = [];
                while (i < lines.length && /^\s*>/.test(lines[i])) {
                    quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
                    i++;
                }
                html.push('<blockquote><p>' + quoteLines.map(inlineMarkdown).join('<br>') + '</p></blockquote>');
                continue;
            }

            var unordered = line.match(/^\s*[-*+]\s+(.*)$/);
            if (unordered) {
                var unorderedItems = [];
                while (i < lines.length) {
                    var item = lines[i].match(/^\s*[-*+]\s+(.*)$/);
                    if (!item) break;
                    unorderedItems.push('<li>' + inlineMarkdown(item[1]) + '</li>');
                    i++;
                }
                html.push('<ul>' + unorderedItems.join('') + '</ul>');
                continue;
            }

            var ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
            if (ordered) {
                var orderedItems = [];
                while (i < lines.length) {
                    var orderedItem = lines[i].match(/^\s*\d+[.)]\s+(.*)$/);
                    if (!orderedItem) break;
                    orderedItems.push('<li>' + inlineMarkdown(orderedItem[1]) + '</li>');
                    i++;
                }
                html.push('<ol>' + orderedItems.join('') + '</ol>');
                continue;
            }

            var paragraph = [line];
            i++;
            while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
                paragraph.push(lines[i]);
                i++;
            }
            html.push('<p>' + inlineMarkdown(paragraph.join('\n')) + '</p>');
        }

        return html.join('');
    }

    function buildR2Url(category, article) {
        return R2_BASE + [category.name, article.title + '.md'].map(function (part) {
            return encodeURIComponent(part);
        }).join('/');
    }

    async function fetchArticleMarkdown(category, article) {
        var key = category.slug + '\u0000' + article.slug;
        if (markdownCache[key]) return markdownCache[key];

        var params = new URLSearchParams({
            category: category.name,
            name: article.title
        });
        var response;

        try {
            response = await fetch(API_URL + '?' + params.toString(), { cache: 'no-store' });
        } catch (error) {
            response = null;
        }

        if (!response || !response.ok) {
            response = await fetch(buildR2Url(category, article), { cache: 'no-store' });
        }
        if (!response.ok) throw new Error('HTTP ' + response.status);

        var markdown = await response.text();
        markdownCache[key] = markdown;
        return markdown;
    }

    async function renderArticle(category, article) {
        var token = ++articleRequestToken;
        renderArticleLoading(category, article);

        try {
            var markdown = await fetchArticleMarkdown(category, article);
            if (token !== articleRequestToken) return;

            var body = document.getElementById('articleBody');
            var state = document.getElementById('articleState');
            if (!body) return;

            body.innerHTML = renderMarkdown(markdown);
            body.hidden = false;
            if (state) state.remove();
        } catch (error) {
            if (token !== articleRequestToken) return;
            console.warn('文章正文加载失败:', error);
            renderArticleError(category, article, '正文暂时无法加载，请稍后重试。');
        }
    }

    function render() {
        if (!configLoaded) return;

        var segments = getRouteSegments();
        var category = findCategory(segments[0]);

        if (!category) {
            if (segments.length) {
                window.history.replaceState({}, '', '/article');
            }
            renderHome();
            return;
        }

        var article = findArticle(category, segments[1]);

        if (segments[1] && !article) {
            window.history.replaceState({}, '', categoryHref(category));
            renderCategory(category);
            return;
        }

        if (article) {
            renderArticle(category, article);
        } else {
            renderCategory(category);
        }
    }

    function navigate(path) {
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
        }
        render();
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    document.addEventListener('click', function (event) {
        var link = event.target.closest('a[data-route]');
        if (link) {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            navigate(link.getAttribute('data-route'));
            return;
        }

        if (event.target.closest('.article-retry')) {
            var segments = getRouteSegments();
            var category = findCategory(segments[0]);
            var article = category ? findArticle(category, segments[1]) : null;
            if (category && article) {
                delete markdownCache[category.slug + '\u0000' + article.slug];
                renderArticle(category, article);
            }
        }
    });

    backLink.addEventListener('click', function () {
        var target = backLink.getAttribute('data-target');
        if (target) navigate(target);
    });

    sidebarToggle.addEventListener('click', function () {
        setSidebarHidden(!articlePage.classList.contains('sidebar-hidden'));
    });

    window.addEventListener('popstate', render);

    view.innerHTML = '<p class="article-state">正在加载文章目录…</p>';

    fetch(CONFIG_URL + '?t=' + Date.now(), { cache: 'no-store' })
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.text();
        })
        .then(function (text) {
            CATEGORIES = buildCategories(parseCsv(text));
            configLoaded = true;
            render();
        })
        .catch(function (error) {
            console.warn('文章目录加载失败:', error);
            view.innerHTML = '<p class="article-state article-state--error">文章目录加载失败，请稍后刷新重试。</p>';
        });
})();
