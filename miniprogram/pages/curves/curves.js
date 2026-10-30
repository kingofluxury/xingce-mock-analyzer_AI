const store = require("../../utils/store.js");
const chart = require("../../utils/chart.js");

const COLORS = chart.COLORS;
const DEFAULT_WINDOW = 15;

function pctFloor(values) {
  const nums = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (!nums.length) return 0;
  const lo = Math.min.apply(null, nums);
  if (lo < 60) return 0;
  return Math.max(0, Math.floor((lo - 5) / 10) * 10);
}

Page({
  data: {
    tabs: [],
    activeId: 1,
    empty: false,
    kpi: null,
    overview: null,
    modules: [],
    rangeLabels: [],
    fromIndex: 0,
    toIndex: 0,
    fromLabel: "",
    toLabel: "",
    rangeText: "",
  },

  onLoad() {
    this.meta = store.meta();
    const tabs = this.meta.paperTypes.map((t) => ({ id: t.id, label: t.examType + " " + t.paperName }));
    const exams = store.listExams();
    const initial = exams.length ? exams[0].paperTypeId : this.meta.defaultPaperTypeId;
    this.setData({ tabs }, () => this.load(initial));
  },

  onTab(e) {
    this.load(Number(e.currentTarget.dataset.id));
  },

  load(typeId) {
    const data = store.stats(typeId);
    if (!data.rows.length) {
      this.allRows = [];
      this.setData({
        activeId: typeId,
        empty: true,
        modules: [],
        kpi: null,
        overview: null,
        rangeLabels: [],
        rangeText: "",
      });
      return;
    }

    this.allRows = data.rows;
    this.modulesMeta = data.modules;
    this.full = data.totals.full;
    const start = Math.max(0, data.rows.length - DEFAULT_WINDOW);
    this.from = data.rows[start].seq;
    this.to = data.rows[data.rows.length - 1].seq;
    this.setData({ activeId: typeId, empty: false }, () => this.renderWindow());
  },

  onFrom(e) {
    const seq = this.allRows[Number(e.detail.value)].seq;
    this.from = seq;
    if (this.to < seq) this.to = seq;
    this.renderWindow();
  },

  onTo(e) {
    const seq = this.allRows[Number(e.detail.value)].seq;
    this.to = seq;
    if (this.from > seq) this.from = seq;
    this.renderWindow();
  },

  onRecent() {
    const start = Math.max(0, this.allRows.length - DEFAULT_WINDOW);
    this.from = this.allRows[start].seq;
    this.to = this.allRows[this.allRows.length - 1].seq;
    this.renderWindow();
  },

  onAll() {
    this.from = this.allRows[0].seq;
    this.to = this.allRows[this.allRows.length - 1].seq;
    this.renderWindow();
  },

  renderWindow() {
    const rows = this.allRows.filter((r) => r.seq >= this.from && r.seq <= this.to);
    const labels = rows.map((r) => String(r.seq));

    const scoreValues = rows
      .map((r) => r.totals.score)
      .filter((v) => v !== null && v !== undefined);
    const scoreMin = scoreValues.length
      ? Math.max(0, Math.floor((Math.min.apply(null, scoreValues) - 5) / 10) * 10)
      : 0;

    const overview = {
      labels,
      series: [
        {
          name: "得分",
          data: rows.map((r) => (r.totals.score === null || r.totals.score === undefined ? null : r.totals.score)),
        },
      ],
      legend: null,
      min: scoreMin,
      max: this.full || 100,
    };

    const avgText = (m) => {
      let pctSum = 0;
      let pctCount = 0;
      let minSum = 0;
      let minCount = 0;
      for (const r of rows) {
        let qty = 0;
        let correct = 0;
        let minutes = 0;
        let known = 0;
        for (const s of m.subtypes) {
          const cell = r.subs[s.id];
          qty += s.qty;
          if (cell && cell.correct !== null && cell.correct !== undefined) correct += cell.correct;
          if (cell && cell.minutes !== null && cell.minutes !== undefined) {
            minutes += cell.minutes;
            known += 1;
          }
        }
        if (qty) {
          pctSum += correct / qty;
          pctCount += 1;
        }
        if (known === m.subtypes.length) {
          minSum += minutes;
          minCount += 1;
        }
      }
      const ap = pctCount ? Math.round((pctSum / pctCount) * 100) : null;
      const am = minCount ? Math.round(minSum / minCount) : null;
      return "平均：正确率 " + (ap === null ? "—" : ap + "%") + " · 用时 " + (am === null ? "—" : am + " 分钟");
    };

    const modules = this.modulesMeta.map((m, mi) => {
      const series = m.subtypes.map((s) => ({
        name: s.name,
        data: rows.map((r) => {
          const cell = r.subs[s.id];
          return cell && cell.pct !== null && cell.pct !== undefined ? cell.pct * 100 : null;
        }),
      }));
      const values = [];
      for (const s of series) for (const v of s.data) if (v !== null) values.push(v);
      return {
        id: mi,
        name: m.name,
        labels,
        series,
        min: pctFloor(values),
        avg: avgText(m),
        legend: series.map((s, i) => ({ name: s.name, color: COLORS[i % COLORS.length] })),
      };
    });

    const last = rows[rows.length - 1];
    const kpi = {
      pct: last.totals.pct === null || last.totals.pct === undefined ? "—" : Math.round(last.totals.pct * 100) + "%",
      minutes:
        last.totals.minutes === null || last.totals.minutes === undefined
          ? "—"
          : Math.round(last.totals.minutes) + " 分钟",
      count: rows.length + "/" + this.allRows.length,
    };

    const rangeLabels = this.allRows.map((r) => "第 " + r.seq + " 次" + (r.name ? " · " + r.name : ""));
    const fromIndex = this.allRows.findIndex((r) => r.seq === this.from);
    const toIndex = this.allRows.findIndex((r) => r.seq === this.to);

    this.setData(
      {
        overview,
        modules,
        kpi,
        rangeLabels,
        fromIndex,
        toIndex,
        fromLabel: rangeLabels[fromIndex],
        toLabel: rangeLabels[toIndex],
        rangeText: "已选 " + rows.length + " 条",
      },
      () => {
        setTimeout(() => this.drawAll(), 60);
      }
    );
  },

  async drawAll() {
    const { overview, modules } = this.data;
    if (overview) {
      await chart.render(this, "overview", {
        labels: overview.labels,
        series: overview.series,
        type: "line",
        min: overview.min,
        max: overview.max,
        unit: "",
        digits: 1,
      });
    }
    for (let i = 0; i < modules.length; i++) {
      await chart.render(this, "c" + i, {
        labels: modules[i].labels,
        series: modules[i].series,
        type: "line",
        min: modules[i].min,
        max: 100,
        unit: "",
        digits: 0,
      });
    }
  },
});
