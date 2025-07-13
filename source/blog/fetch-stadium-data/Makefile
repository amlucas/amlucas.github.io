IMAGES = ../../../images
DST_DIR = $(IMAGES)/blog/fetch-stadium-data

all: $(DST_DIR)/raw_data.svg

dst_dir:
	mkdir -p $(DST_DIR)

$(DST_DIR)/raw_data.svg: dst_dir make_plot.py data.csv
	./make_plot.py data.csv --show-temp --out $@

data.csv: retrieve_stadium_runs_and_weather.py
	./retrieve_stadium_runs_and_weather.py --out $@


.PHONY: dst_dir all
