# Research

I develop computational methods and software to simulate and control microscale systems such as blood flow and artificial microswimmers.
My work combines high-performance computing, fluid dynamics, Bayesian inference, and artificial intelligence to enable biomedical applications like targeted drug delivery and flow manipulation in microfluidics.


## High performance computing for simulating blood...

<img src="./images/rbc_tube.png" class="float-img-right" />

Simulating blood at the cellular resolution is a complex task, as it involves resolving hydrodynamics between deforming cells.
Blood is mainly composed of red blood cells (RBCs), and one of the contributions during my PhD was to accurately model these cells and their interactions at large scale.
We use particles to represent RBCs and all fluids, via the dissipative particle dynamics (DPD) method.
The membranes are discretized into a triangle mesh and elastic forces arise from bending and stretching energy potentials.
Simulations typically consist of millions to billions of these particles, and we thus implemented a custom software package, [Mirheo](https://github.com/cselab/Mirheo).
Mirheo is implemented in C++/Cuda/MPI and has above 98% weak scaling efficiency over 1000 GPUs.
Check out our [2020 paper in _Computer Physics Communications_](https://doi.org/10.1016/j.cpc.2020.107298) for benchmarks and implementation details.


## ...and artificial microswimmers

<img src="./images/ABF_single_tube.png" class="float-img-left" />

Artificial bacterial flagella (ABFs) are micron-sized devices equiped with a magnetic head and a corkscrew shaped body, which makes them able to propel when they are immersed in a rotating magnetic field.
They are great candidates to reach specific regions in the body in a non-invasive way by swimming through the circulatory system of the body.
I have extended our custom software Mirheo to simulate ABFs in blood.
One particular focus of my research tries to answer the following question: _how to control the external magnetic field to guide ABFs to a target?_

<img src="./images/ABF_retina_RL.png" class="float-img-right" />

One possible approach is to use reinforcement learning (RL).
RL learns a control policy by interacting with an environment.
Typically, RL converges after thousands of episodes, while one simulation of ABFs in blood require thousands of GPU-hours.
Instead we train the RL agent on reduced order models, which are much cheaper.
We then test the learned policy in large scale simulations, as shown on the picture on the right.
Details are available in our [2025 article in _Physics of Fluids_](https://doi.org/10.1063/5.0274623).
RL was also useful to design control policies that control multiple ABFs, a difficult task given that the magnetic field is essentially uniform at these scales.
Additional details can be found in our [2022 article in _Advanced Intelligence Systems_](https://doi.org/10.1002/aisy.202100183).



## ODIL: a method for control and path planning

<img src="./images/hydrocube_picture.png" class="float-img-right" />

Reinforcement learning is a great tools for control, but does not always converge in the settings I am interesting in.
Furthermore, I typically have a model of the systems I want to control. 
This lead us to developping a novel method that learns policies from a path planning objective and from the dynamics of the system in the form of an ODE or a PDE.

The method relies on ODIL, developped at CSE-Lab, originally used to solve PDE-based inverse problems.
In the context of control and path planning, we use ODIL to solve both the system dynamics and the control policy at the same time.
This approach is more efficient than RL in numerous benchmarks, summarized in our [2025 article published in _Physical Review Letters_](https://doi.org/10.1103/PhysRevLett.134.044001).

To check the performance of that method, we have built a robotic device (shown in the right picture) that creates flow with rotating disks.
Using the policy found by ODIL, the device can transport small beads to precise targets, as explained in our [2025 publication in _Journal of Fluid Mechanics_](https://doi.org/10.1017/jfm.2025.10174).
I have built this robot with [Petr Karnakov](https://pkarnakov.com/) in less than two months to participate at the [MassRobotics Form and Function Challenge](https://www.massrobotics.org/massrobotics-announces-form-function-challenge-winners-showcases-first-accelerator-cohort-at-the-robotics-summit-expo/) where we have placed second over more than 40 participants.

