#!/usr/bin/env python

import argparse
from datetime import datetime
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=str, default='data.csv')
    args = parser.parse_args()

    df = pd.read_csv(args.data)

    def make_datetime(datetime):
        d, t = datetime.split()
        return np.datetime64(f"{d}T{t}")
    datetime = np.array([make_datetime(dt) for dt in df['datetime'].to_numpy()])
    T = df['temp']

    fig, ax = plt.subplots()
    ax.plot(datetime, T, 'o')
    ax.set_ylabel("temperature")
    plt.show()


if __name__ == '__main__':
    main()
