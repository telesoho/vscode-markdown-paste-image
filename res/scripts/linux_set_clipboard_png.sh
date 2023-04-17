#!/bin/sh
if xclip -selection clipboard -target image/png -i $1>/dev/null 2>&1
then
    xclip -selection clipboard -target image/png -i $1 2>/dev/null
    echo $1
else
    echo "no image"
fi