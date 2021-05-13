# tweet-infra

Infrastructure code for Social media harvesting and storing.


## Pre-requirements

* jq 1.6.x
* OpenStack client 5.3.x (Heat, Magnum, Designate, Neutron) 
* Kubectl client >= v1.18.x
* Helm 3.2.x
* Unix-like shell (tested on Ubuntu)
* SSH keypair loaded pn the OpenStack Dashboard  (MRC or NeCTAR) of the project
* client-keystone-auth Kubernetest plugin
* Grunt CLI 1.2 (https://gruntjs.com/installing-grunt). To install on Ubuntu: `sudo apt install node-grunt-cli`
* Download the OpenStack RC File from the OpenStack Dashboard (MRC or NeCTAR)


## Configuration

Passwords and authorization details can be set, as environment variables, in `secrets.sh`.
Various configuration parameters (number of Swarm service replicas, etc) can be set in `configuration.sh`.

The `secrets.sh` must follow this template:

```shell script
#!/bin/bash
export OS_AUTH_TYPE="password"
export OS_USERNAME=openstack user
export OS_PASSWORD=openstack password
export OS_AUTH_URL=keystone URL
export KEY_NAME=openstack SSH key pair

export OAUTH_CLIENT_ID=GitHub application client ID
export OAUTH_CLIENT_SECRET=GitHub application secret

export DOCKER_SERVER=docker registry server hostname
export DOCKER_USERNAME=docker registry username
export DOCKER_PASSWORD=docker registry password
export DOCKER_EMAIL=docker registry email address

export COUCHDB_PASSWORD='CouchDB admin password'
export COUCHDB_COOKIE='cookie used to authetnicate COuchDB nodes'
```


## The cmd.sh script

This is used to setup the configuration and execute command on the cluster; it could be used a shorthand for executing
`kubectl` commands as well, using ans alias such as:
```shell script
alias k='./cmd.sh kubectl'
alias o='./cmd.sh openstack'
```
To store cluster configurations, a directory has to be created `mkdir configuration/kubeconfig`.
 
NOTE: every `yaml` file in the configuration directoryu has its environment variables expanded and the reulst is put under the `/tmp` directory before exectuing any other command.

NOTE: to show the actual commands beong executed prefix the call to `cmd.sh` with `DEBUG=true`. 


## Adding yourself as admin to an existing cluster that was not created by you

```shell script
./cmd.sh add
```

To add your user as cluster admin to an existing cluster, the cluster creator has to execute:
```
./cmd.sh kubectl create clusterrolebinding clusteradmin-<your OS_USERNAME>\
   --clusterrole=cluster-admin --user=<your OS_USERNAME>
```  


## Cluster provisioning

This command provisions the Kubernetes VMs and its volumes
```shell script
./cmd.sh provision
```
(After the cluster is created, it may be in "unhealty" status for a while, wait until the cluster is "healthy".)


From now on, the Kubernetes configuration has to be set whenever a new shell is started, hence this command
has ot be executed once per session, lest the other commands fail to find the correct configuration (the configuration file `config` is written in
the `configuration/kubeconfig` directory, and `KUBECONFIG` is set accordingly)
```shell script
./cmd.sh set
```
Check the `server:` port value in the `config` file, as sometimes the port is incorrectly stated as `64436443`.

`
Sometimes the overlay network component is not started correctly, hence it is better to drop and recreate it:
```shell script
./cmd.sh kubectl delete pod -l app=flannel -n kube-system
watch -n 10 ./cmd.sh kubectl get pod -l app=flannel -n kube-system 
```

Check Kubernetest cluster existence (it should return 403)
```shell script
./cmd.sh checkcluster
```

Once the cluster is successfully created, create the storage class that comprise the existing volumes
(see the `configuration,sh` file)
```shell script
./cmd.sh createstorageclass

```
NOTE: by default a Permanent Volume Claim is created by JupyterHub for every single user and then attached to the JupyterLab 
pod as sson as that is started. This leads to as many PVCs as users (active or not), which may exceed the threshold for Cinder
volumes allocated to the OPenStack tenancy. Alternatively, a shared volume may be used, partitioned amongst all users.


Setup of Docker Registry credentials (`regcred`)
```shell script
./cmd.sh createsecrets
```


## CouchDB

### Installation

```shell
./cmd.sh  installcouchdb
```

To check the CouchDB deployment:
```shell
./cmd.sh kubectl get pods --namespace default -l "app=couchdb,release=couchdb-release"
```

Once all the pods are running, the cluster configuration has to be completed with:
```shell
./cmd.sh completecouchdb
```


### Add users

```shell
./cmd.sh createuserscouchdb
```


### Create design documents (lists, views and validaiton functions)

```shell
./cmd.sh createdesigncouchdb
```


### Ingress Setup

Create the ingress service:
```shell script
./cmd.sh ingresssetup
```

Watch Octavia logs to check the Load Balancer ingress service creation 
```shell
./cmd.sh kubectl logs -f octavia-ingress-controller-0 -n kube-system
```

Once the ingress is ready, wait for the external IP address to be created: 
```shell script
./cmd.sh kubectl get ingress couchdb-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

Create the CouchDB hostname on the DNS:
```shell script
./cmd.sh dnssetup
```

For the external hostname, check:
```shell
./cmd.sh openstack recordset list $(./cmd.sh openstack zone list -f value -c id) --fit-width
````

To check, point your bwowser to:
`http://couchdb.socmedia.bigtwitter.cloud.edu.au`


### Deploy the harvester

Create the harvester usr on CouchDB:
```shell
./cmd.sh installharvester
```

### Data replication from an old database

Create databases with the desired number of replicas and shards:
```shell
curl -XPUT 'http://couchdb.socmedia.bigtwitter.cloud.edu.au/instagram?n=2&q=8'\
 --user 'admin:<admin password>
```

```shell
curl -XPUT 'http://couchdb.socmedia.bigtwitter.cloud.edu.au/twitter?n=2&q=8'\
 --user 'admin:<admin password>'
```

Setup a replication on `http://couchdb.socmedia.bigtwitter.cloud.edu.au/_utils` 
from:
* Remote database
* `http://45.113.232.90/<database>`
* Authentication
to:
* Existing local database
* `<database>`
* Authentication
Options:
* Replication type: `continuous`


### ElasticSearch Dashboard

TBD


### CouchDB Un-installation

```shell
./cmd.sh  uninstallcouchdb
```
(The claims on permanent volumes are deleted, but not the volumes themselves.)


## Cluster decommissioning

```shell script
./cmd.sh unsetdns
```

```shell script
./cmd.sh unprovision
```

Floatings IP addresses woth no fixed IP address attached belonging to any clusters can be delete with:
```shell script
./cmd.sh removefloats
```

The volumes have to be deleted manually.

