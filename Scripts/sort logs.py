__author__ = 'ayost'

import json
import sys
import re

f = open(sys.argv[1])

errors = {}

find_server = re.compile(r'^.*?on\s+(db\s*:?\s*)?([a-z]{2,3}\s+-\s+[a-z]{2,3}\s+-\s+\d{3}).*', re.IGNORECASE)

for line in f.readlines():
    server = re.sub(find_server, r'\2', line).strip()
    if server not in errors:
        errors[server] = []
    errors[server].append(line.strip())

print(json.dumps(errors, indent=2, sort_keys=True))
