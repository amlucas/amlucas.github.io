#!/usr/bin/env python

import argparse
import markdown
import os

from utils import embed_image_float, embed_image_row, embed_code_from_files

def md_path_to_title(md_path):
    return "blog - " + md_path.split("/")[-1].split(".md")[0]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('md_path', type=str, help="path to md file")
    parser.add_argument('--out-html', type=str, help="Path to output html file.")
    args = parser.parse_args()

    md_path  = args.md_path
    out_html = args.out_html

    with open(md_path) as f:
        raw_md = f.read()
    processed_md = embed_image_float(raw_md)
    processed_md = embed_image_row(processed_md)
    processed_md = embed_code_from_files(processed_md)

    html_content = markdown.markdown(processed_md,
                                     extensions=['mdx_math',
                                                 'fenced_code',
                                                 'codehilite'])


    html_section = f"""
<section class="markdown-body">
  {html_content}
</section>
"""

    title = md_path_to_title(md_path)

    with open(out_html, "w") as f:
        f.write(f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <link rel="stylesheet" href="../css/main.css" />
  <link rel="stylesheet" href="../css/codehilite.css" />
  <script type="text/javascript" async
      src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.7/MathJax.js?config=TeX-MML-AM_CHTML">
  </script>
</head>
<body>

<nav class="top-nav">
  <a href="../index.html">Home</a>
  <a href="../blog.html">Blog</a>
</nav>

{html_section}

</body>
</html>
""")


if __name__ == '__main__':
    main()
