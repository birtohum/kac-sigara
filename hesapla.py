"""Depodaki günlük istasyon verisinden sitenin okuduğu site/veri/veri.json'u üretir."""
import json
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import mean

from hava import depo
from hava.hesap import EN_AZ_SAAT, SIGARA_UGM3, WHO_24SAAT, il_gunluk
from hava.iller import ILLER

HEDEF = depo.KOK / "site" / "veri" / "veri.json"
YIL_GUN = 365
SIRALAMA_EN_AZ_GUN = 183  # yıllık sıralamaya girmek için son 365 günün en az yarısı


def ozet_uret(gunluk, istasyonlar, simdi=None):
    simdi = simdi or datetime.now(timezone.utc)
    ist_il = {i: int(s["plaka"]) for i, s in istasyonlar.items() if s["plaka"]}
    ilg = il_gunluk(gunluk, ist_il)
    if not ilg:
        raise RuntimeError("hesaplanacak veri yok")
    tarihler = sorted({t for t, _ in ilg})
    ilk, son = date.fromisoformat(tarihler[0]), date.fromisoformat(tarihler[-1])
    gunler = [(ilk + timedelta(days=i)).isoformat() for i in range((son - ilk).days + 1)]
    yil_bas = (son - timedelta(days=YIL_GUN - 1)).isoformat()
    takvim_yili = f"{son.year}-01-01"

    ist_sayisi = defaultdict(int)
    for s in istasyonlar.values():
        if s["plaka"]:
            ist_sayisi[int(s["plaka"])] += 1
    # son 30 günde en az bir geçerli günü olan istasyonlar
    otuz_bas = (son - timedelta(days=29)).isoformat()
    aktif_ist = {i for (t, i), v in gunluk.items() if t >= otuz_bas and v[0] >= EN_AZ_SAAT}
    aktif = defaultdict(int)
    for i in aktif_ist:
        if i in ist_il:
            aktif[ist_il[i]] += 1

    iller, yillik, en_kotu = [], [], []
    aylik = defaultdict(list)
    for p, ad in ILLER.items():
        pm = [ilg.get((g, p), (None, 0))[0] for g in gunler]
        n = [ilg.get((g, p), (None, 0))[1] for g in gunler]
        iller.append({"plaka": p, "ad": ad, "istasyon": ist_sayisi.get(p, 0), "aktif": aktif.get(p, 0), "pm": pm, "n": n})
        son_yil = [(g, v) for g, v in zip(gunler, pm) if v is not None and g >= yil_bas]
        bu_yil = [v for g, v in zip(gunler, pm) if v is not None and g >= takvim_yili]
        for g, v in zip(gunler, pm):
            if v is not None:
                aylik[g[:7]].append(v)
        if son_yil:
            degerler = [v for _, v in son_yil]
            yillik.append({
                "plaka": p, "ad": ad, "gun": len(son_yil), "ortalama": round(mean(degerler), 1),
                "who_ustu_gun": sum(v > WHO_24SAAT for v in degerler),
                "siralamada": len(son_yil) >= SIRALAMA_EN_AZ_GUN,
                "bu_yil_sigara": round(sum(v / SIGARA_UGM3 for v in bu_yil)),
                "bu_yil_gun": len(bu_yil),
            })
            en_kotu.extend({"plaka": p, "ad": ad, "tarih": g, "pm": v, "n": ilg[(g, p)][1]}
                           for g, v in son_yil)
    en_kotu.sort(key=lambda x: -x["pm"])
    mevsim = [{"ay": a, "ortalama": round(mean(v), 1), "il_gun": len(v)}
              for a, v in sorted(aylik.items()) if a >= yil_bas[:7]]

    istasyon_listesi = defaultdict(list)
    for i, s in istasyonlar.items():
        if not s["plaka"]:
            continue
        n, ort, *_ = gunluk.get((son.isoformat(), i), (0, None))
        istasyon_listesi[int(s["plaka"])].append({
            "ad": s["ad"], "ilce": s["ilce"], "tur": s["tur"],
            "enlem": float(s["enlem"]) if s["enlem"] else None,
            "boylam": float(s["boylam"]) if s["boylam"] else None,
            "son_pm": ort, "son_saat": n, "gecerli": n >= EN_AZ_SAAT})

    return {
        "guncelleme": simdi.isoformat(timespec="minutes"),
        "ilk_gun": gunler[0], "son_gun": gunler[-1],
        "kurallar": {"en_az_saat": EN_AZ_SAAT, "sigara_ugm3": SIGARA_UGM3, "who_24saat": WHO_24SAAT,
                     "siralama_en_az_gun": SIRALAMA_EN_AZ_GUN},
        "iller": iller,
        "yillik": sorted(yillik, key=lambda x: x["ortalama"]),
        "en_kotu_gunler": en_kotu[:15],
        "mevsim": mevsim,
        "istasyonlar": {str(k): sorted(v, key=lambda x: x["ad"]) for k, v in istasyon_listesi.items()},
    }


def main():
    ozet = ozet_uret(depo.gunlugu_oku(), depo.istasyonlari_oku())
    HEDEF.parent.mkdir(parents=True, exist_ok=True)
    HEDEF.write_text(json.dumps(ozet, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    olcen = sum(1 for il in ozet["iller"] if il["pm"][-1] is not None)
    print(f"{HEDEF.name}: {ozet['ilk_gun']}..{ozet['son_gun']}, son günde {olcen} ilde geçerli ölçüm, "
          f"{HEDEF.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
