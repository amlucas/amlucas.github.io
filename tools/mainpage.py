#!/usr/bin/env python

import argparse
import markdown
import os
import re

def embed_custom_images(md_text):
    pattern = r'\{\{\s*image\("([^"]+)",\s*"([^"]*)",\s*"([^"]+)",\s*(\d+)\)\s*\}\}'

    def replacer(match):
        src = match.group(1)
        caption = match.group(2).strip()
        float_dir = match.group(3)
        width = match.group(4)
        float_class = f"float-img-{float_dir}" if float_dir in ["left", "right"] else ""
        style = f'style="width: {width}%;"'

        caption_html = f'<p class="image-caption">{caption}</p>' if caption else ''

        return f'''
<div class="image-wrap {float_class}" {style}>
  <img src="{src}" alt="{caption}">
  {caption_html}
</div>
        '''

    return re.sub(pattern, replacer, md_text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('md_path', type=str, help="Directory containing md files.")
    parser.add_argument('--out-html', type=str, help="Path to output html file.")
    args = parser.parse_args()

    md_path  = args.md_path
    out_html = args.out_html

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


    with open(out_html, "w") as f:
        f.write(f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lucas Amoudruz</title>
  <link rel="stylesheet" href="css/style.css" />
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
