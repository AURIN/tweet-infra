# tweet-infra
Tweets harvesting and storage infrastucture

## Requirements

On average 2.2GB of space are needed for every 1M tweets with a replication factor of 3. 
Therefore, some 194GB are needed (on each node) to host the about 90M tweets that have been harvested so far.
In addition, 182M tweets are expected to be collected every year, hence 393GB are needed, per-node, every year. 

Total storage need to (on a four-node cluster, with some slack) are as follows:
* Existing 90M tweets take 194GB * 4 = 778GB 
* New (yearly) 180M tweets take 393G * 4 = 1573GB 

To keep the system running for 4 years and store the already collected tweets, the total storage space would be:
around 7072GB (or 1768GB per-node).


 to be 440GB are needed for th host the 270M tweets 

4 database nodes with 1TB each should be enough to cover for contingencies, but periodic compaction woudl probably 
lessen the disk space needed. 


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
export NODES=`cat /etc/hosts | egrep "tweet-.-db" | cut -f 1 -d' ' | paste -d' ' -s`
export DATABASES='_users _global_changes _metadata _replicator'
for ip in ${NODES}
do
  for db in ${DATABASES}
  do
    grunt http:createdb --masterip ${ip} --database ${db}
  done
done
```

Cluster setup (tweet-1-db is the manager)
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

Create the twitter database and accompanying design documents
```
grunt http:createdb --masterip tweet-1-db --database twitter
grunt couch-compile couch-push 
```


## De-commissioning

```
grunt remove
grunt destroyvolumes
grunt destroynodes 3
```
