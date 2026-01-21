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

window.addEventListener('resize', adjustNameScale);

async function loadRanking(fileName) {
    try {
        const response = await fetch(`./data/${fileName}`);
        let data = await response.json();
        const currentEvent = allEvents.find(e => e.file === fileName);
        const mode = currentEvent.type;

        if (mode === 'extermination') {
            data.forEach(item => {
                item.d1 = item.day1 || 0;
                item.d2 = item.day2 || 0;
                item.d3 = item.day3 || 0;
                item.t1 = item.d1;
                item.t2 = item.d1 + item.d2;
                item.t3 = item.d1 + item.d2 + item.d3;
            });

            calcSubRank(data, 't1', 'rank_t1');
            calcSubRank(data, 't2', 'rank_t2');
            calcSubRank(data, 't3', 'rank_t3');
            calcSubRank(data, 'd1', 'rank_d1');
            calcSubRank(data, 'd2', 'rank_d2');
            calcSubRank(data, 'd3', 'rank_d3');

            data.sort((a, b) => a.rank_t3 - b.rank_t3);
        }

        renderHeader(mode);

        tableBody.innerHTML = '';
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            if ((mode === 'season' && item.rank === 1) || (mode === 'extermination' && item.rank_t3 === 1)) {
                row.className = 'rank-1';
            }
            row.classList.add('row-animate');
            row.style.animationDelay = `${Math.min(index * 0.02, 1.0)}s`;

            if (mode === 'season') {
                const first = data[0];
                const prev = index === 0 ? data[0] : data[index - 1];
                row.innerHTML = renderSeasonRow(item, first, prev);
            } else {
                row.innerHTML = renderExRow(item, data, index);
            }
            tableBody.appendChild(row);
        });
        
        applyFilter();
        setTimeout(adjustNameScale, 50);

    } catch (e) { console.error("LOAD_FAILED:", e); }
}

function adjustNameScale() {
    const nameTexts = document.querySelectorAll('.name-scaler-text');
    nameTexts.forEach(span => {
        span.style.transform = 'none';
        const parent = span.parentElement;
        const parentWidth = parent.clientWidth;
        const textWidth = span.scrollWidth;
        if (textWidth > parentWidth) {
            const scale = parentWidth / textWidth;
            span.style.transform = `scale(${scale * 0.95})`;
        }
    });
}

function calcSubRank(data, key, rankKey) {
    const sorted = [...data].sort((a, b) => b[key] - a[key]);
    sorted.forEach((item, index) => {
        item[rankKey] = index + 1;
    });
}

function renderHeader(mode) {
    if (mode === 'season') {
        tableHead.innerHTML = `
            <tr>
                <th class="sticky-col th-brown">順</th>
                <th class="sticky-col name-col th-brown">ギルド名</th>
                <th class="th-green">スコア</th>
                <th class="th-green">メンバ数</th>
                <th class="th-green">一人当たり</th>
                <th class="th-green">1位差</th>
                <th class="th-green">上差</th>
                <th class="th-green">1位ノルマ</th>
                <th class="th-green">上ノルマ</th>
            </tr>`;
    } else {
        tableHead.innerHTML = `
            <tr>
                <th rowspan="2" class="sticky-col th-brown">順</th>
                <th rowspan="2" class="sticky-col name-col th-brown">ギルド名</th>
                <th colspan="5" class="th-green-dark">トータル</th>
                <th colspan="3" class="th-blue-dark">Day</th>
            </tr>
            <tr>
                <th class="th-green">1日目</th>
                <th class="th-green">2日目</th>
                <th class="th-green">3日目</th>
                <th class="th-green">1位差</th>
                <th class="th-green">上差</th>
                <th class="th-blue">1日目</th>
                <th class="th-blue">2日目</th>
                <th class="th-blue">3日目</th>
            </tr>`;
    }
}

function renderSeasonRow(item, first, prev) {
    const score = item.score || 0;
    const members = item.members || 20;
    const nameHtml = `<div class="name-scaler-wrap"><span class="name-scaler-text">${item.guildName}</span></div>`;

    return `
        <td class="sticky-col cell-rank">${item.rank}</td>
        <td class="sticky-col name-col hl">${nameHtml}</td>
        <td class="score-num">${score.toLocaleString()}</td>
        <td>${members}</td>
        <td class="hl">${(score / 1000 / members).toFixed(2)}</td>
        <td class="dim-num">${Math.abs(first.score - score).toLocaleString()}</td>
        <td class="dim-num">${Math.abs(prev.score - score).toLocaleString()}</td>
        <td class="norm-num">${(Math.abs(first.score - score) / 1000 / members).toFixed(2)}</td>
        <td class="norm-num">${(Math.abs(prev.score - score) / 1000 / members).toFixed(2)}</td>
    `;
}

function renderExRow(item, allData, index) {
    const first = allData[0];
    const prev = index === 0 ? allData[0] : allData[index - 1];
    
    const diffFirst = Math.abs(first.t3 - item.t3);
    const diffAbove = Math.abs(prev.t3 - item.t3);

    const cell = (rank, score, isDay) => {
        // ★ 1〜5位の色分けロジック
        let badgeColor = 'badge-norm';
        if (rank === 1) badgeColor = 'badge-1';
        else if (rank === 2) badgeColor = 'badge-2';
        else if (rank === 3) badgeColor = 'badge-3';
        else if (rank === 4) badgeColor = 'badge-4';
        else if (rank === 5) badgeColor = 'badge-5';

        const scoreClass = isDay ? 'day-val' : 'total-val';
        return `
            <div class="cell-inner">
                <span class="rank-badge ${badgeColor}">${rank}</span>
                <span class="${scoreClass}">${score.toLocaleString()}</span>
            </div>
        `;
    };
    
    const nameHtml = `<div class="name-scaler-wrap"><span class="name-scaler-text">${item.guildName}</span></div>`;

    return `
        <td class="sticky-col cell-rank">${item.rank_t3}</td>
        <td class="sticky-col name-col hl">${nameHtml}</td>
        
        <td>${cell(item.rank_t1, item.t1, false)}</td>
        <td>${cell(item.rank_t2, item.t2, false)}</td>
        <td>${cell(item.rank_t3, item.t3, false)}</td>
        
        <td class="dim-num small-text">${diffFirst.toLocaleString()}</td>
        <td class="dim-num small-text">${diffAbove.toLocaleString()}</td>
        
        <td>${cell(item.rank_d1, item.d1, true)}</td>
        <td>${cell(item.rank_d2, item.d2, true)}</td>
        <td>${cell(item.rank_d3, item.d3, true)}</td>
    `;
}

function applyFilter() {
    const term = searchInput.value.toLowerCase();
    document.querySelectorAll('#ranking-body tr').forEach(row => {
        const nameCell = row.querySelector('.name-col');
        if (nameCell) {
            const visible = nameCell.textContent.toLowerCase().includes(term);
            row.style.display = visible ? '' : 'none';
        }
    });
    adjustNameScale();
}

init();