# Graph Neural Networks to learn an energy potential

May 20, 2024

Graph neural networks (GNNs) are an increasingly popular approach to learn from complex data structures that can be represented as graphs.
In computational science we can often represent a physical system by a graph:

* A computational grid is a set of nodes connected with each other.
* Molecular dynamics is essentially a list of particles (nodes) interacting with pairwise forces (edges).
* Unstructured grids to represent PDEs.
* Triangle mesh surfaces to represent membranes.

{{ image("../images/blog/gnn-local-interactions/dataset.svg", "The training data, 500 particles uniformly placed in a square box.", "right", 50) }}

To test this method I generated \( N \) particles in a square 2D domain, with random positions \(\mathbf{r}_i \sim \mathcal{U}\left([0, L] \times [0, L]\right)\), \(i = 1, 2, \dots, N\).
Each particle has an associated feature \(m_i \sim \mathcal{U}(0.1, 1)\).
These are the state of the system.

Now, we define an "energy" associated with each particle, that can be computed from the state of the system:
$$
E_i = \sum\limits_{j \neq i, r_{ij} < r_c} m_i m_j w(r_{ij}),
$$
where \(r_c = 1\) is the cutoff radius, \(r_{ij}\) the distance separating particles \(i\) and \(j\) and \(w(r)=\max\left(0, 1 - \frac{r}{r_c}\right)\).

The training data, 500 particles placed randomly in a square box, is illustrated on the right image.
The color shows the energy.

Let's suppose that we have data about the energy of particles in a given configuration, can we predict the energy of particles in a new situation, without knowing the form of the energy?

The GNN architecture is set as follows:
$$
y_i = \sum\limits_{j: (i,j) \in E} \phi(m_i, m_j, \mathbf{e}_{ij}),
$$
where \(y_i\) is the output at node \(i\) and the edge features are the direction between particles and their distance, \(\mathbf{e}_{ij} = \left(\mathbf{r}_{ij} / r_{ij}, r_{ij}\right)\).
The function \(\phi\) is a multi layer perceptron.
Note that in this case the direction between particles is not useful, but we assume that we don't know this information.

This is easily implemented using [pytorch-geometric](https://pytorch-geometric.readthedocs.io/en/latest/index.html):
~~~python
class EdgeConv(MessagePassing):
    def __init__(self, x_channels, e_channels, out_channels):
        super().__init__(aggr='add')
        self.mlp = nn.Sequential(nn.Linear(2 * x_channels + e_channels, 16),
                              nn.ReLU(),
                              nn.Linear(16, out_channels))

    def forward(self, x, edge_index, edge_attr):
        return self.propagate(edge_index, x=x, edge_attr=edge_attr)

    def message(self, x_i, x_j, edge_attr):
        z = torch.cat([x_i, x_j, edge_attr], dim=1)
        return self.mlp(z)


class GCN(torch.nn.Module):
    def __init__(self, x_channels, e_channels, out_channels):
        super().__init__()
        self.conv = EdgeConv(x_channels, e_channels, out_channels)

    def forward(self, data):
        x, edge_index, edge_attr = data.x, data.edge_index, data.edge_attr
        return self.conv(x, edge_index, edge_attr)
~~~

We train for 20000 epochs using the Adam optimizer with a learning rate of 0.001.
Here are the results, the model tested on a new random configuration:

{{ image("../images/blog/gnn-local-interactions/comp_xyE.svg", "", "center", 75) }}
{{ image("../images/blog/gnn-local-interactions/comp_E.svg", "", "center", 65) }}

The prediction of the energy is very close to the ground truth on the test data.
