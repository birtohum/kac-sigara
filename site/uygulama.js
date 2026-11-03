"use strict";

const SINIRLAR = [0.5, 1, 1.5, 2, 3, 4]; // sigara/gün, harita sınıfları
const RENK_DEG = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7"];
const VARSAYILAN_IL = 34;

let V, G, gunler, secili, kural;
const $ = (s) => document.querySelector(s);
const css = (ad) => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();

const sayi = (x, b = 1) => x == null ? "—" :
  x.toLocaleString("tr-TR", { minimumFractionDigits: b, maximumFractionDigits: b });
const sigara = (pm) => pm == null ? null : pm / kural.sigara_ugm3;
const tarihYaz = (iso, uzun = true) => new Date(iso + "T00:00:00Z").toLocaleDateString("tr-TR",
  uzun ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
       : { day: "numeric", month: "short", timeZone: "UTC" });
const ilBul = (p) => V.iller.find((i) => i.plaka === p);
const sinif = (s) => { let i = 0; while (i < SINIRLAR.length && s >= SINIRLAR[i]) i++; return i; };
const renk = (pm) => pm == null ? css("--veri-yok") : css(RENK_DEG[sinif(sigara(pm))]);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function gunListesi(ilk, son) {
  const out = [];
  for (let d = new Date(ilk + "T00:00:00Z"); d <= new Date(son + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1))
    out.push(d.toISOString().slice(0, 10));
  return out;
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

// ---------- kahraman ----------
function sigaraCiz(s) {
  const kap = document.createElement("div");
  kap.className = "sigaralar";
  kap.setAttribute("aria-hidden", "true");
  if (s == null) return kap;
  const tam = Math.min(Math.floor(s), 20);
  for (let i = 0; i < tam; i++) kap.appendChild(Object.assign(document.createElement("span"), { className: "sigara" }));
  const kalan = s - Math.floor(s);
  if (Math.floor(s) < 20 && kalan >= 0.05) {
    const k = Object.assign(document.createElement("span"), { className: "sigara kismi" });
    const ic = document.createElement("i"); ic.style.width = (kalan * 100) + "%"; k.appendChild(ic);
    kap.appendChild(k);
  }
  return kap;
}

function sonGecerli(il) {
  for (let i = il.pm.length - 1; i >= 0; i--) if (il.pm[i] != null) return i;
  return -1;
}

function kahramanCiz() {
  const il = ilBul(secili), son = gunler.length - 1;
  const pm = il.pm[son], s = sigara(pm);
  const k = $("#kahraman-icerik");
  if (pm == null) {
    const j = sonGecerli(il);
    k.innerHTML = `<div class="buyuk">—</div><div class="kahraman-yan">
      <p><strong>${esc(il.ad)}</strong>: ${tarihYaz(gunler[son])} için geçerli ölçüm yok.</p>
      <p>${il.istasyon ? `${il.istasyon} PM2.5 istasyonu kayıtlı, son 30 günde ${il.aktif} tanesinden geçerli veri geldi.` : "Bu ilde PM2.5 ölçen istasyon yok."}
      ${j >= 0 ? `En son ${tarihYaz(gunler[j])}: ${sayi(sigara(il.pm[j]))} sigara (${sayi(il.pm[j])} µg/m³).` : ""}</p></div>`;
    return;
  }
  const kat = pm / kural.who_24saat;
  k.innerHTML = `<div class="buyuk">${sayi(s)}<small>sigara</small></div>
    <div class="kahraman-yan">
      <p><strong>${esc(il.ad)}</strong>, ${tarihYaz(gunler[son])}</p>
      <p>PM2.5 günlük ortalama <strong>${sayi(pm)} µg/m³</strong> · ${il.n[son]} istasyonun ortalaması</p>
      <p>${kat > 1 ? `WHO 24 saatlik yönergesinin (15 µg/m³) <strong>${sayi(kat)} katı</strong>` : "WHO 24 saatlik yönergesinin (15 µg/m³) altında"}</p>
    </div>`;
  k.appendChild(sigaraCiz(s));
}

// ---------- harita ----------
let haritaYollar;
function haritaCiz() {
  const W = 960, H = 430;
  const proj = d3.geoMercator().fitExtent([[4, 4], [W - 4, H - 4]], G);
  const yol = d3.geoPath(proj);
  const son = gunler.length - 1;
  const svg = d3.select("#harita").html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img").attr("aria-label", "İllere göre son tam günün sigara eşdeğeri haritası");
  haritaYollar = svg.selectAll("path").data(G.features).join("path")
    .attr("class", "il").attr("d", yol)
    .attr("fill", (f) => renk(ilBul(f.properties.plaka).pm[son]))
    .on("pointermove", (e, f) => {
      const il = ilBul(f.properties.plaka), pm = il.pm[son];
      ipucuGoster(`<b>${esc(il.ad)}</b><br>${pm == null ? (il.istasyon ? "Geçerli ölçüm yok" : "PM2.5 istasyonu yok")
        : `${sayi(sigara(pm))} sigara · ${sayi(pm)} µg/m³<br>${il.n[son]} istasyon`}`, e);
    })
    .on("pointerleave", ipucuGizle)
    .on("click", (e, f) => ilSec(f.properties.plaka, true));
  haritaYollar.append("title").text((f) => ilBul(f.properties.plaka).ad);
  haritaVurgula();

  const etiket = ["0,5'ten az", "0,5–1", "1–1,5", "1,5–2", "2–3", "3–4", "4 ve üstü"];
  $("#lejant").innerHTML = "<span>Sigara/gün:</span>" + etiket.map((t, i) =>
    `<span><i style="background:${css(RENK_DEG[i])}"></i>${t}</span>`).join("") +
    `<span><i style="background:${css("--veri-yok")}"></i>veri yok</span>`;
  const olcen = V.iller.filter((i) => i.pm[son] != null);
  const ustu = olcen.filter((i) => i.pm[son] > kural.who_24saat).length;
  $("#harita-tarih").textContent = tarihYaz(gunler[son]);
  $("#harita-not").textContent = `Geçerli ölçümü olan ${olcen.length} ilin ${ustu} tanesinde günlük ortalama WHO yönergesinin (15 µg/m³) üstünde. Gri iller: istasyon yok ya da veri eksik.`;
}
function haritaVurgula() {
  if (haritaYollar) haritaYollar.classed("secili", (f) => f.properties.plaka === secili)
    .filter((f) => f.properties.plaka === secili).raise();
}

// ---------- grafikler ----------
function cerceve(sec, H, sol = 34) {
  const kap = d3.select(sec).html("");
  const W = Math.max(300, kap.node().clientWidth || 600);
  const m = { u: 10, s: 8, a: 24, l: sol };
  const svg = kap.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  return { svg, W, H, m, ic: { x0: m.l, x1: W - m.s, y0: H - m.a, y1: m.u } };
}
function yEkseni(c, y, adim) {
  const g = c.svg.append("g").attr("class", "izgara");
  const ticks = y.ticks(adim);
  g.selectAll("line").data(ticks).join("line").attr("x1", c.ic.x0).attr("x2", c.ic.x1)
    .attr("y1", y).attr("y2", y);
  c.svg.append("g").attr("class", "eksen").selectAll("text").data(ticks).join("text")
    .attr("x", c.ic.x0 - 6).attr("y", (d) => y(d) + 4).attr("text-anchor", "end").text((d) => sayi(d, d % 1 ? 1 : 0));
}
function whoCizgisi(c, y) {
  const w = kural.who_24saat / kural.sigara_ugm3;
  c.svg.append("line").attr("class", "who").attr("x1", c.ic.x0).attr("x2", c.ic.x1).attr("y1", y(w)).attr("y2", y(w));
  c.svg.append("text").attr("class", "who-yazi").attr("x", c.ic.x0 + 4).attr("y", y(w) - 5)
    .text("WHO 15 µg/m³");
}

function grafik30() {
  const il = ilBul(secili);
  const n = Math.min(30, gunler.length), bas = gunler.length - n;
  const veri = d3.range(bas, gunler.length).map((i) => ({ g: gunler[i], pm: il.pm[i], n: il.n[i] }));
  const c = cerceve("#grafik-30", 220);
  const enc = d3.max(veri, (d) => sigara(d.pm)) || 1;
  const y = d3.scaleLinear().domain([0, Math.max(1, enc * 1.1)]).nice().range([c.ic.y0, c.ic.y1]);
  const x = d3.scaleBand().domain(veri.map((d) => d.g)).range([c.ic.x0, c.ic.x1]).paddingInner(0.18);
  yEkseni(c, y, 4);
  const r = Math.min(4, x.bandwidth() / 2);
  c.svg.append("g").selectAll("path").data(veri.filter((d) => d.pm != null)).join("path")
    .attr("class", (d, i, a) => "cubuk" + (d.g === gunler[gunler.length - 1] ? " vurgulu" : ""))
    .attr("d", (d) => {
      const x0 = x(d.g), w = x.bandwidth(), y0 = y(0), y1 = y(sigara(d.pm)), rr = Math.min(r, y0 - y1);
      return `M${x0},${y0}V${y1 + rr}Q${x0},${y1} ${x0 + rr},${y1}H${x0 + w - rr}Q${x0 + w},${y1} ${x0 + w},${y1 + rr}V${y0}Z`;
    });
  whoCizgisi(c, y);
  const etiketler = veri.filter((d, i) => i % 7 === (n - 1) % 7);
  c.svg.append("g").attr("class", "eksen").selectAll("text").data(etiketler).join("text")
    .attr("x", (d) => x(d.g) + x.bandwidth() / 2).attr("y", c.H - 6).attr("text-anchor", "middle")
    .text((d) => tarihYaz(d.g, false));
  c.svg.append("g").selectAll("rect").data(veri).join("rect")
    .attr("x", (d) => x(d.g) - 1).attr("width", x.step()).attr("y", c.ic.y1).attr("height", c.ic.y0 - c.ic.y1)
    .attr("fill", "transparent")
    .on("pointermove", (e, d) => ipucuGoster(`<b>${tarihYaz(d.g)}</b><br>${d.pm == null ? "Geçerli ölçüm yok"
      : `${sayi(sigara(d.pm))} sigara · ${sayi(d.pm)} µg/m³<br>${d.n} istasyon`}`, e))
    .on("pointerleave", ipucuGizle);
}

function hareketliOrtalama(pm, pencere = 30, enAz = 15) {
  return pm.map((_, i) => {
    const d = pm.slice(Math.max(0, i - pencere + 1), i + 1).filter((v) => v != null);
    return i >= pencere - 1 && d.length >= enAz ? d3.mean(d) : null;
  });
}

function grafikYil() {
  const il = ilBul(secili);
  const bas = Math.max(0, gunler.length - 365);
  const ho = hareketliOrtalama(il.pm);
  const veri = d3.range(bas, gunler.length).map((i) => ({
    t: new Date(gunler[i] + "T00:00:00Z"), g: gunler[i], pm: il.pm[i], ho: ho[i], n: il.n[i] }));
  const c = cerceve("#grafik-yil", 240);
  const x = d3.scaleUtc().domain(d3.extent(veri, (d) => d.t)).range([c.ic.x0, c.ic.x1]);
  const enc = d3.max(veri, (d) => sigara(d.pm)) || 1;
  const y = d3.scaleLinear().domain([0, Math.max(1, enc)]).nice().range([c.ic.y0, c.ic.y1]);
  yEkseni(c, y, 4);
  c.svg.append("path").datum(veri).attr("class", "gunluk")
    .attr("d", d3.line().defined((d) => d.pm != null).x((d) => x(d.t)).y((d) => y(sigara(d.pm))));
  c.svg.append("path").datum(veri).attr("class", "ortalama")
    .attr("d", d3.line().defined((d) => d.ho != null).x((d) => x(d.t)).y((d) => y(sigara(d.ho))));
  whoCizgisi(c, y);
  const aylar = x.ticks(d3.utcMonth.every(c.W < 520 ? 3 : 2));
  c.svg.append("g").attr("class", "eksen").selectAll("text").data(aylar).join("text")
    .attr("x", x).attr("y", c.H - 6).attr("text-anchor", "middle")
    .text((d) => d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit", timeZone: "UTC" }));
  if (!veri.some((d) => d.pm != null)) {
    c.svg.append("text").attr("x", (c.ic.x0 + c.ic.x1) / 2).attr("y", (c.ic.y0 + c.ic.y1) / 2)
      .attr("text-anchor", "middle").attr("fill", css("--soluk")).text("Bu il için ölçüm yok");
    return;
  }
  const imlec = c.svg.append("line").attr("class", "imlec").attr("y1", c.ic.y1).attr("y2", c.ic.y0).style("display", "none");
  const nokta = c.svg.append("circle").attr("class", "nokta").attr("r", 4).style("display", "none");
  c.svg.append("rect").attr("x", c.ic.x0).attr("width", c.ic.x1 - c.ic.x0).attr("y", c.ic.y1)
    .attr("height", c.ic.y0 - c.ic.y1).attr("fill", "transparent")
    .on("pointermove", function (e) {
      const [mx] = d3.pointer(e, this);
      const t = x.invert(mx);
      const d = veri[Math.max(0, Math.min(veri.length - 1, d3.bisector((v) => v.t).center(veri, t)))];
      imlec.style("display", null).attr("x1", x(d.t)).attr("x2", x(d.t));
      if (d.pm != null) nokta.style("display", null).attr("cx", x(d.t)).attr("cy", y(sigara(d.pm)));
      else nokta.style("display", "none");
      ipucuGoster(`<b>${tarihYaz(d.g)}</b><br>${d.pm == null ? "Geçerli ölçüm yok" :
        `${sayi(sigara(d.pm))} sigara · ${sayi(d.pm)} µg/m³ · ${d.n} ist.`}` +
        (d.ho != null ? `<br>30 günlük ort.: ${sayi(sigara(d.ho))} sigara` : ""), e);
    })
    .on("pointerleave", () => { imlec.style("display", "none"); nokta.style("display", "none"); ipucuGizle(); });
}

function grafikMevsim() {
  const veri = V.mevsim;
  if (!veri.length) return;
  const c = cerceve("#grafik-mevsim", 200);
  const x = d3.scaleBand().domain(veri.map((d) => d.ay)).range([c.ic.x0, c.ic.x1]).paddingInner(0.2);
  const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(veri, (d) => sigara(d.ortalama)))]).nice().range([c.ic.y0, c.ic.y1]);
  yEkseni(c, y, 4);
  const r = Math.min(4, x.bandwidth() / 2);
  c.svg.append("g").selectAll("path").data(veri).join("path").attr("class", "cubuk")
    .attr("d", (d) => {
      const x0 = x(d.ay), w = x.bandwidth(), y0 = y(0), y1 = y(sigara(d.ortalama)), rr = Math.min(r, y0 - y1);
      return `M${x0},${y0}V${y1 + rr}Q${x0},${y1} ${x0 + rr},${y1}H${x0 + w - rr}Q${x0 + w},${y1} ${x0 + w},${y1 + rr}V${y0}Z`;
    });
  whoCizgisi(c, y);
  const ayAd = (a) => new Date(a + "-01T00:00:00Z").toLocaleDateString("tr-TR", { month: "short", timeZone: "UTC" });
  c.svg.append("g").attr("class", "eksen").selectAll("text").data(veri).join("text")
    .attr("x", (d) => x(d.ay) + x.bandwidth() / 2).attr("y", c.H - 6).attr("text-anchor", "middle")
    .text((d, i) => (c.W < 520 && i % 2) ? "" : ayAd(d.ay));
  c.svg.append("g").selectAll("rect").data(veri).join("rect")
    .attr("x", (d) => x(d.ay) - 1).attr("width", x.step()).attr("y", c.ic.y1).attr("height", c.ic.y0 - c.ic.y1)
    .attr("fill", "transparent")
    .on("pointermove", (e, d) => ipucuGoster(`<b>${new Date(d.ay + "-01T00:00:00Z").toLocaleDateString("tr-TR",
      { month: "long", year: "numeric", timeZone: "UTC" })}</b><br>${sayi(sigara(d.ortalama))} sigara · ${sayi(d.ortalama)} µg/m³<br>${d.il_gun} il-gün`, e))
    .on("pointerleave", ipucuGizle);
}

// ---------- il ayrıntısı ----------
function yilOzet() {
  const il = ilBul(secili), y = V.yillik.find((v) => v.plaka === secili);
  $("#detay-baslik").textContent = `${il.ad}: son 30 gün`;
  const yil = V.son_gun.slice(0, 4);
  $("#yil-ozet").innerHTML = !y ? `<p class="soluk">${esc(il.ad)} için son 365 günde geçerli ölçüm yok.</p>` : `
    <div class="ozet-kutu"><b>≈ ${y.bu_yil_sigara.toLocaleString("tr-TR")}</b><span>${yil} yılında toplam sigara (${y.bu_yil_gun} ölçümlü gün)</span></div>
    <div class="ozet-kutu"><b>${sayi(y.ortalama / kural.sigara_ugm3)}</b><span>son 365 günde günlük ortalama sigara (${sayi(y.ortalama)} µg/m³)</span></div>
    <div class="ozet-kutu"><b>${y.who_ustu_gun} / ${y.gun}</b><span>ölçümlü günlerden WHO yönergesini aşanlar</span></div>`;
  const ist = V.istasyonlar[String(secili)] || [];
  $("#istasyon-tablo").innerHTML = !ist.length ? `<p class="soluk">Bu ilde PM2.5 ölçen istasyon yok.</p>` :
    `<table><thead><tr><th>İstasyon</th><th>Tür</th><th class="sayi">${tarihYaz(V.son_gun, false)} (µg/m³)</th><th class="sayi">Saat</th></tr></thead><tbody>` +
    ist.map((s) => `<tr><td>${esc(s.ad)}</td><td>${esc(s.tur || "—")}</td>
      <td class="sayi">${s.gecerli ? sayi(s.son_pm) : (s.son_saat ? `<span class="soluk">(${sayi(s.son_pm)})</span>` : "—")}</td>
      <td class="sayi">${s.son_saat}/24</td></tr>`).join("") +
    `</tbody></table><p class="soluk">Parantez içindeki değerler 18 saatten az ölçüme dayanır, il ortalamasına girmez.</p>`;
}

// ---------- listeler ----------
function ilDugme(p, ad) { return `<button type="button" data-il="${p}">${esc(ad)}</button>`; }
function listeler() {
  const son = gunler.length - 1;
  const olcen = V.iller.filter((i) => i.pm[son] != null).sort((a, b) => a.pm[son] - b.pm[son]);
  const satir = (i) => `<li>${ilDugme(i.plaka, i.ad)}<span class="deger">${sayi(sigara(i.pm[son]))} sigara · ${i.n[son]} ist.</span></li>`;
  $("#temiz").innerHTML = olcen.slice(0, 5).map(satir).join("");
  $("#kirli").innerHTML = olcen.slice(-5).reverse().map(satir).join("");

  const sirali = V.yillik.filter((y) => y.siralamada).sort((a, b) => b.ortalama - a.ortalama);
  const disari = V.yillik.filter((y) => !y.siralamada).sort((a, b) => b.ortalama - a.ortalama);
  $("#yillik-not").textContent = `En az ${kural.siralama_en_az_gun} geçerli günü olan ${sirali.length} il sıralandı; ` +
    `${disari.length} ilin verisi yetersiz (altta, sırasız). ${81 - V.yillik.length} ilde hiç PM2.5 ölçümü yok.`;
  const tr = (y, s) => `<tr class="secilebilir${y.plaka === secili ? " aktif" : ""}" data-il="${y.plaka}">
    <td class="sayi">${s ?? "—"}</td><td>${esc(y.ad)}</td><td class="sayi">${sayi(y.ortalama / kural.sigara_ugm3)}</td>
    <td class="sayi">${sayi(y.ortalama)}</td><td class="sayi">${y.gun}</td><td class="sayi">%${Math.round(100 * y.who_ustu_gun / y.gun)}</td></tr>`;
  $("#yillik-tablo").innerHTML = `<table><thead><tr><th class="sayi">#</th><th>İl</th><th class="sayi">Sigara/gün</th>
    <th class="sayi">µg/m³</th><th class="sayi">Geçerli gün</th><th class="sayi">WHO üstü</th></tr></thead><tbody>` +
    sirali.map((y, i) => tr(y, i + 1)).join("") + disari.map((y) => tr(y, null)).join("") + "</tbody></table>";

  $("#en-kotu").innerHTML = V.en_kotu_gunler.slice(0, 10).map((d) =>
    `<li>${ilDugme(d.plaka, d.ad)}, ${tarihYaz(d.tarih)}<span class="deger">${sayi(sigara(d.pm))} sigara · ${sayi(d.pm, 0)} µg/m³ · ${d.n} ist.</span></li>`).join("");
}

// ---------- paylaşım kartı ----------
function kartCiz() {
  const cv = $("#paylas-kart"), x = cv.getContext("2d"), S = 1080;
  const il = ilBul(secili), son = gunler.length - 1, pm = il.pm[son], s = sigara(pm);
  const font = (b, w = 600) => `${w} ${b}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  x.fillStyle = "#f6f5f2"; x.fillRect(0, 0, S, S);
  x.fillStyle = "#1b1a18"; x.font = font(54, 700); x.textBaseline = "alphabetic";
  x.fillText(`${il.ad} havası`, 80, 150);
  x.fillStyle = "#52514e"; x.font = font(36, 500); x.fillText(tarihYaz(gunler[son]), 80, 205);
  x.fillStyle = "#1b1a18"; x.font = font(230, 800);
  const metin = s == null ? "—" : sayi(s);
  x.fillText(metin, 70, 460);
  const gen = x.measureText(metin).width;
  x.font = font(64, 600); x.fillStyle = "#52514e"; x.fillText("sigara", 70 + gen + 24, 460);
  // sigaralar
  if (s != null) {
    const w = 168, h = 30, ara = 24, sut = 5, adet = Math.min(Math.ceil(s), 10);
    for (let i = 0; i < adet; i++) {
      const cx = 80 + (i % sut) * (w + ara), cy = 530 + Math.floor(i / sut) * (h + 22);
      const oran = i < Math.floor(s) ? 1 : s - Math.floor(s);
      x.setLineDash([8, 6]); x.strokeStyle = "#c9c6bd"; x.lineWidth = 2;
      if (oran < 1) x.strokeRect(cx, cy, w, h);
      x.setLineDash([]);
      x.save(); x.beginPath(); x.rect(cx, cy, w * oran, h); x.clip();
      x.fillStyle = "#e4e0d6"; x.fillRect(cx, cy, w * 0.78, h);
      x.fillStyle = "#eb6834"; x.fillRect(cx + w * 0.78, cy, w * 0.22, h);
      x.restore();
    }
  }
  x.fillStyle = "#1b1a18"; x.font = font(36, 500);
  x.fillText(pm == null ? "Bu gün için geçerli ölçüm yok." :
    `PM2.5 günlük ortalama ${sayi(pm)} µg/m³ · ${il.n[son]} istasyon`, 80, 680);
  if (pm != null) {
    x.fillStyle = "#52514e";
    x.fillText(pm > kural.who_24saat ? `WHO 24 saatlik yönergesinin ${sayi(pm / kural.who_24saat)} katı` : "WHO 24 saatlik yönergesinin altında", 80, 732);
  }
  // son 30 gün küçük grafik
  const n = Math.min(30, gunler.length), bas = gunler.length - n;
  const seri = il.pm.slice(bas).map(sigara);
  const enc = Math.max(1, ...seri.filter((v) => v != null)) * 1.05;
  const gx = 80, gy = 790, gw = 920, gh = 110, adim = gw / n;
  x.fillStyle = "#77756f"; x.font = font(24, 500); x.fillText("Son 30 gün", gx, gy - 14);
  seri.forEach((v, i) => {
    if (v == null) return;
    const bh = gh * v / enc;
    x.fillStyle = i === n - 1 ? "#9a3c14" : "#eb6834";
    x.fillRect(gx + i * adim + 2, gy + gh - bh, adim - 4, bh);
  });
  const wy = gy + gh - gh * (kural.who_24saat / kural.sigara_ugm3) / enc;
  x.strokeStyle = "#2a78d6"; x.lineWidth = 3; x.setLineDash([12, 9]);
  x.beginPath(); x.moveTo(gx, wy); x.lineTo(gx + gw, wy); x.stroke(); x.setLineDash([]);
  x.fillStyle = "#2a78d6"; x.font = font(22, 600); x.fillText("WHO", gx + gw - 60, wy - 8);
  x.fillStyle = "#77756f"; x.font = font(26, 400);
  x.fillText("Kaba benzetme, tıbbi ölçü değil: günlük 22 µg/m³ PM2.5 ≈ 1 sigara (Berkeley Earth).", 80, 975);
  x.fillText("Veri: ÇŞİDB Ulusal Hava Kalitesi İzleme Ağı" + (siteAdresi() ? " · " + siteAdresi() : ""), 80, 1015);
}
function siteAdresi() {
  const h = location.host;
  return /^(localhost|127\.|\[::1\])/.test(h) || !h ? "" : h + location.pathname.replace(/index\.html$/, "");
}
function dosyaAdi() {
  const il = ilBul(secili);
  return `hava-${il.ad.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/g, "-")}-${V.son_gun}.png`;
}
function paylasimDugmeleri() {
  $("#indir").onclick = () => {
    $("#paylas-kart").toBlob((b) => {
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(b), download: dosyaAdi() });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  };
  if (navigator.canShare) {
    $("#paylas").hidden = false;
    $("#paylas").onclick = () => $("#paylas-kart").toBlob(async (b) => {
      const dosya = new File([b], dosyaAdi(), { type: "image/png" });
      const veri = { files: [dosya], title: "Kaç sigara?", url: location.href };
      try { if (navigator.canShare(veri)) await navigator.share(veri); else await navigator.share({ url: location.href }); } catch (_) {}
    });
  }
  $("#baglanti").onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); $("#baglanti").textContent = "Kopyalandı"; }
    catch (_) { $("#baglanti").textContent = location.href; }
    setTimeout(() => { $("#baglanti").textContent = "Bağlantıyı kopyala"; }, 2000);
  };
}

// ---------- seçim ----------
function ilSec(p, kaydir = false) {
  if (!ilBul(p)) p = VARSAYILAN_IL;
  secili = p;
  $("#il-sec").value = String(p);
  history.replaceState(null, "", "#" + p);
  try { localStorage.setItem("hava-il", String(p)); } catch (_) {}
  kahramanCiz(); haritaVurgula(); grafik30(); grafikYil(); yilOzet(); kartCiz();
  document.querySelectorAll("#yillik-tablo tr[data-il]").forEach((r) => r.classList.toggle("aktif", +r.dataset.il === p));
  if (kaydir) $(".kahraman").scrollIntoView({ behavior: "smooth", block: "start" });
}

function baslangicIli() {
  const h = parseInt(location.hash.slice(1), 10);
  if (h) return h;
  try { const k = parseInt(localStorage.getItem("hava-il"), 10); if (k) return k; } catch (_) {}
  return VARSAYILAN_IL;
}

async function basla() {
  try {
    [V, G] = await Promise.all([fetch("veri/veri.json").then((r) => r.json()), fetch("veri/iller.geojson").then((r) => r.json())]);
  } catch (e) {
    $("#kahraman-icerik").innerHTML = `<p>Veri yüklenemedi.</p>`;
    return;
  }
  kural = V.kurallar;
  gunler = gunListesi(V.ilk_gun, V.son_gun);
  const sec = $("#il-sec");
  sec.innerHTML = [...V.iller].sort((a, b) => a.ad.localeCompare(b.ad, "tr")).map((i) =>
    `<option value="${i.plaka}">${esc(i.ad)}${i.istasyon ? (i.aktif ? "" : " (son 30 günde veri yok)") : " (istasyon yok)"}</option>`).join("");
  sec.onchange = () => ilSec(+sec.value);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-il]");
    if (b && !e.target.closest("select")) ilSec(+b.dataset.il, true);
  });
  window.addEventListener("hashchange", () => { const h = parseInt(location.hash.slice(1), 10); if (h && h !== secili) ilSec(h); });
  $("#guncelleme").textContent = new Date(V.guncelleme).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });
  haritaCiz(); listeler(); grafikMevsim(); paylasimDugmeleri();
  ilSec(baslangicIli());
  let zaman;
  window.addEventListener("resize", () => { clearTimeout(zaman); zaman = setTimeout(() => { grafik30(); grafikYil(); grafikMevsim(); }, 150); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { haritaCiz(); listeler(); ilSec(secili); });
}
basla();
