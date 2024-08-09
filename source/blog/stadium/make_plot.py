#!/usr/bin/env python

import argparse
from datetime import datetime
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd

def extract_date_time_from_csv(csv_file_path):
    return dates, times

def convert_duration_to_minutes(duration):
    minutes, seconds = duration.split(':')
    total_minutes = float(minutes) + float(seconds)/60
    return total_minutes

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_file_path', type=str)
    parser.add_argument('--out', type=str, default=None)
    args = parser.parse_args()

    out = args.out

    df = pd.read_csv(args.csv_file_path)
    dates = df['date'].to_numpy()
    durations = df['time'].to_numpy()
    temperature = df['temperature'].to_numpy()

    dates = [datetime.strptime(date, '%Y-%m-%d') for date in dates]
    durations = np.array([convert_duration_to_minutes(duration) for duration in durations])

    #W = 6
    #mean = np.convolve(durations, np.ones(W), mode='same') / np.convolve(np.ones_like(durations), np.ones(W), mode='same')

    fig, ax = plt.subplots()
    color = 'C0'
    ax.plot(dates, durations, 'o', clip_on=False, color=color)
    #ax.plot(dates, mean, '--k', clip_on=False)
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    ax.tick_params(axis='x', labelrotation=45)
    ax.tick_params(axis='y', color=color, labelcolor=color)
    ax.set_ylabel('Duration (minutes)', color=color)

    color = 'C1'
    axT = ax.twinx()
    axT.plot(dates, temperature, 'o', clip_on=False, color=color)
    axT.set_ylabel('Temperature (Fahrenheit)', color=color)
    axT.tick_params(axis='y', color=color, labelcolor=color)

    plt.tight_layout()
    if out is None:
        plt.show()
    else:
        plt.savefig(out)

if __name__ == '__main__':
    main()
