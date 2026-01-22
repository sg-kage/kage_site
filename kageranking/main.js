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
            row.innerHTML = mode === 'season' 
                ? renderSeasonRow(item, data[0], data[index === 0 ? 0 : index - 1]) 
                : renderExRow(item, data, index);
            tableBody.appendChild(row);
        });

        applyFilter();
        requestAnimationFrame(() => adjustNameScale());
    } catch (e) { console.error("LOAD_FAILED:", e); }
}

function renderHeader(mode) {
    if (mode === 'season') {
        tableHead.innerHTML = `
            <tr>
                <th class="sticky-col col-rank th-guild">順位</th>
                <th class="sticky-col col-name th-guild">ギルド名</th>
                <th style="width:110px" class="th-total">累計スコア</th>
                <th style="width:50px" class="th-total">人数</th>
                <th style="width:60px" class="th-total">平均</th>
                <th style="width:100px" class="th-total">1位差</th>
                <th style="width:100px" class="th-total">上差</th>
                <th style="width:60px" class="th-total">1位ノ</th>
                <th style="width:60px" class="th-total">上ノ</th>
            </tr>`;
    } else {
        tableHead.innerHTML = `
            <tr>
                <th rowspan="2" class="sticky-col col-rank th-guild">順位</th>
                <th rowspan="2" class="sticky-col col-name th-guild">ギルド名</th>
                <th colspan="6" class="th-total">累計推移 (Total)</th>
                <th colspan="2" class="th-total">順位差分</th>
                <th colspan="6" class="th-day">日間スコア (Day)</th>
            </tr>
            <tr>
                <th style="width:40px" class="th-total">順</th><th style="width:110px" class="th-total">Day1</th>
                <th style="width:40px" class="th-total">順</th><th style="width:110px" class="th-total">Day2</th>
                <th style="width:40px" class="th-total">順</th><th style="width:110px" class="th-total">Day3</th>
                <th style="width:100px" class="th-total">1位差</th><th style="width:100px" class="th-total">上差</th>
                <th style="width:40px" class="th-day">順</th><th style="width:110px" class="th-day">Day1</th>
                <th style="width:40px" class="th-day">順</th><th style="width:110px" class="th-day">Day2</th>
                <th style="width:40px" class="th-day">順</th><th style="width:110px" class="th-day">Day3</th>
            </tr>`;
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
    return `
        <td class="sticky-col col-rank">${getRankBadge(item.rank)}</td>
        <td class="sticky-col col-name"><div class="name-scaler-wrap"><span class="name-scaler-text">${item.guildName}</span></div></td>
        <td class="total-val">${score.toLocaleString()}</td>
        <td>${members}</td>
        <td>${(score/1000/members).toFixed(1)}</td>
        <td class="dim-num">${(first.score - score).toLocaleString()}</td>
        <td class="dim-num">${(prev.score - score).toLocaleString()}</td>
        <td class="dim-num">${((first.score - score)/1000/members).toFixed(1)}</td>
        <td class="dim-num">${((prev.score - score)/1000/members).toFixed(1)}</td>`;
}

function renderExRow(item, allData, index) {
    const pair = (r, s, isD) => `
        <td style="width:40px">${getRankBadge(r)}</td>
        <td style="width:110px"><span class="${isD ? 'day-val' : 'total-val'}">${s.toLocaleString()}</span></td>`;
    
    const topScore = allData[0].t3;
    const prevScore = allData[index === 0 ? 0 : index - 1].t3;

    return `
        <td class="sticky-col col-rank">${getRankBadge(item.rank_t3)}</td>
        <td class="sticky-col col-name"><div class="name-scaler-wrap"><span class="name-scaler-text">${item.guildName}</span></div></td>
        ${pair(item.rank_t1, item.t1, false)}
        ${pair(item.rank_t2, item.t2, false)}
        ${pair(item.rank_t3, item.t3, false)}
        <td class="dim-num">${(topScore - item.t3).toLocaleString()}</td>
        <td class="dim-num">${(prevScore - item.t3).toLocaleString()}</td>
        ${pair(item.rank_d1, item.d1, true)}
        ${pair(item.rank_d2, item.d2, true)}
        ${pair(item.rank_d3, item.d3, true)}`;
}

function adjustNameScale() {
    document.querySelectorAll('.name-scaler-text').forEach(span => {
        span.style.transform = 'none';
        const parentWidth = span.parentElement.clientWidth;
        const textWidth = span.scrollWidth;
        if (textWidth > parentWidth) {
            const ratio = (parentWidth / textWidth) * 0.96;
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