"""Veri kapsamı raporu: kaç istasyon PM2.5 ölçüyor, istasyon-günlerin ne kadarı geçerli."""
from collections import Counter, defaultdict
from datetime import date, timedelta

from hava import depo
from hava.hesap import EN_AZ_SAAT


def main():
    ist = depo.istasyonlari_oku()
    gun = depo.gunlugu_oku()
    tarihler = sorted({t for t, _ in gun})
    ilk, son = date.fromisoformat(tarihler[0]), date.fromisoformat(tarihler[-1])
    gun_sayisi = (son - ilk).days + 1
    olasi = len(ist) * gun_sayisi
    veri_var = len(gun)
    gecerli = sum(1 for v in gun.values() if v[0] >= EN_AZ_SAAT)
    print(f"Dönem: {ilk}..{son} ({gun_sayisi} gün)")
    print(f"PM2.5 ölçen kayıtlı istasyon: {len(ist)}, il: {len({s['plaka'] for s in ist.values()})}")
    print(f"İstasyon-gün: olası {olasi}, en az 1 saat veri {veri_var} (%{100*veri_var/olasi:.0f}), "
          f"geçerli (>= {EN_AZ_SAAT} saat) {gecerli} (%{100*gecerli/olasi:.0f})")
    ist_gecerli = Counter(i for (t, i), v in gun.items() if v[0] >= EN_AZ_SAAT)
    oranlar = sorted(ist_gecerli.get(i, 0) / gun_sayisi for i in ist)
    hic = sum(1 for o in oranlar if o == 0)
    print(f"İstasyon başına geçerli gün oranı: medyan %{100*oranlar[len(oranlar)//2]:.0f}, "
          f"%90 üstü {sum(o >= .9 for o in oranlar)} istasyon, hiç geçerli günü olmayan {hic}")
    print(f"En az bir geçerli günü olan istasyon: {len(ist) - hic}, il: "
          f"{len({ist[i]['plaka'] for i in ist_gecerli if i in ist})}")
    il_gun = defaultdict(set)
    for (t, i), v in gun.items():
        if v[0] >= EN_AZ_SAAT and ist.get(i, {}).get("plaka"):
            il_gun[t].add(ist[i]["plaka"])
    sayilar = [len(il_gun.get((ilk + timedelta(days=k)).isoformat(), ())) for k in range(gun_sayisi)]
    print(f"Günde geçerli ölçümü olan il sayısı: en az {min(sayilar)}, medyan {sorted(sayilar)[len(sayilar)//2]}, "
          f"en çok {max(sayilar)}")
    print("Saatlik değerlerin geçersiz sayılma kuralı: boş, < 0 veya > 1000 µg/m³")


if __name__ == "__main__":
    main()
