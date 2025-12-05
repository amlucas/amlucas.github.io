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

    m = 6 # number of faces

    N = 40
    t = np.arange(0, 50)

    Pt = np.zeros(len(t))
    for k in range(m+1):
        Pt += (-1)**k * math.comb(m, k) * ((m-k)/m)**t
    Pt = np.clip(Pt, 0, 1)

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
