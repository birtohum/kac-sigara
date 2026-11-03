"""Çevre, Şehircilik ve İklim Değişikliği Bakanlığı SİM (sim.csb.gov.tr) istemcisi.

Kullanılan iki uç nokta, sitenin herkese açık sayfalarının kendi çağırdığı adreslerdir:
- /Services/GetAirQualityStations : istasyon listesi ve ölçtükleri parametreler
- /STN/STN_Report/StationDataDownloadNewData : "İstasyon Veri İndirme" formu (saatlik veri)

Nazik çekme: tek oturum, istekler arka arkaya değil arada bekleme ile, tek istekte
en çok bir aylık aralık.
"""
import re
import time
from datetime import date, datetime, timedelta

import requests

TABAN = "https://sim.csb.gov.tr"
KIMLIK = "hava-sigara/1.0 (acik veri projesi; github.com/birtohum)"
BEKLEME_SN = 3


class Kaynak:
    def __init__(self, bekleme=BEKLEME_SN):
        self.oturum = requests.Session()
        self.oturum.headers["User-Agent"] = KIMLIK
        self.bekleme = bekleme
        self._jeton = None
        self._son_istek = 0.0

    def _bekle(self):
        gecen = time.time() - self._son_istek
        if gecen < self.bekleme:
            time.sleep(self.bekleme - gecen)
        self._son_istek = time.time()

    def _istek(self, yontem, yol, deneme=3, **kw):
        for i in range(deneme):
            self._bekle()
            try:
                r = self.oturum.request(yontem, TABAN + yol, timeout=300, **kw)
                r.raise_for_status()
                return r
            except requests.RequestException:
                if i == deneme - 1:
                    raise
                time.sleep(30 * (i + 1))

    def istasyonlar(self):
        """Tüm hava kalitesi istasyonları (ham sözlükler)."""
        r = self._istek("POST", "/Services/GetAirQualityStations?type=0")
        j = r.json()
        if not j.get("result"):
            raise RuntimeError(f"istasyon listesi alınamadı: {j.get('message')}")
        return j["objects"]

    def _jeton_al(self):
        r = self._istek("GET", "/STN/STN_Report/StationDataDownloadNew")
        m = re.search(r'name="__RequestVerificationToken" type="hidden" value="([^"]+)"', r.text)
        if not m:
            raise RuntimeError("indirme formunda doğrulama jetonu bulunamadı")
        self._jeton = m.group(1)

    def saatlik(self, istasyon_idleri, baslangic: datetime, bitis: datetime, parametre="PM25"):
        """[baslangic, bitis] arası saatlik ölçümler: [(ReadTime, istasyon_id, deger|None)]."""
        if self._jeton is None:
            self._jeton_al()
        veri = [("__RequestVerificationToken", self._jeton), ("StationType", "1")]
        veri += [("StationIds", i) for i in istasyon_idleri]
        veri += [
            ("Parameters", parametre),
            ("DataPeriods", "8"),  # 8 = saatlik, 16 = günlük
            ("StartDateTime", baslangic.strftime("%d.%m.%Y %H:%M")),
            ("EndDateTime", bitis.strftime("%d.%m.%Y %H:%M")),
        ]
        r = self._istek("POST", "/STN/STN_Report/StationDataDownloadNewData", data=veri,
                        headers={"X-Requested-With": "XMLHttpRequest"})
        j = r.json()
        if not j.get("Result"):
            raise RuntimeError(f"veri alınamadı: {j.get('FeedBack')}")
        satirlar = (j.get("Object") or {}).get("Data") or []
        return [(s["ReadTime"], s["Stationid"], s.get(parametre)) for s in satirlar]


def aylik_parcalar(bas: date, bit: date):
    """[bas, bit] gün aralığını takvim ayı sınırlarında böler: [(gün0, gün1)]."""
    parcalar = []
    g = bas
    while g <= bit:
        ay_sonu = (g.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        son = min(ay_sonu, bit)
        parcalar.append((g, son))
        g = son + timedelta(days=1)
    return parcalar
