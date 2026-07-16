# -*- coding: utf-8 -*-
from google.antigravity import types
import inspect

for name in dir(types):
    if "mcp" in name.lower():
        obj = getattr(types, name)
        print(f"Name: {name}, Type: {type(obj)}")
        try:
            # Pydantic 모델인지 확인
            if hasattr(obj, "model_fields"):
                print("  Fields:")
                for fname, field in obj.model_fields.items():
                    print(f"    {fname}: {field.annotation}")
            else:
                # 일반 클래스나 타입
                print(f"  Obj: {obj}")
        except Exception as e:
            print(f"  Error: {e}")
