const mainTable = document.getElementById('main-table');
const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('ranking-body');
const eventSelect = document.getElementById('event-select');
const searchInput = document.getElementById('search-input');
const tabs = document.querySelectorAll('.mode-tab');

const modal = document.getElementById('chart-modal');
const closeBtn = document.querySelector('.close-button');
let historyChart = null;

let allEvents = [];
let currentMode = 'ex'; 

// 初期化処理
async function init() {
    try {
        const response = await fetch('./events.json');
        allEvents = await response.json();
        setupTabs();
        updateEventDropdown();
        setupModal();
    } catch (e) { console.error("INIT_FAILED:", e); }
}

// タブ切り替えの設定
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;
            updateEventDropdown();
        });
    });
}

// ドロップダウン更新
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

window.addEventListener('resize', () => {
    renderColgroups(currentMode);
    adjustNameScale();
});

// ランキング読み込み
async function loadRanking(filePath) {
    try {
        const response = await fetch(`./data/${filePath}`);
        const json = await response.json();
        let data = json.ranking || [];

        if (currentMode === 'ex') {
            data.forEach(item => {
                item.d1 = item.day1 || 0; item.d2 = item.day2 || 0; item.d3 = item.day3 || 0;
                item.t1 = item.d1; item.t2 = item.d1 + item.d2; item.t3 = item.d1 + item.d2 + item.d3;
            });
            calcSubRank(data, 't1', 'rank_t1'); calcSubRank(data, 't2', 'rank_t2');
            calcSubRank(data, 't3', 'rank_t3'); calcSubRank(data, 'd1', 'rank_d1');
            calcSubRank(data, 'd2', 'rank_d2'); calcSubRank(data, 'd3', 'rank_d3');
            data.sort((a, b) => a.rank_t3 - b.rank_t3);
        } else {
            data.sort((a, b) => (b.score || 0) - (a.score || 0));
        }

        // 上位50位までに制限
        data = data.slice(0, 50);

        renderColgroups(currentMode);
        renderHeader(currentMode);
        tableBody.innerHTML = '';
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = currentMode === 'ss' 
                ? renderSeasonRow(item, data[0], data[index === 0 ? 0 : index - 1]) 
                : renderExRow(item, data, index);
            
            const nameCell = row.querySelector('.col-name');
            if (nameCell) {
                nameCell.onclick = () => showHistory(item.guildName);
            }
            
            tableBody.appendChild(row);
        });
        
        applyFilter();
        setTimeout(adjustNameScale, 10);
    } catch (e) { console.error("LOAD_FAILED:", e); }
}

// 列幅予約（スマホ70px対応）
function renderColgroups(mode) {
    const oldColgroup = mainTable.querySelector('colgroup');
    if (oldColgroup) oldColgroup.remove();
    const colgroup = document.createElement('colgroup');
    
    const isMobile = window.innerWidth <= 480;
    const nameWidth = isMobile ? "70px" : "200px";
    const rankWidth = isMobile ? "25px" : "30px";

    if (mode === 'ss') {
        colgroup.innerHTML = `<col style="width:${rankWidth}"><col style="width:${nameWidth}"><col><col style="width:50px"><col style="width:60px"><col><col>`;
    } else {
        colgroup.innerHTML = `
            <col style="width:${rankWidth}"><col style="width:${nameWidth}">
            <col style="width:${rankWidth}"><col><col style="width:${rankWidth}"><col><col style="width:${rankWidth}"><col>
            <col><col>
            <col style="width:${rankWidth}"><col><col style="width:${rankWidth}"><col><col style="width:${rankWidth}"><col>
        `;
    }
    mainTable.insertBefore(colgroup, tableHead);
}

function renderHeader(mode) {
    if (mode === 'ss') {
        tableHead.innerHTML = `<tr><th class="col-rank th-guild">順</th><th class="col-name th-guild">ギルド名</th><th class="th-total">スコア</th><th>人</th><th>平均</th><th>1位差</th><th>上差</th></tr>`;
    } else {
        tableHead.innerHTML = `<tr><th rowspan="2" class="col-rank th-guild">順</th><th rowspan="2" class="col-name th-guild">ギルド名</th><th colspan="6" class="th-total">累計</th><th colspan="2" class="th-total">差分</th><th colspan="6" class="th-day">日間</th></tr>
        <tr><th class="col-sub-rank">順</th><th>D1</th><th class="col-sub-rank">順</th><th>D2</th><th class="col-sub-rank">順</th><th>D3</th><th>1位差</th><th>上差</th><th class="col-sub-rank">順</th><th>D1</th><th class="col-sub-rank">順</th><th>D2</th><th class="col-sub-rank">順</th><th>D3</th></tr>`;
    }
}

function getRankBadge(rank) {
    let cls = (rank >= 1 && rank <= 5) ? `badge-${rank}` : 'badge-norm';
    return `<span class="rank-badge ${cls}">${rank}</span>`;
}

function renderSeasonRow(item, first, prev) {
    const s = item.score || 0;
    return `<td class="col-rank">${getRankBadge(item.rank || "－")}</td><td class="col-name"><div class="name-scaler-wrap"><span class="name-scaler-text">${item.guildName}</span></div></td><td class="total-val">${s.toLocaleString()}</td><td>${item.members || 20}</td><td>${(s/1000/(item.members||20)).toFixed(1)}</td><td class="dim-num">${(first.score-s).toLocaleString()}</td><td class="dim-num">${(prev.score-s).toLocaleString()}</td>`;
}

function renderExRow(item, allData, index) {
    const p = (r, s, isD) => `<td class="col-sub-rank">${getRankBadge(r)}</td><td><span class="${isD ? 'day-val' : 'total-val'}">${s.toLocaleString()}</span></td>`;
    return `<td class="col-rank">${getRankBadge(item.rank_t3)}</td><td class="col-name"><div class="name-scaler-wrap"><span class="name-scaler-text">${item.guildName}</span></div></td>${p(item.rank_t1, item.t1, false)}${p(item.rank_t2, item.t2, false)}${p(item.rank_t3, item.t3, false)}<td class="dim-num">${(allData[0].t3-item.t3).toLocaleString()}</td><td class="dim-num">${((allData[index===0?0:index-1].t3)-item.t3).toLocaleString()}</td>${p(item.rank_d1, item.d1, true)}${p(item.rank_d2, item.d2, true)}${p(item.rank_d3, item.d3, true)}`;
}

// グラフ表示（数字の常時表示を強化）
async function showHistory(guildName) {
    const modeEvents = allEvents.filter(e => e.type === currentMode).slice(-10);
    modeEvents.reverse(); 

    const labels = [];
    const ranks = [];

    for (const ev of modeEvents) {
        try {
            const resp = await fetch(`./data/${ev.file}`);
            const json = await resp.json();
            const found = json.ranking.find(g => g.guildName === guildName);
            labels.push(ev.name.replace("魔界殲滅戦争", "").replace("魔界戦記 ", ""));
            ranks.push(found ? (found.rank || found.rank_t3) : null);
        } catch (e) { console.error(e); }
    }

    modal.style.display = "block";
    const modeLabel = currentMode === 'ex' ? '殲滅戦' : 'シーズン';
    document.getElementById('modal-title').textContent = `${guildName} - ${modeLabel}順位推移`;
    
    const ctx = document.getElementById('history-chart').getContext('2d');
    if (historyChart) historyChart.destroy();
    
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '順位',
                data: ranks,
                borderColor: '#d4af37',
                backgroundColor: 'transparent',
                tension: 0.1,
                fill: false,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#d4af37'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 35, left: 10, right: 10, bottom: 10 } },
            scales: {
                y: { reverse: true, min: 1, max: 50, ticks: { color: '#fff', stepSize: 5 } },
                x: { ticks: { color: '#fff' } }
            },
            plugins: { 
                legend: { display: false },
                tooltip: { enabled: true }
            },
            // 数字を確実に描画するロジック
            animation: {
                onComplete: function() {
                    const ctx = this.ctx;
                    ctx.font = "bold 12px sans-serif";
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = '#ffffff';

                    this.data.datasets.forEach((dataset, i) => {
                        const meta = this.getDatasetMeta(i);
                        meta.data.forEach((element, index) => {
                            const data = dataset.data[index];
                            if (data !== null) {
                                // 点の少し上に描画
                                ctx.fillText(data, element.x, element.y - 12);
                            }
                        });
                    });
                }
            }
        }
    });
}

function setupModal() {
    closeBtn.onclick = () => { modal.style.display = "none"; };
    window.addEventListener('click', (event) => {
        if (event.target === modal) { modal.style.display = "none"; }
    });
}

function adjustNameScale() {
    document.querySelectorAll('.name-scaler-text').forEach(span => {
        span.style.transform = 'none';
        const parentWidth = span.parentElement.clientWidth;
        const textWidth = span.scrollWidth;
        if (textWidth > parentWidth && parentWidth > 0) {
            const ratio = (parentWidth / textWidth) * 0.95; 
            span.style.transform = `scale(${ratio})`;
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