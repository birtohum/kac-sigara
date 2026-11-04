# Günlük güncelleme, bu bilgisayardan (Windows zamanlanmış görevi "kac-sigara gunluk").
# Bakanlık sunucusu GitHub Actions makinelerinden bağlantıyı yanıtlamadığı için veri buradan çekilir;
# değişiklik varsa commit edilip gönderilir, site yayin.yml ile yeniden yayımlanır.
Set-Location $PSScriptRoot
$env:PYTHONIOENCODING = "utf-8"
Start-Transcript -Append -Path (Join-Path $PSScriptRoot "yerel_guncelle.log") | Out-Null
try {
    git pull --ff-only -q
    .\.venv\Scripts\python.exe cek.py --gun 7
    if ($LASTEXITCODE -ne 0) { throw "cek.py başarısız ($LASTEXITCODE)" }
    .\.venv\Scripts\python.exe hesapla.py
    if ($LASTEXITCODE -ne 0) { throw "hesapla.py başarısız ($LASTEXITCODE)" }
    git add veri site/veri
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit -q -m ("Veri: " + (Get-Date).AddDays(-1).ToString("yyyy-MM-dd") + " (yerel görev)")
        git push -q
        if ($LASTEXITCODE -ne 0) { throw "git push başarısız" }
    } else { "değişiklik yok" }
} catch { "HATA: $_" } finally { Stop-Transcript | Out-Null }
