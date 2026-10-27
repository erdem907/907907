'use strict';
/* Bağımlılıksız rapor PDF'i: sayfalar canvas'a çizilir, JPEG olarak PDF'e gömülür.
   (iPhone ana ekran uygulamalarında window.print() çalışmadığı için gerçek dosya üretilir.) */
(() => {
const W = 1240, H = 1754, MX = 90, MT = 96, MB = 120, CW = W - 2 * MX;   // A4, 150 dpi
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function drawReport(m) {
  const pages = []; let pg = null, y = 0;
  const txt = (s, x, yy, o = {}) => {
    const c = pg.x; c.font = `${o.weight || 400} ${o.size || 24}px ${FONT}`; c.fillStyle = o.color || '#111'; c.textAlign = o.align || 'left';
    s = String(s == null ? '' : s);
    if (o.maxW && c.measureText(s).width > o.maxW) { while (s.length > 1 && c.measureText(s + '…').width > o.maxW) s = s.slice(0, -1); s += '…'; }
    c.fillText(s, x, yy);
  };
  const hline = (yy, color, w) => { const c = pg.x; c.fillStyle = color; c.fillRect(MX, yy, CW, w || 1.5); };
  const rr = (x, yy, w, h, r, fill, stroke) => {
    const c = pg.x; c.beginPath(); c.moveTo(x + r, yy); c.arcTo(x + w, yy, x + w, yy + h, r); c.arcTo(x + w, yy + h, x, yy + h, r); c.arcTo(x, yy + h, x, yy, r); c.arcTo(x, yy, x + w, yy, r); c.closePath();
    c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  };
  const newPage = first => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.textBaseline = 'alphabetic';
    pg = { c, x }; pages.push(pg); y = MT;
    if (!first) { txt(`${m.title} · ${m.sub}`, MX, y + 22, { size: 22, color: '#666' }); y += 54; }
  };
  const ensure = h => { if (y + h > H - MB) newPage(false); };

  newPage(true);
  txt(m.title, MX, y + 40, { size: 52, weight: 800, color: '#0f3d2e' }); y += 64;
  txt(m.sub, MX, y + 24, { size: 28, color: '#555' }); y += 46;
  if (m.who) { txt(m.who, MX, y + 22, { size: 24, color: '#222', maxW: CW }); y += 44; } else y += 8;

  if (m.stats && m.stats.length) {
    const n = m.stats.length, gap = 18, bw = (CW - gap * (n - 1)) / n, bh = 112;
    m.stats.forEach((s, i) => {
      const x0 = MX + i * (bw + gap);
      rr(x0, y, bw, bh, 16, '#eef6f1', '#cfe0d6');
      txt(s.v, x0 + 20, y + 54, { size: 34, weight: 800, color: '#0f3d2e', maxW: bw - 40 });
      txt(s.l, x0 + 20, y + 90, { size: 22, color: '#667', maxW: bw - 40 });
    });
    y += bh + 36;
  }

  (m.tables || []).forEach(t => {
    if (t.title) { ensure(130); txt(t.title, MX, y + 28, { size: 28, weight: 700, color: '#0f3d2e' }); y += 48; }
    const cols = t.cols || [], rows = t.rows || [], colW = cols.map(c => (c.w || 1) * CW / cols.reduce((a, c) => a + (c.w || 1), 0));
    ensure(40 + rows.length * 36);
    let x = MX; cols.forEach((c, i) => { txt(c.t, x + 8, y + 22, { size: 20, weight: 600, color: '#555', maxW: colW[i] - 16 }); x += colW[i]; });
    y += 32; hline(y, '#cfe0d6', 2); y += 8;
    rows.forEach(r => {
      ensure(40); x = MX;
      r.forEach((cell, i) => { txt(cell, x + 8, y + 22, { size: 22, color: '#222', maxW: colW[i] - 16 }); x += colW[i]; });
      y += 36;
    });
    y += 24;
  });

  (m.notes || []).forEach(n => {
    ensure(80); const out = []; let line = '';
    String(n).split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (pg.x.measureText(t).width > CW) { out.push(line); line = w; } else line = t; });
    if (line) out.push(line);
    ensure(out.length * 32 + 10); out.forEach(l => { txt(l, MX, y + 22, { size: 22, color: '#555' }); y += 32; }); y += 10;
  });

  if (m.sign) {
    ensure(230); y += 80;
    const bw = 440; pg.x.fillStyle = '#111';
    pg.x.fillRect(MX, y, bw, 2); pg.x.fillRect(MX + CW - bw, y, bw, 2);
    txt(m.sign.left, MX, y + 38, { size: 23, color: '#333', maxW: bw });
    txt(m.sign.right, MX + CW - bw, y + 38, { size: 23, color: '#333', maxW: bw });
    y += 100; if (m.sign.date) txt(m.sign.date, MX, y, { size: 22, color: '#666' });
  }

  pages.forEach((p, i) => { pg = p; txt(`${m.footer} · Sayfa ${i + 1}/${pages.length}`, W / 2, H - 56, { size: 20, color: '#888', align: 'center' }); });
  return pages.map(p => p.c);
}

function jpegBytes(c) {
  const bin = atob(c.toDataURL('image/jpeg', 0.92).split(',')[1]), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function buildPdf(jpegs) {
  const enc = new TextEncoder(), parts = [], offs = []; let off = 0;
  const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); off += u.length; };
  const obj = (n, body) => { offs[n] = off; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  const n = jpegs.length, kids = jpegs.map((_, i) => `${5 + 3 * i} 0 R`).join(' ');
  push('%PDF-1.4\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  jpegs.forEach((j, i) => {
    const img = 3 + 3 * i, con = 4 + 3 * i, pge = 5 + 3 * i, cs = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
    obj(img, () => { push(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>\nstream\n`); push(j); push('\nendstream'); });
    obj(con, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(pge, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${con} 0 R >>`));
  });
  const total = 3 + 3 * n, xref = off;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offs[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const res = new Uint8Array(off); let p = 0; parts.forEach(b => { res.set(b, p); p += b.length; });
  return res;
}

M.pdfReport = model => buildPdf(drawReport(model).map(jpegBytes));
})();
