"use strict";

const SINIRLAR = [0.5, 1, 1.5, 2, 3, 4]; // sigara/gün, harita sınıfları
const RENK_DEG = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7"];
const VARSAYILAN_IL = 34;
const PAKET = 20;
// hero arka planı: sigara sayısına göre temiz gökten dumana
const GOK = [[0, "#cfe7f4"], [0.6, "#e4e6df"], [1.2, "#e2cdb4"], [2, "#c39a7a"], [3, "#7d5f50"], [4.5, "#3b302c"]];

let V, G, gunler, secili, kural;
const $ = (s) => document.querySelector(s);
const css = (ad) => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
const azHareket = matchMedia("(prefers-reduced-motion: reduce)").matches;

const sayi = (x, b = 1) => x == null ? "—" :
  x.toLocaleString("tr-TR", { minimumFractionDigits: b, maximumFractionDigits: b });
const tam = (x) => Math.round(x).toLocaleString("tr-TR");
const sigara = (pm) => pm == null ? null : pm / kural.sigara_ugm3;
const tarihYaz = (iso, uzun = true) => new Date(iso + "T00:00:00Z").toLocaleDateString("tr-TR",
  uzun ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
       : { day: "numeric", month: "short", timeZone: "UTC" });
const ayYaz = (a, uzun = true) => new Date(a + "-01T00:00:00Z").toLocaleDateString("tr-TR",
  { month: uzun ? "long" : "short", timeZone: "UTC" });
const ilBul = (p) => V.iller.find((i) => i.plaka === p);
const sinif = (s) => { let i = 0; while (i < SINIRLAR.length && s >= SINIRLAR[i]) i++; return i; };
const renk = (pm) => pm == null ? css("--veri-yok") : css(RENK_DEG[sinif(sigara(pm))]);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Türkçe ekler: İstanbul'da, İzmir'de, Muş'ta, Bitlis'te; İstanbul'un, İzmir'in, Muş'un
function sonUnlu(ad) { const m = ad.toLocaleLowerCase("tr-TR").match(/[aeıioöuü](?=[^aeıioöuü]*$)/); return m ? m[0] : "a"; }
function bulunma(ad) {
  const ince = "eiöü".includes(sonUnlu(ad));
  const sert = "çfhkpsşt".includes(ad.slice(-1).toLocaleLowerCase("tr-TR"));
  return `'${sert ? "t" : "d"}${ince ? "e" : "a"}`;
}
function iyelik(ad) {
  const u = sonUnlu(ad), unluyleBiter = "aeıioöuü".includes(ad.slice(-1).toLocaleLowerCase("tr-TR"));
  const ek = { a: "ın", ı: "ın", e: "in", i: "in", o: "un", u: "un", ö: "ün", ü: "ün" }[u];
  return `'${unluyleBiter ? "n" : ""}${ek}`;
}

function gunListesi(ilk, son) {
  const out = [];
  for (let d = new Date(ilk + "T00:00:00Z"); d <= new Date(son + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1))
    out.push(d.toISOString().slice(0, 10));
  return out;
}
function goreliGun(iso) {
  const bugun = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // Türkiye saati
  const dun = new Date(Date.parse(bugun + "T00:00:00Z") - 864e5).toISOString().slice(0, 10);
  return iso === bugun ? "Bugün" : iso === dun ? "Dün" : tarihYaz(iso).replace(/ \d{4}$/, "") + "'de";
}
function gokRengi(s) {
  if (s == null) return { arka: "#dfe3e6", metin: "#1d1f22", duman: 0 };
  let i = GOK.findIndex(([e]) => s <= e);
  if (i === -1) i = GOK.length - 1;
  const [a, b] = [GOK[Math.max(0, i - 1)], GOK[Math.max(1, i)]];
  const t = Math.min(1, Math.max(0, (s - a[0]) / (b[0] - a[0])));
  return { arka: d3.interpolateRgb(a[1], b[1])(t), metin: s >= 2.4 ? "#f4efe9" : "#1d1f22", duman: Math.min(0.9, Math.max(0, (s - 0.4) / 3)) };
}

// ---------- ipucu ----------
const ipucu = $("#ipucu");
function ipucuGoster(html, olay) {
  ipucu.innerHTML = html; ipucu.hidden = false;
  const x = olay.clientX, y = olay.clientY, w = ipucu.offsetWidth, h = ipucu.offsetHeight;
  ipucu.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 12)) + "px";
  ipucu.style.top = (y - h - 12 < 8 ? y + 16 : y - h - 12) + "px";
}
const ipucuGizle = () => { ipucu.hidden = true; };

// ---------- hero ----------
function sigaraDiz(kap, s) {
  kap.innerHTML = "";
  if (s == null) return;
  const tamSay = Math.floor(s), kalan = s - tamSay, sinir = 20;
  const ekle = (uzun, i) => {
    const e = document.createElement("span");
    e.className = "sigara" + (azHareket ? "" : " yeni");
    e.style.setProperty("--uzun", uzun);
    e.style.animationDelay = (i * 70) + "ms";
    e.appendChild(document.createElement("b"));
    kap.appendChild(e);
  };
  for (let i = 0; i < Math.min(tamSay, sinir); i++) ekle(1, i);
  // yarım sigara: yanıp kısalmış bir sigara olarak çizilir
  if (tamSay < sinir && kalan >= 0.05) ekle(kalan, tamSay);
  if (tamSay > sinir) kap.insertAdjacentHTML("beforeend", `<span class="sigara-fazla">+${tamSay - sinir}</span>`);
}

function sonGecerli(il) {
  for (let i = il.pm.length - 1; i >= 0; i--) if (il.pm[i] != null) return i;
  return -1;
}

function seciciGenislik() { $("#sehir-ad").textContent = ilBul(secili).ad; }

function heroCiz() {
  const il = ilBul(secili), son = gunler.length - 1, pm = il.pm[son], s = sigara(pm);
  $("#hero-gun").textContent = goreliGun(gunler[son]);
  $("#hero-ek").textContent = bulunma(il.ad);
  seciciGenislik();
  const g = gokRengi(s), h = $("#hero");
  h.style.setProperty("--gok", g.arka);
  h.style.setProperty("--hero-metin", g.metin);
  h.style.setProperty("--duman-op", g.duman);
  document.querySelector('meta[name="theme-color"]').content = g.arka;
  sigaraDiz($("#hero-sigaralar"), s);
  if (pm == null) {
    $("#hero-sayi").textContent = "?";
    const j = sonGecerli(il);
    $("#hero-alt").innerHTML = !il.istasyon ? `${esc(il.ad)}${bulunma(il.ad)} PM2.5 ölçen istasyon yok. Haritadan başka bir il seç.`
      : `${tarihYaz(gunler[son])} için geçerli ölçüm yok (${il.istasyon} istasyon kayıtlı, son 30 günde ${il.aktif} tanesinden veri geldi).` +
        (j >= 0 ? ` En son ${tarihYaz(gunler[j])}: <strong>${sayi(sigara(il.pm[j]))} sigara</strong>.` : "");
    return;
  }
  sayacOynat($("#hero-sayi"), s, 1, 700);
  const kat = pm / kural.who_24saat;
  $("#hero-alt").innerHTML = `Günlük ortalama PM2.5 <strong>${sayi(pm)} µg/m³</strong>, ${il.n[son]} istasyonun ortalaması. ` +
    (kat > 1 ? `WHO'nun 24 saatlik sınırının <strong>${sayi(kat)} katı</strong>.` : `WHO'nun 24 saatlik sınırının altında.`);
}

function sayacOynat(el, hedef, basamak, sure) {
  if (azHareket) { el.textContent = basamak ? sayi(hedef, basamak) : tam(hedef); return; }
  const t0 = performance.now();
  const adim = (t) => {
    const p = Math.min(1, (t - t0) / sure), e = 1 - Math.pow(1 - p, 3);
    el.textContent = basamak ? sayi(hedef * e, basamak) : tam(hedef * e);
    if (p < 1) requestAnimationFrame(adim);
  };
  requestAnimationFrame(adim);
}

// ---------- bölüm: bu yıl ----------
let yilOynadi = false;
function yilCiz(oynat = false) {
  const il = ilBul(secili), y = V.yillik.find((v) => v.plaka === secili), yil = V.son_gun.slice(0, 4);
  $("#yil-ust").textContent = `${yil}'de ${il.ad}`;
  if (!y || !y.bu_yil_gun) {
    $("#yil-sayac").textContent = "—";
    $("#yil-bulgu").textContent = `${il.ad} için ${yil} yılında geçerli ölçüm yok.`;
    $("#paketler").innerHTML = "";
    return;
  }
  const toplam = y.bu_yil_sigara, paket = toplam / PAKET;
  if (oynat) sayacOynat($("#yil-sayac"), toplam, 0, 1400); else $("#yil-sayac").textContent = tam(toplam);
  $("#yil-bulgu").innerHTML = `1 Ocak'tan bu yana ölçüm olan <strong>${y.bu_yil_gun} günün</strong> toplamı. ` +
    `Yaklaşık <strong>${sayi(paket, paket < 10 ? 1 : 0)} paket</strong>.`;
  const tamPaket = Math.floor(paket);
  $("#paketler").innerHTML = Array.from({ length: Math.min(tamPaket, 120) }, () => '<span class="paket"></span>').join("") +
    (paket - tamPaket >= 0.1 && tamPaket < 120 ? '<span class="paket yarim"></span>' : "");
}

// ---------- grafik yardımcıları ----------
function cerceve(sec, H, sol = 34) {
  const kap = d3.select(sec).html("");
  const W = Math.max(300, kap.node().clientWidth || 600);
  const m = { u: 10, s: 8, a: 26, l: sol };
  const svg = kap.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  return { svg, W, H, ic: { x0: m.l, x1: W - m.s, y0: H - m.a, y1: m.u } };
}
function yEkseni(c, y, adim) {
  const ticks = y.ticks(adim);
  c.svg.append("g").attr("class", "izgara").selectAll("line").data(ticks).join("line")
    .attr("x1", c.ic.x0).attr("x2", c.ic.x1).attr("y1", y).attr("y2", y);
  c.svg.append("g").attr("class", "eksen").selectAll("text").data(ticks).join("text")
    .attr("x", c.ic.x0 - 6).attr("y", (d) => y(d) + 4).attr("text-anchor", "end").text((d) => sayi(d, d % 1 ? 1 : 0));
}
function whoCizgisi(c, y) {
  const w = kural.who_24saat / kural.sigara_ugm3;
  c.svg.append("line").attr("class", "who").attr("x1", c.ic.x0).attr("x2", c.ic.x1).attr("y1", y(w)).attr("y2", y(w));
  c.svg.append("text").attr("class", "who-yazi").attr("x", c.ic.x0 + 4).attr("y", y(w) - 6).text("WHO 15 µg/m³");
}
function cubukYolu(x0, w, y0, y1, r) {
  const rr = Math.max(0, Math.min(r, y0 - y1));
  return `M${x0},${y0}V${y1 + rr}Q${x0},${y1} ${x0 + rr},${y1}H${x0 + w - rr}Q${x0 + w},${y1} ${x0 + w},${y1 + rr}V${y0}Z`;
}

// ---------- bölüm: son 30 gün ----------
function grafik30() {
  const il = ilBul(secili);
  const n = Math.min(30, gunler.length), bas = gunler.length - n;
  const veri = d3.range(bas, gunler.length).map((i) => ({ g: gunler[i], pm: il.pm[i], n: il.n[i] }));
  const olcum = veri.filter((d) => d.pm != null), ustu = olcum.filter((d) => d.pm > kural.who_24saat).length;
  $("#otuz-baslik").innerHTML = !olcum.length ? `${esc(il.ad)} için son 30 günde geçerli ölçüm yok.`
    : `${esc(il.ad)}, ölçüm olan ${olcum.length} günün <em>${ustu}</em> tanesinde WHO sınırının üstündeydi.`;
  const c = cerceve("#grafik-30", 230);
  const enc = d3.max(veri, (d) => sigara(d.pm)) || 1;
  const y = d3.scaleLinear().domain([0, Math.max(1, enc * 1.1)]).nice().range([c.ic.y0, c.ic.y1]);
  const x = d3.scaleBand().domain(veri.map((d) => d.g)).range([c.ic.x0, c.ic.x1]).paddingInner(0.2);
  yEkseni(c, y, 4);
  c.svg.append("g").selectAll("path").data(olcum).join("path")
    .attr("class", (d) => "cubuk" + (d.g === gunler[gunler.length - 1] ? " vurgulu" : ""))
    .attr("d", (d) => cubukYolu(x(d.g), x.bandwidth(), y(0), y(sigara(d.pm)), Math.min(4, x.bandwidth() / 2)));
  whoCizgisi(c, y);
  c.svg.append("g").attr("class", "eksen").selectAll("text").data(veri.filter((d, i) => i % 7 === (n - 1) % 7)).join("text")
    .attr("x", (d) => x(d.g) + x.bandwidth() / 2).attr("y", c.H - 6).attr("text-anchor", "middle").text((d) => tarihYaz(d.g, false));
  c.svg.append("g").selectAll("rect").data(veri).join("rect")
    .attr("x", (d) => x(d.g) - 1).attr("width", x.step()).attr("y", c.ic.y1).attr("height", c.ic.y0 - c.ic.y1).attr("fill", "transparent")
    .on("pointermove", (e, d) => ipucuGoster(`<b>${tarihYaz(d.g)}</b><br>${d.pm == null ? "Geçerli ölçüm yok"
      : `${sayi(sigara(d.pm))} sigara · ${sayi(d.pm)} µg/m³<br>${d.n} istasyon`}`, e))
    .on("pointerleave", ipucuGizle);
}

// ---------- bölüm: son 1 yıl ----------
function hareketliOrtalama(pm, pencere = 30, enAz = 15) {
  return pm.map((_, i) => {
    const d = pm.slice(Math.max(0, i - pencere + 1), i + 1).filter((v) => v != null);
    return i >= pencere - 1 && d.length >= enAz ? d3.mean(d) : null;
  });
}
function ilAylik(il) {
  const kova = d3.group(gunler.map((g, i) => [g.slice(0, 7), il.pm[i]]).filter(([, v]) => v != null), (d) => d[0]);
  return [...kova].filter(([, v]) => v.length >= 10).map(([ay, v]) => ({ ay, ort: d3.mean(v, (d) => d[1]) }));
}
function grafikYil() {
  const il = ilBul(secili);
  const aylar = ilAylik(il);
  if (aylar.length >= 3) {
    const kotu = d3.greatest(aylar, (a) => a.ort), iyi = d3.least(aylar, (a) => a.ort);
    $("#yilgrafik-baslik").innerHTML = `${esc(il.ad)}${iyelik(il.ad)} en kötü ayı ${ayYaz(kotu.ay)}: günde ortalama <em>${sayi(sigara(kotu.ort))}</em> sigara. ` +
      `En temizi ${ayYaz(iyi.ay)}: ${sayi(sigara(iyi.ort))}.`;
  } else $("#yilgrafik-baslik").textContent = `${il.ad} için yıllık karşılaştırmaya yetecek ölçüm yok.`;
  const bas = Math.max(0, gunler.length - 365), ho = hareketliOrtalama(il.pm);
  const veri = d3.range(bas, gunler.length).map((i) => ({ t: new Date(gunler[i] + "T00:00:00Z"), g: gunler[i], pm: il.pm[i], ho: ho[i], n: il.n[i] }));
  const c = cerceve("#grafik-yil", 250);
  const x = d3.scaleUtc().domain(d3.extent(veri, (d) => d.t)).range([c.ic.x0, c.ic.x1]);
  const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(veri, (d) => sigara(d.pm)) || 1)]).nice().range([c.ic.y0, c.ic.y1]);
  yEkseni(c, y, 4);
  c.svg.append("path").datum(veri).attr("class", "gunluk")
    .attr("d", d3.line().defined((d) => d.pm != null).x((d) => x(d.t)).y((d) => y(sigara(d.pm))));
  c.svg.append("path").datum(veri).attr("class", "ortalama")
    .attr("d", d3.line().defined((d) => d.ho != null).x((d) => x(d.t)).y((d) => y(sigara(d.ho))));
  whoCizgisi(c, y);
  c.svg.append("g").attr("class", "eksen").selectAll("text").data(x.ticks(d3.utcMonth.every(c.W < 520 ? 3 : 2))).join("text")
    .attr("x", x).attr("y", c.H - 6).attr("text-anchor", "middle")
    .text((d) => d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit", timeZone: "UTC" }));
  if (!veri.some((d) => d.pm != null)) return;
  const imlec = c.svg.append("line").attr("class", "imlec").attr("y1", c.ic.y1).attr("y2", c.ic.y0).style("display", "none");
  const nokta = c.svg.append("circle").attr("class", "nokta").attr("r", 4).style("display", "none");
  c.svg.append("rect").attr("x", c.ic.x0).attr("width", c.ic.x1 - c.ic.x0).attr("y", c.ic.y1).attr("height", c.ic.y0 - c.ic.y1).attr("fill", "transparent")
    .on("pointermove", function (e) {
      const [mx] = d3.pointer(e, this);
      const d = veri[Math.max(0, Math.min(veri.length - 1, d3.bisector((v) => v.t).center(veri, x.invert(mx))))];
      imlec.style("display", null).attr("x1", x(d.t)).attr("x2", x(d.t));
      if (d.pm != null) nokta.style("display", null).attr("cx", x(d.t)).attr("cy", y(sigara(d.pm))); else nokta.style("display", "none");
      ipucuGoster(`<b>${tarihYaz(d.g)}</b><br>${d.pm == null ? "Geçerli ölçüm yok" : `${sayi(sigara(d.pm))} sigara · ${sayi(d.pm)} µg/m³ · ${d.n} ist.`}` +
        (d.ho != null ? `<br>30 günlük ort.: ${sayi(sigara(d.ho))} sigara` : ""), e);
    })
    .on("pointerleave", () => { imlec.style("display", "none"); nokta.style("display", "none"); ipucuGizle(); });
}

// ---------- bölüm: harita ----------
let haritaYollar;
function haritaCiz() {
  const W = 960, H = 430, son = gunler.length - 1;
  const proj = d3.geoMercator().fitExtent([[4, 4], [W - 4, H - 4]], G), yol = d3.geoPath(proj);
  const svg = d3.select("#harita").html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img").attr("aria-label", "İllere göre son tam günün sigara eşdeğeri haritası");
  haritaYollar = svg.selectAll("path").data(G.features).join("path").attr("class", "il").attr("d", yol)
    .attr("fill", (f) => renk(ilBul(f.properties.plaka).pm[son]))
    .on("pointermove", (e, f) => {
      const il = ilBul(f.properties.plaka), pm = il.pm[son];
      ipucuGoster(`<b>${esc(il.ad)}</b><br>${pm == null ? (il.istasyon ? "Geçerli ölçüm yok" : "PM2.5 istasyonu yok")
        : `${sayi(sigara(pm))} sigara · ${sayi(pm)} µg/m³<br>${il.n[son]} istasyon`}`, e);
    })
    .on("pointerleave", ipucuGizle)
    .on("click", (e, f) => ilSec(f.properties.plaka, true));
  haritaVurgula();
  const etiket = ["0,5'ten az", "0,5–1", "1–1,5", "1,5–2", "2–3", "3–4", "4+"];
  $("#lejant").innerHTML = "<span>Sigara:</span>" + etiket.map((t, i) => `<span><i style="background:${css(RENK_DEG[i])}"></i>${t}</span>`).join("") +
    `<span><i style="background:${css("--veri-yok")}"></i>veri yok</span>`;
  const olcen = V.iller.filter((i) => i.pm[son] != null).sort((a, b) => a.pm[son] - b.pm[son]);
  const ustu = olcen.filter((i) => i.pm[son] > kural.who_24saat).length;
  $("#harita-tarih").textContent = tarihYaz(gunler[son]);
  $("#harita-baslik").innerHTML = `Ölçüm olan ${olcen.length} ilin <em>${ustu}</em> tanesinde hava WHO sınırının üstündeydi.`;
  const satir = (i) => `<li><button type="button" class="il-dugme" data-il="${i.plaka}">${esc(i.ad)}</button><span><b>${sayi(sigara(i.pm[son]))}</b> sigara</span></li>`;
  $("#temiz").innerHTML = olcen.slice(0, 3).map(satir).join("");
  $("#kirli").innerHTML = olcen.slice(-3).reverse().map(satir).join("");
}
function haritaVurgula() {
  if (haritaYollar) haritaYollar.classed("secili", (f) => f.properties.plaka === secili).filter((f) => f.properties.plaka === secili).raise();
}

// ---------- bölüm: en kötü günler, mevsim, sıralama ----------
function enKotuCiz() {
  $("#en-kotu").innerHTML = V.en_kotu_gunler.slice(0, 5).map((d, i) => `<li><span class="sira">${i + 1}</span>
    <span class="kim"><button type="button" class="il-dugme" data-il="${d.plaka}">${esc(d.ad)}</button><small>${tarihYaz(d.tarih)} · ${d.n} istasyon</small></span>
    <span class="deger">${sayi(sigara(d.pm))}<small>sigara · ${sayi(d.pm, 0)} µg/m³</small></span></li>`).join("");
}
function sehirEnKotu() {
  const il = ilBul(secili), bas = Math.max(0, gunler.length - 365);
  let j = -1;
  for (let i = bas; i < gunler.length; i++) if (il.pm[i] != null && (j < 0 || il.pm[i] > il.pm[j])) j = i;
  $("#sehir-en-kotu").innerHTML = j < 0 ? "" :
    `${esc(il.ad)}${iyelik(il.ad)} en kötü günü <strong>${tarihYaz(gunler[j])}</strong>: <strong>${sayi(sigara(il.pm[j]))} sigara</strong> (${sayi(il.pm[j], 0)} µg/m³).`;
}
function grafikMevsim() {
  const veri = V.mevsim;
  if (!veri.length) return;
  const tamAy = veri.filter((d) => d.il_gun >= 500);
  const kotu = d3.greatest(tamAy, (d) => d.ortalama), iyi = d3.least(tamAy, (d) => d.ortalama);
  if (kotu && iyi) $("#mevsim-baslik").innerHTML = `Türkiye'de ${ayYaz(kotu.ay)} ${kotu.ay.slice(0, 4)} havası, ${ayYaz(iyi.ay)} ${iyi.ay.slice(0, 4)} havasının <em>${sayi(kotu.ortalama / iyi.ortalama)} katı</em> kirliydi.`;
  const c = cerceve("#grafik-mevsim", 210);
  const x = d3.scaleBand().domain(veri.map((d) => d.ay)).range([c.ic.x0, c.ic.x1]).paddingInner(0.2);
  const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(veri, (d) => sigara(d.ortalama)))]).nice().range([c.ic.y0, c.ic.y1]);
  yEkseni(c, y, 4);
  c.svg.append("g").selectAll("path").data(veri).join("path")
    .attr("class", (d) => "cubuk" + (d === kotu ? " vurgulu" : ""))
    .attr("d", (d) => cubukYolu(x(d.ay), x.bandwidth(), y(0), y(sigara(d.ortalama)), Math.min(4, x.bandwidth() / 2)));
  whoCizgisi(c, y);
  c.svg.append("g").attr("class", "eksen").selectAll("text").data(veri).join("text")
    .attr("x", (d) => x(d.ay) + x.bandwidth() / 2).attr("y", c.H - 6).attr("text-anchor", "middle")
    .text((d, i) => (c.W < 520 && i % 2) ? "" : ayYaz(d.ay, false));
  c.svg.append("g").selectAll("rect").data(veri).join("rect")
    .attr("x", (d) => x(d.ay) - 1).attr("width", x.step()).attr("y", c.ic.y1).attr("height", c.ic.y0 - c.ic.y1).attr("fill", "transparent")
    .on("pointermove", (e, d) => ipucuGoster(`<b>${ayYaz(d.ay)} ${d.ay.slice(0, 4)}</b><br>${sayi(sigara(d.ortalama))} sigara · ${sayi(d.ortalama)} µg/m³<br>${d.il_gun} il-gün${d.il_gun < 500 ? " (eksik ay)" : ""}`, e))
    .on("pointerleave", ipucuGizle);
}
function siralamaCiz() {
  const sirali = V.yillik.filter((y) => y.siralamada).sort((a, b) => b.ortalama - a.ortalama);
  const disari = V.yillik.filter((y) => !y.siralamada).sort((a, b) => b.ortalama - a.ortalama);
  const enKirli = sirali[0], enTemiz = sirali[sirali.length - 1];
  if (enKirli && enTemiz) $("#siralama-baslik").innerHTML =
    `Son 365 günde ortalaması en kötü il ${esc(enKirli.ad)} (günde <em>${sayi(enKirli.ortalama / kural.sigara_ugm3)}</em> sigara), en temiz ${esc(enTemiz.ad)} (${sayi(enTemiz.ortalama / kural.sigara_ugm3)}).`;
  $("#yillik-not").textContent = `En az ${kural.siralama_en_az_gun} geçerli günü olan ${sirali.length} il sıralandı; ` +
    `${disari.length} ilin verisi yetersiz (altta, sırasız). ${81 - V.yillik.length} ilde hiç PM2.5 ölçümü yok. Satıra dokununca il seçilir.`;
  const tr = (y, s) => `<tr class="secilebilir" data-il="${y.plaka}"><td class="sayi">${s ?? "—"}</td><td>${esc(y.ad)}</td>
    <td class="sayi">${sayi(y.ortalama / kural.sigara_ugm3)}</td><td class="sayi">${sayi(y.ortalama)}</td><td class="sayi">${y.gun}</td>
    <td class="sayi">%${Math.round(100 * y.who_ustu_gun / y.gun)}</td></tr>`;
  $("#yillik-tablo").innerHTML = `<table><thead><tr><th class="sayi">#</th><th>İl</th><th class="sayi">Sigara/gün</th><th class="sayi">µg/m³</th>
    <th class="sayi">Geçerli gün</th><th class="sayi">WHO üstü</th></tr></thead><tbody>` +
    sirali.map((y, i) => tr(y, i + 1)).join("") + disari.map((y) => tr(y, null)).join("") + "</tbody></table>";
}
function istasyonTablosu() {
  const ist = V.istasyonlar[String(secili)] || [];
  $("#istasyon-tablo").innerHTML = !ist.length ? `<p class="not">Bu ilde PM2.5 ölçen istasyon yok.</p>` :
    `<table><thead><tr><th>İstasyon</th><th>Tür</th><th class="sayi">${tarihYaz(V.son_gun, false)} µg/m³</th><th class="sayi">Saat</th></tr></thead><tbody>` +
    ist.map((s) => `<tr><td>${esc(s.ad)}</td><td>${esc(s.tur || "—")}</td>
      <td class="sayi">${s.gecerli ? sayi(s.son_pm) : (s.son_saat ? `(${sayi(s.son_pm)})` : "—")}</td><td class="sayi">${s.son_saat}/24</td></tr>`).join("") +
    `</tbody></table><p class="not">Parantez içindeki değerler 18 saatten az ölçüme dayanır, il ortalamasına girmez.</p>`;
}

// ---------- paylaşım kartı (1080×1350) ----------
function kartCiz() {
  const cv = $("#paylas-kart"), x = cv.getContext("2d"), W = 1080, H = 1350;
  const il = ilBul(secili), son = gunler.length - 1, pm = il.pm[son], s = sigara(pm), g = gokRengi(s);
  const font = (b, w = 600) => `${w} ${b}px "Bricolage Grotesque", system-ui, sans-serif`;
  x.fillStyle = g.arka; x.fillRect(0, 0, W, H);
  if (g.duman > 0) {
    for (const [cx, cy, r, c] of [[250, 400, 520, "120,104,92"], [850, 800, 560, "196,120,70"], [500, 1150, 600, "120,104,92"]]) {
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, `rgba(${c},${0.55 * g.duman})`); gr.addColorStop(1, `rgba(${c},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
    }
  }
  const ana = g.metin, ikinci = g.metin === "#1d1f22" ? "rgba(29,31,34,.72)" : "rgba(244,239,233,.8)";
  x.fillStyle = ana; x.textBaseline = "alphabetic";
  x.font = font(60, 650);
  x.fillText(`${goreliGun(gunler[son])} ${il.ad}${bulunma(il.ad)}`, 80, 190);
  x.fillText("nefes almak", 80, 262);
  const metin = s == null ? "?" : sayi(s);
  x.font = font(110, 500); x.globalAlpha = .55; x.fillText("=", 74, 520); x.globalAlpha = 1;
  x.font = font(330, 800);
  x.fillText(metin, 150, 600);
  const gen = x.measureText(metin).width;
  x.font = font(72, 650); x.fillText("sigara", 150 + gen + 24, 600);
  if (s != null) {
    const w0 = 170, h = 34, ara = 26, sut = 4, adet = Math.min(Math.ceil(s), 12);
    for (let i = 0; i < adet; i++) {
      const oran = i < Math.floor(s) ? 1 : s - Math.floor(s);
      const filtre = 38, w = filtre + (w0 - filtre) * oran;
      const cx = 80 + (i % sut) * (w0 + ara), cy = 690 + Math.floor(i / sut) * (h + 26);
      x.fillStyle = "#d9a066"; x.fillRect(cx, cy, filtre, h);
      x.fillStyle = "#f7f5f0"; x.fillRect(cx + filtre, cy, w - filtre - 14, h);
      x.fillStyle = "#ff5a1f"; x.shadowColor = "rgba(255,90,31,.8)"; x.shadowBlur = 18;
      x.fillRect(cx + w - 14, cy, 14, h); x.shadowBlur = 0;
    }
  }
  x.fillStyle = ikinci; x.font = font(36, 500);
  x.fillText(pm == null ? "Bu gün için geçerli ölçüm yok." : `PM2.5 günlük ortalama ${sayi(pm)} µg/m³ · ${il.n[son]} istasyon`, 80, 960);
  if (pm != null) x.fillText(pm > kural.who_24saat ? `WHO 24 saatlik sınırının ${sayi(pm / kural.who_24saat)} katı` : "WHO 24 saatlik sınırının altında", 80, 1012);
  x.fillStyle = ana; x.font = font(64, 750); x.fillText("Seninki kaç sigara?", 80, 1150);
  x.fillStyle = ikinci; x.font = font(26, 400);
  x.fillText("Kaba benzetme, tıbbi ölçü değil: günlük 22 µg/m³ PM2.5 ≈ 1 sigara (Berkeley Earth).", 80, 1230);
  x.fillText("Veri: ÇŞİDB Ulusal Hava Kalitesi İzleme Ağı" + (siteAdresi() ? " · " + siteAdresi() : ""), 80, 1272);
}
function siteAdresi() {
  const h = location.host;
  return /^(localhost|127\.|\[::1\])/.test(h) || !h ? "" : h + location.pathname.replace(/index\.html$/, "");
}
function dosyaAdi() {
  return `kac-sigara-${ilBul(secili).ad.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/g, "-")}-${V.son_gun}.png`;
}
function paylasimDugmeleri() {
  $("#indir").onclick = () => $("#paylas-kart").toBlob((b) => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(b), download: dosyaAdi() });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  if (navigator.canShare) {
    $("#paylas").hidden = false;
    $("#paylas").onclick = () => $("#paylas-kart").toBlob(async (b) => {
      const il = ilBul(secili), s = sigara(il.pm[gunler.length - 1]);
      const veri = { files: [new File([b], dosyaAdi(), { type: "image/png" })], url: location.href,
        text: s == null ? "Şehrinin havası kaç sigara?" : `${goreliGun(V.son_gun)} ${il.ad}${iyelik(il.ad)} havası ${sayi(s)} sigara. Seninki?` };
      try { if (navigator.canShare(veri)) await navigator.share(veri); else await navigator.share({ url: location.href, text: veri.text }); } catch (_) {}
    });
  }
  $("#baglanti").onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); $("#baglanti").textContent = "Kopyalandı"; }
    catch (_) { $("#baglanti").textContent = location.href; }
    setTimeout(() => { $("#baglanti").textContent = "Bağlantıyı kopyala"; }, 2000);
  };
}

// ---------- konum ----------
function konumDugmesi() {
  const b = $("#konum");
  if (!navigator.geolocation) { b.hidden = true; return; }
  b.onclick = () => {
    b.textContent = "Konum soruluyor…";
    navigator.geolocation.getCurrentPosition((p) => {
      const { latitude: la, longitude: lo } = p.coords;
      let enIyi = null, enYakin = Infinity;
      for (const [plaka, liste] of Object.entries(V.istasyonlar)) {
        if (!ilBul(+plaka).aktif) continue;
        for (const s of liste) {
          if (s.enlem == null) continue;
          const d = (s.enlem - la) ** 2 + ((s.boylam - lo) * Math.cos(la * Math.PI / 180)) ** 2;
          if (d < enYakin) { enYakin = d; enIyi = +plaka; }
        }
      }
      b.textContent = "📍 Konumumdan bul";
      if (enIyi) ilSec(enIyi);
    }, () => { b.textContent = "Konum alınamadı"; setTimeout(() => { b.textContent = "📍 Konumumdan bul"; }, 2500); },
    { timeout: 10000, maximumAge: 3600e3 });
  };
}

// ---------- seçim ----------
function ilSec(p, yukari = false) {
  if (!ilBul(p)) p = VARSAYILAN_IL;
  secili = p;
  $("#il-sec").value = String(p);
  history.replaceState(null, "", "#" + p);
  try { localStorage.setItem("hava-il", String(p)); } catch (_) {}
  heroCiz(); yilCiz(yilOynadi); haritaVurgula(); grafik30(); grafikYil(); sehirEnKotu(); istasyonTablosu(); kartCiz();
  document.querySelectorAll("#yillik-tablo tr[data-il]").forEach((r) => r.classList.toggle("aktif", +r.dataset.il === p));
  if (yukari) window.scrollTo({ top: 0, behavior: azHareket ? "auto" : "smooth" });
}
function baslangicIli() {
  const h = parseInt(location.hash.slice(1), 10);
  if (h) return h;
  try { const k = parseInt(localStorage.getItem("hava-il"), 10); if (k) return k; } catch (_) {}
  return VARSAYILAN_IL;
}
function acilmalar() {
  const bolumler = document.querySelectorAll(".bolum .kap");
  bolumler.forEach((b) => b.classList.add("acil"));
  if (!("IntersectionObserver" in window)) { bolumler.forEach((b) => b.classList.add("gorundu")); return; }
  const g = new IntersectionObserver((kayitlar) => {
    for (const k of kayitlar) {
      if (!k.isIntersecting) continue;
      k.target.classList.add("gorundu");
      if (k.target.closest("#yil") && !yilOynadi) { yilOynadi = true; yilCiz(true); }
      g.unobserve(k.target);
    }
  }, { threshold: 0.15 });
  bolumler.forEach((b) => g.observe(b));
}

async function basla() {
  try {
    [V, G] = await Promise.all([fetch("veri/veri.json").then((r) => r.json()), fetch("veri/iller.geojson").then((r) => r.json())]);
  } catch (e) {
    $("#hero-alt").textContent = "Veri yüklenemedi.";
    return;
  }
  kural = V.kurallar;
  gunler = gunListesi(V.ilk_gun, V.son_gun);
  const sec = $("#il-sec");
  sec.innerHTML = [...V.iller].sort((a, b) => a.ad.localeCompare(b.ad, "tr")).map((i) =>
    `<option value="${i.plaka}">${esc(i.ad)}${i.istasyon ? (i.aktif ? "" : " (veri yok)") : " (istasyon yok)"}</option>`).join("");
  sec.onchange = () => ilSec(+sec.value);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-il]");
    if (b && !e.target.closest("select")) ilSec(+b.dataset.il, true);
  });
  window.addEventListener("hashchange", () => { const h = parseInt(location.hash.slice(1), 10); if (h && h !== secili) ilSec(h); });
  $("#guncelleme").textContent = new Date(V.guncelleme).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });
  haritaCiz(); enKotuCiz(); grafikMevsim(); siralamaCiz(); paylasimDugmeleri(); konumDugmesi();
  ilSec(baslangicIli());
  acilmalar();
  // yazı tipi geç yüklenirse seçici genişliği ve kart yeniden çizilir
  if (document.fonts) document.fonts.ready.then(() => { seciciGenislik(); kartCiz(); });
  let zaman;
  window.addEventListener("resize", () => { clearTimeout(zaman); zaman = setTimeout(() => { seciciGenislik(); grafik30(); grafikYil(); grafikMevsim(); }, 150); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { haritaCiz(); grafikMevsim(); ilSec(secili); });
}
basla();
