const tableBody = document.getElementById('ranking-body');
const eventSelect = document.getElementById('event-select');
const searchInput = document.getElementById('search-input'); // 検索窓を取得

// 初期化：イベントリスト取得
async function init() {
    try {
        const response = await fetch('./events.json');
        const events = await response.json();
        events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.file;
            option.textContent = event.name;
            eventSelect.appendChild(option);
        });
        // 最初のデータをロード
        loadRanking(events[0].file);
    } catch (e) { console.error("INIT_FAILED:", e); }
}

// イベント切り替え時の処理
eventSelect.addEventListener('change', (e) => loadRanking(e.target.value));

// 検索入力時の処理（リアルタイムフィルター）
searchInput.addEventListener('input', applyFilter);

// ランキングデータ読み込み＆描画
async function loadRanking(fileName) {
    try {
        const response = await fetch(`./data/${fileName}`);
        const data = await response.json();
        tableBody.innerHTML = '';

        data.forEach((item, index) => {
            const first = data[0];
            const prev = index === 0 ? data[0] : data[index - 1];

            const dFirst = Math.abs(first.score - item.score);
            const dAbove = Math.abs(prev.score - item.score);

            const perK = (item.score / 1000 / item.members).toFixed(2);
            const nFirst = (dFirst / 1000 / item.members).toFixed(2);
            const nAbove = (dAbove / 1000 / item.members).toFixed(2);

            const row = document.createElement('tr');
            if (item.rank === 1) row.className = 'rank-1';

            // アニメーション用クラス
            row.classList.add('row-animate');
            row.style.animationDelay = `${Math.min(index * 0.03, 1.0)}s`; // 遅延が大きくなりすぎないよう制限

            row.innerHTML = `
                <td class="sticky-col">${item.rank}</td>
                <td class="sticky-col name-col hl" style="text-align:left;">${item.guildName}</td>
                <td class="score-num">${item.score.toLocaleString()}</td>
                <td>${item.members}</td>
                <td class="hl">${perK}</td>
                <td class="divider"></td>
                <td class="dim-num">${dFirst.toLocaleString()}</td>
                <td class="dim-num">${dAbove.toLocaleString()}</td>
                <td class="norm-num">${nFirst}</td>
                <td class="norm-num">${nAbove}</td>
            `;
            tableBody.appendChild(row);
        });

        // ★重要：データ読み込み完了後に、現在の検索ワードで即座にフィルタリングを実行
        applyFilter();

    } catch (e) { console.error("LOAD_FAILED:", e); }
}

// フィルター実行関数（共通化）
function applyFilter() {
    const term = searchInput.value.toLowerCase();
    const rows = document.querySelectorAll('#ranking-body tr');

    rows.forEach(row => {
        // ここで 'name-col' というクラスがついたセルを探しています
        const nameCell = row.querySelector('.name-col'); 
        if (nameCell) {
            const name = nameCell.textContent.toLowerCase();
            if (name.includes(term)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

init();