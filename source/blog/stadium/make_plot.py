#!/usr/bin/env python

import argparse
from datetime import datetime
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd

def extract_date_time_from_csv(csv_file_path):
    df = pd.read_csv(csv_file_path)
    dates = df['date'].to_numpy()
    times = df['time'].to_numpy()
    return dates, times

def convert_duration_to_minutes(duration):
    minutes, seconds = duration.split(':')
    total_minutes = float(minutes) + float(seconds)/60
    return total_minutes

def plot_duration_vs_date(dates, durations, out):
    dates = [datetime.strptime(date, '%Y-%m-%d') for date in dates]
    durations = [convert_duration_to_minutes(duration) for duration in durations]

    fig, ax = plt.subplots()
    ax.plot(dates, durations, 'o', clip_on=False)
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    plt.xticks(rotation=45)
    #plt.xlabel('Date')
    plt.ylabel('Duration (minutes)')
    plt.tight_layout()
    if out is None:
        plt.show()
    else:
        plt.savefig(out)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_file_path', type=str)
    parser.add_argument('--out', type=str, default=None)
    args = parser.parse_args()

    dates, times = extract_date_time_from_csv(args.csv_file_path)
    plot_duration_vs_date(dates, times, args.out)
