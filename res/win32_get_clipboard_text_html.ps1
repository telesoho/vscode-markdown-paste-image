add-type -an system.windows.forms
$content = [System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::Html)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::WriteLine($content)
