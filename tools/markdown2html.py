#!/usr/bin/env python

import argparse
import markdown
import sys

def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument('md_file', type=str, help="The file to convert.")
    parser.add_argument('--title', type=str, default="Lucas Amoudruz")
    args = parser.parse_args(argv)

    md_file = args.md_file
    title = args.title

    with open(md_file, "r") as f:
        md_text = f.read()
        html = markdown.markdown(md_text)

    output = [ """<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="css/white.css" type="text/css" rel="stylesheet" />
    <title>%(title)s</title>
  </head>
<body>

<header>
<nav>
  <ul>
    <li> <a href="./index.html"> Home </a> </li>
    <li> <a href="./about.html"> About </a> </li>
    <li> <a href="./publications.html"> Publications </a> </li>
    <li> <a href="./software.html"> Software </a> </li>
  </ul>
</nav>
</header>

""" % { 'title' : title }
    ]

    output.append( html )

    output.append( """

</body>

</html>
""" )

    print("".join(output))

if __name__ == '__main__':
    main(sys.argv[1:])
