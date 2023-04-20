param($textPath)
add-type -an system.windows.forms
$textContent = Get-Content -Path $textPath -Raw -Encoding UTF8
Set-Clipboard -Value $textContent
