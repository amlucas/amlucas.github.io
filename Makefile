SOURCE_DIR=source
OUTPUT_DIR=output
TOOLS_DIR=tools
GITHUB_PAGES_BRANCH=main

filenames = \
	about.html \
	contact.html \
	index.html \
	publications.html \
	software.html
targets = $(addprefix $(OUTPUT_DIR)/, $(filenames))

all: $(targets) css images

publish: all
	ghp-import -m "Generate site" -b $(GITHUB_PAGES_BRANCH) "$(OUTPUT_DIR)"
	git push origin $(GITHUB_PAGES_BRANCH)

output_dir:
	mkdir -p $(OUTPUT_DIR)

$(OUTPUT_DIR)/%.html: $(SOURCE_DIR)/%.md output_dir
	$(TOOLS_DIR)/markdown2html.py $< > $@

images: output_dir
	cp -r images $(OUTPUT_DIR)/

css: output_dir
	cp -r css $(OUTPUT_DIR)/

clean:
	rm -f $(targets)
	rm -r $(OUTPUT_DIR)

.PHONY: all clean css output_dir publish
