param($imagePath)
# Adapted from https://github.com/octan3/img-clipboard-dump/blob/master/dump-clipboard-png.ps1
add-type -an system.windows.forms
Add-Type -Assembly PresentationCore
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$noImage = "no image"
if(![System.Windows.Forms.Clipboard]::ContainsImage())
{
    [Console]::WriteLine($noImage)
    Exit 1
}

$img = [Windows.Clipboard]::GetImage()
if ($null -eq $img) {
    [Console]::WriteLine($noImage)
    Exit 1
}

if (-not $imagePath) {
    [Console]::WriteLine($noImage)
    Exit 1
}

$fcb = new-object Windows.Media.Imaging.FormatConvertedBitmap($img, [Windows.Media.PixelFormats]::Rgb24, $null, 0)
$stream = [IO.File]::Open($imagePath, "OpenOrCreate")
$encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder
$encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($fcb)) | out-null
$encoder.Save($stream) | out-null
$stream.Dispose() | out-null

[Console]::WriteLine($imagePath)
