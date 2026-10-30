function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  return out;
}

export function markdownToHtml(md) {
  const lines = String(md ?? "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listOpen = false;
  let codeOpen = false;
  let codeBuf = [];

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*```/.test(line)) {
      if (codeOpen) {
        html.push("<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>");
        codeBuf = [];
        codeOpen = false;
      } else {
        closeList();
        codeOpen = true;
      }
      continue;
    }
    if (codeOpen) {
      codeBuf.push(raw);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      html.push("<h" + level + ">" + inline(h[2]) + "</h" + level + ">");
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push("<li>" + inline(li[1]) + "</li>");
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      closeList();
      html.push("<p>" + inline(ol[0]) + "</p>");
      continue;
    }
    closeList();
    html.push("<p>" + inline(line) + "</p>");
  }
  if (codeOpen && codeBuf.length) html.push("<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>");
  closeList();
  return html.join("\n");
}
