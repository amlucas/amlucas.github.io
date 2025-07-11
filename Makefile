SOURCE_DIR=source
OUTPUT_DIR=output
TOOLS_DIR=tools
GITHUB_PAGES_BRANCH=main

blog_filenames = \
	blog/gnn-local-interactions.html \
	blog/stadium.html

targets = $(addprefix $(OUTPUT_DIR)/, $(filenames))

all: $(OUTPUT_DIR)/index.html css images

publish: all
	ghp-import -m "Generate site" -b $(GITHUB_PAGES_BRANCH) "$(OUTPUT_DIR)"
	git push origin $(GITHUB_PAGES_BRANCH)

output_dir:
	mkdir -p $(OUTPUT_DIR)

$(OUTPUT_DIR)/index.html: $(SOURCE_DIR)/about.md \
		$(SOURCE_DIR)/contact.md \
		$(SOURCE_DIR)/gallery.md \
		$(SOURCE_DIR)/publications.md \
		$(SOURCE_DIR)/software.md \
		output_dir
	$(TOOLS_DIR)/mainpage.py $(SOURCE_DIR) --out-html $@

images: output_dir
	cp -r images $(OUTPUT_DIR)/

css/codehilite.css:
	pygmentize -S default -f html -a .codehilite > css/codehilite.css

css: output_dir css/codehilite.css
	cp -r css $(OUTPUT_DIR)/
	cp -r css $(OUTPUT_DIR)/blog/

clean:
	rm -r $(OUTPUT_DIR)

.PHONY: all clean css output_dir publish
