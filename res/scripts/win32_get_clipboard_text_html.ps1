add-type -an system.windows.forms
Add-Type -Assembly PresentationCore
$content = [Windows.Clipboard]::GetData([Windows.DataFormats]::Html)
$metadata = @{}
$properties = [regex]::Matches($content, "^([A-Za-z]*):(.*?)[\r\n$]", [System.Text.RegularExpressions.RegexOptions]::Multiline)

foreach ($property in $properties) {
    $metadata[$property.Groups[1].Value] = $property.Groups[2].Value
}

$text = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::UTF8.GetBytes($content)[$metadata["StartFragment"]..$($metadata["EndFragment"] - 1)])
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::WriteLine($text)
