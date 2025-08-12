# Running the Harvard stadium: what makes me run faster?

August 9, 2025

Running the stairs at the Harvard stadium always feels rough (and yet I keep doing it because it's really fun to do with friends).
In a previous post, I have described how I could automatically [retrieve statistics and weather data](./fetch-stadium-data.html) of all my stadium runs.
Today I want to see if one can understand this data: Can I predict the run time, given weather and sleep scores data? What parameters are most important?

So far I have collected \(N=67\) data points, still in the low-data regime, so deep learning won't work.
But maybe we can learn a lot with a simple linear model,
$$
y = \mathbf{\theta} \cdot \mathbf{x},
$$
where \(y\) is the duration of the stadium runs, \(\mathbf{x}\) the input features (temperature, dew point, sleep score, number of stadiums I ran within the past 2 months prior this run, or combination of these variables), and \(\mathbf{\theta}\) are parameters of the model, to be inferred. 
The input features also contain an entry of value \(1\), to allow for a bias.

It is clear that the run duration depends on a lot more variables than these features: what I ate before running, if I feel like pushing hard, if someone is in front of me and I cannot pass them, if a friend pushes/pulls me to go faster...
We model these unknowns with Gaussian noise added to the output of the linear model:
$$
y_k = \mathbf{\theta} \cdot \mathbf{x}_k + \sigma \xi, \;\; k=1,\dots,N,
$$
where \(\sigma\) is a positive scalar to infer and \(\xi \sim \mathcal{N}(0, 1)\) are i.i.d. normally distributed random variables.
The likelihood corresponding to the data \(\mathcal{D} = \{\mathbf{x}_k, y_k\}\) reads
$$
P(\mathcal{D} | \mathbf{\theta}, \sigma) = \prod\limits_{i=1}^N \frac{1}{\sqrt{2\pi \sigma^2}} \exp\left( -\frac{(y_k - \mathbf{\theta} \cdot \mathbf{x}_k)^2}{2 \sigma^2} \right).
$$
Taking the logarithm, we get the log likelihood
$$
\log (\mathcal{D} | \mathbf{\theta}, \sigma) = - \sum\limits_{i=1}^N \frac{(y_k - \mathbf{\theta} \cdot \mathbf{x}_k)^2}{2 \sigma^2} - \frac{N}{2}\log{2\pi \sigma^2}.
$$
The maximum likelihood gives us the best parameters to fit the data:
$$
\mathbf{\hat{\theta}} = (X^T X)^{-1} (X^T Y), \quad \quad  \hat{\sigma} = \sqrt{\frac{1}{2N} (Y - X \hat{\theta})\cdot(Y - X \hat{\theta})},
$$
where \(X\) is a matrix whose rows contain the features of each sample, and \(Y\) is a vector containing the duration of all samples. 
Here is the list of features I have used:

* temperature;
* dewpoint;
* sleep score (as estimated by my watch);
* number of times I have run the stadium in the past 2 months;
* month of the year;
* time of the day;
* all quadratic combinations of the above.

The program is very simple and only requires solving a linear system with the size of the number of features.
Below are the results of the predictions:

{{ image("../images/blog/analyze-stadium-data/predictions.svg", "Predictions of the model against the real values used to calibrate this model. Error bars correspond to 1 \(\sigma\).", "center", 75) }}

The model seems to do reasonably well, at least in capturing the general trends.
The important question now is the following: what are the important variables to predict the run time?

We assume that until now we have explored a reasonably wide set of conditions.
Thus, we can expect each input feature to take values with a standard deviation that is close to the empirical one.
The importance of feature \(i\) on the duration can be quantified with first order Sobol indices, computed as
$$
S_i = \frac{\hat{\theta}_i^2 \sigma_i^2}{\sum\limits_{k=1}^N \hat{\theta}_k^2 \sigma_k^2},
$$
where \(\sigma_i^2 = \mathrm{Var}[X_i]\).
The list of features and their first order Sobol index are summarized below:

```
temp                      : S=2.965e-01
sleep_score               : S=1.641e-01
sleep_score * sleep_score : S=1.569e-01
sleep_score * temp        : S=1.039e-01
dwpt                      : S=6.586e-02
hour * temp               : S=2.944e-02
hour * dwpt               : S=2.788e-02
temp * temp               : S=2.558e-02
num_runs_2m * num_runs_2m : S=2.119e-02
hour * sleep_score        : S=1.966e-02
month * month             : S=1.458e-02
num_runs_2m * sleep_score : S=1.198e-02
month * num_runs_2m       : S=1.103e-02
hour                      : S=9.858e-03
dwpt * temp               : S=8.317e-03
month * sleep_score       : S=5.056e-03
month * temp              : S=4.274e-03
hour * hour               : S=4.237e-03
month * dwpt              : S=4.218e-03
hour * month              : S=3.899e-03
num_runs_2m * temp        : S=3.733e-03
dwpt * dwpt               : S=2.436e-03
month                     : S=2.003e-03
hour * num_runs_2m        : S=1.588e-03
sleep_score * dwpt        : S=1.021e-03
num_runs_2m * dwpt        : S=6.389e-04
num_runs_2m               : S=1.508e-04
1                         : S=0.000e+00
```

Perhaps unsurprisingly, the temperature is the most important feature to predict the run time, followed by the sleep score and the dewpoint (related to humidity).

So now we can ask, given this model and this data, what are the perfect conditions to run the stairs?
What I did here is to replace in my feature vectors one quantity of interest at a time, and compute the average of the predicted durations.
Here is what I got for the temperature, sleep score, and dew point:
{{image_row, [
  ["../images/blog/analyze-stadium-data/optimal_temp.svg", "", 32],
  ["../images/blog/analyze-stadium-data/optimal_sleep_score.svg", "", 32],
  ["../images/blog/analyze-stadium-data/optimal_dewpoint.svg", "", 32],
]}}

So according to this simple model, the best temperature to run the stadium would be around 15 Celcius degrees, with a dewpoint at 3 Celcius degrees and after a relatively good night of sleep (score of 80).
Obviously this analysis relies on crude assumptions, such as the form of this simple model, but we still obtain reasonable values.
This certainly won't limit my stadium runs to these "optimal" conditions, I'm sure that the main factor is more training!

The results were produced with the following code:
{{file_full, "source/blog/analyze-stadium-data/main.py", "python", "spoiler"}}


