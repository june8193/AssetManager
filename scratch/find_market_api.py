# -*- coding: utf-8 -*-
def search_file(filepath):
    print(f"=== {filepath} ===")
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if "@router.get(" in line:
            print(f"Line {i+1}: {line.strip()}")
            # 5줄 출력
            for j in range(i, min(len(lines), i+8)):
                print(f"  {j+1}: {lines[j].strip()}")
            print("-" * 30)

search_file("c:/localrepo/AssetManager/src/backend/routers/market.py")
search_file("c:/localrepo/AssetManager/src/backend/routers/stocks.py")
