SOURCE_DIR=source
OUTPUT_DIR=output
TOOLS_DIR=tools
GITHUB_PAGES_BRANCH=main

targets = $(addprefix $(OUTPUT_DIR)/, $(filenames))

blog_filenames = \
	blog/gnn-local-interactions.html \
	blog/how-i-built-this-website.html \
	blog/fetch-stadium-data.html \
	blog/hydrocube.html \
	blog/analyze-stadium-data.html \
	blog/tossing-potatoes.html


blog_targets = $(addprefix $(OUTPUT_DIR)/, $(blog_filenames))


all: \
	$(OUTPUT_DIR)/index.html \
	$(OUTPUT_DIR)/blog.html \
	$(OUTPUT_DIR)/favicon.ico \
	$(blog_targets) \
	css images data

publish: all
	ghp-import -m "Generate site" -b $(GITHUB_PAGES_BRANCH) "$(OUTPUT_DIR)"
	git push origin $(GITHUB_PAGES_BRANCH)

output_dir:
	mkdir -p $(OUTPUT_DIR)
	mkdir -p $(OUTPUT_DIR)/blog

$(OUTPUT_DIR)/index.html: $(TOOLS_DIR)/mainpage.py \
		$(SOURCE_DIR)/about.md \
		$(SOURCE_DIR)/research.md \
		$(SOURCE_DIR)/publications.md \
		output_dir
	$(TOOLS_DIR)/mainpage.py $(SOURCE_DIR) --blog --out-html $@

$(SOURCE_DIR)/publications.md: $(TOOLS_DIR)/generate_publications.py $(SOURCE_DIR)/publications.bib
	$(TOOLS_DIR)/generate_publications.py $(SOURCE_DIR)/publications.bib $(SOURCE_DIR)/publications.md

$(OUTPUT_DIR)/blog.html: $(TOOLS_DIR)/blogmainpage.py \
		$(SOURCE_DIR)/blog.md \
		output_dir
	$(TOOLS_DIR)/blogmainpage.py $(SOURCE_DIR)/blog.md --out-html $@

$(OUTPUT_DIR)/blog/%.html: $(SOURCE_DIR)/blog/%.md \
		$(TOOLS_DIR)/blogpage.py \
		output_dir
	$(TOOLS_DIR)/blogpage.py $< --out-html $@

images: output_dir
	cp -r images $(OUTPUT_DIR)/

$(OUTPUT_DIR)/favicon.ico: favicon.ico
	cp -r $< $@

data: output_dir
	cp -r data $(OUTPUT_DIR)/

css/codehilite.css:
	pygmentize -S trac -f html -a .codehilite > css/codehilite.css

css: output_dir css/main.css css/codehilite.css
	cp -r css $(OUTPUT_DIR)/

clean:
	rm -r $(OUTPUT_DIR)

.PHONY: all clean css css/codehilite.css output_dir publish images
