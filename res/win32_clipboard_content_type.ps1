$content = "unknow"
if ([Windows.Clipboard]::ContainsData("HTML Format")) {
    $content = "text/html"
} elseif([Windows.Clipboard]::ContainsData("Text")) {
    $content = "text/plain"
} elseif([Windows.Clipboard]::ContainsData("Bitmap")) {
    $content = "image/png"
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::WriteLine($content)
