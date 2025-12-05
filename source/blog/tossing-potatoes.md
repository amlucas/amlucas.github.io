# Tossing potatoes

December 2, 2025

Tonight I have prepared sautéed potatoes.
It's pretty simple: cut the potatoes in rough cubes, ideally of the same size, and throw them in a pan that contains enough oil (or better, duck fat).
Then you just need to sauté them while they cook on a relatively high heat.
Salt, pepper, and there you have it, crispy sautéed potatoes.

As I was cooking my potatoes, I asked myself: how many times should I toss them?

Let's try to estimate this. 
We have \(N\) potatoes with four sides.
Every time I toss the potatoes, each cube lands randomly on one of its sides with equal probabilities, assuming my tossing technique is good enough.
We'll assume that a potato cube is well cooked only after each of its four sides has been against the pan. 

Let's first look at a single potato cube: what's the probability \(P(t)\) that it is well cooked after \(t\) tosses? 
It's a combinatorial problem, let's break it down:

1. \(P(t) = 1 - P(\text{at least one side never touched the pan})\)
2. There are \(4^t\) possible sequences.
3. There are \(3^t\) possible sequences that have never touched face \(1\). The same applies to face 2, 3, and 4.
4. \(4 \cdot 3^t\) is more than the number of sequences that miss at least one side: for example, sequences where faces 1 and 2 are both missing will be counted twice.
Thus, we need to subtract the number of sequences where two faces were missing.
There are \({4 \choose 2} = 6\) possible missing doublets, and each of them have \(2^t\) possible sequences.
Therefore we remove \(6\cdot 2^t\) of these double counted sequences.
Finally, removing this number, we have removed cases where 3 faces were missing from the whole sequence.
The first term counted them 3 times, while the second term counts them also 3 times, thus we need to add them back to count them exactly once.

The final result is 
$$
\begin{aligned}
P(t) &= 1 - \frac{1}{4^t} \left(4 \cdot 3^t - 6 \cdot 2^t + 4 \cdot 1^t \right) \\
&= 1 - 4 \cdot \left(\frac{3}{4}\right)^t + 6 \cdot \left(\frac{1}{2}\right)^t - 4 \cdot \left(\frac{1}{4}\right)^t.
\end{aligned}
$$
This follows the [inclusion-exclusion principle](https://en.wikipedia.org/wiki/Inclusion%E2%80%93exclusion_principle).

Of course potato cubes have 6 faces, not 4, oops.
Luckily, this gave us an intuition of the inclusion-exclusion principle.
The generalization of the above result for \(m\) faces is given by:
$$
P_m(t) = \sum\limits_{k=0}^m (-1)^k {m \choose k} \left( \frac{m-k}{m} \right)^t.
$$

The probability \(P_m(t)\) tends exponentially to 1 as \(t\) increases, as illustrated in the following figure:

{{image("../images/blog/tossing-potatoes/Pt.svg", "Probability that a potato has touched all 6 sides after t tosses.", "center", 70)}}

As expected, under 6 tosses, the probability that the potato is well cooked is zero, because it cannot have been on 6 faces.
The figure shows that after 27 tosses, there is already more than 95% probability that the potato cube has visited all 6 faces.
I don't have only one potato piece, but \(N\) of them (say 40).
The number of well cooked potatoes follows a binomial distribution, with success probability \(P_6(t)\).

{{image("../images/blog/tossing-potatoes/binomial.svg", "Median number of well cooked potatoes out of \(N=40\), against the number of tosses. Error bars indicate the 5 to 95% quantiles.", "center", 70)}}

In my pan, most of the 40 potatoes will be well cooked after about 30 tosses.
It's hard work, but totally worth it.

Of course many of the approximations I made are impractical, and this shouldn't serve as a 3 Michelin star level cooking guide. 
But this little exercise made me discover the inclusion-exclusion principle, and next time I'll count how many tosses I naturally do.

The figures were produced with these two scripts:
{{file_full, "source/blog/tossing-potatoes/Pt.py", "python", "spoiler"}}
{{file_full, "source/blog/tossing-potatoes/binomial.py", "python", "spoiler"}}


