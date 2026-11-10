<#
  Cut the studio's own photographs (the November 2026 set) into the sizes
  each slot on the website needs. Windows PowerShell + System.Drawing, so it
  runs without Pillow:

      powershell -File tools/build-photos.ps1 <dir-with-originals>

  The originals are expected as 1.jpg .. 8.jpg, the order they were supplied:
    1 before / after          5 reformer, plants and the DUA wall
    2 shelving and the logo   6 reception shelf (not used on the site)
    3 reformers, evening      8 spa room, a treatment in progress
    4 the bright main room

  2, 4 and 5 carry a DUA watermark in a bottom corner. The crop stops above
  it (nothing is retouched); swap in clean originals and set the crop height
  back to the full frame to get the bottom of those rooms back.

  Nothing is upscaled: a width wider than its crop is skipped.
#>
param([string]$Src = '.')

Add-Type -AssemblyName System.Drawing
$Out = Join-Path $PSScriptRoot '..\assets\img'

# name, source, crop x, y, w, h (source pixels), output widths
$Jobs = @(
  @('dua-studio-daylight', '4.jpg', 0, 0,   1086, 1300, @(1086, 720)),
  @('dua-og',              '4.jpg', 0, 560, 1086, 570,  @(1086)),
  @('dua-reformer-plants', '5.jpg', 0, 0,   1086, 1300, @(1086, 720)),
  # held in on the lit shelf and the logo, so it does not repeat the hero's room
  @('dua-shelving',        '2.jpg', 150, 0, 750, 1000, @(750)),
  @('dua-reformer-evening','3.jpg', 0, 0,   3072, 4096, @(1500, 900)),
  @('dua-spa-room',        '8.jpg', 0, 0,   1328, 1744, @(1328, 800)),
  @('dua-before-after',    '1.jpg', 0, 0,   1104, 1456, @(1104, 720))
)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]82)

foreach ($j in $Jobs) {
  $name, $file, $x, $y, $w, $h, $widths = $j
  $im = [System.Drawing.Image]::FromFile((Resolve-Path (Join-Path $Src $file)))
  foreach ($tw in $widths) {
    if ($tw -gt $w) { Write-Host "  skip $name-$tw (crop is only $w wide)"; continue }
    $th = [int][Math]::Round($h * $tw / $w)
    $bmp = New-Object System.Drawing.Bitmap $tw, $th
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($im, (New-Object System.Drawing.Rectangle 0, 0, $tw, $th), (New-Object System.Drawing.Rectangle $x, $y, $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
    $dest = Join-Path $Out "$name-$tw.jpg"
    $bmp.Save($dest, $codec, $params)
    $g.Dispose(); $bmp.Dispose()
    Write-Host ("  {0,-30} {1}x{2}  {3,5:N0} KB" -f "$name-$tw.jpg", $tw, $th, ((Get-Item $dest).Length / 1KB))
  }
  $im.Dispose()
}
