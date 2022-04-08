set clipboardText to (the clipboard as text)
do shell script "echo " & quoted form of clipboardText
