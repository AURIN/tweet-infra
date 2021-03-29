#!/usr/bin/env bash

export CLUSTER_NAME='socmedia'

# Components versions
export COUCHDB_CHART_VERSION='3.3.4'  # Helm chart version (CouchDB 3.1.0)

export KUBECONFIG_DIR=${PWD}/configuration/kubeconfig/${CLUSTER_NAME}
export KUBECONFIG=${KUBECONFIG_DIR}/config

# OpenStack parameters
export OS_PROJECT_NAME="bigtwitter"
export DOMAIN_NAME=${OS_PROJECT_NAME}.cloud.edu.au
export OS_USER_DOMAIN_NAME="Default"
export OS_REGION_NAME="Melbourne"
export OS_INTERFACE="public"
export OS_IDENTITY_API_VERSION=3
export USER="ubuntu"
export OS_AVAILABILITY_ZONE="melbourne-qh2"
export OS_VOLUME_AZ='melbourne-qh2'
export OS_EXTERNAL_NETWORK='melbourne'

# VM parameters
export OS_MASTERS_COUNT=1
export OS_WORKERS_COUNT=4
export OS_MASTER_FLAVOR='m3.medium'
export OS_FLAVOR='m3.medium'

# K8s parameters
export CLUSTER_TEMPLATE='34539368-9cd4-4978-900f-86065c74d104' # kubernetes-melbourne-v1.17.11
export CLOUDPROVIDER_TAG='v1.17.11'
export KUBE_TAG='v1.17.11'
export OS_VOLUME_SIZE='30Gi'
export K8S_STORAGECLASS='couchdb'
export K8S_SG="${CLUSTER_NAME}-sg"
export K8S_SG="${CLUSTER_NAME}-sg"
export K8S_INGRESS_SG="${CLUSTER_NAME}-ingress-sg"
export K8S_OTHER_SG="${CLUSTER_NAME}-"

# Ports
export SSH_PORT=22
export INGRESS_PORT=443
export DASHBOARD_PORT=8443

# Other parameters
export ES_VOLUME_SIZE='30Gi'
export VOLUMES='3e6b46d7-3102-4c68-b641-95e2de4911ab fcb6ca8a-d1a7-44ae-bb96-7f543d13dba8 80847aeb-fef1-4ad3-92ca-25527c7cff48 6797a706-3485-4ca0-b1f6-89d12970edfb'
export COUCHDB_INSTANCE_ID='8385a12c-5224-4e17-8211-f31cbb4b4e3c'
