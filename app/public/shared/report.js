function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

export function r0(v) {
  return isNum(v) ? String(Math.round(v)) : "—";
}

export function r1(v) {
  return isNum(v) ? v.toFixed(1) : "—";
}

export function moduleStats(modules, rows) {
  const last = rows.length ? rows[rows.length - 1] : null;
  return modules.map((m) => {
    let correct = 0;
    let qty = 0;
    for (const row of rows) {
      for (const s of m.subtypes) {
        const cell = row.subs?.[s.id];
        qty += s.qty;
        if (isNum(cell?.correct)) correct += cell.correct;
      }
    }
    let lastCorrect = 0;
    let lastQty = 0;
    if (last) {
      for (const s of m.subtypes) {
        const cell = last.subs?.[s.id];
        lastQty += s.qty;
        if (isNum(cell?.correct)) lastCorrect += cell.correct;
      }
    }
    const avgPct = qty > 0 ? correct / qty : null;
    const lastPct = lastQty > 0 ? lastCorrect / lastQty : null;
    const gap = avgPct !== null && lastPct !== null ? avgPct - lastPct : null;
    return {
      name: m.name,
      qty: m.qty,
      full: m.full,
      avgPct,
      lastPct,
      gap,
      gapQty: gap === null ? null : gap * m.qty,
      gapPts: gap === null ? null : gap * m.full,
    };
  });
}

export function weakModules(stats, minPts = 0.05) {
  return stats
    .filter((s) => isNum(s.gapPts) && s.gapPts > minPts)
    .sort((a, b) => b.gapPts - a.gapPts);
}

export function buildMarkdown({ typeLabel, rows, range, stats, total, generatedAt }) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  const weak = weakModules(stats);
  const lines = [];
  lines.push("# 行测复盘 · " + typeLabel);
  lines.push("");
  lines.push(
    "- 区间：第 " + first.seq + " 次 → 第 " + last.seq + " 次（" + rows.length + " 条 / 共 " + total + " 条）"
  );
  lines.push("- 生成时间：" + generatedAt);
  if (last.date) lines.push("- 末次日期：" + last.date);
  lines.push("");
  lines.push("## 历次成绩");
  lines.push("");
  lines.push("| 第几次 | 日期 | 卷名 | 得分 | 正确率 | 用时(分钟) |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      "| " +
        r.seq +
        " | " +
        (r.date || "—") +
        " | " +
        (r.name || "—") +
        " | " +
        r1(r.totals?.score) +
        " | " +
        (isNum(r.totals?.pct) ? r0(r.totals.pct * 100) + "%" : "—") +
        " | " +
        r0(r.totals?.minutes) +
        " |"
    );
  }
  lines.push("");
  lines.push("## 板块表现");
  lines.push("");
  lines.push("| 板块 | 题量/满分 | 区间平均 | 末次 | 差距 | 补到均线 |");
  lines.push("|---|---|---|---|---|---|");
  for (const s of stats) {
    const gapText = isNum(s.gap) ? (s.gap > 0 ? "-" : "+") + r1(Math.abs(s.gap) * 100) + "%" : "—";
    const recover =
      isNum(s.gapPts) && s.gapPts > 0.05 ? "+" + r1(s.gapQty) + " 题 / +" + r1(s.gapPts) + " 分" : "—";
    lines.push(
      "| " +
        s.name +
        " | " +
        s.qty +
        " 题 / " +
        s.full +
        " 分 | " +
        (isNum(s.avgPct) ? r0(s.avgPct * 100) + "%" : "—") +
        " | " +
        (isNum(s.lastPct) ? r0(s.lastPct * 100) + "%" : "—") +
        " | " +
        gapText +
        " | " +
        recover +
        " |"
    );
  }
  lines.push("");
  lines.push("## 薄弱板块（末次低于区间平均）");
  lines.push("");
  if (weak.length === 0) {
    lines.push("区间内没有明显短板。");
  } else {
    for (const s of weak) {
      lines.push(
        "- " +
          s.name +
          "：" +
          r0(s.lastPct * 100) +
          "% vs 均 " +
          r0(s.avgPct * 100) +
          "%，补回多拿 " +
          r1(s.gapQty) +
          " 题 / " +
          r1(s.gapPts) +
          " 分"
      );
    }
    const pts = weak.reduce((sum, s) => sum + s.gapPts, 0);
    lines.push("");
    lines.push("合计可回收：" + r1(pts) + " 分");
  }
  lines.push("");
  return lines.join("\n");
}

export function buildCsv(rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [["次数", "日期", "卷名", "得分", "正确率", "用时分钟", "备注"].join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.seq,
        r.date || "",
        r.name || "",
        isNum(r.totals?.score) ? r.totals.score.toFixed(1) : "",
        isNum(r.totals?.pct) ? (r.totals.pct * 100).toFixed(1) : "",
        isNum(r.totals?.minutes) ? String(Math.round(r.totals.minutes)) : "",
        r.note || "",
      ]
        .map(esc)
        .join(",")
    );
  }
  return "\uFEFF" + lines.join("\n") + "\n";
}
