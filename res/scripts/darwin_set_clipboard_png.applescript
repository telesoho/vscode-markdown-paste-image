property PNG : �class PNGf�

on run argv
  if argv is {} then
    return ""
  end if
  set imagePath to (item 1 of argv)
  set the clipboard to (read imagePath as PNG)
  copy imagePath to stdout
end run
