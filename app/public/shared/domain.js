export const PAPER_TYPES = [
  { id: 1, examType: "江苏", paperName: "A/B类" },
  { id: 2, examType: "江苏", paperName: "C类" },
  { id: 3, examType: "国考", paperName: "副省级" },
  { id: 4, examType: "国考", paperName: "地市级/行政执法类" },
];

export const DEFAULT_PAPER_TYPE_ID = 1;

function s(id, paperTypeId, module, name, qty, pts) {
  return { id, paperTypeId, module, name, qty, pts };
}

export const SUBTYPES = [
  s(1, 1, "政治理论", "政治理论", 10, 0.7),
  s(2, 1, "常识判断", "常识判断", 10, 0.6),
  s(3, 1, "言语理解", "片段阅读", 15, 0.7),
  s(4, 1, "言语理解", "选词填空", 10, 0.5),
  s(5, 1, "言语理解", "文章阅读", 5, 0.7),
  s(6, 1, "数量关系", "数字推理", 5, 0.7),
  s(7, 1, "数量关系", "数字运算", 15, 0.9),
  s(8, 1, "判断推理", "类比推理", 10, 0.5),
  s(9, 1, "判断推理", "图形推理", 10, 0.8),
  s(10, 1, "判断推理", "逻辑判断", 15, 0.8),
  s(11, 1, "判断推理", "定义判断", 10, 0.8),
  s(12, 1, "资料分析", "资料分析", 20, 0.9),

  s(13, 2, "政治理论", "政治理论", 10, 0.8),
  s(14, 2, "常识判断", "常识判断", 10, 0.7),
  s(15, 2, "言语理解", "片段阅读", 15, 0.7),
  s(16, 2, "言语理解", "选词填空", 10, 0.6),
  s(17, 2, "言语理解", "文章阅读", 5, 0.8),
  s(18, 2, "数量关系", "数字推理", 5, 0.7),
  s(19, 2, "数量关系", "数字运算", 15, 0.8),
  s(20, 2, "判断推理", "类比推理", 10, 0.7),
  s(21, 2, "判断推理", "图形推理", 10, 0.8),
  s(22, 2, "判断推理", "逻辑判断", 10, 0.8),
  s(23, 2, "判断推理", "定义判断", 10, 0.8),
  s(24, 2, "资料分析", "资料分析", 20, 0.9),

  s(25, 3, "政治理论", "政治理论", 20, 0.5),
  s(26, 3, "常识判断", "常识判断", 15, 0.5),
  s(27, 3, "言语理解", "言语理解", 30, 0.8),
  s(28, 3, "判断推理", "图形推理", 10, 0.8),
  s(29, 3, "判断推理", "定义判断", 10, 0.8),
  s(30, 3, "判断推理", "类比推理", 5, 0.8),
  s(31, 3, "判断推理", "逻辑判断", 10, 0.85),
  s(32, 3, "数量关系", "数量关系", 10, 1),
  s(33, 3, "资料分析", "资料分析", 20, 1),

  s(34, 4, "政治理论", "政治理论", 20, 0.5),
  s(35, 4, "常识判断", "常识判断", 15, 0.5),
  s(36, 4, "言语理解", "言语理解", 30, 0.8),
  s(37, 4, "判断推理", "图形推理", 10, 0.8),
  s(38, 4, "判断推理", "定义判断", 10, 0.7),
  s(39, 4, "判断推理", "类比推理", 5, 0.7),
  s(40, 4, "判断推理", "逻辑判断", 10, 0.8),
  s(41, 4, "数量关系", "数量关系", 15, 0.8),
  s(42, 4, "资料分析", "资料分析", 20, 1),
];

export const SUBTYPE_BY_ID = new Map(SUBTYPES.map((item) => [item.id, item]));

export function tenthsOf(subtype) {
  return Math.round(subtype.pts * 10);
}

export function paperTypeById(id) {
  return PAPER_TYPES.find((t) => t.id === Number(id)) || null;
}

export function paperTypeLabel(id) {
  const type = paperTypeById(id);
  return type ? type.examType + " · " + type.paperName : "未知试卷";
}

const subtypesCache = new Map();
export function subtypesOf(paperTypeId) {
  const key = Number(paperTypeId) || DEFAULT_PAPER_TYPE_ID;
  if (!subtypesCache.has(key)) {
    subtypesCache.set(
      key,
      SUBTYPES.filter((item) => item.paperTypeId === key).sort((a, b) => a.id - b.id)
    );
  }
  return subtypesCache.get(key);
}

const moduleCache = new Map();
export function modulesOf(paperTypeId) {
  const key = Number(paperTypeId) || DEFAULT_PAPER_TYPE_ID;
  if (moduleCache.has(key)) return moduleCache.get(key);

  const order = [];
  const byName = new Map();
  for (const item of subtypesOf(key)) {
    if (!byName.has(item.module)) {
      byName.set(item.module, { name: item.module, subtypes: [], qty: 0, tenths: 0 });
      order.push(item.module);
    }
    const mod = byName.get(item.module);
    mod.subtypes.push(item);
    mod.qty += item.qty;
    mod.tenths += item.qty * tenthsOf(item);
  }

  const modules = order.map((name) => {
    const mod = byName.get(name);
    return { name, subtypes: mod.subtypes, qty: mod.qty, full: mod.tenths / 10 };
  });
  moduleCache.set(key, modules);
  return modules;
}

const totalsCache = new Map();
export function totalsOf(paperTypeId) {
  const key = Number(paperTypeId) || DEFAULT_PAPER_TYPE_ID;
  if (!totalsCache.has(key)) {
    const list = subtypesOf(key);
    totalsCache.set(key, {
      qty: list.reduce((sum, item) => sum + item.qty, 0),
      full: Math.round(list.reduce((sum, item) => sum + item.qty * tenthsOf(item), 0)) / 10,
    });
  }
  return totalsCache.get(key);
}
