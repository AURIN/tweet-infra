# tweet-infra
Tweets harvesting and storage infrastucture

## Requirements

On average 2.2GB of space are needed for every 1M tweets. Therefore, somew 200GB are neeed to host the about 
90M tweets that have been harvested so far.
With a replica factor of 2, 4.4GB are needed for every 1M tweets, bringing the disk space for 200M tweets 
(a total that would be reached in a year or so) to 900GB.


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
grunt start
```

## CouchDB setup

Creation of default database
```
grunt clouddity:exec --nodetype db --command "/setup-couchdb.sh"
```

Cluster setup (tweet-1-db is the mastr, the rest are added as slaves)
```
export NODES=`cat /etc/hosts | egrep "tweet-[234567889]-db" | cut -f 1 -d' ' | paste -d' ' -s`
for ip in ${NODES}
do
  grunt http:addcouchnode --masterip tweet-1-db --slaveip ${ip}
done
```

This should show all the nodes being part of the cluster
```
grunt http:clusternodes --masterip tweet-1-db && cat /tmp/membership.json
```

Crerate the twitter database and accompanying design deocuments
```
grunt http:createdb --masterip tweet-1-db --database twitter
grunt couch-compile couch-push 
```

## De-commissioning

```
grunt remove
grunt destroyvolumes
grunt destroynodes 
```
