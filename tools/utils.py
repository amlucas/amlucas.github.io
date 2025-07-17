import ast
import re

# START_BLOG_IMAGE
def embed_image_float(md_text):
    pattern = r'\{\{\s*image\("([^"]+)",\s*"([^"]*)",\s*"([^"]+)",\s*(\d+)\)\s*\}\}'

    def replacer(match):
        src = match.group(1)
        caption = match.group(2).strip()
        float_dir = match.group(3)
        width = match.group(4)
        float_class = f"float-img-{float_dir}" if float_dir in ["left", "center", "right"] else ""
        style = f'style="width: {width}%;"'

        caption_html = f'<p class="image-caption">{caption}</p>' if caption else ''

        return f'''
<div class="image-wrap {float_class}" {style}>
  <img src="{src}" alt="{caption}">
  {caption_html}
</div>
        '''

    return re.sub(pattern, replacer, md_text)
# END_BLOG_IMAGE

def embed_image_row(md_text):
    pattern = r'\{\{\s*image_row,\s*(\[[^\}]+)\s*\}\}'

    def replacer(match):
        try:
            # Parse the list of lists
            items = ast.literal_eval(match.group(1))  # Safe parsing of Python literal

            image_html = ""
            for path, caption, width in items:
                image_html += f'''
<div class="image-wrap" style="width: {width}%;">
  <img src="{path}" alt="{caption}">
  <p class="image-caption">{caption}</p>
</div>
'''

            return f'<div class="image-row">\n{image_html}</div>\n'

        except Exception as e:
            return f"<p><strong>Error rendering image_row:</strong> {e}</p>"

    return re.sub(pattern, replacer, md_text)


# START_BLOG_CODE
def embed_code_from_files(md_text):
    full_pattern = r'\{\{\s*file_full,\s*"([^"]+)",\s*"([^"]+)"(?:,\s*"([^"]+)")?\s*\}\}'
    partial_pattern = r'\{\{\s*file_partial,\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"(?:,\s*"([^"]+)")?\s*\}\}'

    def full_replacer(match):
        path, lang = match.group(1), match.group(2)
        spoiler = match.group(3) == "spoiler"
        try:
            with open(path, "r") as f:
                code = f.read().strip()
            code_block = f"\n```{lang}\n{code}\n```\n"
            if spoiler:
                return f"<details>\n<summary>Show code</summary>\n\n{code_block}</details>\n"
            else:
                return code_block
        except Exception as e:
            return f"**Error including file: {path} ({e})**"

    def partial_replacer(match):
        path, lang, marker = match.group(1), match.group(2), match.group(3)
        spoiler = match.group(4) == "spoiler"
        start_tag = f"# START_{marker}"
        end_tag = f"# END_{marker}"
        try:
            with open(path, "r") as f:
                lines = f.readlines()
            inside = False
            extracted = []
            for line in lines:
                if start_tag in line:
                    inside = True
                    continue
                if end_tag in line:
                    inside = False
                    continue
                if inside:
                    extracted.append(line)
            code = ''.join(extracted).strip()
            code_block = f"\n```{lang}\n{code}\n```\n"
            if spoiler:
                return f"""<details class="code-block">\n<summary>Show code</summary>\n\n{code_block}</details>\n"""
            else:
                return code_block
        except Exception as e:
            return f"**Error including partial code: {path} ({e})**"

    md_text = re.sub(full_pattern, full_replacer, md_text)
    md_text = re.sub(partial_pattern, partial_replacer, md_text)
    return md_text
# END_BLOG_CODE
