SOURCE_DIR=source
TOOLS_DIR=tools

TARGETS = \
	about.html \
	index.html \
	publications.html \
	software.html

all: $(TARGETS)

%.html: $(SOURCE_DIR)/%.md
	$(TOOLS_DIR)/markdown2html.py $< > $@

clean:
	rm -f $(TARGETS)

.PHONY: all clean
