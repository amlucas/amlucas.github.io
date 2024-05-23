SOURCE_DIR=source
OUTPUT_DIR=output
TOOLS_DIR=tools
GITHUB_PAGES_BRANCH=main

HEADER_PATH = source/header.html
BLOG_HEADER_PATH = source/blog_header.html

filenames = \
	blog.html \
	gallery.html \
	index.html \
	publications.html \
	software.html

blog_filenames = \
	blog/gnn-local-interactions.html \
	blog/stadium.html

targets = $(addprefix $(OUTPUT_DIR)/, $(filenames))
blog_targets = $(addprefix $(OUTPUT_DIR)/, $(blog_filenames))

all: $(targets) $(blog_targets) css images

publish: all
	ghp-import -m "Generate site" -b $(GITHUB_PAGES_BRANCH) "$(OUTPUT_DIR)"
	git push origin $(GITHUB_PAGES_BRANCH)

output_dir:
	mkdir -p $(OUTPUT_DIR)
	mkdir -p $(OUTPUT_DIR)/blog

$(OUTPUT_DIR)/blog/%.html: $(SOURCE_DIR)/blog/%.md output_dir
	$(TOOLS_DIR)/markdown2html.py $< --header $(BLOG_HEADER_PATH) > $@

$(OUTPUT_DIR)/%.html: $(SOURCE_DIR)/%.md output_dir
	$(TOOLS_DIR)/markdown2html.py $< --header $(HEADER_PATH) > $@

images: output_dir
	cp -r images $(OUTPUT_DIR)/

css/codehilite.css:
	pygmentize -S default -f html -a .codehilite > css/codehilite.css

css: output_dir css/codehilite.css
	cp -r css $(OUTPUT_DIR)/
	cp -r css $(OUTPUT_DIR)/blog/

clean:
	rm -f $(targets)
	rm -f $(blog_targets)
	rm -r $(OUTPUT_DIR)

.PHONY: all clean css output_dir publish
