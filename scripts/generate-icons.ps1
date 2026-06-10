$src = 'C:\Users\sandu\.cursor\projects\c-Users-sandu-OneDrive-Documents-RentBook\assets\c__Users_sandu_AppData_Roaming_Cursor_User_workspaceStorage_81707394288aeba5bb80e6b9aea06d5a_images_image-e91713b6-07f1-4518-8463-4d60370b4e30.png'
$dest = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($src)
foreach ($size in 72, 96, 128, 144, 152, 192, 384, 512) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($image, 0, 0, $size, $size)
  $out = Join-Path $dest "icon-${size}x${size}.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}
$image.Dispose()
Copy-Item (Join-Path $dest 'icon-192x192.png') (Join-Path $PSScriptRoot '..\public\favicon.png') -Force
Write-Output 'Icons generated'
