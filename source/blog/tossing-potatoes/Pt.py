#!/usr/bin/env python

import argparse
import matplotlib.pyplot as plt
import math
import numpy as np

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=str, default=None, help='output plot')
    args = parser.parse_args()

    out = args.out

    m = 6 # number of faces
    t = np.arange(0, 50)

    Pt = np.zeros(len(t))
    for k in range(m+1):
        Pt += (-1)**k * math.comb(m, k) * ((m-k)/m)**t
    Pt = np.clip(Pt, 0, 1)

    for t_, Pt_ in zip(t, Pt):
        print(t_, Pt_)

    fig, ax = plt.subplots()
    ax.plot(t, Pt, '-o', clip_on=False)
    ax.set_xlabel(r'$t$')
    ax.set_ylabel(r'$P_6(t)$')
    plt.tight_layout()
    if out is None:
        plt.show()
    else:
        plt.savefig(out)


if __name__ == '__main__':
    main()
