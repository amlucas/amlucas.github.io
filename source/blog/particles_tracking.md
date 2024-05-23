# Graph Neural Networks to learn an energy potential

May 23, 2024

Graph neural networks (GNNs) are an increasingly popular approach to learn from complex data structures that can be represented as graphs.
In computational science we can often represent a physical system by a graph:

* A computational grid is a set of nodes connected with each other.
* Molecular dynamics is essentially a list of particles (nodes) interacting with pairwise forces (edges).
* Unstructure grids to represent PDEs.
* Triangle mesh surfaces to represent membranes.

To test this method I generated \( N \) particles in a square 2D domain, with random positions \(\mathbf{r}_i \sim \mathcal{U}\left([0, L] \times [0, L]\right)\), \(i = 1, 2, \dots, N\).
Each particle has an associated feature \(m_i \sim \mathcal{U}(0.1, 1)\).
These are the state of the system.

Now, we define an "energy" associated with each particle, that can be computed from the state of the system:
$$
E_i = \sum\limits_{j \neq i, r_{ij} < r_c} m_i m_j w(r_{ij}),
$$
where \(r_c = 1\) is the cutoff radius, \(r_{ij}\) the distance separating particles \(i\) and \(j\) and \(w(r)=\max\left(0, 1 - \frac{r}{r_c}\right)\).
Let's suppose that we have data about the energy of particles in a given configuration, can we predict the energy of particles in a new situation, without knowing the form of the energy?


