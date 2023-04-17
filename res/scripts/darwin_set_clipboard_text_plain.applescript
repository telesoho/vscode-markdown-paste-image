property UTF8 : Çclass utf8È

on run argv
  if argv is {} then
    return ""
  end if
  set textPath to (item 1 of argv)
  set the clipboard to (read textPath as UTF8)
end run
