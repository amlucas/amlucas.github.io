#!/usr/bin/env python

import argparse
import matplotlib.pyplot as plt
import numpy as np
import os
import pandas as pd

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_data', type=str, help='Path to csv file')
    parser.add_argument('--skip', type=int, default=7, help='number of first points to skip for the analysis')
    parser.add_argument('--out-dir', type=str, default=None, help='output directory')
    args = parser.parse_args()

    out_dir = args.out_dir
    skip = args.skip
    df = pd.read_csv(args.csv_data, parse_dates=['datetime'])

    Xvars = ['temp', 'dwpt', 'sleep_score']
    Yvar = 'duration'

    X = []
    Y = df[Yvar].to_numpy()[skip:]

    for var in Xvars:
        X.append(df[var].to_numpy()[skip:])

    # Engineered variable: number of runs the past 2 months
    time = df['datetime'].to_numpy()
    num_runs_2m = []
    for t in time[skip:]:
        n = np.count_nonzero(np.logical_and(time <= t, t - pd.DateOffset(days=60) < time))
        num_runs_2m.append(n)
    #X.append(np.array(num_runs_2m))
    #Xvars.append('num_runs_2m')

    # Engineered variable: time of the year
    X.append(pd.to_datetime(df['datetime']).dt.month[skip:])
    Xvars.append('month')

    X.append(pd.to_datetime(df['datetime']).dt.hour[skip:])
    Xvars.append('hour')

    # add quadratic term for features
    nbase = len(X)
    for i in range(nbase):
        for j in range(i+1):
            X.append(X[i] * X[j])
            Xvars.append(f'{Xvars[i]} * {Xvars[j]}')

    # bias
    X.append(np.ones_like(X[0]))
    Xvars.append('1')

    # max likelihood estimate
    X = np.array(X).T
    Y = np.array(Y)

    A = X.T @ X
    b = np.dot(Y, X)

    theta = np.linalg.solve(A, b)
    sigma = np.sqrt( np.mean((Y - X @ theta)**2) / 2 )


    # test sensitivity of the model
    n = len(theta)
    varx = np.var(X, axis=0)
    sobol_indices = theta**2 * varx
    sobol_indices /= np.sum(sobol_indices)

    for i in reversed(np.argsort(sobol_indices)):
        print(f"{Xvars[i].ljust(26)}: S={sobol_indices[i]:.3e}")

    # plot predictions
    Ypred = X @ theta

    tlo = 22
    thi = 26

    fig, ax = plt.subplots(figsize=(6,6))
    ax.errorbar(Y/60, Ypred/60, yerr=sigma/60, fmt='o', capsize=2)
    ax.plot([tlo, thi], [tlo, thi], '--k')
    ax.set_xlim(tlo, thi)
    ax.set_ylim(tlo, thi)
    ax.set_aspect('equal')
    ax.set_xlabel('run time (min)')
    ax.set_ylabel('predicted run time (min)')
    plt.tight_layout()
    if out_dir:
        plt.savefig(os.path.join(out_dir, 'predictions.svg'))
    else:
        plt.show()


    figsize = (3, 2.2)
    # best temperature?
    Tmin = -10
    Tmax = 40

    temps = np.linspace(Tmin, Tmax, 500)
    mean_duration = []
    std_duration = []
    for T in temps:
        X_ = X.copy()
        X_[:,0] = T
        k = nbase
        for i in range(nbase):
            for j in range(i+1):
                X_[:,k] = X_[:,i] * X_[:,j]
                k += 1
        mean_duration.append(np.mean(X_ @ theta))
        std_duration.append(np.sqrt(np.var(X_ @ theta) + sigma**2))

    mean_duration = np.array(mean_duration) / 60
    std_duration = np.array(std_duration) / 60

    id_T_opt = np.argmin(mean_duration)
    T_opt = temps[id_T_opt]

    fig, ax = plt.subplots(figsize=figsize)
    ax.fill_between(temps, mean_duration-std_duration, mean_duration+std_duration, lw=0, alpha=0.1, color='C0')
    ax.plot(temps, mean_duration)
    ax.plot([temps[id_T_opt]], [mean_duration[id_T_opt]], 'o', color='C0', markersize=10)
    ax.set_xlabel('temperature (Celcius degrees)')
    ax.set_ylabel('run time (min)')
    ax.set_xlim(Tmin, Tmax)
    plt.tight_layout()
    if out_dir:
        plt.savefig(os.path.join(out_dir, 'optimal_temp.svg'))
    else:
        plt.show()
    plt.close()

    # best sleep score?
    ssmin = 50
    ssmax = 100

    sleep_scores = np.linspace(ssmin, ssmax, 500)
    mean_duration = []
    std_duration = []
    for ss in sleep_scores:
        X_ = X.copy()
        X_[:,2] = ss
        k = nbase
        for i in range(nbase):
            for j in range(i+1):
                X_[:,k] = X_[:,i] * X_[:,j]
                k += 1
        mean_duration.append(np.mean(X_ @ theta))
        std_duration.append(np.sqrt(np.var(X_ @ theta) + sigma**2))

    mean_duration = np.array(mean_duration) / 60
    std_duration = np.array(std_duration) / 60

    id_ss_opt = np.argmin(mean_duration)
    ss_opt = sleep_scores[id_ss_opt]

    fig, ax = plt.subplots(figsize=figsize)
    ax.fill_between(sleep_scores, mean_duration-std_duration, mean_duration+std_duration, lw=0, alpha=0.1, color='C0')
    ax.plot(sleep_scores, mean_duration)
    ax.plot([sleep_scores[id_ss_opt]], [mean_duration[id_ss_opt]], 'o', color='C0', markersize=10)
    ax.set_xlabel('sleep score')
    ax.set_ylabel('run time (min)')
    ax.set_xlim(ssmin, ssmax)
    plt.tight_layout()
    if out_dir:
        plt.savefig(os.path.join(out_dir, 'optimal_sleep_score.svg'))
    else:
        plt.show()
    plt.close()


    # best dew point?
    dpmin = -20
    dpmax = 20

    dewpoints = np.linspace(dpmin, dpmax, 500)
    mean_duration = []
    std_duration = []
    for dp in dewpoints:
        X_ = X.copy()
        X_[:,1] = dp
        k = nbase
        for i in range(nbase):
            for j in range(i+1):
                X_[:,k] = X_[:,i] * X_[:,j]
                k += 1
        mean_duration.append(np.mean(X_ @ theta))
        std_duration.append(np.sqrt(np.var(X_ @ theta) + sigma**2))

    mean_duration = np.array(mean_duration) / 60
    std_duration = np.array(std_duration) / 60

    id_dp_opt = np.argmin(mean_duration)
    dp_opt = dewpoints[id_dp_opt]

    fig, ax = plt.subplots(figsize=figsize)
    ax.fill_between(dewpoints, mean_duration-std_duration, mean_duration+std_duration, lw=0, alpha=0.1, color='C0')
    ax.plot(dewpoints, mean_duration)
    ax.plot([dewpoints[id_dp_opt]], [mean_duration[id_dp_opt]], 'o', color='C0', markersize=10)
    ax.set_xlabel('dew point (Celcius degrees)')
    ax.set_ylabel('run time (min)')
    ax.set_xlim(dpmin, dpmax)
    plt.tight_layout()
    if out_dir:
        plt.savefig(os.path.join(out_dir, 'optimal_dewpoint.svg'))
    else:
        plt.show()
    plt.close()

    print(f"Best temperature: {T_opt}")
    print(f"Best sleep score: {ss_opt}")
    print(f"Best dew point:   {dp_opt}")


if __name__ == '__main__':
    main()
