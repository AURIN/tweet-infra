#!/bin/bash

curl -XPUT "http://localhost:5984/_users" --user "${COUCHDB_USER}:${COUCHDB_PASSWORD}"
curl -XPUT "http://localhost:5984/_global_changes" --user "${COUCHDB_USER}:${COUCHDB_PASSWORD}"
curl -XPUT "http://localhost:5984/_metadata" --user "${COUCHDB_USER}:${COUCHDB_PASSWORD}"
curl -XPUT "http://localhost:5984/_replicator" --user "${COUCHDB_USER}:${COUCHDB_PASSWORD}"
