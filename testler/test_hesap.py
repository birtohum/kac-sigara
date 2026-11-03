from datetime import date

from hava.hesap import EN_AZ_SAAT, gunluk_istasyon, il_gunluk, sigara
from hava.iller import ILLER, plaka
from hava.kaynak import aylik_parcalar
from hesapla import ozet_uret


def saatler(gun, ist, degerler):
    return [(f"{gun}T{h:02d}:00:00", ist, v) for h, v in enumerate(degerler)]


def test_gecersiz_degerler_sayilmaz():
    g = gunluk_istasyon(saatler("2026-01-01", "a", [10] * 20 + [None, -1, 2000, 30]))
    assert g[("2026-01-01", "a")] == (21, round((200 + 30) / 21, 2), 10.0, 30.0)


def test_eksik_gun_il_ortalamasina_girmez():
    veri = saatler("2026-01-01", "a", [44] * EN_AZ_SAAT + [None] * 6)
    veri += saatler("2026-01-01", "b", [100] * (EN_AZ_SAAT - 1) + [None] * 7)
    g = gunluk_istasyon(veri)
    assert il_gunluk(g, {"a": 6, "b": 6}) == {("2026-01-01", 6): (44.0, 1)}


def test_il_ortalamasi_istasyonlarin_ortalamasi():
    veri = saatler("2026-01-01", "a", [10] * 24) + saatler("2026-01-01", "b", [30] * 24)
    assert il_gunluk(gunluk_istasyon(veri), {"a": 34, "b": 34})[("2026-01-01", 34)] == (20.0, 2)


def test_tekrarlanan_saat_son_deger():
    veri = saatler("2026-01-01", "a", [10] * 24) + [("2026-01-01T05:00:00", "a", 34)]
    assert gunluk_istasyon(veri)[("2026-01-01", "a")][1] == round((230 + 34) / 24, 2)


def test_sigara():
    assert sigara(22) == 1.0
    assert sigara(None) is None


def test_il_adlari():
    assert len(ILLER) == 81
    assert plaka("İstanbul") == 34 and plaka("ISTANBUL") == 34
    assert plaka("Kahramanmaraş") == 46 and plaka("Hakkâri") == 30 and plaka("Iğdır") == 76
    assert all(plaka(a) == k for k, a in ILLER.items())


def test_aylik_parcalar():
    assert aylik_parcalar(date(2025, 12, 30), date(2026, 2, 3)) == [
        (date(2025, 12, 30), date(2025, 12, 31)), (date(2026, 1, 1), date(2026, 1, 31)),
        (date(2026, 2, 1), date(2026, 2, 3))]


def test_ozet_bosluklu_seri():
    g = gunluk_istasyon(saatler("2026-01-01", "a", [22] * 24) + saatler("2026-01-03", "a", [44] * 24))
    ist = {"a": {"plaka": "6", "ad": "A", "ilce": "", "tur": "", "enlem": "", "boylam": ""}}
    o = ozet_uret(g, ist)
    ankara = next(il for il in o["iller"] if il["plaka"] == 6)
    assert ankara["pm"] == [22.0, None, 44.0] and ankara["n"] == [1, 0, 1]
    y = o["yillik"][0]
    assert y["gun"] == 2 and y["bu_yil_sigara"] == 3 and not y["siralamada"]
    assert o["en_kotu_gunler"][0]["tarih"] == "2026-01-03"
