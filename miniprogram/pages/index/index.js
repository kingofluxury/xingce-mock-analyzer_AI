const store = require("../../utils/store.js");
const { fmt } = require("../../utils/fmt.js");

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

Page({
  data: {
    examTypes: [],
    examTypeIndex: 0,
    paperNames: [],
    paperIndex: 0,
    typeId: 1,
    full: 100,
    seq: 1,
    date: "",
    name: "",
    note: "",
    modules: [],
    totals: { score: "0.0", pct: "0%", minutes: "—" },
    editing: false,
  },

  onLoad(query) {
    this.examId = query.id ? Number(query.id) : null;
    this.meta = store.meta();
    const examTypes = [];
    this.meta.paperTypes.forEach((type) => {
      if (!examTypes.includes(type.examType)) examTypes.push(type.examType);
    });

    let typeId = this.meta.defaultPaperTypeId;
    let exam = null;
    if (this.examId) {
      exam = store.getExam(this.examId);
      if (exam) typeId = exam.paperTypeId;
    }

    this.setData({
      examTypes,
      editing: Boolean(exam),
      date: today(),
    });
    this.changeType(typeId, exam);
  },

  typeObj(id) {
    return this.meta.paperTypes.find((t) => t.id === Number(id));
  },

  paperIndexFor(type) {
    const list = this.meta.paperTypes.filter((t) => t.examType === type.examType);
    return Math.max(0, list.findIndex((t) => t.id === type.id));
  },

  changeType(typeId, exam) {
    const type = this.typeObj(typeId) || this.meta.paperTypes[0];
    const list = this.meta.paperTypes.filter((t) => t.examType === type.examType);
    const modules = type.modules.map((m) => ({
      name: m.name,
      qty: m.qty,
      full: m.full,
      pct: "—",
      time: "—",
      score: "—",
      subtypes: m.subtypes.map((s, si) => ({
        id: s.id,
        name: s.name,
        qty: s.qty,
        pts: s.pts,
        si,
        correct: "",
        minutes: "",
        pct: "—",
        score: "—",
      })),
    }));

    this.type = type;
    this.setData(
      {
        typeId: type.id,
        full: type.totals.full,
        examTypeIndex: this.data.examTypes.indexOf(type.examType),
        paperNames: list.map((t) => t.paperName),
        paperIndex: this.paperIndexFor(type),
        modules,
        seq: exam ? exam.seq : type.nextSeq,
        name: exam ? exam.name || "" : "",
        note: exam ? exam.note || "" : "",
        date: exam ? exam.date || today() : today(),
      },
      () => {
        if (exam) this.fill(exam);
        this.compute();
      }
    );
  },

  fill(exam) {
    const map = {};
    (exam.items || []).forEach((item) => {
      map[item.subtypeId] = item;
    });
    const modules = this.data.modules.map((m) => ({
      ...m,
      subtypes: m.subtypes.map((s) => {
        const item = map[s.id];
        return item
          ? {
              ...s,
              correct: String(item.correct),
              minutes: item.minutes === null || item.minutes === undefined ? "" : String(item.minutes),
            }
          : s;
      }),
    }));
    this.setData({ modules });
  },

  onExamType(e) {
    const name = this.data.examTypes[Number(e.detail.value)];
    const first = this.meta.paperTypes.find((t) => t.examType === name);
    this.switchTo(first.id);
  },

  onPaper(e) {
    const list = this.meta.paperTypes.filter((t) => t.examType === this.type.examType);
    const next = list[Number(e.detail.value)];
    this.switchTo(next.id);
  },

  switchTo(typeId) {
    const hasInput = this.data.modules.some((m) => m.subtypes.some((s) => String(s.correct).trim() !== ""));
    const revert = () =>
      this.setData({
        examTypeIndex: this.data.examTypes.indexOf(this.type.examType),
        paperIndex: this.paperIndexFor(this.type),
      });

    if (!hasInput) {
      this.changeType(typeId, null);
      return;
    }
    wx.showModal({
      title: "切换试卷",
      content: "会清空当前输入，继续？",
      success: (res) => {
        if (res.confirm) this.changeType(typeId, null);
        else revert();
      },
      fail: revert,
    });
  },

  onCell(e) {
    const { mi, si, field } = e.currentTarget.dataset;
    const value = e.detail.value;
    this.setData({ [`modules[${mi}].subtypes[${si}].${field}`]: value }, () => this.compute());
  },

  onSeq(e) {
    this.setData({ seq: e.detail.value });
  },
  onDate(e) {
    this.setData({ date: e.detail.value });
  },
  onName(e) {
    this.setData({ name: e.detail.value });
  },
  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  compute() {
    let totalScore = 0;
    let totalCorrect = 0;
    let totalQty = 0;
    let totalMinutes = 0;

    const modules = this.data.modules.map((m) => {
      let qtySum = 0;
      let correctSum = 0;
      let scoreSum = 0;
      let known = 0;
      let minutesSum = 0;
      let timed = 0;

      const subtypes = m.subtypes.map((s) => {
        const rawC = String(s.correct).trim();
        const rawT = String(s.minutes).trim();
        const c = rawC === "" ? null : Number(rawC);
        const t = rawT === "" ? null : Number(rawT);
        const okC = c !== null && Number.isInteger(c) && c >= 0 && c <= s.qty;
        const okT = t === null || (isFinite(t) && t >= 0 && t <= 600);

        qtySum += s.qty;
        totalQty += s.qty;
        if (okC) {
          correctSum += c;
          totalCorrect += c;
          scoreSum += Math.round(c * s.pts * 10) / 10;
          totalScore += Math.round(c * s.pts * 10) / 10;
          known += 1;
        }
        if (t !== null && okT) {
          minutesSum += t;
          totalMinutes += t;
          timed += 1;
        }

        return {
          ...s,
          pct: okC ? Math.round((c / s.qty) * 100) + "%" : "—",
          score: okC ? (Math.round(c * s.pts * 10) / 10).toFixed(1) : "—",
        };
      });

      return {
        ...m,
        subtypes,
        pct: known ? Math.round((correctSum / qtySum) * 100) + "%" : "—",
        time: timed ? fmt(minutesSum, 0) : "—",
        score: known ? scoreSum.toFixed(1) : "—",
      };
    });

    this.setData({
      modules,
      totals: {
        score: totalScore.toFixed(1),
        pct: totalQty ? Math.round((totalCorrect / totalQty) * 100) + "%" : "—",
        minutes: totalMinutes ? Math.round(totalMinutes) + " 分钟" : "—",
      },
    });
  },

  buildPayload() {
    const items = [];
    let missing = 0;
    this.data.modules.forEach((m) => {
      m.subtypes.forEach((s) => {
        const rawC = String(s.correct).trim();
        if (rawC === "") {
          missing += 1;
          return;
        }
        const rawT = String(s.minutes).trim();
        items.push({
          subtypeId: s.id,
          correct: Number(rawC),
          minutes: rawT === "" ? null : Number(rawT),
        });
      });
    });
    if (missing > 0) throw new Error("还有 " + missing + " 个题型没填答对数");

    const seqRaw = String(this.data.seq).trim();
    return {
      paperTypeId: this.data.typeId,
      seq: seqRaw === "" ? null : Number(seqRaw),
      name: this.data.name.trim() || null,
      date: this.data.date || null,
      note: this.data.note.trim() || null,
      items,
    };
  },

  onSave() {
    if (this.saving) return;
    let payload;
    try {
      payload = this.buildPayload();
    } catch (err) {
      wx.showToast({ title: err.message, icon: "none" });
      return;
    }

    this.saving = true;
    wx.showLoading({ title: "保存中", mask: true });
    try {
      const saved = this.examId ? store.updateExam(this.examId, payload) : store.createExam(payload);
      wx.hideLoading();
      wx.showToast({ title: "已保存", icon: "success" });

      if (this.examId) {
        setTimeout(() => {
          wx.navigateBack({
            fail: () => wx.reLaunch({ url: "/pages/records/records" }),
          });
        }, 600);
      } else {
        const nextSeq = Number(saved.seq) + 1;
        const modules = this.data.modules.map((m) => ({
          ...m,
          subtypes: m.subtypes.map((s) => ({ ...s, correct: "", minutes: "" })),
        }));
        this.setData({ seq: nextSeq, name: "", note: "", modules }, () => this.compute());
      }
    } catch (err) {
      wx.hideLoading();
      wx.showModal({ title: "保存失败", content: err.message || "未知错误", showCancel: false });
    } finally {
      this.saving = false;
    }
  },

  onBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: "/pages/records/records" }),
    });
  },
});
