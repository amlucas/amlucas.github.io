#!/usr/bin/env python

import argparse
import matplotlib.pyplot as plt
import numpy as np

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=str, default=None, help='output plot')
    args = parser.parse_args()

    out = args.out

    t = np.arange(0, 30)

    Pt = 1 \
        - 4 * (3/4)**t \
        + 6 * (1/2)**t \
        - 4 * (1/4)**t
    Pt[0] = 0

    for t_, Pt_ in zip(t, Pt):
        print(t_, Pt_)

    fig, ax = plt.subplots()
    ax.plot(t, Pt, '-o', clip_on=False)
    ax.set_xlabel(r'$t$')
    ax.set_ylabel(r'$P_t$')
    plt.tight_layout()
    if out is None:
        plt.show()
    else:
        plt.savefig(out)


if __name__ == '__main__':
    main()
