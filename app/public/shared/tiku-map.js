const G = {
  polit: "政治理论",
  common: "常识判断",
  verbal: "言语理解",
  quant: "数量关系",
  judge: "判断推理",
  data: "资料分析",
};

const EXACT = new Map([
  ["言语理解与表达", G.verbal],
  ["言语理解与表达能力", G.verbal],
  ["言语应用", G.verbal],
  ["言语运用", G.verbal],
  ["言语理解", G.verbal],
  ["言语表达与理解", G.verbal],
  ["言语能力与表达", G.verbal],
  ["选词填空", G.verbal],
  ["实词填空", G.verbal],
  ["逻辑填空", G.verbal],
  ["阅读理解", G.verbal],
  ["段落阅读", G.verbal],
  ["片段阅读", G.verbal],
  ["语句表达", G.verbal],
  ["篇章阅读", G.verbal],
  ["文章阅读", G.verbal],

  ["判断推理", G.judge],
  ["判断推理能力", G.judge],
  ["推理判断", G.judge],
  ["图形推理", G.judge],
  ["定义判断", G.judge],
  ["类比推理", G.judge],
  ["逻辑判断", G.judge],
  ["逻辑推理", G.judge],
  ["演绎推理", G.judge],

  ["数量关系（数学运算）", G.quant],
  ["数量关系（数字推理）", G.quant],
  ["数量关系", G.quant],
  ["数理能力", G.quant],
  ["数量分析", G.quant],
  ["数学运算", G.quant],
  ["数字推理", G.quant],

  ["资料分析", G.data],
  ["资料分斩", G.data],

  ["常识判断", G.common],
  ["常识判断（单选题）", G.common],
  ["常识判断（多选题）", G.common],
  ["常识", G.common],
  ["常识应用", G.common],
  ["常识应用能力", G.common],
  ["常识部分", G.common],
  ["基本常识", G.common],
  ["公共基础知识", G.common],
  ["公共基础知识-单项选择题", G.common],
  ["综合分析能力", G.common],

  ["政治理论", G.polit],
  ["政治", G.polit],
]);

const INCLUDED = new Map([
  ["言语理", G.verbal],
  ["言语", G.verbal],
  ["判断", G.judge],
  ["推理", G.judge],
  ["数量关系与资料", G.quant],
  ["数量", G.quant],
  ["数理", G.quant],
  ["数学", G.quant],
  ["资料", G.data],
  ["常识", G.common],
  ["政治理论", G.polit],
]);

export function chapterToModule(chapter) {
  const ch = String(chapter ?? "").trim();
  if (!ch) return null;
  if (EXACT.has(ch)) return EXACT.get(ch);
  for (const [key, mod] of INCLUDED) {
    if (ch.includes(key)) return mod;
  }
  if (ch === "综合分析") return G.quant;
  return null;
}

export function moduleList() {
  return [G.polit, G.common, G.verbal, G.quant, G.judge, G.data];
}

export { G as MODULES };
