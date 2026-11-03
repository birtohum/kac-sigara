# Şehrinin havası kaç sigaraya eşit?

Türkiye'deki hava kalitesi istasyonlarının PM2.5 ölçümlerinden, her il için günlük
"sigara eşdeğeri" gösteren statik bir site. Veri her gece GitHub Actions ile çekilir,
depoya CSV/JSON olarak yazılır ve site yeniden yayımlanır.

Sitede: il il son tam günün haritası, seçili il için son 30 gün ve son 1 yıl grafiği
(WHO 24 saatlik yönergesi referans çizgisiyle), takvim yılı toplamı, son tam günün en
temiz/en kirli illeri, son 365 günün sıralaması, en kötü il-günler, aylık mevsimsellik
ve paylaşmak için tarayıcıda üretilen tek kartlık görsel.

## Kaynak

- **T.C. Çevre, Şehircilik ve İklim Değişikliği Bakanlığı, Ulusal Hava Kalitesi İzleme Ağı**
  ([sim.csb.gov.tr](https://sim.csb.gov.tr/Services/AirQuality)).
  - İstasyon listesi: `POST /Services/GetAirQualityStations?type=0` (haritalı sayfanın kendi kullandığı adres).
  - Saatlik veri: sitenin herkese açık "İstasyon Veri İndirme" formu
    (`/STN/STN_Report/StationDataDownloadNew` → `StationDataDownloadNewData`), PM2.5, saatlik periyot.
- Sitede ayrı bir kullanım şartları sayfası ve `robots.txt` bulamadım (`/robots.txt` ana
  sayfayı döndürüyor). Veri kamuya açık sunuluyor; yine de nazik çekiyorum: tek oturum,
  istekler arasında en az 3 saniye, tek istekte en fazla bir takvim ayı. Günlük iş son 7
  günü tek istekte (~1,5 MB) alır; geçmiş bir yıl 13 istekle (ay başına ~15 MB) alındı.
- `havaizleme.gov.tr` bu makineden yanıt vermedi; OpenAQ v3 API anahtarı istiyor ve
  Türkiye verisini zaten bu ağdan aldığı için yedek olarak eklemedim. Bakanlık adresi
  değişirse ya da yurt dışı IP'leri engellerse (GitHub Actions ABD'den çalışır) iş hata
  verir; o durumda yerelde zamanlanmış görevle çalıştırmak gerekir.

## Yöntem

1. **Saatlik değerler.** Boş, 0'dan küçük ya da 1000 µg/m³'ten büyük değerler geçersiz sayılır.
   Saat etiketi kaynaktaki gibi Türkiye saatidir (UTC+3); gün 00:00–23:00 etiketli 24 saattir.
2. **İstasyon günü.** 24 saatin en az 18'inde (%75) geçerli değer varsa günlük ortalama
   hesaplanır; yoksa o istasyon o gün yok sayılır.
3. **İl günü.** O gün geçerli olan istasyonların günlük ortalamalarının basit ortalaması.
   Sitede her değerin yanında kaç istasyondan geldiği yazar. Geçerli istasyonu olmayan
   il o gün boş (gri) kalır; tahmin ya da komşu ilden doldurma yok.
4. **Sigara eşdeğeri.** `sigara = günlük ortalama PM2.5 / 22`. Kaynak: Berkeley Earth,
   R. A. Muller & E. A. Muller (2015), [Air Pollution and Cigarette Equivalence](https://berkeleyearth.org/air-pollution-and-cigarette-equivalence/):
   22 µg/m³'e bir gün maruz kalmanın ölüm riskine etkisi kabaca günde bir sigaraya denk.
5. **Referans.** WHO 2021 hava kalitesi yönergesi, PM2.5 24 saatlik: 15 µg/m³ (≈ 0,7 sigara).
6. **Özetler.**
   - Son 365 gün sıralaması: ölçümlü günlerin ortalaması; en az 183 geçerli günü olan iller sıralanır, diğerleri "yetersiz veri" olarak altta.
   - "Bu yıl toplam": takvim yılında yalnızca ölçümlü günlerin sigara toplamı, kaç gün olduğu yanında.
   - Mevsimsellik: her ay, tüm il-günlerin ortalaması (her il-gün eşit ağırlıkta; ölçen il sayısı aydan aya değişir).
   - 1 yıllık grafikteki kalın çizgi: 30 günlük hareketli ortalama, penceredeki en az 15 geçerli günle.

## Veri kapsamı

`python kapsam.py` çıktısı (çekim tarihi 3 Kasım 2026, dönem 1 Kasım 2025 – 2 Kasım 2026):

- Dönem: 2025-11-01..2026-11-02 (367 gün)
- PM2.5 ölçen kayıtlı istasyon: 210, il: 72
- İstasyon-gün: olası 77070, en az 1 saat veri 49002 (%64), geçerli (>= 18 saat) 45056 (%58)
- İstasyon başına geçerli gün oranı: medyan %78, %90 üstü 78 istasyon, hiç geçerli günü olmayan 59
- En az bir geçerli günü olan istasyon: 151, il: 61
- Günde geçerli ölçümü olan il sayısı: en az 39, medyan 52, en çok 59

Kısaca: kayıtlarda PM2.5 ölçtüğü yazan 210 istasyonun 59'u bu dönemde hiç geçerli gün üretmedi (çoğu PM2.5 cihazı tanımlı ama veri göndermiyor). Bir günde ortalama 52 ilde, hiçbir günde 59'dan fazla ilde geçerli PM2.5 ölçümü yok; 81 ilin 20'si yıl boyunca hiç görünmüyor.

## Sınırlar

- **Benzetme kabadır.** Sigara sayısı bir iletişim aracıdır, tıbbi ya da kişisel bir maruziyet
  ölçüsü değildir. Kişinin iç mekânda geçirdiği zamanı, sigaranın PM2.5 dışındaki etkilerini,
  yaş ve sağlık durumunu hesaba katmaz. Kural, uzun dönem maruziyet çalışmalarından türetilmiş
  bir ortalamayı günlük değere uygular.
- **İstasyonlar ili temsil etmeyebilir.** Bazıları trafik, sanayi ya da ısınma kaynaklarının
  yanına kurulmuş (istasyon türü sitede yazar), bazıları tesis işletmelerine ait (ör. termik
  santral, demir-çelik). Tek istasyonlu illerde değer o noktanın değeridir. İller arası
  karşılaştırma bu yüzden dikkatle okunmalı.
- **İstasyon listesi bugünkü listedir.** Geçmişte kapanmış ve listeden çıkmış istasyonlar
  geriye dönük çekime dahil değil.
- **Son günler kesin değil.** Kaynak, doğrulama sonrasında geçmiş değerleri değiştirebiliyor;
  günlük iş son 7 günü her gece yeniden çeker, daha eski düzeltmeler ancak elle
  `python cek.py --baslangic ... --bitis ...` ile alınır.
- **Saat etiketi.** Kaynağın saat etiketinin ölçüm saatinin başını mı sonunu mu gösterdiği
  belgelenmemiş; gün sınırında bir saatlik kayma olabilir.
- 81 ilin bir kısmında PM2.5 ölçen istasyon yok; bu iller haritada gri.

## Çalıştırma

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt pytest   # Windows; Linux/macOS: .venv/bin/pip
python cek.py                     # son 7 gün (varsayılan)
python cek.py --baslangic 2025-11-01 --bitis 2026-11-02   # geriye dönük
python hesapla.py                 # site/veri/veri.json
python kapsam.py                  # kapsam raporu
python -m pytest -q
python -m http.server 8000 --directory site
```

Harita sınırları bir kez `harita_hazirla.py` ile Natural Earth 1:10m il sınırlarından
(kamu malı) sadeleştirilerek üretildi (`shapely` gerekir); günlük iş bunu kullanmaz.

## Dosyalar

| Yol | İçerik |
|---|---|
| `veri/istasyonlar.csv` | PM2.5 ölçen istasyonlar: kod, ad, il, tür, konum, işleten kurum |
| `veri/gunluk_istasyon.csv` | istasyon × gün: geçerli saat sayısı, ortalama, en düşük, en yüksek (yalnızca en az 1 saat verisi olanlar) |
| `site/veri/veri.json` | sitenin okuduğu özet (il günlük serileri, sıralamalar) |
| `site/veri/iller.geojson` | sadeleştirilmiş il sınırları |
| `.github/workflows/gunluk.yml` | her gece 03:40'ta çek → hesapla → commit → Pages'e yayımla |

Günlük istasyon ortalamaları saklandığı için %75 kuralı ya da il ortalaması yöntemi
değiştirilirse ham veriyi yeniden çekmeden yeniden hesaplanabilir (saat sayısı kayıtlı).

## Yayın

Depo GitHub'a gönderildikten sonra: Settings → Pages → Source: **GitHub Actions**.
İş her gece çalışır; elle çalıştırmak için Actions → "Günlük güncelleme" → Run workflow.
