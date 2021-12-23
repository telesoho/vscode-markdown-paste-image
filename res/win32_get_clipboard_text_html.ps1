add-type -an system.windows.forms
$content = [System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::Html)
$metadata = @{}
$properties = [regex]::Matches($content, "^([A-Za-z]*):(.*?)[\r\n$]", [System.Text.RegularExpressions.RegexOptions]::Multiline)

foreach ($property in $properties) {
    $metadata[$property.Groups[1].Value] = $property.Groups[2].Value
}

$text = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::UTF8.GetBytes($content)[$metadata["StartFragment"]..$($metadata["EndFragment"] - 1)])
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::WriteLine($text)
