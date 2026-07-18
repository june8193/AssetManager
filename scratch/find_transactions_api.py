# -*- coding: utf-8 -*-
with open("c:/localrepo/AssetManager/src/backend/routers/db_manage.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "@router.get(" in line or "def get_transactions" in line or "class Transaction" in line:
        print(f"Line {i+1}: {line.strip()}")
        # 주변 5줄 출력
        start = max(0, i-2)
        end = min(len(lines), i+8)
        for j in range(start, end):
            print(f"  {j+1}: {lines[j].strip()}")
        print("-" * 40)
