"""SİM'den PM2.5 ölçen istasyonları ve saatlik veriyi çekip günlük ortalamaları depoya yazar.

Kullanım:
  python cek.py                      # son 7 günü (dün dahil) yeniden çek
  python cek.py --gun 30
  python cek.py --baslangic 2025-11-01 --bitis 2026-11-02
"""
import argparse
import re
import sys
from datetime import date, datetime, timedelta, timezone

from hava import depo
from hava.hesap import gunluk_istasyon
from hava.iller import ILLER, plaka
from hava.kaynak import Kaynak, aylik_parcalar

TR = timezone(timedelta(hours=3))  # Türkiye 2016'dan beri sürekli UTC+3


def bugun_tr():
    return datetime.now(TR).date()


def _konum(nokta):
    m = re.match(r"POINT \(([-\d.]+) ([-\d.]+)\)", nokta or "")
    return (round(float(m.group(2)), 5), round(float(m.group(1)), 5)) if m else ("", "")


def istasyonlari_guncelle(kaynak, bugun):
    eski = depo.istasyonlari_oku()
    ham = kaynak.istasyonlar()
    pm = [s for s in ham if "PM25" in ((s.get("Config") or {}).get("parameters") or "").split(",")]
    for s in pm:
        p = plaka(s.get("City_Title"))
        if p is None:
            print(f"uyarı: il eşleşmedi: {s.get('City_Title')!r} ({s.get('Name')})", file=sys.stderr)
        enlem, boylam = _konum(s.get("Location"))
        onceki = eski.get(s["id"], {})
        eski[s["id"]] = {
            "id": s["id"], "kod": s.get("Code") or "", "ad": s.get("Name") or "",
            "il": ILLER.get(p, s.get("City_Title") or ""), "plaka": p or "",
            "ilce": s.get("Town_Title") or "", "tur": s.get("SubType_Title") or "",
            "enlem": enlem, "boylam": boylam, "kurum": s.get("Company_Title") or "",
            "ilk_gorulme": onceki.get("ilk_gorulme") or bugun.isoformat(),
            "son_gorulme": bugun.isoformat(),
        }
    depo.istasyonlari_yaz(eski)
    print(f"{len(ham)} istasyon, {len(pm)} tanesi PM2.5 ölçüyor; kayıtlı toplam {len(eski)}")
    return eski


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--gun", type=int, default=7)
    ap.add_argument("--baslangic", type=date.fromisoformat)
    ap.add_argument("--bitis", type=date.fromisoformat)
    a = ap.parse_args(argv)

    bugun = bugun_tr()
    bitis = a.bitis or (bugun - timedelta(days=1))
    baslangic = a.baslangic or (bitis - timedelta(days=a.gun - 1))

    kaynak = Kaynak()
    istasyonlar = istasyonlari_guncelle(kaynak, bugun)
    idler = sorted(istasyonlar)
    gunluk = depo.gunlugu_oku()

    for g0, g1 in aylik_parcalar(baslangic, bitis):
        saatlik = kaynak.saatlik(idler, datetime(g0.year, g0.month, g0.day, 0),
                                 datetime(g1.year, g1.month, g1.day, 23))
        yeni = gunluk_istasyon(saatlik)
        # bu aralıktaki eski kayıtları at, yenisini koy (kaynakta sonradan yapılan düzeltmeler için)
        aralik = {(g0 + timedelta(days=i)).isoformat() for i in range((g1 - g0).days + 1)}
        gunluk = {k: v for k, v in gunluk.items() if k[0] not in aralik}
        gunluk.update({k: v for k, v in yeni.items() if v[0] > 0 and k[0] in aralik})
        dolu = sum(1 for v in yeni.values() if v[0] > 0)
        print(f"{g0}..{g1}: {len(saatlik)} saatlik satır, {dolu} dolu istasyon-gün")
        depo.gunlugu_yaz(gunluk)


if __name__ == "__main__":
    main()
