# tweet-infra
Tweets harvesting and storage infrastucture


## Architecture

The CouchDB cluster is hidden behind a nApache-base load-balancer, which takes care of authentication.


## Development machine pre-requirements

* Node.js 6.x installed
* NPM 3.x installed
* Grunt installed `sudo npm install -g grunt --save-dev`
* Grunt-cli installed `npm install grunt-cli --save-dev`
* Docker installed and its daemon running on TCP port 2375 
  (add this line to the `/etc/default/docker` file: 
  `DOCKER_OPTS="-H tcp://0.0.0.0:2375 -H unix:///var/run/docker.sock" --insecure-registry cuttlefish.eresearch.unimelb.edu.au --insecure-registry docker.eresearch.unimelb.edu.au`
  and restart the Docker daemon (`sudo systemctl daemon-reload`)
* Install tweet-infra: `npm install`


## Cluster Requirements

On average 2.2GB of space are needed for every 1M tweets with a replication factor of 3. 
Therefore, some 194GB are needed (on each node) to host the about 90M tweets that have been harvested so far.
In addition, 182M tweets are expected to be collected every year, hence 393GB are needed, per-node, every year. 

Total storage need to (on a four-node cluster, with some slack) are as follows:
* Existing 90M tweets take 194GB * 4 = 778GB 
* New (yearly) 180M tweets take 393G * 4 = 1573GB 

To keep the system running for 4 years and store the already collected tweets, the total storage space would be:
around 7072GB (or 1768GB per-node).

4 database nodes with 1.7TB each should be enough to cover for contingencies, but periodic compaction would probably 
lessen the disk space needed. 

On the computer used to 


## Security

The load-balancer defined three users:
* readonly (`/couchdbro` path): user that is allowed only to issues GET, HEAD and OPTIONS HTTP methods  
* harvester (`/couchdbh` path): user that is allowrd to modify CouchDB, bar what is allowed to admins only
* admin (`/` path): CouchDB admin (can be used to setup the CouchDB cluster, since it is mapped to port 5986) 

The `admin` user is a CouchDB user as well (same password). 


## Provisioning

```
grunt launchnodes 
grunt launchvolumes
```

To make life easier, the cluster IP addresses should be added to `/etc/hosts`, by
taking the output of `grunt listnodes --hosts-format` and adding it to `/etc/hosts`. 

```
grunt build 
grunt push
grunt pull
grunt create
grunt generate
grunt start
```

## Starting Apache with CLI

```
docker create --network host --volume /home/ubuntu:/hostvolume --name apache\
   cuttlefish.eresearch.unimelb.edu.au/apache:2.4.43
```


## CouchDB setup

Creation of default database
```
export NODES=`cat /etc/hosts | egrep "tweet-.-db" | cut -f 1 -d' ' | paste -d' ' -s`
export DATABASES='_users _global_changes _metadata _replicator'
for ip in ${NODES}
do
  for db in ${DATABASES}
  do
    grunt http:createdb --masterip=${ip} --database=${db}
  done
done
```

Cluster setup (tweet-1-db is the manager)
```
export NODES=`cat /etc/hosts | egrep "tweet-[234567889]-db" | cut -f 1 -d' ' | paste -d' ' -s`
for ip in ${NODES}
do
  grunt http:addcouchnode --masterip=tweet-1-db --slaveip=${ip}
done
```

This should show all the nodes being part of the cluster
```
grunt http:clusternodes --masterip=tweet-1-db && cat /tmp/membership.json
```

Create the twitter database and accompanying design documents
```
grunt http:createdb --masterip=tweet-1-db --database=twitter
grunt http:createdb --masterip=tweet-1-db --database=instagram
grunt couch-compile couch-push --masterip=tweet-1-lb --port=80
```

Create the instagram indexes
```
grunt http:addgeoindex --masterip=tweet-1-db --database=instagram --no-color && jq '.' /tmp/a.log -M 
grunt http:listindexes --masterip=tweet-1-db --database=instagram --no-color && jq '.' /tmp/a.log -M
```

Selects instagram by position and time
```
grunt http:querygeo --masterip=tweet-1-db --database=instagram --no-color && jq '.' /tmp/a.log -M 
```

Drop the instagram indexes
```
grunt http:delgeoindex --masterip=tweet-1-db --database=instagram --index=indexes/json/geo-index--no-color && jq '.' /tmp/a.log -M 
```

## Database creations on development (numberCruncher sevevr)

(Change the admin password accordingly in sensitive.json before)
```
grunt http:deletedb --masterip=numberCruncher --port=80 --database=twitter
grunt http:deletedb --masterip=numberCruncher --port=80 --database=instagram
grunt http:createdb --masterip=numberCruncher --port=80 --database=twitter
grunt http:createdb --masterip=numberCruncher --port=80 --database=instagram
grunt couch-compile couch-push --masterip=numberCruncher --port=80 
````


## Deployment tests

This should return a valid GeoJSON for the Melbourne area in `/tmp/b.geojson` (read the password from teh `sensitive.json` file)
```
curl -XGET "http://tweet-1-lb/couchdbro/instagram/_design/instagram/_list/geojson/timegeo?\
reduce=false&start_key=\[2014,1,15,\"r1r0\"\]&end_key=\[2014,1,31,\"r1r1\"\]&skip=0&limit=5"\
  --user "readonly:ween7ighai9gahR6"

curl -XGET "http://tweet-1-lb/couchdbro/twitter/_design/twitter/_list/geojson/geoindex?\
reduce=false&start_key=\[\"r1r\",2017,1,1\]&end_key=\[\"r1rzzzzzzzzzz\",2017,\{\},\{\}\]"\
  --user "readonly:ween7ighai9gahR6"\
  -o /tmp/b.geojson
cat /tmp/b.geojson
```


## Querying

```
curl -XGET "http://45.113.232.90/couchdbro/twitter/_design/twitter/_view/summary?reduce=true&start_key=\[\"adelaide\",2014,7,28\]&end_key=\[\"sydney\",2017,7,1\]&group_level=3" \
  --user "readonly:ween7ighai9gahR6"

curl -XGET "http://45.113.232.90/couchdbro/twitter/_design/twitter/_view/summary?reduce=true&start_key=\[\"adelaide\",2014,7,28\]&end_key=\[\"adelaide\",2017,1,1\]"\
  --user "readonly:ween7ighai9gahR6"

curl -XGET "http://45.113.232.90/couchdbro/twitter/_design/twitter/_view/summary?reduce=false&include_docs=true&start_key=\[\"adelaide\",2014,7,28\]&end_key=\[\"adelaide\",2017,1,1\]"\
  -vvv --user "readonly:ween7ighai9gahR6" -o /tmp/twitter.json
````




## De-commissioning

```
grunt remove
grunt destroyvolumes
grunt destroynodes 
```

NOTE: due ot a bug somewhere, volumes are not actually deleted after being detached, hence they have to be deleted using the NeCTAR dashboard.


curl -XPOST "http://admin:aeyiefiethaeBea2@tweet-1-db:5984/instagram/_find" \
--header "Content-Type: application/json" \
--data '{
   "fields" : ["_id", "user.lang", "user.screen_name", "text", "created_at", "coordinates"],
   "selector": {
      "$and": [
        {"coordinates.coordinates": {"$gt": [100, -31]}},
        {"coordinates.coordinates": {"$lt": [116, -33]}},
        {"created_time": {"$gt": "0"}}
      ]
   }
}' -vvv

curl -XPOST "http://admin:aeyiefiethaeBea2@tweet-1-db:5984/instagram/_find" \
--header "Content-Type: application/json" \
--data '{
   "fields" : ["_id", "user.lang", "user.screen_name", "text", "created_at", "coordinates"],
   "selector": {
     "_id": "1000017972733809557_760934995"
   }
}' -vvv


## Upgrqde eo CouchDB 2.3.1

* Pull the image
```shell script
docker login cuttlefish.eresearch.unimelb.edu.au\
 --password <password>\
 --username developer
docker pull cuttlefish.eresearch.unimelb.edu.au/couchdbc:2.3.1
```

* Create a container
(grab the `HOSTNAME` with `docker inspect $(docker ps --quiet) | grep NODENAME`)
```shell script

# tweet-1-db
docker create --network=host\
  --volume='/mnt/couchdbdatavolume:/datavolume'\
  --name couchdbc\
  --env NODENAME='45.113.232.75'\
  --env COUCHDB_USER='admin'\
  --env COUCHDB_PASSWORD='<password>'\
  --env CLUSTER_NODES_LIST='tweet-1-db:45.113.232.75,tweet-1-lb:45.113.232.90,tweet-2-db:45.113.232.71,tweet-3-db:45.113.232.68,tweet-4-db:45.113.232.79'\
  cuttlefish.eresearch.unimelb.edu.au/couchdbc:2.3.1
docker start couchdbc

# tweet-2-db
docker create --network=host\
  --volume='/mnt/couchdbdatavolume:/datavolume'\
  --name couchdbc\
  --env NODENAME='45.113.232.71'\
  --env COUCHDB_USER='admin'\
  --env COUCHDB_PASSWORD='<password>'\
  --env CLUSTER_NODES_LIST='tweet-1-db:45.113.232.75,tweet-1-lb:45.113.232.90,tweet-2-db:45.113.232.71,tweet-3-db:45.113.232.68,tweet-4-db:45.113.232.79'\
  cuttlefish.eresearch.unimelb.edu.au/couchdbc:2.3.1
docker start couchdbc

# tweet-3-db
docker create --network=host\
  --volume='/mnt/couchdbdatavolume:/datavolume'\
  --name couchdbc\
  --env NODENAME='45.113.232.68'\
  --env COUCHDB_USER='admin'\
  --env COUCHDB_PASSWORD='<password>'\
  --env CLUSTER_NODES_LIST='tweet-1-db:45.113.232.75,tweet-1-lb:45.113.232.90,tweet-2-db:45.113.232.71,tweet-3-db:45.113.232.68,tweet-4-db:45.113.232.79'\
  cuttlefish.eresearch.unimelb.edu.au/couchdbc:2.3.1
docker start couchdbc

# tweet-3-db
docker create --network=host\
  --volume='/mnt/couchdbdatavolume:/datavolume'\
  --name couchdbc\
  --env NODENAME='45.113.232.79'\
  --env COUCHDB_USER='admin'\
  --env COUCHDB_PASSWORD='<password>'\
  --env CLUSTER_NODES_LIST='tweet-1-db:45.113.232.75,tweet-1-lb:45.113.232.90,tweet-2-db:45.113.232.71,tweet-3-db:45.113.232.68,tweet-4-db:45.113.232.79'\
  cuttlefish.eresearch.unimelb.edu.au/couchdbc:2.3.1
docker start couchdbc
```

Check n. of documents on different servers:
```shell script
USER=`jq '.couchdb.authadmin' sensitive.json | sed s/\"//g`
echo '' > /tmp/instagram.txt
for n in {1..4}; do 
  echo "http://tweet-${n}-db:5984/instagram"
  curl -XGET "http://tweet-${n}-db:5984/instagram" --user "${USER}"\
  | jq '.doc_count' >> /tmp/instagram.txt
done
cat /tmp/instagram.txt

echo '' > /tmp/twitter.txt
for n in {1..4}; do 
  echo "http://tweet-${n}-db:5984/twitter"
  curl -XGET "http://tweet-${n}-db:5984/twitter" --user "${USER}"\
  | jq '.doc_count' >> /tmp/twitter.txt
done
echo Twitter
cat /tmp/twitter.txt

```

Check database size on different servers:
```shell script
for n in {1..4}; do
  ssh ubuntu@tweet-${n}-db 'df -h | grep data' 
done

for n in {1..4}; do
  ssh ubuntu@tweet-${n}-db 'df -h' | grep vda1
done
```
