"""公式ヘルプ「状態異常・特殊効果」からクイズ用の状態効果データを書き出す。

公式サイトはブラウザ以外からのリクエストに空のページを返すため、
ヘルプページはブラウザで「名前を付けて保存」した HTML を入力にする。
アイコン画像は公式サイトから直接ダウンロードする。

使い方:
    1. ブラウザで HELP_URL を開き、「名前を付けて保存」で quiz/status_help.html に保存
    2. python build_status_effects.py [保存したHTMLのパス]

出力:
    status_effects.json  クイズが読み込むデータ（名称・種類・アイコン・説明）
    icons/               アイコン画像（既にあるものはダウンロードしない）
"""

import json
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

HELP_URL = 'https://www.shadow-garden-mog.jp/help/battlesystem0/battlesystem10/?cat=battle'
SITE_ROOT = 'https://www.shadow-garden-mog.jp'

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = BASE_DIR / 'status_help.html'
OUTPUT_JSON = BASE_DIR / 'status_effects.json'
ICON_DIR = BASE_DIR / 'icons'
# 保存先のファイル名と JSON の icon 値になるので、パス区切りや .. を含む名前は受け付けない。
# index.html の STATUS_ICON_RE と揃えること
ICON_NAME_RE = re.compile(r'[\w-]+\.(?:png|webp|gif|jpe?g)')

# 名称から効果がすぐ分かるので出題しない
EXCLUDE_KEYWORDS = ('耐性', 'アップ', 'ダウン', 'カット')

# 説明から名称を特定できないもの。汎用的な説明か、伏せ字にすると他と区別できない説明
# （伏せ字後に完全一致するものは dedupe() が自動で除く）
UNGUESSABLE = {
    '双牙の刻印', '闘気', '式神召喚', '歌姫のオーラ',
    'オーバーコンバージョン(クリティカル率)', '魔力解放', '魔力暴走',
}

MASK = '〇〇'


class EffectTableParser(HTMLParser):
    """「名称」「アイコン」「種類」「解除可能」「説明」の表を行ごとに読む。"""

    def __init__(self):
        super().__init__()
        self.rows = []
        self._row = None
        self._cell = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'tr':
            self._row = []
        elif tag in ('td', 'th') and self._row is not None:
            self._cell = {'tag': tag, 'text': [], 'img': None}
        elif self._cell is not None:
            if tag == 'br':
                self._cell['text'].append('\n')
            elif tag == 'img' and not self._cell['img']:
                self._cell['img'] = attrs.get('src')

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self._cell is not None:
            self._row.append(self._cell)
            self._cell = None
        elif tag == 'tr' and self._row is not None:
            self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell['text'].append(data)


def clean_text(parts):
    lines = ''.join(parts).replace('\r', '').split('\n')
    return '\n'.join(line.strip() for line in lines if line.strip())


def parse_effects(html):
    parser = EffectTableParser()
    parser.feed(html)
    effects = []
    for row in parser.rows:
        cells = [c for c in row if c['tag'] == 'td']
        if len(cells) != 5:
            continue
        name, icon, kind, _removable, desc = cells
        if not icon['img']:
            continue
        effects.append({
            'name': clean_text(name['text']),
            'type': clean_text(kind['text']),
            'icon_src': icon['img'],
            'desc': clean_text(desc['text']),
        })
    return effects


def dedupe(effects):
    """伏せ字後の説明が同じものは正解を一つに決められないので、まとめて除く。"""
    owners = {}
    for e in effects:
        owners.setdefault(e['desc'], []).append(e['name'])
    dropped = [names for names in owners.values() if len(names) > 1]
    kept = [e for e in effects if len(owners[e['desc']]) == 1]
    return kept, dropped


def download_icon(src):
    url = src if src.startswith('http') else SITE_ROOT + src
    if not url.startswith(SITE_ROOT + '/'):
        raise RuntimeError(f'公式サイト以外のアイコンです: {src}')
    filename = url.rsplit('/', 1)[-1]
    if not ICON_NAME_RE.fullmatch(filename):
        raise RuntimeError(f'想定外のアイコンファイル名です: {src}')
    dest = ICON_DIR / filename
    if not dest.exists():
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = resp.read()
        if not data:
            raise RuntimeError(f'アイコンが空でした: {url}')
        dest.write_bytes(data)
        print(f'  ダウンロード: {filename}')
    return f'icons/{filename}'


def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
    if not input_path.exists():
        sys.exit(f'{input_path} がありません。ブラウザで {HELP_URL} を開いて保存してください。')

    all_effects = parse_effects(input_path.read_text(encoding='utf-8'))
    if not all_effects:
        sys.exit('状態効果の表が見つかりませんでした。保存したページを確認してください。')

    by_keyword = [e for e in all_effects if any(k in e['name'] for k in EXCLUDE_KEYWORDS)]
    candidates = [e for e in all_effects if e not in by_keyword and e['name'] not in UNGUESSABLE]
    for e in candidates:
        e['desc'] = e['desc'].replace(e['name'], MASK)
    kept, dropped = dedupe(candidates)

    unknown = UNGUESSABLE - {e['name'] for e in all_effects}
    if unknown:
        print(f'注意: UNGUESSABLE のうち一覧に存在しない名称: {sorted(unknown)}')

    ICON_DIR.mkdir(exist_ok=True)
    output = [
        {'name': e['name'], 'type': e['type'], 'icon': download_icon(e['icon_src']), 'desc': e['desc']}
        for e in kept
    ]

    previous = set()
    if OUTPUT_JSON.exists():
        previous = {e['name'] for e in json.loads(OUTPUT_JSON.read_text(encoding='utf-8'))}
    OUTPUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(f'公式一覧: {len(all_effects)} 件')
    print(f'  名称で除外（{"・".join(EXCLUDE_KEYWORDS)}）: {len(by_keyword)} 件')
    print(f'  特定できないため除外: {len(all_effects) - len(by_keyword) - len(candidates)} 件')
    for names in dropped:
        print(f'  説明が同じため除外: {" / ".join(names)}')
    print(f'出題対象: {len(output)} 件 -> {OUTPUT_JSON.name}')
    if previous:
        current = {e['name'] for e in output}
        if current - previous:
            print(f'  追加: {sorted(current - previous)}')
        if previous - current:
            print(f'  削除: {sorted(previous - current)}')


if __name__ == '__main__':
    main()
