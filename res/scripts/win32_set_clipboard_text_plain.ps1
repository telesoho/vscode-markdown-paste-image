param($textPath)
add-type -an system.windows.forms
$data = New-Object System.Windows.Forms.DataObject
$textContent = Get-Content -Path $textPath -Raw -Encoding UTF8
$data.SetData([System.Windows.Forms.DataFormats]::Text, $textContent)
[System.Windows.Forms.Clipboard]::SetDataObject($data)
