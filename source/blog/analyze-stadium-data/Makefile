IMAGES = ../../../images
DST_DIR = $(IMAGES)/blog/analyze-stadium-data

all: $(DST_DIR)/predictions.svg

dst_dir:
	mkdir -p $(DST_DIR)

$(DST_DIR)/predictions.svg: dst_dir main.py data.csv
	./main.py data.csv --out-dir $(DST_DIR)

.PHONY: dst_dir all
