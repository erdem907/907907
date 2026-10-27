'use strict';
/* Türkiye resmi tatilleri: sabit günler + dini bayramlar (+ kullanıcı özel günleri) */
(() => {
const FIXED = [
  ['01-01', 'Yılbaşı'], ['04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'], ['05-01', 'Emek ve Dayanışma Günü'],
  ['05-19', "Atatürk'ü Anma, Gençlik ve Spor Bayramı"], ['07-15', 'Demokrasi ve Millî Birlik Günü'],
  ['08-30', 'Zafer Bayramı'], ['10-29', 'Cumhuriyet Bayramı']
];
/* [Ramazan Bayramı 1. gün, Kurban Bayramı 1. gün] — Diyanet takvimi */
const TABLE = {
  2022: [['05-02'], ['07-09']], 2023: [['04-21'], ['06-28']], 2024: [['04-10'], ['06-16']],
  2025: [['03-30'], ['06-06']], 2026: [['03-20'], ['05-27']], 2027: [['03-09'], ['05-16']]
};
M.HOL_TABLE_LAST = 2027;

let fmt = null;
try { fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', day: 'numeric' }); } catch (e) {}
function estimate(y) {
  if (!fmt) return null;
  const r = [], k = [];
  for (let d = new Date(Date.UTC(y, 0, 1)); d.getUTCFullYear() === y; d = new Date(d.getTime() + 864e5)) {
    const p = {}; fmt.formatToParts(d).forEach(x => { p[x.type] = x.value; });
    const md = d.toISOString().slice(5, 10);
    if (p.month === '10' && p.day === '1') r.push(md);
    if (p.month === '12' && p.day === '10') k.push(md);
  }
  return [r, k];
}
const addDays = (iso, n) => { const d = M.parse(iso); d.setDate(d.getDate() + n); return M.iso(d); };
const cache = {};

function build(y) {
  const map = {};
  const put = (date, name, half, est) => { if (date.slice(0, 4) === String(y)) map[date] = { date, name, half: !!half, est: !!est }; };
  FIXED.forEach(([md, name]) => put(`${y}-${md}`, name, false));
  put(`${y}-10-28`, 'Cumhuriyet Bayramı Arifesi', true);
  let est = false, pair = TABLE[y];
  if (!pair) { pair = estimate(y); est = true; }
  if (pair) {
    pair[0].forEach(md => {
      const r = `${y}-${md}`;
      put(addDays(r, -1), 'Ramazan Bayramı Arifesi', true, est);
      for (let i = 0; i < 3; i++) put(addDays(r, i), `Ramazan Bayramı ${i + 1}. Gün`, false, est);
    });
    pair[1].forEach(md => {
      const k = `${y}-${md}`;
      put(addDays(k, -1), 'Kurban Bayramı Arifesi', true, est);
      for (let i = 0; i < 4; i++) put(addDays(k, i), `Kurban Bayramı ${i + 1}. Gün`, false, est);
    });
  }
  return map;
}
const yearMap = y => cache[y] || (cache[y] = build(y));

/* Tarih için tatil bilgisi (arife dahil) veya null */
M.holidayInfo = date => {
  const c = (M.db.settings.customHolidays || []).find(h => h.date === date);
  if (c) return { date, name: c.name, half: false, est: false, custom: true };
  return yearMap(Number(date.slice(0, 4)))[date] || null;
};
/* Tatil ücreti (x2) uygulanacak mı? Arife yalnızca ayar açıksa */
M.isHolidayPay = date => { const h = M.holidayInfo(date); return !!h && (!h.half || M.db.settings.arife !== false); };
M.holidaysOfYear = y => {
  const list = Object.values(yearMap(y));
  (M.db.settings.customHolidays || []).forEach(c => { if (c.date.slice(0, 4) === String(y) && !list.some(h => h.date === c.date)) list.push({ date: c.date, name: c.name, half: false, est: false, custom: true }); });
  return list.sort((a, b) => a.date.localeCompare(b.date));
};
M.upcomingHolidays = (fromIso, n) => {
  const y = Number(fromIso.slice(0, 4));
  return [...M.holidaysOfYear(y), ...M.holidaysOfYear(y + 1)].filter(h => h.date >= fromIso && (!h.half || h.date >= fromIso)).slice(0, n);
};
})();
