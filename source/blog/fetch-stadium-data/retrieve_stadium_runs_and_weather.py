#!/usr/bin/env python

import argparse
import datetime
from datetime import datetime
from garminconnect import Garmin, GarminConnectAuthenticationError
# START_BLOG_WEATHER
from meteostat import Point, Hourly

# END_BLOG_WEATHER
import pandas as pd

# START_BLOG_IS_STADIUM
# lat, lon of the stadium
LAT_STADIUM =  42.3669
LON_STADIUM = -71.1260

def is_stadium_run(activity):
    try:
        lat = activity['startLatitude']
        lon = activity['startLongitude']
        el = activity['elevationGain']

        m_per_degrees = 110 * 1000
        dist = m_per_degrees * ((lat - LAT_STADIUM)**2 + (lon - LON_STADIUM)**2)**(1/2)
        dist_threshold = 100 # m

        if dist < dist_threshold and el > 300 and el < 400:
            return True
    except:
        return False
    return False
# END_BLOG_IS_STADIUM

# START_BLOG_FETCH_DURATIONS
def retrieve_stadium_dates_and_durations(garmin):
    start_times = []
    durations = []
    activities = garmin.get_activities(start=0, limit=1000, activitytype='running')
    for activity in activities:
        if is_stadium_run(activity):
            start_times.append(activity['startTimeLocal'])
            durations.append(activity['duration'])

    return start_times, durations
# END_BLOG_FETCH_DURATIONS

def retrieve_sleep_scores(garmin, start_times):
    scores = []
    for t in start_times:
        cdate = t.split(' ')[0]
        data = garmin.get_sleep_data(cdate)
        scores.append(data['dailySleepDTO']['sleepScores']['overall']['value'])
    return scores

# START_BLOG_WEATHER
def retrieve_weather_data(start_times):
    location = Point(LAT_STADIUM, LON_STADIUM)
    date_times = pd.to_datetime(start_times)
    date_times_hour = date_times.round('h')

    start = date_times_hour.min().to_pydatetime()
    end = date_times_hour.max().to_pydatetime()

    data = Hourly(location, start, end)
    data = data.fetch()

    df = data.loc[date_times_hour]
    df = df.reset_index()
    df.rename(columns={'index' :'datetime'}, inplace=True )
    df['datetime'] = date_times
    return df
# END_BLOG_WEATHER

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=str, default='data.csv')
    args = parser.parse_args()

    try:
        tokenstore = '~/.garminconnect'
        garmin = Garmin()
        garmin.login(tokenstore)
    except (FileNotFoundError, GarthHTTPError, GarminConnectAuthenticationError):
        print(f"Login tokens not found in {tokenstore}.")

    start_times, durations = retrieve_stadium_dates_and_durations(garmin)
    sleep_scores = retrieve_sleep_scores(garmin, start_times)

    df = retrieve_weather_data(start_times)
    df['duration'] = durations
    df['sleep_score'] = sleep_scores

    df.sort_values(by='datetime', inplace=True)
    df.to_csv(args.out, index=False)



if __name__ == '__main__':
    main()
