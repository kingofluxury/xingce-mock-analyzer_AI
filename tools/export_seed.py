# -*- coding: utf-8 -*-
"""把「如风刷题.xlsx」导出为 app/data/seed.json（首次启动自动导入 SQLite）。

注意：原始表格记录的是「错误题数」，导入时统一转换为「答对题数」。
用法：python tools/export_seed.py
"""
import json
import re
from datetime import datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "如风刷题.xlsx"
OUT = ROOT / "app" / "data" / "seed.json"

SPEC = [
    ("B", 1, 10, 0.7),
    ("D", 2, 10, 0.6),
    ("F", 3, 15, 0.7),
    ("G", 4, 10, 0.5),
    ("H", 5, 5, 0.7),
    ("K", 6, 5, 0.7),
    ("L", 7, 15, 0.9),
    ("O", 8, 10, 0.5),
    ("P", 9, 10, 0.8),
    ("Q", 10, 15, 0.8),
    ("R", 11, 10, 0.8),
    ("U", 12, 20, 0.9),
]

TIME_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(?:min|分钟)?\s*$", re.I)

SOURCE_IS_WRONG_COUNT = True


def to_minutes(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = TIME_RE.match(str(value))
    return float(m.group(1)) if m else None


def main():
    wb = openpyxl.load_workbook(SRC, data_only=False)
    ws = wb["Sheet1"]

    for col, _, qty, pts in SPEC:
        if ws[f"{col}2"].value != qty:
            raise SystemExit(f"{col}2 题量与预期 {qty} 不一致")
        if abs(float(ws[f"{col}3"].value) - pts) > 1e-9:
            raise SystemExit(f"{col}3 分值 {ws[f'{col}3'].value} 与预期 {pts} 不一致")

    exams = []
    for r in range(4, ws.max_row + 1, 2):
        seq = ws[f"A{r}"].value
        if not isinstance(seq, (int, float)):
            continue
        if all(ws[f"{col}{r}"].value is None for col, *_ in SPEC):
            continue

        items = []
        for col, sid, qty, _ in SPEC:
            raw = ws[f"{col}{r}"].value
            minutes = to_minutes(ws[f"{col}{r + 1}"].value)
            if not isinstance(raw, (int, float)):
                raise SystemExit(f"第 {seq} 次 题型 {sid} 数值缺失")
            if raw < 0 or raw > qty:
                raise SystemExit(f"第 {seq} 次 题型 {sid} 数值越界：{raw}")
            correct = int(qty - raw) if SOURCE_IS_WRONG_COUNT else int(raw)
            items.append({
                "subtypeId": sid,
                "correct": correct,
                "minutes": minutes,
            })
        exams.append({"seq": int(seq), "items": items})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": SRC.name,
        "sourceField": "错误题数" if SOURCE_IS_WRONG_COUNT else "答对题数",
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "exams": exams,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已导出 {len(exams)} 次模考 -> {OUT}")


if __name__ == "__main__":
    main()
