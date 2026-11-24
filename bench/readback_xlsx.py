#!/usr/bin/env python3
"""Re-read the committed sheet and print its cell values plus formatting flags.

    python bench/readback_xlsx.py

Used as a cheap "did the export actually contain what I meant" check.
"""

import io
import sys
from pathlib import Path

from openpyxl import load_workbook

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

XLSX = Path(__file__).resolve().parent.parent / "docs" / "assets" / "token-savings-measurement.xlsx"

wb = load_workbook(XLSX)
ws = wb.active
print("sheet:", ws.title, "| dims:", ws.dimensions)
print("-" * 70)
for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=3):
    vals = ["" if c.value is None else str(c.value) for c in row]
    print(" | ".join(vals))
print("-" * 70)
print("merges:", [str(m) for m in ws.merged_cells.ranges])
print("freeze:", ws.freeze_panes)
for r in range(4, 9):
    b = ws.cell(row=r, column=2)
    print(f"  B{r}: value={b.value!r} bold={b.font.bold}")
