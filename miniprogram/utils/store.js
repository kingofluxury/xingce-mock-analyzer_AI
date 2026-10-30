const core = require("./core.js");

const KEY = "xingce:exams";
const DEFAULT_TYPE = 1;

function now() {
  return new Date().toISOString();
}

function readAll() {
  const value = wx.getStorageSync(KEY);
  return Array.isArray(value) ? value : [];
}

function writeAll(list) {
  wx.setStorageSync(KEY, list);
}

function typeIdOf(exam) {
  return core.paperTypeById(exam.paperTypeId) ? Number(exam.paperTypeId) : DEFAULT_TYPE;
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function nextSeq(list, paperTypeId) {
  const seqs = list.filter((item) => typeIdOf(item) === paperTypeId).map((item) => Number(item.seq) || 0);
  return seqs.length === 0 ? 1 : Math.max(...seqs) + 1;
}

function mapOf(items) {
  return new Map((items || []).map((item) => [item.subtypeId, item]));
}

function summaryOf(exam) {
  return core.summarize(mapOf(exam.items), core.subtypesOf(typeIdOf(exam)));
}

function meta() {
  const list = readAll();
  return {
    defaultPaperTypeId: core.DEFAULT_PAPER_TYPE_ID,
    paperTypes: core.PAPER_TYPES.map((type) => ({
      id: type.id,
      examType: type.examType,
      paperName: type.paperName,
      subtypes: core.subtypesOf(type.id),
      modules: core.modulesOf(type.id),
      totals: core.totalsOf(type.id),
      nextSeq: nextSeq(list, type.id),
    })),
  };
}

function listExams() {
  return readAll()
    .map((exam) => ({
      id: exam.id,
      paperTypeId: typeIdOf(exam),
      seq: Number(exam.seq),
      name: exam.name || null,
      date: exam.date || null,
      note: exam.note || null,
      totals: summaryOf(exam).totals,
    }))
    .sort((a, b) => a.paperTypeId - b.paperTypeId || b.seq - a.seq);
}

function getExam(id) {
  const exam = readAll().find((item) => Number(item.id) === Number(id));
  if (!exam) return null;
  const paperTypeId = typeIdOf(exam);
  return {
    ...exam,
    paperTypeId,
    seq: Number(exam.seq),
    summary: core.summarize(mapOf(exam.items), core.subtypesOf(paperTypeId)),
  };
}

function createExam(payload) {
  const paperTypeId = Number(payload.paperTypeId) || DEFAULT_TYPE;
  if (!core.paperTypeById(paperTypeId)) throw new Error("考试类型无效");
  const data = core.normalizeExam({ ...payload, paperTypeId }, core.subtypesOf(paperTypeId));
  const list = readAll();
  const seq = data.seq || nextSeq(list, paperTypeId);
  if (list.some((item) => typeIdOf(item) === paperTypeId && Number(item.seq) === seq)) {
    throw new Error("该试卷的第 " + seq + " 次已存在");
  }
  const record = {
    id: nextId(list),
    paperTypeId,
    seq,
    name: data.name,
    date: data.date,
    note: data.note,
    createdAt: now(),
    updatedAt: now(),
    items: data.items,
  };
  list.push(record);
  writeAll(list);
  return { id: record.id, seq };
}

function updateExam(id, payload) {
  const list = readAll();
  const index = list.findIndex((item) => Number(item.id) === Number(id));
  if (index < 0) throw new Error("记录不存在");

  const paperTypeId = Number(payload.paperTypeId) || typeIdOf(list[index]);
  if (!core.paperTypeById(paperTypeId)) throw new Error("考试类型无效");
  const data = core.normalizeExam({ ...payload, paperTypeId }, core.subtypesOf(paperTypeId));
  const seq = data.seq || Number(list[index].seq);

  if (list.some((item, i) => i !== index && typeIdOf(item) === paperTypeId && Number(item.seq) === seq)) {
    throw new Error("该试卷的第 " + seq + " 次已存在");
  }

  list[index] = {
    ...list[index],
    paperTypeId,
    seq,
    name: data.name,
    date: data.date,
    note: data.note,
    updatedAt: now(),
    items: data.items,
  };
  writeAll(list);
  return { id: Number(id), seq };
}

function removeExam(id) {
  const list = readAll();
  const next = list.filter((item) => Number(item.id) !== Number(id));
  if (next.length === list.length) throw new Error("记录不存在");
  writeAll(next);
  return true;
}

function moveExam(id, targetSeq) {
  const list = readAll();
  const moving = list.find((item) => Number(item.id) === Number(id));
  if (!moving) throw new Error("记录不存在");
  const target = Number(targetSeq);
  if (!Number.isInteger(target) || target < 1) throw new Error("请输入正整数");

  const paperTypeId = typeIdOf(moving);
  const sameType = list.filter((item) => typeIdOf(item) === paperTypeId).sort((a, b) => a.seq - b.seq);
  const others = sameType.filter((item) => Number(item.id) !== Number(id));
  const index = Math.max(0, Math.min(target - 1, others.length));
  others.splice(index, 0, moving);

  others.forEach((item, i) => {
    item.seq = i + 1;
  });
  writeAll(list);
  return { id: Number(id), seq: index + 1 };
}

function stats(paperTypeId) {
  const typeId = core.paperTypeById(paperTypeId) ? Number(paperTypeId) : DEFAULT_TYPE;
  const records = readAll()
    .filter((item) => typeIdOf(item) === typeId)
    .sort((a, b) => a.seq - b.seq);
  return {
    paperTypeId: typeId,
    rows: core.compactRows(records),
    modules: core.modulesOf(typeId),
    totals: core.totalsOf(typeId),
  };
}

function exportAll() {
  const list = readAll();
  return {
    app: "xingce-analyzer",
    version: 2,
    exportedAt: now(),
    subtypes: core.SUBTYPES,
    exams: list.map((exam) => ({
      paperTypeId: typeIdOf(exam),
      seq: Number(exam.seq),
      name: exam.name || null,
      date: exam.date || null,
      note: exam.note || null,
      items: exam.items,
    })),
  };
}

function importExams(payload) {
  if (!payload || !Array.isArray(payload.exams)) throw new Error("备份文件格式不正确");
  const list = readAll();
  const used = new Map();
  list.forEach((exam) => {
    const type = typeIdOf(exam);
    if (!used.has(type)) used.set(type, new Set());
    used.get(type).add(Number(exam.seq));
  });

  let imported = 0;
  let skipped = 0;

  payload.exams.forEach((raw) => {
    try {
      const paperTypeId = Number(raw.paperTypeId) || DEFAULT_TYPE;
      if (!core.paperTypeById(paperTypeId)) {
        skipped += 1;
        return;
      }
      const data = core.normalizeExam(
        {
          paperTypeId,
          seq: raw.seq || null,
          name: raw.name || null,
          date: raw.date || null,
          note: raw.note || null,
          items: raw.items,
        },
        core.subtypesOf(paperTypeId)
      );
      if (!used.has(paperTypeId)) used.set(paperTypeId, new Set());
      const set = used.get(paperTypeId);
      let seq = data.seq;
      if (!seq) {
        seq = 1;
        while (set.has(seq)) seq += 1;
      }
      if (set.has(seq)) {
        skipped += 1;
        return;
      }
      list.push({
        id: nextId(list),
        paperTypeId,
        seq,
        name: data.name,
        date: data.date,
        note: data.note,
        createdAt: now(),
        updatedAt: now(),
        items: data.items,
      });
      set.add(seq);
      imported += 1;
    } catch (err) {
      skipped += 1;
    }
  });

  writeAll(list);
  return { imported, skipped };
}

function clearAll() {
  writeAll([]);
  return true;
}

module.exports = {
  meta,
  listExams,
  getExam,
  createExam,
  updateExam,
  removeExam,
  moveExam,
  stats,
  exportAll,
  importExams,
  clearAll,
};


