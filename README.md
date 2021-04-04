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
Check the `server:` port value in the `config` file, as sometimes the port is incorrectly stated as `84438443`.

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


### Un-installation

```shell
./cmd.sh  uninstallcouchdb
```
(The claims on permanent volumes are deleted, but not the volumes themselves.)


// XXXXXXXXXXXXXXXXXXXXXX


Install certificate manager
```shell script
./cmd.sh installcertmanager 
```


## Kubernetes dashboard

FIXME: it does not wok on the `k8s-dev` cluster, as the `kubernetes-dashboard` service was not created during Magnum provisioning. 

Follow the instructions to display the Kubernetes dashboard displayed by the following command:
```shell script
./cmd.sh dashboard
```
(An error message is shown when the dashboard admin role exists already.)


### Kafka installation
 
To install Kafka:
```shell script
./cmd.sh installkafka
````

Wait for all pods to have started:
```shell script
./cmd.sh checkpods
./cmd.sh  kubectl get pods -n kafka
```

To install the Avro-based schema registry:
```shell script
./cmd.sh installschemaregistry
````

Wait for all pods to have started:
```shell script
./cmd.sh checkpods
./cmd.sh  kubectl get all -l app=schema-registry -n kafka
````
(It may take several minutes for the service to start.)

Make schema registry service available to the `DP_NAMESPACE` namespace
```shell script
./cmd.sh setschemaregistryservice
``` 


### Knative installation
 
To install Knative, executes (on the client):
```shell script
./cmd.sh installknative
````
(If the error `namespaces "knative-eventing" not found` is shown, re-run the command.)

After a few minutes, check initialization of Knative services:
```shell script
./cmd.sh checkpods
./cmd.sh checkknative
```

TO start the Knative monitoring dashboard (follow the instructions):
```shell script
./cmd.sh knativemonitor
```

TO start the Knative logging dashboard (follow the instructions):
```shell script
./cmd.sh knativelogging
```
FIXME: this does not work yet, see AUR-6764

Make Kafka broker available to the `DP_NAMESPACE` namespace:
```shell script
./cmd.sh setbrokerservice
```

 
### Test function installation

This assumes the functions are deployed in directories at the same level as this repo ans you are logged to the Docker registry.
```shell script
./cmd.sh build ../dpng-echo
./cmd.sh push ../dpng-echo
./cmd.sh up ../dpng-echo
``` 

Once the function is installed (watch it with `./cmd.sh kn service list`:
```shell script
./cmd.sh testecho
``` 


## Camel-K installation  

Camel-K iserver installation:
```shell script
./cmd.sh installkamel
```

Check Camel-K installation:
```shell script
./cmd.sh checkpods
./cmd.sh kamel get integrations
```


### Test Camel-K

```shell script
./cmd.sh testkamel 
```
This test requires the Camel-K source code to be installed under the `KAMEL_PATH` directory/. 
It may take several minutes to start, then print thie message (repeated ad infinutum)
"[Camel (camel-k) thread #1 - timer://tick] route1 - Hello Camel K!"


```shell script
./cmd.sh testintegration 
```
(After severl minutes it should print a stream of `{"body":{"message":"Hello!"}}])` messages.)


### Test kafka with Camel-K

Start producer integration: 
```shell script
./cmd.sh integrate kafka-prod 
```

Start consumer integration in another shell: 
```shell script
./cmd.sh integrate kafka-cons 
```

The Kafka events generated by the consumer should be seen consumed by then concsumer.  
(Stop the consumer first, to avoid building up messages.)


### Deployiment of the Data Provider Middleware, workers, and MiddleWare

Create ingress gateways and Issue certificate to secure MiddleWare
```shell script
./cmd.sh ingressmw 
```

Deploy API and Middleware as Knative service 
```shell script
./cmd.sh deploymw 
```
(For testing the deployment, see system tests of dpng-middleware component.)

Deploy workers as Knative service 
```shell script
./cmd.sh deployworkers 
```

Check workers deployment:
```shell script
./cmd.sh kubectl get pods
```
(For testing the deployment, see system tests of dpng-middleware component.)


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


## Misc

Various Kafka commands:

```shell script
./cmd.sh kubectl exec -ti my-cluster-kafka-0 -n kafka -- /bin/bas
./bin/kafka-topics.sh --bootstrap-server my-cluster-kafka-bootstrap:9092\
  --list --exclude-internal
./bin/kafka-topics.sh --bootstrap-server my-cluster-kafka-bootstrap:9092\
  --topic ${TOPIC_NAME} --describe
./bin/kafka-console-consumer.sh --bootstrap-server my-cluster-kafka-bootstrap:9092\
  --new-consumer --from-beginning\
  --topic ${TOPIC_NAME}
./bin/kafka-topics.sh --bootstrap-server my-cluster-kafka-bootstrap:9092\
  --create --topic $TOPIC_NAME\
  --partitions 3 --replication-factor 3 --if-not-exists
./bin/kafka-topics.sh --bootstrap-server my-cluster-kafka-bootstrap:9092\
  --delete --topic ${TOPIC_NAME}
```


Deletion of all terminating pods:
```shell script
. ./secrets.sh; . ./config.sh
echo '#!/usr/bin/env bash' > /tmp/term.sh
kubectl get pods -A | egrep -i '(crashloopbackoff|terminating)' | tr -s ' ' |\
  awk '{print "kubectl delete pod " $2 " --namespace " $1 " --force --grace-period=0"}' >> /tmp/term.sh
bash /tmp/term.sh
```

