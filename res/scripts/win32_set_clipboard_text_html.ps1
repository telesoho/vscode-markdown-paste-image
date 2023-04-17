add-type -an system.windows.forms
Add-Type -Assembly PresentationCore
$data = New-Object System.Windows.Forms.DataObject
$data.SetData([System.Windows.Forms.DataFormats]::Text, $html)
[System.Windows.Forms.Clipboard]::SetDataObject($data)
