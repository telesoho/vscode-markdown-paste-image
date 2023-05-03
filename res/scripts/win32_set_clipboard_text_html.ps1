param($htmlPath)
add-type -an system.windows.forms
Add-Type -Assembly PresentationCore

function SetHtmlDataString([string]$html) {
    $data = New-Object System.Windows.Forms.DataObject
    [string]$Header = "Version:0.9
StartHTML:<<<<<<<<1
EndHTML:<<<<<<<<2
StartFragment:<<<<<<<<3
EndFragment:<<<<<<<<4";

    $StartFragment="<!--StartFragment-->"
    $EndFragment="<!--EndFragment-->"

    $sb = New-Object -TypeName "System.Text.StringBuilder"; 
    $sb.AppendLine($Header)
    $sb.AppendLine("<html>")
    $sb.AppendLine("<body>")
    $sb.AppendLine($StartFragment)
    [int]$fragmentStart=[System.Text.Encoding]::UTF8.GetByteCount($sb)
    $sb.AppendLine($html)
    [int]$fragmentEnd=[System.Text.Encoding]::UTF8.GetByteCount($sb)
    $sb.AppendLine($EndFragment)
    $sb.AppendLine("</body>")
    $sb.AppendLine("</html>")


    # // Back-patch offsets (scan only the header part for performance)
    $sb.Replace("<<<<<<<<1", $Header.Length.ToString("D9"), 0, $Header.Length);
    $sb.Replace("<<<<<<<<2", [System.Text.Encoding]::UTF8.GetByteCount($sb).ToString("D9"), 0, $Header.Length);
    $sb.Replace("<<<<<<<<3", $fragmentStart.ToString("D9"), 0, $Header.Length);
    $sb.Replace("<<<<<<<<4", $fragmentEnd.ToString("D9"), 0, $Header.Length);

    $htmlData = [System.Text.Encoding]::Default.GetString([System.Text.Encoding]::UTF8.GetBytes($sb))

    $data.SetData([System.Windows.Forms.DataFormats]::Html, $htmlData)
    [System.Windows.Forms.Clipboard]::SetDataObject($data)
}

$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# $htmlContent = Get-Content -Path $htmlPath -Raw -Encoding UTF8
$htmlContentDefault = Get-Content -Path $htmlPath -Raw -Encoding UTF8
# SetHtmlDataString $htmlContent
Set-Clipboard -ashtml -Value $htmlContentDefault