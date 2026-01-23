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
        // 描画後に位置を微調整
        requestAnimationFrame(() => {
            setTimeout(() => {
                updateStickyPosition();
                adjustNameScale();
            }, 50);
        });
    } catch (e) { console.error("LOAD_FAILED:", e); }
}

function updateStickyPosition() {
    const firstCols = document.querySelectorAll('tr td.sticky-col.col-rank');
    if (firstCols.length > 0) {
        const firstWidth = firstCols[0].offsetWidth;
        document.querySelectorAll('.col-name').forEach(cell => {
            cell.style.left = `${firstWidth}px`;
        });
    }
}

function renderHeader(mode) {
    if (mode === 'season') {
        tableHead.innerHTML = `<tr><th class="sticky-col col-rank th-guild">順</th><th class="sticky-col col-name th-guild">ギルド名</th><th style="width:75px" class="th-total">スコア</th><th style="width:30px" class="th-total">人</th><th style="width:40px" class="th-total">平均</th><th style="width:70px" class="th-total">1位差</th><th style="width:70px" class="th-total">上差</th></tr>`;
    } else {
        tableHead.innerHTML = `
            <tr><th rowspan="2" class="sticky-col col-rank th-guild">順</th><th rowspan="2" class="sticky-col col-name th-guild">ギルド名</th><th colspan="6" class="th-total">累計(Total)</th><th colspan="2" class="th-total">差</th><th colspan="6" class="th-day">日間(Day)</th></tr>
            <tr><th style="width:28px" class="th-total">順</th><th style="width:75px" class="th-total">D1</th><th style="width:28px" class="th-total">順</th><th style="width:75px" class="th-total">D2</th><th style="width:28px" class="th-total">順</th><th style="width:75px" class="th-total">D3</th><th style="width:70px" class="th-total">1位差</th><th style="width:70px" class="th-total">上差</th><th style="width:28px" class="th-day">順</th><th style="width:75px" class="th-day">D1</th><th style="width:28px" class="th-day">順</th><th style="width:75px" class="th-day">D2</th><th style="width:28px" class="th-day">順</th><th style="width:75px" class="th-day">D3</th></tr>`;
    }
}

function getRankBadge(rank) {
    let cls = 'badge-norm';
    if (rank >= 1 && rank <= 5) cls = `badge-${rank}`;
    return `<span class="rank-badge ${cls}">${rank}</span>`;
}

function renderSeasonRow(item, first, prev) {
    return `<td class="sticky-col col-rank">${getRankBadge(item.rank)}</td><td class="sticky-col col-name"><div class="name-scaler-wrap" style="overflow:hidden;"><span class="name-scaler-text">${item.guildName}</span></div></td><td class="total-val">${(item.score||0).toLocaleString()}</td><td>${item.members||20}</td><td>${((item.score||0)/1000/(item.members||20)).toFixed(1)}</td><td class="dim-num">${(first.score-(item.score||0)).toLocaleString()}</td><td class="dim-num">${(prev.score-(item.score||0)).toLocaleString()}</td>`;
}

function renderExRow(item, allData, index) {
    const p = (r, s, isD) => `<td style="width:28px">${getRankBadge(r)}</td><td style="width:75px"><span class="${isD ? 'day-val' : 'total-val'}">${s.toLocaleString()}</span></td>`;
    return `<td class="sticky-col col-rank">${getRankBadge(item.rank_t3)}</td><td class="sticky-col col-name"><div class="name-scaler-wrap" style="overflow:hidden;"><span class="name-scaler-text">${item.guildName}</span></div></td>${p(item.rank_t1, item.t1, false)}${p(item.rank_t2, item.t2, false)}${p(item.rank_t3, item.t3, false)}<td class="dim-num">${(allData[0].t3 - item.t3).toLocaleString()}</td><td class="dim-num">${((allData[index === 0 ? 0 : index - 1].t3) - item.t3).toLocaleString()}</td>${p(item.rank_d1, item.d1, true)}${p(item.rank_d2, item.d2, true)}${p(item.rank_d3, item.d3, true)}`;
}

function adjustNameScale() {
    document.querySelectorAll('.name-scaler-text').forEach(span => {
        span.style.transform = 'none';
        const pw = span.parentElement.clientWidth;
        const tw = span.scrollWidth;
        if (tw > pw) {
            const r = (pw / tw) * 0.98;
            span.style.transform = `scale(${r})`;
            span.style.transformOrigin = 'left center';
        }
    });
}

function calcSubRank(data, key, rankKey) {
    const sorted = [...data].sort((a, b) => b[key] - a[key]);
    sorted.forEach((item, index) => { item[rankKey] = index + 1; });
}

function applyFilter() {
    const term = searchInput.value.toLowerCase();
    document.querySelectorAll('#ranking-body tr').forEach(row => {
        const text = row.querySelector('.name-scaler-text')?.textContent.toLowerCase() || "";
        row.style.display = text.includes(term) ? '' : 'none';
    });
}
init();