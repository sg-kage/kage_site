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

        # ファイル名でソート（降順）
        files = sorted([f for f in os.listdir(path) if f.endswith('.json')], reverse=True)

        for f_name in files:
            full_path = os.path.join(path, f_name)
            
            with open(full_path, 'r', encoding='utf-8') as f:
                content = json.load(f)

            # --- 形式変換とデータ保持のロジック ---
            if isinstance(content, list):
                # 古い配列形式（[{}, {}]）をオブジェクト形式に変換
                date_match = re.search(r'\d{4}_\d{2}\d{2}', f_name)
                date_str = date_match.group().replace('_', '/') if date_match else f_name
                content = {
                    "title": f"{mode_name} {date_str}",
                    "url": "",
                    "attribute": "",
                    "ranking": content
                }
            else:
                # すでにオブジェクト形式の場合、既存の値を優先し、足りない場合のみ補完
                if "title" not in content:
                    content["title"] = f_name
                content.setdefault("url", "")
                content.setdefault("attribute", "")

            # --- 1ギルド1行のカスタム書き出し ---
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write("{\n")
                f.write(f'  "title": "{content["title"]}",\n')
                f.write(f'  "url": "{content["url"]}",\n')
                f.write(f'  "attribute": "{content["attribute"]}",\n')
                f.write('  "ranking": [\n')
                
                ranking = content.get("ranking", [])
                for i, row in enumerate(ranking):
                    # 各ギルドの辞書を1行の文字列にする（ensure_ascii=Falseで日本語維持）
                    row_str = json.dumps(row, ensure_ascii=False)
                    comma = "," if i < len(ranking) - 1 else ""
                    f.write(f"    {row_str}{comma}\n")
                
                f.write("  ]\n")
                f.write("}\n")

            # events.json 用のリストに追加
            events_list.append({
                "type": k, 
                "name": content["title"], 
                "file": f"{k}/{f_name}"
            })

    # events.json の書き出し（1要素1行形式）
    with open('events.json', 'w', encoding='utf-8') as f:
        f.write("[\n")
        for i, ev in enumerate(events_list):
            line = json.dumps(ev, ensure_ascii=False)
            comma = "," if i < len(events_list) - 1 else ""
            f.write(f"  {line}{comma}\n")
        f.write("]\n")
    
    print(f"Done: {len(events_list)} files processed.")

if __name__ == "__main__":
    migrate_and_generate()