"""Depodaki CSV dosyaları: veri/istasyonlar.csv ve veri/gunluk_istasyon.csv."""
import csv
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
VERI = KOK / "veri"
ISTASYONLAR = VERI / "istasyonlar.csv"
GUNLUK = VERI / "gunluk_istasyon.csv"

IST_ALANLAR = ["id", "kod", "ad", "il", "plaka", "ilce", "tur", "enlem", "boylam", "kurum",
               "ilk_gorulme", "son_gorulme"]
GUN_ALANLAR = ["tarih", "istasyon_id", "saat_sayisi", "ortalama", "en_dusuk", "en_yuksek"]


def _yaz(yol, alanlar, satirlar):
    yol.parent.mkdir(parents=True, exist_ok=True)
    gecici = yol.with_suffix(".tmp")
    with open(gecici, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=alanlar, lineterminator="\n")
        w.writeheader()
        w.writerows(satirlar)
    gecici.replace(yol)


def istasyonlari_oku():
    if not ISTASYONLAR.exists():
        return {}
    with open(ISTASYONLAR, encoding="utf-8") as f:
        return {s["id"]: s for s in csv.DictReader(f)}


def istasyonlari_yaz(istasyonlar):
    satirlar = sorted(istasyonlar.values(), key=lambda s: (int(s["plaka"] or 0), s["ad"]))
    _yaz(ISTASYONLAR, IST_ALANLAR, satirlar)


def gunlugu_oku():
    """{(tarih, ist): (n, ort, min, max)}"""
    if not GUNLUK.exists():
        return {}
    sonuc = {}
    with open(GUNLUK, encoding="utf-8") as f:
        for s in csv.DictReader(f):
            sayi = lambda x: float(x) if x != "" else None
            sonuc[(s["tarih"], s["istasyon_id"])] = (
                int(s["saat_sayisi"]), sayi(s["ortalama"]), sayi(s["en_dusuk"]), sayi(s["en_yuksek"]))
    return sonuc


def gunlugu_yaz(gunluk):
    bos = lambda x: "" if x is None else x
    satirlar = [
        {"tarih": t, "istasyon_id": i, "saat_sayisi": n, "ortalama": bos(o),
         "en_dusuk": bos(a), "en_yuksek": bos(b)}
        for (t, i), (n, o, a, b) in sorted(gunluk.items())
    ]
    _yaz(GUNLUK, GUN_ALANLAR, satirlar)
