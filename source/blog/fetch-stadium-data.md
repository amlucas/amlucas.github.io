# Running the Harvard stadium: automatically retrieve data

July 12, 2025

My friends and I took the habit to run the stairs at the Harvard stadium.
The principle is simple: walk (or run!) up the big steps and down the small ones every row (37 times).
I record my time every week to keep track of my progress with my Garmin watch.
In the summer heat my friends and I asked ourselves how much the weather impacts our time.
So I wrote a python program that downloads my time from the Garmin server, and retrieves weather data at those times and location.

I used the [python-garminconnect](https://github.com/cyberjunky/python-garminconnect/tree/master) package to do so.

I usually record my stadium runs as _run activities_. 
I thus need to retrieve the run data from `garmniconnect`; note that I assume all stadium runs are within my last 1000 running activities, which is likely:

{{file_partial, "source/blog/fetch-stadium-data/retrieve_stadium_runs_and_weather.py", "python", "BLOG_FETCH_DURATIONS"}}

where `garmin` is a [Garmin](https://github.com/cyberjunky/python-garminconnect/blob/master/garminconnect/__init__.py#L16) object that contains my credentials.

All my runs are not stadium runs.
This is why I filter them using the following function, assuming each stadium run starts within 100m of the stadium location, and has a sufficient elevation gain to distinguish from the relatively flat runs in Boston (my watch usually measures between 350 and 380m for a stadium run):

{{file_partial, "source/blog/fetch-stadium-data/retrieve_stadium_runs_and_weather.py", "python", "BLOG_IS_STADIUM"}}


Now all we need to do is retrieve weather data at these activity times.
Here I have chosen to use [meteostat](https://dev.meteostat.net/python/) to do so:

{{file_partial, "source/blog/fetch-stadium-data/retrieve_stadium_runs_and_weather.py", "python", "BLOG_WEATHER"}}

Note that the data is hourly so I had to round the start times to the closest hour.
We are now ready to plot the durations and temperature of all my stadium runs!

The plot below shows the activities duration and the temperature over time.

![](../images/blog/fetch-stadium-data/raw_data.svg)

We can observe a few trends:

* the time improves when I went consistently (high density of points along the time axis)  
* not going for a few weeks resulted in higher times  
* there is some plateau time that I probably won't cross if I keep doing it this way  
* temperature seems to be a factor of performance.

But much more analysis is needed - this will be the object of a future post.
