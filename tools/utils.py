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
