import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../app/public/shared/markdown-lite.js";

test("markdown-lite 渲染标题、加粗、列表", () => {
  const html = markdownToHtml("## 结论\n\n这次**正常波动**。\n\n- 资料分析偏弱\n- 判断推理稳定\n");
  assert.ok(html.includes("<h2>结论</h2>"));
  assert.ok(html.includes("<b>正常波动</b>"));
  assert.ok(html.includes("<ul>"));
  assert.equal((html.match(/<li>/g) || []).length, 2);
});

test("markdown-lite 转义 HTML，代码块单独渲染", () => {
  const html = markdownToHtml("<script>x</script>\n\n```\n<b>raw</b>\n```\n");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<pre><code>&lt;b&gt;raw&lt;/b&gt;</code></pre>"));
});

test("markdown-lite 空输入返回空串", () => {
  assert.equal(markdownToHtml(""), "");
  assert.equal(markdownToHtml(null), "");
});
