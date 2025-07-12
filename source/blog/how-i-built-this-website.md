# How I built this website

July 11, 2025

Today I have redesigned my website to take a more modern look, and thought I would share how I ended up with this result.
My requirements were the following:

* One home page containing a brief introduction, contact information, a description of my research, and a list of publication. A navigation bar is here to help jumping between sections.
* Keep it simple. I don't want to directly write `html` code, and as little `javascript` as possible. In fact, I use javascript only to insert equations in the blog pages.
* Separate pages for blog posts, to keep the main page clean.

To keep things easy to write I chose to use `markdown`, which is simple and powerful enough for my needs.
Furthermore it is easy to convert `markdown` to `html` with the python package [markdown](https://python-markdown.github.io/).
Due to my very limited knowledge in `css` styling, I have heavily used chatGPT and I must say I was happy with the result.
Below I give more details of the structure of my code.


## The main page


The main page is created by the following script:

{{file_full, "tools/mainpage.py", "python", "spoiler"}}

It converts markdown files, process them for special commands, and combines them into a single html file. 
