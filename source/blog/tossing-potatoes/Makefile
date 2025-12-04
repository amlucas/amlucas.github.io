IMAGES = ../../../images
DST_DIR = $(IMAGES)/blog/tossing-potatoes

all: $(DST_DIR)/Pt.svg $(DST_DIR)/binomial.svg

dst_dir:
	mkdir -p $(DST_DIR)

$(DST_DIR)/Pt.svg: dst_dir Pt.py
	./Pt.py --out $@

$(DST_DIR)/binomial.svg: dst_dir binomial.py
	./binomial.py --out $@

.PHONY: dst_dir all
