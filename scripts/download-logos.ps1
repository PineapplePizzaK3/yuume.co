# Download logos/favicons das lojas para public/logos/
# Usa API de favicon do Google (256px - mínimo 120x120 para exibição)
# IMPORTANTE: Por padrão NÃO sobrescreve arquivos existentes (preserva logos manuais).
# Use -Force para forçar novo download de todos.
# Para logos manuais: adicione em public/logos/{id}.png — o script não os substituirá.

param([switch]$Force)

$logosDir = Join-Path $PSScriptRoot "..\public\logos"
if (-not (Test-Path $logosDir)) { New-Item -ItemType Directory -Path $logosDir -Force }

$domains = @{
  amazon = 'amazon.co.jp'
  rakuten = 'rakuten.co.jp'
  qoo10 = 'qoo10.jp'
  sofmap = 'sofmap.com'
  daiso = 'jp.daisonet.com'
  minne = 'minne.com'
  amiami = 'amiami.com'
  aniplex = 'aniplexplus.com'
  pokemoncenter = 'pokemoncenter-online.com'
  charaani = 'chara-ani.com'
  kotobukiya = 'shop.kotobukiya.co.jp'
  hareruya = 'hareruyamtg.com'
  yuyutei = 'yuyu-tei.jp'
  hobbysearch = '1999.co.jp'
  goodsmile = 'goodsmile.com'
  junglescs = 'jungle-scs-jpsale.jp'
  colleize = 'colleize.com'
  lashinbang = 'shop.lashinbang.com'
  manzokuya = 'shopmanzokuya.com'
  magicamp = 'magi.camp'
  cardrush = 'cardrush.jp'
  '193tcg' = '193tcg.com'
  japantoreca = 'japan-toreca.com'
  sanrio = 'sanrio.co.jp'
  studioghibli = 'donguri-sora.com'
  mandarake = 'mandarake.co.jp'
  rakuma = 'fril.jp'
  mercari = 'jp.mercari.com'
  yahoofleamarket = 'yahoo.co.jp'
  hardoff = 'netmall.hardoff.co.jp'
  toretoku = 'toretoku.jp'
  okoku = 'okoku.jp'
  uniqlo = 'uniqlo.com'
  snkrdunk = 'snkrdunk.com'
  clove = 'clove.jp'
  ragtag = 'ragtag.jp'
  closetchild = 'closetchildonlineshop.com'
  voi = '0101.co.jp'
  palcloset = 'palcloset.jp'
}

foreach ($id in $domains.Keys) {
  $domain = $domains[$id]
  $outFile = Join-Path $logosDir "$id.png"
  if (-not $Force -and (Test-Path $outFile -PathType Leaf)) {
    Write-Host "SKIP: $id (logo existente, use -Force para sobrescrever)"
    continue
  }
  $url = "https://www.google.com/s2/favicons?domain=$domain&sz=256"
  try {
    & curl.exe -sL -o $outFile $url
    if (Test-Path $outFile -PathType Leaf) { Write-Host "OK: $id" } else { Write-Host "FAIL: $id" }
  } catch {
    Write-Host "FAIL: $id - $_"
  }
}
