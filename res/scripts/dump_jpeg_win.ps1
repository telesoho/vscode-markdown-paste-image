#Set-ExecutionPolicy RemoteSigned -s Process -f
Try{
add-type -an system.windows.forms #an AssemblyName
$folder = Get-Item -Path "D:\"
$obj= [System.Windows.Forms.Clipboard]::GetDataObject()
if(!($obj -eq $null)){$clpdatatype = $obj.GetType()}
if($obj.ContainsText()){
[boolean]$blHtm = $false
$objhtm = $obj.GetData([Windows.Forms.DataFormats]::Html)
if(!($objhtm -eq $null)){Write-Host "objhtm has data"
$sFullPath ="{0}\Clipboard-{1}.html" -f $folder,((Get-Date -f s) -replace '[-T:]','')
$strHTML | Out-File $sFullPath -Force -Encoding "utf8"
[boolean]$blHtm = $true
}
if($blHtm-eq $false){
$objtxt = $obj.GetData([Windows.Forms.DataFormats]::text)
if(!($objtxt -eq $null)){Write-Host "objtxt has data"
$sFullPath ="{0}\Clipboardtxt-{1}.txt" -f $folder,((Get-Date -f s) -replace '[-T:]','')
}
$objUxt = $obj.GetData([Windows.Forms.DataFormats]::UnicodeText)
if(!($objUxt -eq $null)){Write-Host "objUxt has data"
$sFullPath ="{0}\ClipboardUxt-{1}.txt" -f $folder,((Get-Date -f s) -replace '[-T:]','')
$objUxt | Out-File $sFullPath -Force -Encoding "unicode"
}
$objCxt = $obj.GetData([Windows.Forms.DataFormats]::CommaSeparatedValue)
if(!($objCxt -eq $null)){Write-Host "objCxt has data"
$sFullPath ="{0}\Clipboardcsvt-{1}.csv" -f $folder,((Get-Date -f s) -replace '[-T:]','')
$objCxt | Export-Csv $sFullPath -Force -NoTypeInformation -Encoding "utf8"
}
$objrtf = $obj.GetData([Windows.Forms.DataFormats]::Rtf)
if(!($objrtf -eq $null)){Write-Host "objrtf has data"
$sFullPath ="{0}\Clipboardrtf-{1}.rtf" -f $folder,((Get-Date -f s) -replace '[-T:]','')
$objrtf | Out-File $sFullPath -Force 
}
} #End IF $blHtm-eq $false

}

if($obj.ContainsImage()){
$objimg = $obj.GetData([Windows.Forms.DataFormats]::Bitmap)
Write-Host "image"
$img = [Windows.Clipboard]::GetImage()
Write-Host ("Bild gefunden. {0}x{1} Pixel." -f $img.PixelWidth,$img.PixelHeight)
$fcb = new-object Windows.Media.Imaging.FormatConvertedBitmap($img, [Windows.Media.PixelFormats]::Rgb24, $null, 0)
$stream = [IO.File]::Open(("{0}\Clipboard-{1}.png" -f $folder,((Get-Date -f s) -replace '[-T:]','')), "OpenOrCreate")
$encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder
$encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($fcb))
$encoder.Save($stream)
$stream.Dispose()
}
if($obj.ContainsAudio()){
Write-Host "Audio"
$objAud = $obj.GetData([Windows.Forms.DataFormats]::WaveAudio)}
}Finally{

}