#!/usr/bin/env python

import argparse
from datetime import datetime
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

def convert_duration_to_minutes(duration):
    minutes, seconds = duration.split(':')
    total_minutes = float(minutes) + float(seconds)/60
    return total_minutes

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_file_path', type=str)
    parser.add_argument('--out', type=str, default=None)
    args = parser.parse_args()

    data = pd.read_csv(args.csv_file_path)
    out = args.out

    dates = [datetime.strptime(date, '%Y-%m-%d') for date in data['date']]
    durations = np.array([convert_duration_to_minutes(duration) for duration in data['time']])

    tsince_last = [(dates[i] - dates[i-1]).days for i in range(1,len(dates))]

    fig, axes = plt.subplots(ncols=2,nrows=2)

    ax = axes[0,0]
    ax.plot(data['temperature'], durations, '+')
    ax.set_xlabel('T [F]')
    ax.set_ylabel('time [min]')

    ax = axes[0,1]
    ax.plot(data['humidity'], durations, '+')
    ax.set_xlabel(r'humidity (percent)')
    ax.set_ylabel('time [min]')

    ax = axes[1,0]
    ax.plot(data['wind'], durations, '+')
    ax.set_xlabel('wind speed [mph]')
    ax.set_ylabel('time [min]')

    ax = axes[1,1]
    ax.plot(tsince_last, durations[1:], '+')
    ax.set_xlabel('time since last [days]')
    ax.set_ylabel('time [min]')


    plt.tight_layout()
    if out is None:
        plt.show()
    else:
        plt.savefig(out)

if __name__ == '__main__':
    main()
