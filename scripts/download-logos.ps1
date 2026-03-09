# Download logos/favicons das lojas para public/logos/
# Usa API de favicon do Google (128px)

$logosDir = Join-Path $PSScriptRoot "..\public\logos"
if (-not (Test-Path $logosDir)) { New-Item -ItemType Directory -Path $logosDir -Force }

$domains = @{
  amazon = 'amazon.co.jp'
  qoo10 = 'qoo10.jp'
  amiami = 'amiami.com'
  aniplex = 'aniplexplus.com'
  pokemoncenter = 'pokemoncenter-online.com'
  hareruya = 'hareruya2.com'
  yuyutei = 'yuyu-tei.jp'
  sanrio = 'sanrio.co.jp'
  studioghibli = 'donguri-sora.com'
  mandarake = 'mandarake.co.jp'
  rakuma = 'fril.jp'
  mercari = 'jp.mercari.com'
  yahoofleamarket = 'yahoo.co.jp'
  uniqlo = 'uniqlo.com'
  skrndnk = 'skrndnk.com'
}

foreach ($id in $domains.Keys) {
  $domain = $domains[$id]
  $url = "https://www.google.com/s2/favicons?domain=$domain&sz=128"
  $outFile = Join-Path $logosDir "$id.png"
  try {
    Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing -ErrorAction Stop
    Write-Host "OK: $id"
  } catch {
    Write-Host "FAIL: $id - $_"
  }
}
