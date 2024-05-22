# Notes

Private notes to myself.

## May 22, 2024

Convolutional neural networks (CNNs) are now the default tool for image classification, segmentation and many vision tasks.
In one of my projects (hydrocube) I need to track particles that are recorded with cameras, so why not use CNNs?
I went ahead and tried on synthetic data consisting of images of circles at random locations and random radii, labeled with the true position of the circles.
The model contains a series of convolutional layers, max pooling, relu activation, followed by an MLP.
This sums up to more than half a million parameters, just to track the center of a circle on a 2D image!

The real struggle came when I realized the amount of data needed to reach an acceptable accuracy: it would need 10'000 labeled images, which is far too many for me to label by hand, no need to say that I am reading the documentation of opencv right now.
