// =====================================================
// カゲマス おすすめ編成
// 閲覧: teams.json + キャラ図鑑JSONを結合し、
//       属性枠(赤/緑/黄/青/混合)別のチーム一覧と採用率を表示
// 編集: ページ内でチームCRUD → teams.json書き出し
// =====================================================
const CONFIG = {
    attributes: ["赤", "緑", "黄", "青"],
    roles: ["アタッカー", "タンク", "サポーター"],
    // チームの属性枠(表示行の順)
    teamAttrs: ["赤", "緑", "黄", "青", "混合"],
    attrColors: {
        "赤": "#FF6347",
        "緑": "#32CD32",
        "黄": "#FFD700",
        "青": "#1E90FF",
        "混合": "linear-gradient(135deg, #FF6347 0%, #FFD700 35%, #32CD32 65%, #1E90FF 100%)"
    },
    charsUrl: 'https://sg-kage.github.io/kage_character/characters/all_characters_ja.json',
    imgDir: 'https://sg-kage.github.io/kage_character/image/characters/',
    zukanUrl: 'https://sg-kage.github.io/kage_character/',   // ?pos=Pos値 でキャラ詳細を直接開ける
    ext: '.webp',
    teamSize: 5,
    DRAFT_KEY: 'kage_tier_draft',
    SORT_KEY: 'kage_tier_sort'
};

// 画像欠損時のフォールバック（1px透明GIF）
const FALLBACK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const state = {
    charMap: new Map(),   // CharacterID → キャラ(前処理済み)
    allChars: [],
    data: null,           // teams.json の作業コピー
    activeCat: null,      // カテゴリid
    edit: false,
    editing: null,        // { catId, index(既存) | -1(新規), team(編集中コピー) }
    sortDir: 'asc',       // キャラ表示のPos順: 'asc'(小さい順) | 'desc'(大きい順)
    pickerFilters: { attr: new Set(), role: new Set(), text: '' }
};

// =====================================================
// 初期化
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    const savedSort = localStorage.getItem(CONFIG.SORT_KEY);
    if (savedSort === 'asc' || savedSort === 'desc') state.sortDir = savedSort;
    document.getElementById('sortSelect').value = state.sortDir;

    Promise.all([
        fetch(CONFIG.charsUrl).then(r => r.json()),
        fetch('./teams.json', { cache: 'no-cache' }).then(r => r.json())
    ]).then(([chars, teams]) => {
        state.allChars = chars.map(preprocessCharacter);
        state.allChars.forEach(c => state.charMap.set(c.CharacterID, c));
        // デフォルト表示は常に公開中の teams.json。下書きは編集モードに入るときに確認する
        state.data = teams;
        cleanupStaleDraft(teams);
        state.activeCat = state.data.categories[0]?.id ?? null;
        renderAll();
    }).catch(err => {
        console.error(err);
        document.getElementById('teamsArea').innerHTML =
            '<p class="usage-empty">データの読み込みに失敗しました。時間をおいて再読み込みしてください。</p>';
    });

    bindStaticEvents();
    bindCharHoverJump();
});

function preprocessCharacter(char) {
    const nameMatch = char.name.match(/^(.+?)([\[［].+[\]］])$/);
    char._shortName = nameMatch ? nameMatch[1] : char.name;
    char._searchText = `${char.name} ${char.aliases || ''}`.toLowerCase();
    return char;
}

function imgUrl(char) {
    return `${CONFIG.imgDir}${encodeURIComponent(char.name)}${CONFIG.ext}`;
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// チームの属性枠。未設定・未知値は「混合」に寄せて消失させない
function teamAttr(team) {
    return CONFIG.teamAttrs.includes(team.attr) ? team.attr : '混合';
}

// CharacterID配列を表示用にPos順で並べ替える(元配列は変更しない。不明IDは末尾)
function sortCharsByPos(ids) {
    const dir = state.sortDir === 'desc' ? -1 : 1;
    const posOf = (id) => state.charMap.get(id)?.position ?? (dir === 1 ? Infinity : -Infinity);
    return [...ids].sort((a, b) => (posOf(a) - posOf(b)) * dir || a - b);
}

// =====================================================
// 下書き(localStorage)
// =====================================================
// 公開データに反映済み(同一内容)または壊れた下書きを掃除する
function cleanupStaleDraft(fetched) {
    try {
        const raw = localStorage.getItem(CONFIG.DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (!validateData(draft) || JSON.stringify(draft) === JSON.stringify(fetched)) {
            localStorage.removeItem(CONFIG.DRAFT_KEY);
        }
    } catch (e) {
        localStorage.removeItem(CONFIG.DRAFT_KEY);
    }
}

// 編集モードに入るとき、前回の下書きが残っていれば復元を確認する
function offerDraftRestore() {
    try {
        const raw = localStorage.getItem(CONFIG.DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (!validateData(draft)) throw new Error('invalid draft');
        if (JSON.stringify(draft) === JSON.stringify(state.data)) return;
        if (confirm('前回の編集下書きがあります。復元しますか？\n(キャンセルすると下書きは破棄され、現在の公開データから編集を始めます)')) {
            state.data = draft;
            if (!draft.categories.some(c => c.id === state.activeCat)) {
                state.activeCat = draft.categories[0]?.id;
            }
        } else {
            localStorage.removeItem(CONFIG.DRAFT_KEY);
        }
    } catch (e) {
        console.warn('下書きの復元に失敗:', e);
        localStorage.removeItem(CONFIG.DRAFT_KEY);
    }
}

function saveDraft() {
    try {
        localStorage.setItem(CONFIG.DRAFT_KEY, JSON.stringify(state.data));
    } catch (e) {
        console.warn('下書き保存に失敗:', e);
    }
}

function validateData(d) {
    return d && Array.isArray(d.categories)
        && d.categories.every(c => c.id && c.name && Array.isArray(c.teams)
            && c.teams.every(t => Array.isArray(t.chars)));
}

// =====================================================
// 描画(全体)
// =====================================================
function renderAll() {
    renderTabs();
    renderTeamsArea();
    renderUsage();
}

function activeCategory() {
    return state.data.categories.find(c => c.id === state.activeCat) || state.data.categories[0];
}

function renderTabs() {
    const nav = document.getElementById('catTabs');
    nav.innerHTML = '';
    state.data.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cat-tab' + (cat.id === state.activeCat ? ' active' : '');
        btn.textContent = cat.name;
        btn.onclick = () => {
            state.activeCat = cat.id;
            renderAll();
        };
        nav.appendChild(btn);
    });
}

// =====================================================
// チーム一覧(属性枠別)
// =====================================================
function renderTeamsArea() {
    const cat = activeCategory();
    const container = document.getElementById('teamsArea');
    container.innerHTML = '';
    if (!cat) return;

    CONFIG.teamAttrs.forEach(attr => {
        const teams = cat.teams
            .map((team, index) => ({ team, index }))
            .filter(({ team }) => teamAttr(team) === attr);

        if (teams.length === 0 && !state.edit) return; // 閲覧時は空行を隠す

        const row = document.createElement('div');
        row.className = 'group-row';

        const label = document.createElement('div');
        label.className = 'group-label';
        label.textContent = attr;
        label.style.background = CONFIG.attrColors[attr];
        row.appendChild(label);

        const teamsBox = document.createElement('div');
        teamsBox.className = 'group-teams';
        teams.forEach(({ team, index }) => teamsBox.appendChild(teamCard(cat, team, index)));

        if (state.edit) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'add-team-btn';
            addBtn.textContent = '+ チーム追加';
            addBtn.onclick = () => openEditor(cat.id, -1, attr);
            teamsBox.appendChild(addBtn);
        }

        row.appendChild(teamsBox);
        container.appendChild(row);
    });

    if (!container.children.length) {
        container.innerHTML = '<p class="usage-empty">このカテゴリにはまだチームが登録されていません。</p>';
    }
}

function charIconHtml(id, withName) {
    const char = state.charMap.get(id);
    if (!char) {
        console.warn('未知のCharacterID:', id);
        return `<div class="team-char"><div class="char-unknown">ID:${Number(id)}</div>
                ${withName ? '<div class="tc-name">?</div>' : ''}</div>`;
    }
    return `<div class="team-char attr-${char.attribute}" data-cid="${char.CharacterID}">
        <img src="${imgUrl(char)}" alt="${escapeHtml(char._shortName)}"
             loading="lazy" onerror="this.onerror=null;this.src=FALLBACK_IMG">
        ${withName ? `<div class="tc-name">${escapeHtml(char._shortName)}</div>` : ''}
    </div>`;
}

function teamCard(cat, team, index) {
    const card = document.createElement('div');
    card.className = 'team-card';

    let html = '';
    if (team.name) html += `<div class="team-name">${escapeHtml(team.name)}</div>`;
    html += `<div class="team-chars">${sortCharsByPos(team.chars).map(id => charIconHtml(id, true)).join('')}</div>`;
    if (team.comment) html += `<div class="team-comment">${escapeHtml(team.comment)}</div>`;

    // 編集コントロール(閲覧時はCSSで非表示)
    const attrOptions = CONFIG.teamAttrs
        .map(a => `<option value="${a}" ${a === teamAttr(team) ? 'selected' : ''}>${a}</option>`)
        .join('');
    html += `<div class="team-edit-controls">
        <button type="button" data-act="edit">✎</button>
        <button type="button" data-act="left" title="前へ">◀</button>
        <button type="button" data-act="right" title="後へ">▶</button>
        <select data-act="attr" title="属性枠を移動">${attrOptions}</select>
        <button type="button" data-act="del" class="del-btn">×</button>
    </div>`;

    card.innerHTML = html;

    card.querySelector('[data-act="edit"]').onclick = () => openEditor(cat.id, index);
    card.querySelector('[data-act="del"]').onclick = () => {
        if (!confirm('このチームを削除しますか？')) return;
        cat.teams.splice(index, 1);
        commitChange();
    };
    card.querySelector('[data-act="left"]').onclick = () => moveTeam(cat, index, -1);
    card.querySelector('[data-act="right"]').onclick = () => moveTeam(cat, index, +1);
    card.querySelector('[data-act="attr"]').onchange = (e) => {
        cat.teams[index].attr = e.target.value;
        commitChange();
    };
    return card;
}

// 同じ属性枠内で隣のチームと入れ替える
function moveTeam(cat, index, dir) {
    const attr = teamAttr(cat.teams[index]);
    const siblings = cat.teams
        .map((t, i) => ({ t, i }))
        .filter(x => teamAttr(x.t) === attr)
        .map(x => x.i);
    const pos = siblings.indexOf(index);
    const swapWith = siblings[pos + dir];
    if (swapWith === undefined) return;
    [cat.teams[index], cat.teams[swapWith]] = [cat.teams[swapWith], cat.teams[index]];
    commitChange();
}

function commitChange() {
    saveDraft();
    renderAll();
}

// =====================================================
// キャラ採用率ランキング
// =====================================================
function computeUsage(cat) {
    const total = cat.teams.length;
    const counts = new Map();
    cat.teams.forEach(team => {
        new Set(team.chars).forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    });
    return {
        total,
        rows: [...counts.entries()]
            .map(([id, n]) => ({ id, n, rate: total ? n / total * 100 : 0 }))
            .sort((a, b) => b.n - a.n || a.id - b.id)
    };
}

function renderUsage() {
    const cat = activeCategory();
    const listEl = document.getElementById('usageList');
    const noteEl = document.getElementById('usageNote');
    listEl.innerHTML = '';
    if (!cat || cat.teams.length === 0) {
        noteEl.textContent = '';
        listEl.innerHTML = '<p class="usage-empty">チームが登録されると自動で集計されます。</p>';
        return;
    }

    const { total, rows } = computeUsage(cat);
    noteEl.textContent = `「${cat.name}」の全${total}チームからキャラ単体の採用率を自動集計(採用数順)`;

    const rowHtml = (r, rank) => {
        const char = state.charMap.get(r.id);
        const icon = char
            ? `<img src="${imgUrl(char)}" alt="${escapeHtml(char._shortName)}" data-cid="${char.CharacterID}"
                    loading="lazy" onerror="this.onerror=null;this.src=FALLBACK_IMG">`
            : `<div class="char-unknown">ID:${Number(r.id)}</div>`;
        const name = char ? escapeHtml(char._shortName) : '不明';
        return `<div class="usage-row ${rank <= 3 ? 'top3' : ''}">
            <div class="usage-rank">${rank}</div>
            ${icon}
            <div class="usage-name" ${char ? `data-cid="${char.CharacterID}"` : ''}>${name}</div>
            <div class="usage-count">${r.n}/${total}チーム (${r.rate.toFixed(1)}%)</div>
            <div class="usage-bar-track"><div class="usage-bar" style="width:${r.rate}%"></div></div>
        </div>`;
    };

    const TOP = 20;
    let html = rows.slice(0, TOP).map((r, i) => rowHtml(r, i + 1)).join('');
    if (rows.length > TOP) {
        html += `<details><summary>残り${rows.length - TOP}件を表示</summary>
            ${rows.slice(TOP).map((r, i) => rowHtml(r, TOP + i + 1)).join('')}</details>`;
    }
    listEl.innerHTML = html;
}

// =====================================================
// キャラ詳細ツールチップ & 図鑑ジャンプ
// (チームカード・採用率ランキングの data-cid 要素に委譲で付与)
// =====================================================
function bindCharHoverJump() {
    const tip = document.createElement('div');
    tip.className = 'char-tip';
    tip.hidden = true;
    document.body.appendChild(tip);

    const findTarget = (e) => e.target.closest?.('[data-cid]');

    document.addEventListener('mouseover', (e) => {
        const el = findTarget(e);
        const char = el && state.charMap.get(Number(el.dataset.cid));
        if (!char) { tip.hidden = true; return; }
        tip.innerHTML = tipHtml(char);
        tip.hidden = false;
        positionTip(tip, el);
    });
    document.addEventListener('mouseout', (e) => {
        if (findTarget(e)) tip.hidden = true;
    });
    // スクロール中に置き去りにならないよう隠す
    document.addEventListener('scroll', () => { tip.hidden = true; }, true);

    document.addEventListener('click', (e) => {
        if (state.edit) return; // 編集モード中は誤ジャンプ防止
        const el = findTarget(e);
        const char = el && state.charMap.get(Number(el.dataset.cid));
        if (!char) return;
        window.open(`${CONFIG.zukanUrl}?pos=${encodeURIComponent(char.position)}`, '_blank', 'noopener');
    });
}

function tipHtml(char) {
    const skill = (label, arr) => arr?.[0]?.title
        ? `<div class="tip-skill"><span class="tip-skill-label">${label}</span>${escapeHtml(arr[0].title)}</div>`
        : '';
    return `
        <div class="tip-name attr-${char.attribute}">${escapeHtml(char.name)}</div>
        <div class="tip-meta">${escapeHtml(char.attribute)}属性 / ${escapeHtml(char.role)} / Pos:${escapeHtml(char.position)} / ${escapeHtml(char.rarity)} / ${escapeHtml(char.gacha)}</div>
        ${skill('奥義EX', char.ex_ultimate)}
        ${skill('奥義', char.ultimate)}
        ${skill('特技1', char.skill1)}
        ${skill('特技2', char.skill2)}
        ${state.edit ? '' : '<div class="tip-hint">クリックで図鑑の詳細へ →</div>'}`;
}

function positionTip(tip, el) {
    const r = el.getBoundingClientRect();
    // 一度サイズを確定させてから位置決め
    tip.style.left = '0px';
    tip.style.top = '0px';
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8);
    let y = r.top - th - 8;
    if (y < 8) y = Math.min(r.bottom + 8, window.innerHeight - th - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
}

// =====================================================
// 編集モード
// =====================================================
function bindStaticEvents() {
    document.getElementById('editToggleBtn').onclick = () => {
        state.edit = !state.edit;
        if (state.edit) offerDraftRestore();
        document.body.classList.toggle('edit-mode', state.edit);
        document.getElementById('editToolbar').hidden = !state.edit;
        document.getElementById('editToggleBtn').textContent =
            state.edit ? '✔ 編集を終了' : '✎ 編集モード';
        renderAll();
    };

    document.getElementById('sortSelect').addEventListener('change', (e) => {
        state.sortDir = e.target.value;
        localStorage.setItem(CONFIG.SORT_KEY, state.sortDir);
        renderAll();
        if (state.editing) {
            renderEditorSlots();
            renderPicker();
        }
    });

    document.getElementById('dlJsonBtn').onclick = downloadJson;
    document.getElementById('copyJsonBtn').onclick = copyJson;
    document.getElementById('loadJsonBtn').onclick = () =>
        document.getElementById('jsonFileInput').click();
    document.getElementById('jsonFileInput').addEventListener('change', importJsonFile);
    document.getElementById('discardDraftBtn').onclick = () => {
        if (!confirm('下書きを破棄して公開中の teams.json を読み直しますか？')) return;
        localStorage.removeItem(CONFIG.DRAFT_KEY);
        location.reload();
    };

    // モーダル
    document.getElementById('editorCloseBtn').onclick = closeEditor;
    document.getElementById('editorCancelBtn').onclick = closeEditor;
    document.getElementById('editorSaveBtn').onclick = saveEditor;
    document.getElementById('editorModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeEditor();
    });
    document.getElementById('pickerSearchBox').addEventListener('input', (e) => {
        state.pickerFilters.text = e.target.value;
        renderPicker();
    });
    createPickerFilterBtns('pickerAttrFilters', CONFIG.attributes, 'attr');
    createPickerFilterBtns('pickerRoleFilters', CONFIG.roles, 'role');
}

function exportJsonText() {
    const out = structuredClone(state.data);
    out.updated = new Date().toISOString().slice(0, 10);
    return JSON.stringify(out, null, 2) + '\n';
}

function downloadJson() {
    const blob = new Blob([exportJsonText()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'teams.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

function copyJson() {
    const text = exportJsonText();
    const btn = document.getElementById('copyJsonBtn');
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✔ コピーしました';
        setTimeout(() => { btn.textContent = '📋 JSONコピー'; }, 1500);
    }).catch(() => {
        prompt('コピーできませんでした。手動でコピーしてください:', text);
    });
}

function importJsonFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            if (!validateData(parsed)) throw new Error('teams.json の形式ではありません');
            state.data = parsed;
            state.activeCat = parsed.categories.some(c => c.id === state.activeCat)
                ? state.activeCat : parsed.categories[0]?.id;
            commitChange();
        } catch (err) {
            alert('読み込み失敗: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// =====================================================
// チームエディタ(モーダル)
// =====================================================
function openEditor(catId, index, defaultAttr) {
    const cat = state.data.categories.find(c => c.id === catId);
    const base = index >= 0 ? cat.teams[index] : null;
    state.editing = {
        catId,
        index,
        team: base
            ? structuredClone(base)
            : { attr: defaultAttr || '混合', name: '', comment: '', chars: [] }
    };

    document.getElementById('editorTitle').textContent =
        index >= 0 ? 'チーム編集' : 'チーム追加';
    document.getElementById('editorNameInput').value = state.editing.team.name || '';
    document.getElementById('editorCommentInput').value = state.editing.team.comment || '';

    const attrSel = document.getElementById('editorAttrSelect');
    attrSel.innerHTML = CONFIG.teamAttrs
        .map(a => `<option value="${a}" ${a === teamAttr(state.editing.team) ? 'selected' : ''}>${a}</option>`)
        .join('');

    state.pickerFilters.attr.clear();
    state.pickerFilters.role.clear();
    state.pickerFilters.text = '';
    document.getElementById('pickerSearchBox').value = '';
    document.querySelectorAll('.btn-filter.active').forEach(b => b.classList.remove('active'));

    renderEditorSlots();
    renderPicker();
    document.getElementById('editorModal').hidden = false;
}

function closeEditor() {
    state.editing = null;
    document.getElementById('editorModal').hidden = true;
}

function saveEditor() {
    const t = state.editing.team;
    t.name = document.getElementById('editorNameInput').value.trim();
    t.comment = document.getElementById('editorCommentInput').value.trim();
    t.attr = document.getElementById('editorAttrSelect').value;

    if (t.chars.length !== CONFIG.teamSize
        && !confirm(`キャラが${t.chars.length}体しか選ばれていません。このまま保存しますか？`)) {
        return;
    }

    const cat = state.data.categories.find(c => c.id === state.editing.catId);
    if (state.editing.index >= 0) {
        cat.teams[state.editing.index] = t;
    } else {
        cat.teams.push(t);
    }
    closeEditor();
    commitChange();
}

function renderEditorSlots() {
    const box = document.getElementById('editorSlots');
    box.innerHTML = '';
    const sorted = sortCharsByPos(state.editing.team.chars);
    for (let i = 0; i < CONFIG.teamSize; i++) {
        const id = sorted[i];
        const slot = document.createElement('div');
        const char = id !== undefined ? state.charMap.get(id) : null;
        if (id !== undefined) {
            slot.className = `editor-slot filled attr-${char ? char.attribute : ''}`;
            slot.title = char ? `${char.name} (クリックで外す)` : `ID:${id} (クリックで外す)`;
            slot.innerHTML = char
                ? `<img src="${imgUrl(char)}" alt="" onerror="this.onerror=null;this.src=FALLBACK_IMG">
                   <div class="es-name">${escapeHtml(char._shortName)}</div>`
                : `<div class="es-empty">?</div><div class="es-name">ID:${Number(id)}</div>`;
            slot.onclick = () => {
                const chars = state.editing.team.chars;
                chars.splice(chars.indexOf(id), 1);
                renderEditorSlots();
                renderPicker();
            };
        } else {
            slot.className = 'editor-slot';
            slot.innerHTML = '<div class="es-empty">＋</div><div class="es-name">未選択</div>';
        }
        box.appendChild(slot);
    }
}

function createPickerFilterBtns(containerId, items, kind) {
    const container = document.getElementById(containerId);
    items.forEach(item => {
        const btn = document.createElement('div');
        btn.className = 'btn-filter';
        btn.textContent = item;
        btn.onclick = () => {
            const set = state.pickerFilters[kind];
            set.has(item) ? set.delete(item) : set.add(item);
            btn.classList.toggle('active');
            renderPicker();
        };
        container.appendChild(btn);
    });
}

function renderPicker() {
    if (!state.editing) return;
    const listEl = document.getElementById('pickerList');
    listEl.innerHTML = '';
    const f = state.pickerFilters;
    const keywords = f.text.normalize('NFKC').toLowerCase().replace(/　/g, ' ')
        .trim().split(/ +/).filter(k => k);

    const results = state.allChars.filter(c => {
        if (f.attr.size && !f.attr.has(c.attribute)) return false;
        if (f.role.size && !f.role.has(c.role)) return false;
        return keywords.every(k => c._searchText.includes(k));
    });

    const dir = state.sortDir === 'desc' ? -1 : 1;
    results.sort((a, b) =>
        ((a.position ?? Infinity) - (b.position ?? Infinity)) * dir || a.CharacterID - b.CharacterID);

    if (!results.length) {
        listEl.innerHTML = '<div class="picker-hit">該当キャラなし</div>';
        return;
    }

    results.forEach(char => {
        const inTeam = state.editing.team.chars.includes(char.CharacterID);
        const item = document.createElement('div');
        item.className = `picker-item attr-${char.attribute}` + (inTeam ? ' selected' : '');
        item.title = char.name;
        item.innerHTML = `
            <img src="${imgUrl(char)}" alt="" loading="lazy" onerror="this.onerror=null;this.src=FALLBACK_IMG">
            <div class="pi-name">${escapeHtml(char._shortName)}</div>`;
        item.onclick = () => {
            const chars = state.editing.team.chars;
            const pos = chars.indexOf(char.CharacterID);
            if (pos >= 0) {
                chars.splice(pos, 1);
            } else {
                if (chars.length >= CONFIG.teamSize) {
                    alert(`チームは${CONFIG.teamSize}体までです。外してから追加してください。`);
                    return;
                }
                chars.push(char.CharacterID);
            }
            renderEditorSlots();
            renderPicker();
        };
        listEl.appendChild(item);
    });
}
