-- do shell script "echo " & quoted form of clipboardType & ""

set clipboardType to ((clipboard info) as string)
if clipboardType contains "Unicode text"
    set clipboardText to (the clipboard as text)
    set regexCommand to "echo \"" & clipboardText & "\"|sed \"s/<[a-z]*>/*html*(&)/i\"" as string
    set regexResult to do shell script regexCommand
    set isHTML to regexResult starts with "*html*"
    if isHTML
        copy "HTML" to stdout
    else
        copy "Text" to stdout
    end if
else if clipboardType contains "picture"
    copy "Image" to stdout
end if