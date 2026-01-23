const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('ranking-body');
const eventSelect = document.getElementById('event-select');
const searchInput = document.getElementById('search-input');
const tabs = document.querySelectorAll('.mode-tab');

let allEvents = [];
let currentMode = 'ex'; 

async function init() {
    try {
        const response = await fetch('./events.json');
        allEvents = await response.json();
        setupTabs();
        updateEventDropdown();
    } catch (e) { console.error("INIT_FAILED:", e); }
}

function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode; // 'ex' か 'ss'
            updateEventDropdown();
        });
    });
}

function updateEventDropdown() {
    eventSelect.innerHTML = '';
    const filtered = allEvents.filter(e => e.type === currentMode);
    filtered.forEach(event => {
        const option = document.createElement('option');
        option.value = event.file;
        option.textContent = event.name;
        eventSelect.appendChild(option);
    });
    if (filtered.length > 0) loadRanking(filtered[0].file);
}

eventSelect.addEventListener('change', (e) => loadRanking(e.target.value));
searchInput.addEventListener('input', applyFilter);
window.addEventListener('resize', updateLayout);

async function loadRanking(filePath) {
    try {
        const response = await fetch(`./data/${filePath}`);
        const json = await response.json();
        
        // ★ranking キーからデータを取得
        let data = json.ranking || [];
        
        const isMobile = window.innerWidth <= 480;
        const root = document.documentElement;

        if (currentMode === 'ex') {
            root.style.setProperty('--rank-w', isMobile ? '28px' : '45px');
            root.style.setProperty('--name-w', isMobile ? '85px' : '200px');
            data.forEach(item => {
                item.d1 = item.day1 || 0; item.d2 = item.day2 || 0; item.d3 = item.day3 || 0;
                item.t1 = item.d1; item.t2 = item.d1 + item.d2; item.t3 = item.d1 + item.d2 + item.d3;
            });
            calcSubRank(data, 't1', 'rank_t1'); calcSubRank(data, 't2', 'rank_t2');
            calcSubRank(data, 't3', 'rank_t3'); calcSubRank(data, 'd1', 'rank_d1');
            calcSubRank(data, 'd2', 'rank_d2'); calcSubRank(data, 'd3', 'rank_d3');
            data.sort((a, b) => a.rank_t3 - b.rank_t3);
        } else {
            root.style.setProperty('--rank-w', isMobile ? '35px' : '55px');
            root.style.setProperty('--name-w', isMobile ? '100px' : '240px');
            data.sort((a, b) => (a.rank || 999) - (b.rank || 999));
        }

        renderHeader(currentMode);
        tableBody.innerHTML = '';
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = currentMode === 'ss' 
                ? renderSeasonRow(item, data[0], data[index === 0 ? 0 : index - 1]) 
                : renderExRow(item, data, index);
            tableBody.appendChild(row);
        });
        applyFilter();
        updateLayout();
    } catch (e) { console.error("LOAD_FAILED:", e); }
}

function updateLayout() {
    requestAnimationFrame(() => {
        const firstCol = document.querySelector('.col-rank');
        if (firstCol) document.documentElement.style.setProperty('--rank-w', `${firstCol.offsetWidth}px`);
        adjustNameScale();
    });
}

function renderHeader(mode) {
    if (mode === 'ss') {
        tableHead.innerHTML = `<tr><th class="sticky-col col-rank th-guild">順</th><th class="sticky-col col-name th-guild">ギルド名</th><th style="width:80px" class="th-total">スコア</th><th style="width:30px" class="th-total">人</th><th style="width:40px" class="th-total">平均</th><th style="width:75px" class="th-total">1位差</th><th style="width:75px" class="th-total">上差</th></tr>`;
    } else {
        tableHead.innerHTML = `<tr><th rowspan="2" class="sticky-col col-rank th-guild">順</th><th rowspan="2" class="sticky-col col-name th-guild">ギルド名</th><th colspan="6" class="th-total">累計</th><th colspan="2" class="th-total">差分</th><th colspan="6" class="th-day">日間</th></tr>
        <tr><th style="width:28px">順</th><th style="width:80px">D1</th><th style="width:28px">順</th><th style="width:80px">D2</th><th style="width:28px">順</th><th style="width:80px">D3</th><th style="width:75px">1位差</th><th style="width:75px">上差</th><th style="width:28px">順</th><th style="width:80px">D1</th><th style="width:28px">順</th><th style="width:80px">D2</th><th style="width:28px">順</th><th style="width:80px">D3</th></tr>`;
    }
}

function getRankBadge(rank) {
    let cls = (rank >= 1 && rank <= 5) ? `badge-${rank}` : 'badge-norm';
    return `<span class="rank-badge ${cls}">${rank}</span>`;
}

function renderSeasonRow(item, first, prev) {
    const s = item.score || 0;
    const m = item.members || 20;
    return `<td class="sticky-col col-rank">${getRankBadge(item.rank)}</td><td class="sticky-col col-name"><div class="name-scaler-wrap" style="overflow:hidden;"><span class="name-scaler-text">${item.guildName}</span></div></td><td class="total-val">${s.toLocaleString()}</td><td>${m}</td><td>${(s/1000/m).toFixed(1)}</td><td class="dim-num">${(first.score-s).toLocaleString()}</td><td class="dim-num">${(prev.score-s).toLocaleString()}</td>`;
}

function renderExRow(item, allData, index) {
    const p = (r, s, isD) => `<td style="width:30px">${getRankBadge(r)}</td><td style="width:80px"><span class="${isD ? 'day-val' : 'total-val'}">${s.toLocaleString()}</span></td>`;
    return `<td class="sticky-col col-rank">${getRankBadge(item.rank_t3)}</td><td class="sticky-col col-name"><div class="name-scaler-wrap" style="overflow:hidden;"><span class="name-scaler-text">${item.guildName}</span></div></td>${p(item.rank_t1, item.t1, false)}${p(item.rank_t2, item.t2, false)}${p(item.rank_t3, item.t3, false)}<td class="dim-num">${(allData[0].t3-item.t3).toLocaleString()}</td><td class="dim-num">${((allData[index===0?0:index-1].t3)-item.t3).toLocaleString()}</td>${p(item.rank_d1, item.d1, true)}${p(item.rank_d2, item.d2, true)}${p(item.rank_d3, item.d3, true)}`;
}

function adjustNameScale() {
    document.querySelectorAll('.name-scaler-text').forEach(span => {
        span.style.transform = 'none';
        const pw = span.parentElement.clientWidth;
        const tw = span.scrollWidth;
        if (tw > pw) { span.style.transform = `scale(${(pw/tw)*0.98})`; span.style.transformOrigin = 'left center'; }
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