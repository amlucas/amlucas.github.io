#!/usr/bin/env python

import argparse
from datetime import datetime
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.optimize import least_squares

def convert_duration_to_minutes(duration):
    minutes, seconds = duration.split(':')
    total_minutes = float(minutes) + float(seconds)/60
    return total_minutes

def compute_fitness(dates, day, window=60):
    f = 0
    for d in dates:
        delta = (day - d).days
        if delta > 0 and delta < window:
            f += 1
    return f

def compute_prediction(params, temperature, fitness):
    t0, tfactor, fshift, ffactor, = params
    return t0 + tfactor * temperature + ffactor * (fitness - fshift)**2

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_file_path', type=str)
    parser.add_argument('--out', type=str, default=None)
    args = parser.parse_args()

    data = pd.read_csv(args.csv_file_path)
    out = args.out

    dates = [datetime.strptime(date, '%Y-%m-%d') for date in data['date']]
    durations = np.array([convert_duration_to_minutes(duration) for duration in data['time']])

    fitness = np.array([compute_fitness(dates, d) for d in dates], dtype=float)
    temperature = data['temperature'].to_numpy()


    def f(x):
        y = compute_prediction(x, temperature, fitness)
        return y - durations

    x0 = [20.0, 0.1, 6.0, 0.1]

    res = least_squares(f, x0)

    params = res.x

    fig, ax = plt.subplots()

    ax.plot(durations, compute_prediction(params, temperature, fitness), '+')
    ax.plot([np.min(durations), np.max(durations)], [np.min(durations), np.max(durations)], '--k')

    plt.tight_layout()
    if out is None:
        plt.show()
    else:
        plt.savefig(out)

if __name__ == '__main__':
    main()
