#!/usr/bin/env node
/**
 * Renders the measurement sheet into docs/assets/.
 *
 *   python bench/make_xlsx.py
 *
 * Numbers are the ones bench.mjs / billing.mjs produced on the reference
 * session; this script only formats them.
 */

import os
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "docs" / "assets" / "token-savings-measurement.xlsx"

wb = Workbook()
ws = wb.active
ws.title = "省token实测"

thin = Side(style="thin", color="BFBFBF")
border = Border(left=thin, right=thin, top=thin, bottom=thin)
head_fill = PatternFill("solid", fgColor="E8EEF7")
note_font = Font(size=9, color="808080")

ws["A1"] = "tokenskip-context skill 省 token 实测"
ws["A1"].font = Font(size=13, bold=True)
ws.merge_cells("A1:C1")
ws["A1"].alignment = Alignment(vertical="center")
ws.row_dimensions[1].height = 26

headers = ["口径", "削减", "依据"]
for c, h in enumerate(headers, 1):
    cell = ws.cell(row=3, column=c, value=h)
    cell.font = Font(bold=True)
    cell.fill = head_fill
    cell.border = border
    cell.alignment = Alignment(horizontal="center", vertical="center")

rows = [
    ("原始内容", "−20.5%", "719,532 → 571,949 tok", True),
    ("　└ 工具输出", "−78.2%", "167,310 → 36,487", False),
    ("　└ assistant 叙述", "−77.6%", "21,604 → 4,842", False),
    ("Token 账单", "−15.0%", "19.07M → 16.20M（省 2.87M）", True),
    ("不可触及部分", "73.7%", "交付写入 + 工具 schema + 用户话语", False),
]

for i, (name, cut, basis, strong) in enumerate(rows):
    r = 4 + i
    a = ws.cell(row=r, column=1, value=name)
    b = ws.cell(row=r, column=2, value=cut)
    c = ws.cell(row=r, column=3, value=basis)

    a.font = Font(bold=strong)
    b.font = Font(bold=strong, color="C00000" if cut.startswith("−") else "000000")
    c.font = Font(bold=strong)

    for cell in (a, b, c):
        cell.border = border
        cell.alignment = Alignment(vertical="center")

    b.alignment = Alignment(horizontal="center", vertical="center")
    c.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[r].height = 18

nr = 4 + len(rows) + 1
ws.cell(
    row=nr,
    column=1,
    value="基线：178 次请求 / 19.07M 输入 token / 94.2% 缓存命中。"
    "估计器经 harness shadowedTokenCount 校准，偏差 1.024×（18 样本）。",
)
ws.cell(row=nr, column=1).font = note_font
ws.merge_cells(start_row=nr, start_column=1, end_row=nr, end_column=3)
ws.cell(row=nr, column=1).alignment = Alignment(vertical="center")
ws.row_dimensions[nr].height = 16

ws.column_dimensions["A"].width = 22
ws.column_dimensions["B"].width = 11
ws.column_dimensions["C"].width = 44
ws.freeze_panes = "A4"

OUT.parent.mkdir(parents=True, exist_ok=True)
wb.save(OUT)
print("saved:", OUT.relative_to(REPO))
