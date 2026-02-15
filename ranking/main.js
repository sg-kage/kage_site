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

const attrColors = {
    '緑': '#28a745',
    '赤': '#dc3545',
    '青': '#007bff',
    '黄': '#ffc107',
    '白': '#e0e0e0',
    'default': '#d4af37'
};

async function init() {
    try {
        const response = await fetch('./events.json');
        allEvents = await response.json();
        setupTabs();
        updateEventDropdown();
        setupModal();
    } catch (e) { console.error("INIT_FAILED:", e); }
}

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

        renderColgroups(currentMode);
        renderHeader(currentMode);
        tableBody.innerHTML = '';
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = currentMode === 'ss' 
                ? renderSeasonRow(item, data[0], data[index === 0 ? 0 : index - 1]) 
                : renderExRow(item, data, index);
            const nameCell = row.querySelector('.col-name');
            if (nameCell) nameCell.onclick = () => showHistory(item.guildName);
            tableBody.appendChild(row);
        });
        
        applyFilter();
        setTimeout(adjustNameScale, 10);
    } catch (e) { console.error("LOAD_FAILED:", e); }
}

function renderColgroups(mode) {
    const oldColgroup = mainTable.querySelector('colgroup');
    if (oldColgroup) oldColgroup.remove();
    const colgroup = document.createElement('colgroup');
    const isMobile = window.innerWidth <= 480;
    
    // 殲滅戦側と共通の幅定義
    const rankWidth = isMobile ? "25px" : "30px";
    const nameWidth = isMobile ? "70px" : "200px";

    if (mode === 'ss') {
        // ギルド名幅を ${nameWidth} に固定し、他の列も固定幅にすることで
        // 殲滅戦側と同じギルド名表示エリアを確保します
        colgroup.innerHTML = `
            <col style="width:${rankWidth}">
            <col style="width:${nameWidth}">
            <col style="width:120px"> 
            <col style="width:45px">
            <col style="width:70px">
            <col style="width:110px">
            <col style="width:110px">`;
    } else {
        // 殲滅戦（既存の定義を維持）
        colgroup.innerHTML = `<col style="width:${rankWidth}"><col style="width:${nameWidth}"><col style="width:${rankWidth}"><col><col style="width:${rankWidth}"><col><col style="width:${rankWidth}"><col><col><col><col style="width:${rankWidth}"><col><col style="width:${rankWidth}"><col><col style="width:${rankWidth}"><col>`;
    }
    mainTable.insertBefore(colgroup, tableHead);
}

function renderHeader(mode) {
    if (mode === 'ss') {
        mainTable.classList.add('mode-ss'); // SSモード用のスタイルを適用
        tableHead.innerHTML = `<tr><th class="col-rank th-guild">順</th><th class="col-name th-guild">ギルド名</th><th class="th-total">スコア</th><th>人</th><th>平均</th><th>1位差</th><th>上差</th></tr>`;
    } else {
        mainTable.classList.remove('mode-ss'); // 殲滅戦モードに戻す
        tableHead.innerHTML = `<tr><th rowspan="2" class="col-rank th-guild">順</th><th rowspan="2" class="col-name th-guild">ギルド名</th><th colspan="6" class="th-total">累計</th><th colspan="2" class="th-total">差分</th><th colspan="6" class="th-day">日間</th></tr><tr><th class="col-sub-rank">順</th><th>Day1</th><th class="col-sub-rank">順</th><th>Day2</th><th class="col-sub-rank">順</th><th>Day3</th><th>1位差</th><th>上差</th><th class="col-sub-rank">順</th><th>Day1</th><th class="col-sub-rank">順</th><th>Day2</th><th class="col-sub-rank">順</th><th>Day3</th></tr>`;
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

// 履歴グラフ（動的単位フォーマット適用）
async function showHistory(guildName) {
    const modeEvents = allEvents.filter(e => e.type === currentMode).slice(-10);
    modeEvents.reverse(); 
    const labels = []; const ranks = []; const scores = []; const pointColors = []; const barColors = [];

    for (const ev of modeEvents) {
        try {
            const resp = await fetch(`./data/${ev.file}`);
            const json = await resp.json();
            const found = json.ranking.find(g => g.guildName === guildName);
            labels.push(ev.name.replace("魔界殲滅戦争", "").replace("魔界戦記 ", ""));
            const r = found ? (found.rank || found.rank_t3) : null;
            ranks.push(r);
            let totalScore = found ? (found.score || ((found.day1 || 0) + (found.day2 || 0) + (found.day3 || 0))) : 0;
            scores.push(totalScore);
            const color = attrColors[json.attribute || 'default'] || attrColors['default'];
            pointColors.push(color); barColors.push(color + '33');
        } catch (e) { console.error(e); }
    }

    const validRanks = ranks.filter(r => r !== null);
    const minRank = validRanks.length > 0 ? Math.min(...validRanks) : 1;
    const maxRank = validRanks.length > 0 ? Math.max(...validRanks) : 10;

    modal.style.display = "block";
    document.getElementById('modal-title').textContent = `${guildName} - 推移分析`;
    const ctx = document.getElementById('history-chart').getContext('2d');
    if (historyChart) historyChart.destroy();
    
    // スコア表示用フォーマッタ
    const scoreFormatter = (v, precision = 0) => {
        if (currentMode === 'ss') return (v / 1000).toFixed(precision) + 'K';
        return (v / 1000000).toFixed(precision) + 'M';
    };

    historyChart = new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                { type: 'line', label: '順位', data: ranks, borderColor: '#d4af37', backgroundColor: 'transparent', tension: 0.1, fill: false, pointRadius: 6, pointBackgroundColor: pointColors, yAxisID: 'y_rank', zIndex: 2 },
                { type: 'bar', label: '累計スコア', data: scores, backgroundColor: barColors, yAxisID: 'y_score', barPercentage: 0.6, zIndex: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 30, left: 10, right: 10, bottom: 10 } },
            scales: {
                y_rank: {
                    type: 'linear', position: 'left', reverse: true,
                    min: Math.max(0.5, minRank - 1),
                    max: maxRank + 1,
                    ticks: { 
                        color: '#d4af37', precision: 0, stepSize: 1,
                        callback: function(v) { return (v >= 1 && Number.isInteger(v)) ? v : ''; }
                    },
                    title: { display: true, text: '順位', color: '#d4af37' }
                },
                y_score: {
                    type: 'linear', position: 'right', grid: { display: false },
                    beginAtZero: false, 
                    ticks: { 
                        color: '#aaa', 
                        callback: function(v) { return scoreFormatter(v, 0); } // 軸の目盛り表示
                    },
                    title: { display: true, text: currentMode === 'ss' ? 'スコア(K)' : 'スコア(M)', color: '#aaa' }
                },
                x: { ticks: { color: '#fff' } }
            },
            plugins: { 
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false, callbacks: { label: function(c) { return `${c.dataset.label}: ${c.datasetIndex === 0 ? c.parsed.y : c.parsed.y.toLocaleString()}`; } } }
            },
            animation: {
                onComplete: function() {
                    const ctx = this.ctx; ctx.font = "bold 11px sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                    this.data.datasets.forEach((dataset, i) => {
                        const meta = this.getDatasetMeta(i); ctx.fillStyle = i === 0 ? '#ffffff' : '#aaaaaa'; 
                        meta.data.forEach((element, index) => {
                            const data = dataset.data[index];
                            if (data !== null) {
                                // 棒グラフ上のラベル表示（シーズンならK、殲滅戦ならM）
                                let label = i === 0 ? data : scoreFormatter(data, 1);
                                ctx.fillText(label, element.x, element.y - 12);
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
    modal.onclick = (event) => { if (event.target === modal) { modal.style.display = "none"; } };
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