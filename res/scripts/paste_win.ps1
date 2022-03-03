Add-Type -Assembly PresentationCore
$content = ""
if ([Windows.Clipboard]::ContainsData("HTML Format")) {
    $content = [Windows.Clipboard]::GetData("HTML Format")
} elseif([Windows.Clipboard]::ContainsData("Text")) {
    $content = [Windows.Clipboard]::GetData("Text")
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::WriteLine($content)
