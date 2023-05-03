param($imagePath)
Add-Type -Assembly System.Drawing
Add-Type -Assembly System.Windows.Forms
$imageFile = (get-item $imagePath)
$image = [System.Drawing.Image]::FromFile($imageFile)
[System.Windows.Forms.Clipboard]::SetImage($image)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::WriteLine($imagePath)