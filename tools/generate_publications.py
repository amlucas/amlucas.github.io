#!/usr/bin/env python

import argparse
import bibtexparser
import latexcodec
import markdown
import re

def strip_braces(text):
    return re.sub(r'[{}]', '', text)

def decode_latex_string(text):
    try:
        return text.encode("utf-8").decode("latex")
    except Exception:
        return text

def bold_author(authors_str, name="Amoudruz, Lucas"):
    return authors_str.replace(name, f"**{name}**")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('bib_file', type=str, help="input bibtex file")
    parser.add_argument('out_md', type=str, help="output md file")
    args = parser.parse_args()

    bib_file = args.bib_file
    out_md_file = args.out_md

    with open(bib_file) as f:
        bib_database = bibtexparser.load(f)

    writer = bibtexparser.bwriter.BibTexWriter()
    writer.indent = "  "

    # Sort by year descending
    entries = sorted(bib_database.entries, key=lambda e: e.get("year", "0"), reverse=True)

    md_lines = ["# Publications\n"]
    cur_year = None

    for entry in entries:
        year = entry.get("year", "????")
        title = entry.get("title", "Untitled").strip("{}")
        authors = entry.get("author", "Unknown")
        journal = entry.get("journal") or entry.get("booktitle") or "arxiv preprint"
        doi = entry.get("doi")
        arxiv = entry.get("eprint") if "arxiv" in entry.get("eprint", "").lower() else None
        key = entry.get("ID")

        if year != cur_year:
            md_lines.append(f"\n## {year}\n")
            cur_year = year

        title = strip_braces(decode_latex_string(title))
        authors = strip_braces(decode_latex_string(authors))
        authors = bold_author(authors)
        journal = strip_braces(journal)

        # dump bibtex entry to a file
        bib_database = bibtexparser.bibdatabase.BibDatabase()
        bib_database.entries = [entry]
        bibtex_content = str(writer.write(bib_database))

        # Format publication
        citation_md = f'{authors}. _"{title}"_, '
        if entry.get('ENTRYTYPE') == 'phdthesis':
            school = entry.get("school")
            citation_md += f"  _PhD dissertation_, {school}"
        else:
            citation_md += f"  _{journal}_"
            volume = entry.get('volume')
            number = entry.get('number')
            pages = entry.get('pages')
            if volume:
                citation_md += f", Vol. {volume}"
            if number:
                citation_md += f", No. {number}"
            if pages:
                citation_md += f", pp. {pages}"
            if year:
                citation_md += f" ({year})"

        if doi:
            citation_md += f"  [DOI]({doi})"
        if arxiv:
            citation_md += f"  [arxiv]({arxiv})"

        # convert to html, and add it as a spoiler for the bibtex version
        html_line = markdown.markdown(citation_md)
        # remove the <p> introduced by markdown converter
        html_line = html_line.replace('<p>', '')
        html_line = html_line.replace('<\\p>', '')

        spoiler = f"""<details class="pub-entry">\n<summary>{html_line}\n</summary>\n\n<pre><code class="language-bibtex">{bibtex_content}</code></pre></details>\n"""

        md_lines.append(spoiler)


    with open(out_md_file, "w") as f:
        f.write("\n".join(md_lines))

    print(f"Generated: {out_md_file}")

if __name__ == '__main__':
    main()
