#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
python3 -m http.server 8123 --bind 127.0.0.1
