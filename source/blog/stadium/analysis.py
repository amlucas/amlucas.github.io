#!/usr/bin/env python

import argparse
from datetime import datetime
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

def fitness(dates, day, window=60):
    f = 0
    for d in dates:
        delta = (day - d).days
        if delta > 0 and delta < window:
            f += 1
    return f

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_file_path', type=str)
    parser.add_argument('--out', type=str, default=None)
    args = parser.parse_args()

    df = pd.read_csv(args.csv_file_path)
    df.drop(index=list(range(10)), inplace=True)
    out = args.out

    dates = df['datetime'].to_numpy()
    dates = [datetime.strptime(date, '%Y-%m-%d %H:%M:%S') for date in dates]
    durations = df['duration'].to_numpy() / 60 # minutes

    fig, axes = plt.subplots(ncols=2,nrows=2)

    fitn = [fitness(dates, d) for d in dates]

    ax = axes[0,0]
    ax.plot(df['temp'], durations, 'o', clip_on=False)
    ax.set_xlabel('T [C]')
    ax.set_ylabel('time [min]')

    ax = axes[0,1]
    ax.plot(df['rhum'], durations, 'o', clip_on=False)
    ax.set_xlabel(r'humidity (percent)')
    ax.set_ylabel('time [min]')

    ax = axes[1,0]
    ax.plot(df['sleep_score'], durations, 'o', clip_on=False)
    ax.set_xlabel('sleep score')
    ax.set_ylabel('time [min]')

    ax = axes[1,1]
    ax.plot(fitn, durations, 'o', clip_on=False)
    ax.set_xlabel('number of stadiums in the past 2 months')
    ax.set_ylabel('time [min]')
    ax.set_xlim(0, max(fitn))


    plt.tight_layout()
    if out is None:
        plt.show()
    else:
        plt.savefig(out)

if __name__ == '__main__':
    main()
