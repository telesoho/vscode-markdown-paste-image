Add-Type -Assembly PresentationCore
$content = [Windows.Clipboard]::GetData("HTML Format")

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::WriteLine($content)
