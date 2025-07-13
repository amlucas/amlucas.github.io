#!/usr/bin/env python

import garth
from getpass import getpass

email = input("Enter email address: ")
password = getpass("Enter password: ")
# If there's MFA, you'll be prompted during the login
garth.login(email, password)

token = "~/.garminconnect"
garth.save(token)
print(f"saved to '{token}'")
