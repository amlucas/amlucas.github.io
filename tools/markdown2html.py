#!/usr/bin/env python

import argparse
import markdown
import sys

def get_file_str(path):
    with open(path, "r") as f:
        text = " ".join(line.rstrip() for line in f)
    return text

def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument('md_path', type=str, help="The file to convert.")
    parser.add_argument('--header', type=str, default=None, help="html header.")
    parser.add_argument('--title', type=str, default="Lucas Amoudruz")
    args = parser.parse_args(argv)

    md_path     = args.md_path
    header_path = args.header
    title       = args.title

    output = [ """<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="css/white.css" type="text/css" rel="stylesheet" />
    <link href="css/codehilite.css" rel="stylesheet" />
    <title>%(title)s</title>
  </head>
<body>


""" % { 'title' : title }
    ]

    if header_path is not None:
        output.append(get_file_str(header_path))

    with open(md_path, "r") as f:
        md_text = f.read()
        html = markdown.markdown(md_text,
                                 extensions=['fenced_code', 'codehilite'])
        output.append( html )

    output.append( """

</body>

</html>
""" )

    print("".join(output))

if __name__ == '__main__':
    main(sys.argv[1:])
