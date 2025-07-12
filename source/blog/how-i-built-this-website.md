# How I built this website with Python and Markdown

July 12, 2025

I have recently redesigned my website to take a more modern look, and thought I would share how I ended up with this result.
I'm sure many aspects could be improved, as I have limited experience building websites.
My requirements were the following:

* One home page containing a brief introduction, contact information, a description of my research, and a list of publication. A navigation bar is here to help jumping between sections.
* Keep it simple. I don't want to directly write HTML code, and as little JavaScript as possible. In fact, I use JavaScript only to insert equations in the blog pages.
* Separate pages for blog posts, to keep the main page clean.

To keep things easy to write and maintain, I chose to use Markdown, which is simple and powerful enough for my needs.
Furthermore it is easy to convert Markdown to HTML with the python package [markdown](https://python-markdown.github.io/).
Due to my very limited knowledge in CSS styling, I have heavily used chatGPT and I must say I was happy with the result.
Below, I describe the structure of the code in more details.

## The main page


The [main page](../index.html) is created with the following script:

{{file_full, "tools/mainpage.py", "python", "spoiler"}}

It converts Markdown files, processes to parse custom directives, and combines them into a single html file. 
The pre-processing stage helps placing floating images more easily, and it uses the function `embed_custom_images`.
This function handles parsing custom image blocks and turns them into proper HTML:

{{file_partial, "tools/utils.py", "python", "BLOG_IMAGE", "spoiler"}}

It replaces patterns of the form `{{image, "path/to/image.png", "caption", "left/right/center", width-in-percent}}` with the appropriate HTML content.

After being processed, each md file is placed in `section`, and a link is added to a navigation bar.

## Blog pages

The main blog page is similar to the main page, except that there is a single section containing links to individual blog posts:

{{file_full, "tools/blogmainpage.py", "python", "spoiler"}}

Individual blog pages follow the same pattern: a single md file is preprocessed and then embedded into a common html file format.

{{file_full, "tools/blogpage.py", "python", "spoiler"}}

Note that there is an additional stylesheet for code, generated as follows:

~~~bash
pygmentize -S trac -f html -a .codehilite > css/codehilite.css
~~~
This, together with the `extensions` provided to the Markdown converter, allows code highlighting in the final rendering.
Similarly, the blog pages include a [mathjax](https://www.mathjax.org/) snippet to allow equations rendering.
Code and equations are not needed in the main page.

The pre-processing stage also contains an additional step, to include code from files:

{{file_partial, "tools/utils.py", "python", "BLOG_CODE", "spoiler"}}

This function relies on a similar format than that used by the `image` pattern.
Here I have two options:

* `{{file_full, "path/to/code", "language", "spoiler"} }` (spoiler is optional) to include the full file;
* `{{file_partial, "path/to/code", "language", "marker", "spoiler"} }` (again, spoiler is optional) to include code between markers `# START_marker` and `# END_marker`;

## CSS

Here is my full CSS configuration.

{{file_full, "css/main.css", "css", "spoiler"}}
