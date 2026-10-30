const store = require("../../utils/store.js");
const { APP_VERSION } = require("../../utils/version.js");

Page({
  data: {
    groups: [],
    count: 0,
    version: APP_VERSION,
    importing: false,
    importText: "",
  },

  onShow() {
    this.reload();
  },

  reload() {
    const meta = store.meta();
    const groups = meta.paperTypes.map((type) => ({
      id: type.id,
      title: type.examType + " · " + type.paperName,
      qty: type.totals.qty,
      full: type.totals.full,
      modules: type.modules.map((m) => ({
        name: m.name,
        qty: m.qty,
        full: m.full,
        subs: m.subtypes.map((s) => ({ name: s.name, qty: s.qty, pts: s.pts })),
      })),
    }));
    this.setData({ groups, count: store.listExams().length });
  },

  onExport() {
    const text = JSON.stringify(store.exportAll(), null, 2);
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showModal({
          title: "已复制备份",
          content: "JSON 已复制到剪贴板，粘贴到聊天或文件里保存。",
          showCancel: false,
        });
      },
      fail: () => wx.showToast({ title: "复制失败", icon: "none" }),
    });
  },

  onImport() {
    wx.getClipboardData({
      success: (res) => {
        let payload;
        try {
          payload = JSON.parse(res.data);
        } catch (err) {
          wx.showModal({ title: "导入失败", content: "剪贴板里不是有效的 JSON 备份", showCancel: false });
          return;
        }
        const total = Array.isArray(payload.exams) ? payload.exams.length : 0;
        this.setData({ importing: true, importText: "共 " + total + " 条记录，请稍候…" });
        setTimeout(() => {
          try {
            const result = store.importExams(payload);
            this.setData({ importing: false, importText: "" });
            wx.showModal({
              title: "导入完成",
              content: "导入 " + result.imported + " 条，跳过 " + result.skipped + " 条",
              showCancel: false,
              success: () => this.reload(),
            });
          } catch (err) {
            this.setData({ importing: false, importText: "" });
            wx.showModal({ title: "导入失败", content: err.message, showCancel: false });
          }
        }, 80);
      },
      fail: () => wx.showToast({ title: "读取剪贴板失败", icon: "none" }),
    });
  },

  onClear() {
    wx.showModal({
      title: "清空全部数据",
      content: "会删除所有模考记录，且不可恢复。确定继续？",
      confirmColor: "#c94f4f",
      success: (res) => {
        if (!res.confirm) return;
        store.clearAll();
        this.reload();
        wx.showToast({ title: "已清空", icon: "success" });
      },
    });
  },

  onRecords() {
    wx.reLaunch({ url: "/pages/records/records" });
  },
});

