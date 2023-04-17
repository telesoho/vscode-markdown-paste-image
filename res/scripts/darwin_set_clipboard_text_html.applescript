property HTML : Çclass HTMLÈ

on run argv
  if argv is {} then
    return ""
  end if
  set htmlPath to (item 1 of argv)
  set the clipboard to (read htmlPath as HTML)
end run
