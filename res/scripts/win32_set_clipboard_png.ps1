param($imagePath)
# Adapted from https://github.com/octan3/img-clipboard-dump/blob/master/dump-clipboard-png.ps1
using namespace System.Windows
using namespace System.Windows.Media.Imaging
using namespace System.IO
using namespace System.Windows.Interop
add-type -an system.windows.forms
Add-Type -Assembly PresentationCore


function Set-ClipboardImage {
    [cmdletbinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateScript({
            if(Test-Path (Split-Path $_)) {
                return $true
            }

            throw [ArgumentException]::new(
                'Destination folder does not exist.', 'Destination'
            )
        })]
        [string] $Destination,

        [Parameter(Mandatory, ValueFromPipeline, DontShow)]
        [InteropBitmap] $InputObject,

        [Parameter()]
        [ValidateSet('Png', 'Bmp', 'Jpeg')]
        [string] $Encoding = 'Png'
    )

    end {
        try {
            $Destination = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($Destination)
            $encoder = switch($Encoding) {
                Png  { [PngBitmapEncoder]::new(); break }
                Bmp  { [BmpBitmapEncoder]::new(); break }
                Jpeg { [JpegBitmapEncoder]::new() }
            }
            $fs = [File]::Create($Destination)
            $encoder.Frames.Add([BitmapFrame]::Create($InputObject))
            $encoder.Save($fs)
        }
        catch {
            $PSCmdlet.WriteError($_)
        }
        finally {
            $fs.ForEach('Dispose')
        }
    }
}

Set-ClipboardImage -Destination $imagePath -Encoding Png
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::WriteLine($imagePath)
