const COLORS = ["#3b6fd4", "#e8833a", "#c94f4f", "#4b9b8a", "#8b6bb1", "#b08a2e"];
const { fmt } = require("./fmt.js");

function draw(canvas, ctx, opts) {
  const {
    width,
    height,
    labels = [],
    series = [],
    min = 0,
    max = 100,
    unit = "",
    digits = 0,
    type = "line",
  } = opts;

  const padL = 44;
  const padR = 16;
  const padT = 24;
  const padB = 26;
  const w = width - padL - padR;
  const h = height - padT - padB;

  ctx.clearRect(0, 0, width, height);
  ctx.font = "10px sans-serif";

  ctx.strokeStyle = "#eef0f3";
  ctx.fillStyle = "#8a9099";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + w, y);
    ctx.stroke();
    const value = max - ((max - min) * i) / 4;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(fmt(value, digits) + unit, padL - 6, y);
  }

  if (!labels.length) return;

  const step = labels.length > 1 ? w / (labels.length - 1) : 0;
  const xOf = (i) => (labels.length > 1 ? padL + step * i : padL + w / 2);

  ctx.fillStyle = "#8a9099";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const every = Math.max(1, Math.ceil(labels.length / 6));
  labels.forEach((label, i) => {
    if (i % every !== 0 && i !== labels.length - 1) return;
    ctx.fillText(String(label), xOf(i), padT + h + 8);
  });

  const showLabels = series.length * labels.length <= 14;

  series.forEach((s, si) => {
    const color = COLORS[si % COLORS.length];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    if (type === "bar" && series.length === 1) {
      const barW = Math.min(28, (w / Math.max(labels.length, 1)) * 0.5);
      s.data.forEach((v, i) => {
        if (v === null || v === undefined) return;
        const x = xOf(i) - barW / 2;
        const y = padT + h - ((v - min) / (max - min)) * h;
        ctx.fillStyle = "#c9d8f5";
        ctx.fillRect(x, y, barW, padT + h - y);
        ctx.fillStyle = "#3b6fd4";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(fmt(v, digits) + unit, xOf(i), y - 3);
      });
      return;
    }

    let started = false;
    ctx.beginPath();
    s.data.forEach((v, i) => {
      if (v === null || v === undefined) {
        started = false;
        return;
      }
      const x = xOf(i);
      const y = padT + h - ((v - min) / (max - min)) * h;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.textAlign = "center";
    s.data.forEach((v, i) => {
      if (v === null || v === undefined) return;
      const x = xOf(i);
      const y = padT + h - ((v - min) / (max - min)) * h;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (showLabels) {
        ctx.textBaseline = "bottom";
        ctx.fillText(fmt(v, digits), x, y - 5);
      }
    });
  });
}

function setupCanvas(page, id) {
  return new Promise((resolve) => {
    wx.createSelectorQuery()
      .in(page)
      .select("#" + id)
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node || !info.width || !info.height) {
          resolve(null);
          return;
        }
        const canvas = info.node;
        const ctx = canvas.getContext("2d");
        const dpr = (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio) || 1;
        canvas.width = info.width * dpr;
        canvas.height = info.height * dpr;
        ctx.scale(dpr, dpr);
        resolve({ canvas, ctx, width: info.width, height: info.height });
      });
  });
}

async function render(page, id, opts) {
  const prepared = await setupCanvas(page, id);
  if (!prepared) return;
  draw(prepared.canvas, prepared.ctx, { ...opts, width: prepared.width, height: prepared.height });
}

module.exports = { render, draw, COLORS };

