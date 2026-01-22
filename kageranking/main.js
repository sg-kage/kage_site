const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('ranking-body');
const eventSelect = document.getElementById('event-select');
const searchInput = document.getElementById('search-input');

let allEvents = [];

async function init() {
    try {
        const response = await fetch('./events.json');
        allEvents = await response.json();
        allEvents.forEach(event => {
            const option = document.createElement('option');
            option.value = event.file;
            option.textContent = event.name;
            eventSelect.appendChild(option);
        });
        loadRanking(allEvents[0].file);
    } catch (e) { console.error("INIT_FAILED:", e); }
}

eventSelect.addEventListener('change', (e) => loadRanking(e.target.value));
searchInput.addEventListener('input', applyFilter);
window.addEventListener('resize', () => {
    updateStickyPosition();
    adjustNameScale();
});

async function loadRanking(fileName) {
    try {
        const response = await fetch(`./data/${fileName}`);
        let data = await response.json();
        const currentEvent = allEvents.find(e => e.file === fileName);
        const mode = currentEvent.type;

        if (mode === 'extermination') {
            data.forEach(item => {
                item.d1 = item.day1 || 0; item.d2 = item.day2 || 0; item.d3 = item.day3 || 0;
                item.t1 = item.d1; item.t2 = item.d1 + item.d2; item.t3 = item.d1 + item.d2 + item.d3;
            });
            calcSubRank(data, 't1', 'rank_t1'); calcSubRank(data, 't2', 'rank_t2');
            calcSubRank(data, 't3', 'rank_t3'); calcSubRank(data, 'd1', 'rank_d1');
            calcSubRank(data, 'd2', 'rank_d2'); calcSubRank(data, 'd3', 'rank_d3');
            data.sort((a, b) => a.rank_t3 - b.rank_t3);
        }

        renderHeader(mode);
        tableBody.innerHTML = '';
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = mode === 'season' ? renderSeasonRow(item, data[0], data[index === 0 ? 0 : index - 1]) : renderExRow(item, data, index);
            tableBody.appendChild(row);
        });

        applyFilter();
        // 描画後に重なりを防ぐための位置計算を確実に実行
        requestAnimationFrame(() => {
            setTimeout(() => {
                updateStickyPosition();
                adjustNameScale();
            }, 100);
        });
    } catch (e) { console.error("LOAD_FAILED:", e); }
}

function updateStickyPosition() {
    const firstCells = document.querySelectorAll('tbody tr td.sticky-col:nth-child(1)');
    if (firstCells.length > 0) {
        const firstWidth = firstCells[0].getBoundingClientRect().width;
        // tbodyの2列目
        document.querySelectorAll('tbody td.sticky-col.name-col').forEach(cell => {
            cell.style.left = `${firstWidth - 1}px`; // 境界線の重なりを微調整
        });
        // theadの2列目
        document.querySelectorAll('thead th.sticky-col.name-col').forEach(th => {
            th.style.left = `${firstWidth - 1}px`;
        });
    }
}

function adjustNameScale() {
    document.querySelectorAll('.name-scaler-text').forEach(span => {
        span.style.transform = 'none';
        span.style.display = 'inline-block';
        const parentWidth = span.parentElement.clientWidth;
        const textWidth = span.scrollWidth;
        if (textWidth > parentWidth) {
            const ratio = (parentWidth / textWidth) * 0.98;
            span.style.transform = `scale(${ratio})`;
            span.style.transformOrigin = 'left center';
        }
    });
}

function calcSubRank(data, key, rankKey) {
    const sorted = [...data].sort((a, b) => b[key] - a[key]);
    sorted.forEach((item, index) => { item[rankKey] = index + 1; });
}

function renderHeader(mode) {
    if (mode === 'season') {
        tableHead.innerHTML = `<tr><th class="sticky-col th-brown">順</th><th class="sticky-col name-col th-brown">ギルド名</th><th class="th-green">スコア</th><th class="th-green">メンバ</th><th class="th-green">平均</th><th class="th-green">1位差</th><th class="th-green">上差</th><th class="th-green">1位ノルマ</th><th class="th-green">上ノルマ</th></tr>`;
    } else {
        tableHead.innerHTML = `
            <tr><th rowspan="2" class="sticky-col th-brown">順</th><th rowspan="2" class="sticky-col name-col th-brown">ギルド名</th><th colspan="6" class="th-green-dark">トータル</th><th colspan="2" class="th-green"></th><th colspan="6" class="th-blue-dark">Day</th></tr>
            <tr><th colspan="2" class="th-green">1日</th><th colspan="2" class="th-green">2日</th><th colspan="2" class="th-green">3日</th><th class="th-green">1位差</th><th class="th-green">上差</th><th colspan="2" class="th-blue">1日</th><th colspan="2" class="th-blue">2日</th><th colspan="2" class="th-blue">3日</th></tr>`;
    }
}

function getRankBadge(rank) {
    let cls = 'badge-norm';
    if (rank >= 1 && rank <= 5) cls = `badge-${rank}`;
    return `<span class="rank-badge ${cls}">${rank}</span>`;
}

function renderSeasonRow(item, first, prev) {
    const score = item.score || 0;
    const members = item.members || 20;
    return `<td class="sticky-col cell-rank">${getRankBadge(item.rank)}</td><td class="sticky-col name-col"><div class="name-scaler-wrap" style="overflow:hidden;"><span class="name-scaler-text">${item.guildName}</span></div></td><td class="score-num">${score.toLocaleString()}</td><td>${members}</td><td>${(score / 1000 / members).toFixed(2)}</td><td class="dim-num">${Math.abs(first.score - score).toLocaleString()}</td><td class="dim-num">${Math.abs(prev.score - score).toLocaleString()}</td><td class="dim-num">${(Math.abs(first.score - score) / 1000 / members).toFixed(2)}</td><td class="dim-num">${(Math.abs(prev.score - score) / 1000 / members).toFixed(2)}</td>`;
}

function renderExRow(item, allData, index) {
    const cellPair = (rank, score, isDay) => {
        return `<td class="cell-rank-box">${getRankBadge(rank)}</td><td class="cell-score-box"><span class="${isDay ? 'day-val' : 'total-val'}">${score.toLocaleString()}</span></td>`;
    };
    return `<td class="sticky-col cell-rank">${getRankBadge(item.rank_t3)}</td><td class="sticky-col name-col"><div class="name-scaler-wrap" style="overflow:hidden;"><span class="name-scaler-text">${item.guildName}</span></div></td>${cellPair(item.rank_t1, item.t1, false)}${cellPair(item.rank_t2, item.t2, false)}${cellPair(item.rank_t3, item.t3, false)}<td class="dim-num">${Math.abs(allData[0].t3 - item.t3).toLocaleString()}</td><td class="dim-num">${Math.abs((allData[index === 0 ? 0 : index - 1].t3) - item.t3).toLocaleString()}</td>${cellPair(item.rank_d1, item.d1, true)}${cellPair(item.rank_d2, item.d2, true)}${cellPair(item.rank_d3, item.d3, true)}`;
}

function applyFilter() {
    const term = searchInput.value.toLowerCase();
    document.querySelectorAll('#ranking-body tr').forEach(row => {
        const span = row.querySelector('.name-scaler-text');
        if (span) { row.style.display = span.textContent.toLowerCase().includes(term) ? '' : 'none'; }
    });
}
init();