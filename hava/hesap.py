"""Saatlik PM2.5 -> istasyon günlük ortalaması -> il günlük ortalaması -> sigara eşdeğeri.

Kurallar (README'de de yazılı):
- Geçersiz saatlik değer: boş, 0'dan küçük veya 1000 µg/m³'ten büyük.
- İstasyon günü geçerli: 24 saatin en az 18'inde (%75) geçerli değer var.
- İl günü = o gün geçerli olan istasyon ortalamalarının basit ortalaması.
- Sigara = günlük ortalama PM2.5 / 22 (Berkeley Earth, Muller & Muller 2015).
"""
from collections import defaultdict
from statistics import mean

EN_AZ_SAAT = 18
UST_SINIR = 1000.0
SIGARA_UGM3 = 22.0
WHO_24SAAT = 15.0


def gecerli_deger(v):
    return v is not None and 0 <= v <= UST_SINIR


def gunluk_istasyon(saatlik):
    """saatlik: [(ReadTime 'YYYY-MM-DDTHH:MM:SS', istasyon_id, deger)].

    Dönen: {(tarih, istasyon_id): (saat_sayisi, ortalama|None, en_dusuk|None, en_yuksek|None)}.
    Aynı istasyon-saat iki kez gelirse sonuncusu kullanılır.
    """
    saatler = {}
    for zaman, ist, v in saatlik:
        saatler[(zaman[:13], ist)] = v
    gruplar = defaultdict(list)
    gorulen = set()
    for (saat, ist), v in saatler.items():
        anahtar = (saat[:10], ist)
        gorulen.add(anahtar)
        if gecerli_deger(v):
            gruplar[anahtar].append(float(v))
    sonuc = {}
    for anahtar in gorulen:
        d = gruplar.get(anahtar, [])
        if d:
            sonuc[anahtar] = (len(d), round(mean(d), 2), round(min(d), 1), round(max(d), 1))
        else:
            sonuc[anahtar] = (0, None, None, None)
    return sonuc


def il_gunluk(gunluk, istasyon_il):
    """gunluk: {(tarih, ist): (n, ort, ...)}, istasyon_il: {ist: plaka}.

    Dönen: {(tarih, plaka): (il_ortalamasi, gecerli_istasyon_sayisi)}; geçerli istasyonu
    olmayan il-günler dönmez.
    """
    kova = defaultdict(list)
    for (tarih, ist), (n, ort, *_ ) in gunluk.items():
        p = istasyon_il.get(ist)
        if p is None or ort is None or n < EN_AZ_SAAT:
            continue
        kova[(tarih, p)].append(ort)
    return {k: (round(mean(v), 2), len(v)) for k, v in kova.items()}


def sigara(pm25):
    return None if pm25 is None else round(pm25 / SIGARA_UGM3, 2)
