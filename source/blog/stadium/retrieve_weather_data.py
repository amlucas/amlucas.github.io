#!/usr/bin/env python

import argparse
from meteostat import Point, Hourly
from datetime import datetime
import pandas as pd

def retrieve_weather_data(dates, times):

    location = Point(42.3584, -71.1259)

    date_times = pd.to_datetime([
        f"{date} {time}" for date, time in zip(dates, times)
    ])

    start = date_times.min().to_pydatetime()
    end = date_times.max().to_pydatetime()

    data = Hourly(location, start, end)
    data = data.fetch()

    matched = data.loc[date_times]
    return matched


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--time-data', type=str, default='times.csv')
    parser.add_argument('--out', type=str, default='data.csv')
    args = parser.parse_args()

    df = pd.read_csv(args.time_data)
    dates = df['date'].tolist()
    times = ['18:00'] * len(dates)
    data = retrieve_weather_data(dates, times)
    data.to_csv(args.out)



if __name__ == '__main__':
    main()
