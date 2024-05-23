IMAGES = ../../../images
DST_DIR = $(IMAGES)/blog/stadium

all: $(DST_DIR)/raw_times.svg

dst_dir:
	mkdir -p $(DST_DIR)

$(DST_DIR)/raw_times.svg: dst_dir
	./make_plot.py times.csv --out $@

.PHONY: dst_dir all
