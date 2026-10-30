const store = require("../../utils/store.js");

Page({
  data: {
    papers: [],
    filterIndex: 0,
    rows: [],
    empty: false,
  },

  onShow() {
    this.reload();
  },

  reload() {
    const meta = store.meta();
    const prev = this.data.papers[this.data.filterIndex];
    const prevId = prev ? prev.id : 0;

    const papers = [{ id: 0, label: "全部试卷" }].concat(
      meta.paperTypes.map((t) => ({ id: t.id, label: t.examType + " " + t.paperName }))
    );
    const idx = Math.max(
      0,
      papers.findIndex((p) => p.id === prevId)
    );
    const filterId = papers[idx].id;

    const rows = store
      .listExams()
      .filter((e) => !filterId || e.paperTypeId === filterId)
      .map((e) => {
        const type = meta.paperTypes.find((t) => t.id === e.paperTypeId);
        return {
          id: e.id,
          paperTypeId: e.paperTypeId,
          seq: e.seq,
          name: e.name,
          date: e.date,
          typeLabel: type ? type.examType + " " + type.paperName : "",
          score: e.totals.score === null || e.totals.score === undefined ? "—" : e.totals.score.toFixed(1),
          pct: e.totals.pct === null || e.totals.pct === undefined ? "—" : Math.round(e.totals.pct * 100) + "%",
          minutes: e.totals.minutes === null || e.totals.minutes === undefined ? "—" : Math.round(e.totals.minutes) + " 分钟",
        };
      });

    this.setData({ papers, filterIndex: idx, rows, empty: rows.length === 0 });
  },

  onFilter(e) {
    this.setData({ filterIndex: Number(e.detail.value) }, () => this.reload());
  },

  onNew() {
    wx.reLaunch({ url: "/pages/index/index" });
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/index/index?id=" + id });
  },

  onMove(e) {
    const { id, seq, label } = e.currentTarget.dataset;
    wx.showModal({
      title: "调整顺序",
      content: label + "：输入目标次数",
      editable: true,
      placeholderText: String(seq),
      success: (res) => {
        if (!res.confirm) return;
        const target = Number(res.content);
        if (!Number.isInteger(target) || target < 1) {
          wx.showToast({ title: "请输入正整数", icon: "none" });
          return;
        }
        try {
          store.moveExam(id, target);
          this.reload();
          wx.showToast({ title: "已调整", icon: "success" });
        } catch (err) {
          wx.showModal({ title: "调整失败", content: err.message, showCancel: false });
        }
      },
    });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除记录",
      content: "确定删除这条记录？删除后不可恢复。",
      success: (res) => {
        if (!res.confirm) return;
        try {
          store.removeExam(id);
          this.reload();
          wx.showToast({ title: "已删除", icon: "success" });
        } catch (err) {
          wx.showModal({ title: "删除失败", content: err.message, showCancel: false });
        }
      },
    });
  },
});
