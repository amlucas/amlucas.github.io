#!/usr/bin/env python

import argparse
import markdown
import os

from utils import embed_custom_images

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('md_path', type=str, help="Directory containing md files.")
    parser.add_argument('--out-html', type=str, help="Path to output html file.")
    parser.add_argument('--blog', action='store_true', default=False, help="Enable link to blog.")
    args = parser.parse_args()

    md_path  = args.md_path
    out_html = args.out_html
    blog     = args.blog

    sections = {
        "about": "about.md",
        "research": "research.md",
        "publications": "publications.md"
    }

    html_sections = ""
    for section_id, filename in sections.items():
        with open(os.path.join(md_path, filename)) as f:
            raw_md = f.read()
        processed_md = embed_custom_images(raw_md)
        html_content = markdown.markdown(processed_md)
        html_sections += f'''<section id="{section_id}">
  <div class="markdown-body">
    {html_content}
  </div>
</section>
'''

    nav_bar = ""
    for key in sections.keys():
        name = key.title()
        nav_bar += f'  <a href="#{key}">{name}</a>\n'

    if blog:
        nav_bar += '  <a href="./blog.html">Blog</a>\n'


    with open(out_html, "w") as f:
        f.write(f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lucas Amoudruz</title>
  <link rel="stylesheet" href="css/main.css" />
</head>
<body>

<nav class="top-nav">
{nav_bar}
</nav>

{html_sections}

</body>
</html>
""")


if __name__ == '__main__':
    main()
