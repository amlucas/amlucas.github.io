#!/usr/bin/env python

import argparse
import matplotlib.pyplot as plt
import math
import numpy as np
from scipy.stats import binom

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=str, default=None, help='output plot')
    args = parser.parse_args()

    out = args.out

    N = 40
    t = np.arange(1, 50)

    Pt = 1 \
        - 4 * (3/4)**t \
        + 6 * (1/2)**t \
        - 4 * (1/4)**t

    median = binom.median(N, Pt)
    lo = binom.ppf(0.05, N, Pt)
    hi = binom.ppf(0.95, N, Pt)

    fig, ax = plt.subplots()
    ax.errorbar(t, median, yerr=np.stack((median-lo, hi-median)), capsize=3, fmt='-o', clip_on=False)
    ax.set_xlabel(r'Number of tosses $t$')
    ax.set_ylabel(r'Number of well cooked potatoes $k$ out of $N={}$'.format(N))
    plt.tight_layout()
    if out is None:
        plt.show()
    else:
        plt.savefig(out)


if __name__ == '__main__':
    main()
