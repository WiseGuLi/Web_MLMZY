/* 革命文艺 · 音乐页：读取曲目表，播放 R2 音频并展开歌词。 */
(function () {
    'use strict';

    var CSV_URL = '/data/革命文艺/音乐.csv';
    var MUSIC_BASE = 'https://files.mlmzy.org/革命文艺/音乐/';

    var status = document.getElementById('musicStatus');
    var listCard = document.getElementById('musicListCard');
    var list = document.getElementById('musicList');
    var count = document.getElementById('musicCount');
    var player = document.getElementById('musicPlayer');
    var audio = document.getElementById('musicAudio');
    var nowPlaying = document.getElementById('musicNow');
    var closeButton = document.getElementById('musicPlayerClose');

    var songs = [];
    var currentIndex = -1;

    function setStatus(text, isError) {
        status.hidden = !text;
        status.classList.toggle('is-error', Boolean(isError));
        status.textContent = text || '';
    }

    function decodeBuffer(buffer) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch (error) {
            try {
                /* 音乐.csv 为 GBK/GB18030 编码，UTF-8 解码失败时改用中文编码。 */
                return new TextDecoder('gb18030').decode(buffer);
            } catch (fallbackError) {
                return new TextDecoder().decode(buffer);
            }
        }
    }

    function stripOuterQuotes(value) {
        var text = String(value == null ? '' : value);
        if (text.length >= 2 && text.charAt(0) === '"' && text.charAt(text.length - 1) === '"') {
            return text.slice(1, -1).replace(/""/g, '"');
        }
        return text;
    }

    function parseTsv(text) {
        return text.split('\n').map(function (line) {
            return line.split('\t').map(stripOuterQuotes);
        }).filter(function (row) {
            return row.some(function (cell) { return cell.trim() !== ''; });
        });
    }

    function parseCsv(text) {
        var rows = [];
        var row = [];
        var field = '';
        var inQuotes = false;

        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);

            if (inQuotes) {
                if (ch === '"') {
                    if (text.charAt(i + 1) === '"') {
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

    function parseTable(text) {
        var input = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
        var firstLine = input.split('\n')[0] || '';
        return firstLine.indexOf('\t') !== -1 ? parseTsv(input) : parseCsv(input);
    }

    function findColumn(headers, names) {
        for (var i = 0; i < names.length; i++) {
            var index = headers.indexOf(names[i]);
            if (index !== -1) return index;
        }
        return -1;
    }

    function normalizeLyrics(value) {
        var text = stripOuterQuotes(value)
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/\r\n?/g, '\n')
            .trim();
        return text || '暂无歌词';
    }

    function parseSongs(rows) {
        if (rows.length < 2) return [];

        var headers = rows[0].map(function (cell) { return String(cell || '').trim(); });
        var fileIndex = findColumn(headers, ['文件名', '文件', 'filename', 'file']);
        var titleIndex = findColumn(headers, ['歌名', '歌曲名称', '名称', 'title', 'name']);
        var lyricsIndex = findColumn(headers, ['歌词', 'lyrics']);
        if (fileIndex === -1 || titleIndex === -1) {
            throw new Error('音乐表缺少“文件名”或“歌名”列');
        }

        var result = [];
        var seen = Object.create(null);

        rows.slice(1).forEach(function (cells) {
            var fileName = String(cells[fileIndex] || '').trim();
            if (!fileName) return;

            var title = String(cells[titleIndex] || '').trim() || fileName.replace(/\.[^.]+$/, '');
            var key = fileName + '|' + title;
            if (seen[key]) return;
            seen[key] = true;

            result.push({
                file: fileName,
                title: title,
                lyrics: lyricsIndex === -1 ? '暂无歌词' : normalizeLyrics(cells[lyricsIndex])
            });
        });

        return result;
    }

    function buildAudioUrl(fileName) {
        var path = String(fileName).split('/').map(encodeURIComponent).join('/');
        return MUSIC_BASE + path;
    }

    function playIcon() {
        return '<svg class="music-icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"></path></svg>' +
            '<svg class="music-icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z"></path></svg>';
    }

    function renderList() {
        list.innerHTML = '';
        count.textContent = '共 ' + songs.length + ' 首';

        songs.forEach(function (song, index) {
            var item = document.createElement('li');
            item.className = 'music-item';
            item.setAttribute('data-index', String(index));

            var row = document.createElement('div');
            row.className = 'music-row';

            var play = document.createElement('button');
            play.type = 'button';
            play.className = 'music-play';
            play.setAttribute('data-music-play', '');
            play.setAttribute('aria-label', '播放：' + song.title);
            play.innerHTML = playIcon();

            var info = document.createElement('div');
            info.className = 'music-info';

            var title = document.createElement('span');
            title.className = 'music-title';
            title.textContent = song.title;

            var meta = document.createElement('span');
            meta.className = 'music-meta';
            meta.textContent = '革命文艺 · 音乐';

            info.appendChild(title);
            info.appendChild(meta);

            var lyricsButton = document.createElement('button');
            lyricsButton.type = 'button';
            lyricsButton.className = 'music-lyrics-toggle';
            lyricsButton.setAttribute('data-music-lyrics', '');
            lyricsButton.setAttribute('aria-expanded', 'false');
            lyricsButton.setAttribute('aria-controls', 'musicLyrics-' + index);
            lyricsButton.innerHTML = '<span>歌词</span><span class="music-lyrics-caret" aria-hidden="true"></span>';

            row.appendChild(play);
            row.appendChild(info);
            row.appendChild(lyricsButton);

            var lyrics = document.createElement('div');
            lyrics.className = 'music-lyrics';
            lyrics.id = 'musicLyrics-' + index;
            lyrics.hidden = true;

            var lyricsText = document.createElement('p');
            lyricsText.textContent = song.lyrics;
            lyrics.appendChild(lyricsText);

            item.appendChild(row);
            item.appendChild(lyrics);
            list.appendChild(item);
        });
    }

    function currentItem() {
        return currentIndex === -1 ? null : list.querySelector('.music-item[data-index="' + currentIndex + '"]');
    }

    function syncPlayingState() {
        var item = currentItem();
        if (item) item.classList.toggle('is-playing', !audio.paused);
        list.querySelectorAll('.music-play[data-music-play]').forEach(function (button) {
            var index = Number(button.closest('.music-item').getAttribute('data-index'));
            var song = songs[index];
            if (!song) return;
            var isCurrent = index === currentIndex;
            button.setAttribute('aria-label', (isCurrent && !audio.paused ? '暂停：' : '播放：') + song.title);
        });
    }

    function selectSong(index) {
        var song = songs[index];
        if (!song) return;

        currentIndex = index;
        list.querySelectorAll('.music-item').forEach(function (item) {
            item.classList.toggle('is-current', Number(item.getAttribute('data-index')) === index);
        });

        nowPlaying.textContent = song.title;
        player.hidden = false;
        document.body.classList.add('music-player-open');
        audio.src = buildAudioUrl(song.file);

        var promise = audio.play();
        if (promise && typeof promise.catch === 'function') {
            promise.catch(function (error) {
                console.warn('音乐播放失败:', error);
                setStatus('音频加载失败，请检查网络后重试。', true);
            });
        }
    }

    function toggleSong(index) {
        if (index === currentIndex) {
            if (audio.paused) {
                var promise = audio.play();
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(function () {
                        setStatus('音频加载失败，请检查网络后重试。', true);
                    });
                }
            } else {
                audio.pause();
            }
            return;
        }

        selectSong(index);
    }

    function closePlayer() {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        player.hidden = true;
        document.body.classList.remove('music-player-open');
        currentIndex = -1;
        nowPlaying.textContent = '—';
        list.querySelectorAll('.music-item').forEach(function (item) {
            item.classList.remove('is-current', 'is-playing');
        });
    }

    status.hidden = false;
    status.classList.remove('is-error');
    status.textContent = '正在加载音乐…';
    listCard.hidden = true;

    fetch(CSV_URL + '?t=' + Date.now(), { cache: 'no-store' })
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.arrayBuffer();
        })
        .then(function (buffer) {
            songs = parseSongs(parseTable(decodeBuffer(buffer)));
            if (!songs.length) {
                setStatus('音乐正在整理中，敬请期待。', false);
                return;
            }
            status.hidden = true;
            listCard.hidden = false;
            renderList();
        })
        .catch(function (error) {
            console.warn('音乐列表加载失败:', error);
            setStatus('音乐列表加载失败，请尝试刷新网页。', true);
        });

    list.addEventListener('click', function (event) {
        var playButton = event.target.closest('[data-music-play]');
        if (playButton) {
            var playItem = playButton.closest('.music-item');
            if (playItem) toggleSong(Number(playItem.getAttribute('data-index')));
            return;
        }

        var lyricsButton = event.target.closest('[data-music-lyrics]');
        if (lyricsButton) {
            var lyricsItem = lyricsButton.closest('.music-item');
            if (!lyricsItem) return;
            var panel = lyricsItem.querySelector('.music-lyrics');
            var expanded = lyricsButton.getAttribute('aria-expanded') === 'true';
            lyricsButton.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            if (panel) panel.hidden = expanded;
        }
    });

    audio.addEventListener('play', function () {
        setStatus('');
        syncPlayingState();
    });
    audio.addEventListener('pause', syncPlayingState);
    audio.addEventListener('ended', function () {
        syncPlayingState();
    });
    audio.addEventListener('error', function () {
        if (currentIndex === -1) return;
        setStatus('音频加载失败，请检查网络后重试。', true);
        syncPlayingState();
    });

    closeButton.addEventListener('click', closePlayer);
})();
