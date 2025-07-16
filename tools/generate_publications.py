#!/usr/bin/env python

import argparse
import bibtexparser
import os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('bib_file', type=str, help="input bibtex file")
    parser.add_argument('out_md', type=str, help="output md file")
    parser.add_argument('out_bib', type=str, help="output bib directory")
    args = parser.parse_args()

    bib_file = args.bib_file
    out_md_file = args.out_md
    out_bib_dir = args.out_bib

    os.makedirs(out_bib_dir, exist_ok=True)

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
        journal = entry.get("journal") or entry.get("booktitle") or ""
        doi = entry.get("doi")
        arxiv = entry.get("eprint") if "arxiv" in entry.get("eprint", "").lower() else None
        key = entry.get("ID")

        if year != cur_year:
            md_lines.append(f"\n## {year}\n")
            cur_year = year

        # dump bibtex entry to a file
        bib_database = bibtexparser.bibdatabase.BibDatabase()
        bib_database.entries = [entry]
        path = os.path.join(out_bib_dir, f"{key}.bib")
        with open(path, "w") as f:
            f.write(writer.write(bib_database))

        # Short formatted line
        md_lines.append(f"- **{title}**  \n  {authors}  \n  *{journal}*" + (
            f" [DOI]({doi})" if doi else "") + (
            f" [arxiv]({arxiv})" if arxiv else "") + (
            f" [bibtex](data/bib/{key}.bib)\n"))



    with open(out_md_file, "w") as f:
        f.write("\n".join(md_lines))

    print(f"Generated: {out_md_file}")

if __name__ == '__main__':
    main()
