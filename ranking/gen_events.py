import json
import os
import re

def migrate_and_generate():
    modes = {'ex': '殲滅戦', 'ss': 'シーズン'}
    data_dir = 'data'
    events_list = []

    for k, mode_name in modes.items():
        path = os.path.join(data_dir, k)
        if not os.path.exists(path): continue

        files = sorted([f for f in os.listdir(path) if f.endswith('.json')], reverse=True)

        for f_name in files:
            full_path = os.path.join(path, f_name)
            
            with open(full_path, 'r', encoding='utf-8') as f:
                content = json.load(f)

            # 古い配列形式ならタイトル付きに変換
            if isinstance(content, list):
                print(f"Converting format: {f_name}")
                date_match = re.search(r'\d{4}_\d{2}\d{2}', f_name)
                date_str = date_match.group().replace('_', '/') if date_match else f_name
                content = {"title": f"{mode_name} {date_str}", "ranking": content}

            # --- ★各データのJSONを「1ギルド1行」で書き出すカスタム処理 ---
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write("{\n")
                f.write(f'  "title": "{content["title"]}",\n')
                f.write('  "ranking": [\n')
                
                ranking = content["ranking"]
                for i, row in enumerate(ranking):
                    # 1ギルド分のデータを1行の文字列にする
                    row_str = json.dumps(row, ensure_ascii=False)
                    comma = "," if i < len(ranking) - 1 else ""
                    f.write(f"    {row_str}{comma}\n")
                
                f.write("  ]\n")
                f.write("}\n")
            # -------------------------------------------------------

            events_list.append({
                "type": k, 
                "name": content.get('title', f_name), 
                "file": f"{k}/{f_name}"
            })

    # events.json も1要素1行で書き出し
    with open('events.json', 'w', encoding='utf-8') as f:
        f.write("[\n")
        for i, ev in enumerate(events_list):
            line = json.dumps(ev, ensure_ascii=False)
            comma = "," if i < len(events_list) - 1 else ""
            f.write(f"  {line}{comma}\n")
        f.write("]\n")
    
    print(f"Done: {len(events_list)} files optimized.")

if __name__ == "__main__":
    migrate_and_generate()