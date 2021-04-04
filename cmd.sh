#!/usr/bin/env bash

# Loads configuration
. ./configuration/configuration.sh
. ./configuration/secrets.sh

shopt -s nullglob
for f in ./configuration/*.yaml; do
  cat ${f} | envsubst >/tmp/${f##*/}
done

if [ ${DEBUG} ]; then
  set -x
fi

set_network_var() {
  CLUSTER_ID=$(openstack coe cluster show ${CLUSTER_NAME} -f value -c uuid)
  STACK_ID=$(openstack coe cluster show ${CLUSTER_ID} -f value -c stack_id)
  FLOATING_IP=$(openstack stack output show ${STACK_ID} api_address -c output_value -f value)
  PORT_ID=$(openstack floating ip show ${FLOATING_IP} -c port_id -f value)
}

# Executes commands
case "${1}" in

set)
  (
    set_network_var
    mkdir ${KUBECONFIG_DIR}
    openstack coe cluster config --dir ${KUBECONFIG_DIR} --force ${CLUSTER_NAME}

    # Replace the API IP adddress with the floating-point
    API_IP=$(echo ${FLOATING_IP} | sed -E "s/\./\\\./g")
    cat ${KUBECONFIG} | sed -E "s/https\:\/\/.+\:${API_PORT}/https\:\/\/${API_IP}\:6443/g" >/tmp/${CLUSTER_NAME}.kubeconfig
    mv /tmp/${CLUSTER_NAME}.kubeconfig ${KUBECONFIG}
    kubectl config set-cluster ${CLUSTER_NAME}

    kubectl config view
    kubectl cluster-info
  )
  ;;

add)
  (
    set_network_var
    mkdir ${KUBECONFIG_DIR}
    rm ${KUBECONFIG_DIR}/config
    kubectl config set-cluster ${CLUSTER_NAME} \
      --server="https://${FLOATING_IP}:${API_PORT}" \
      --embed-certs=false \
      --insecure-skip-tls-verify=true \
      --kubeconfig=${KUBECONFIG_DIR}/config
    kubectl config set-credentials \
      "${OS_USERNAME}" \
      --exec-command="client-keystone-auth" \
      --exec-api-version="client.authentication.k8s.io/v1beta1" \
      --exec-env="OS_USERNAME=${OS_USERNAME}" \
      --exec-env="OS_PASSWORD=${OS_PASSWORD}" \
      --exec-env="OS_PROJECT_NAME=${OS_PROJECT_NAME}" \
      --exec-env="OS_DOMAIN_NAME=${OS_USER_DOMAIN_NAME}"
    kubectl config set-context \
      default \
      --cluster="${CLUSTER_NAME}" \
      --user="${OS_USERNAME}"
    kubectl config use-context default
  )
  ;;

provision)
  (
    openstack coe cluster create \
      --cluster-template "${CLUSTER_TEMPLATE}" \
      --master-flavor ${OS_MASTER_FLAVOR} \
      --flavor ${OS_FLAVOR} \
      --keypair ${KEY_NAME} \
      --master-count ${OS_MASTERS_COUNT} \
      --node-count ${OS_WORKERS_COUNT} \
      --timeout 15 \
      ${CLUSTER_NAME}

    watch -n 20 openstack coe cluster show ${CLUSTER_NAME}
  )
  ;;

createstorageclass)
  (
    kubectl delete storageclass ${K8S_STORAGECLASS}
    kubectl apply -f /tmp/storage-class.yaml
    #    for v in ${VOLUMES}; do
    #      export VOLUMEID=${v}
    #      cat ./configuration/pv-volume.yaml | envsubst >/tmp/pv-volume.yaml
    #      kubectl apply -f /tmp/pv-volume.yaml
    #    done
  )
  ;;

checkcluster)
  (
    set_network_var
    curl -XGET -k "https://${FLOATING_IP}:6443/"
  )
  ;;

checkpods)
  (
    kubectl get pods -A | grep -iv -e running -e completed
  )
  ;;

createsecrets)
  (
    kubectl delete secret regcred
    kubectl delete secret ${COUCHDB_CHART_RELEASE}-couchdb
    kubectl create namespace ${DP_NAMESPACE}
    kubectl create secret docker-registry regcred \
      --docker-server=${DOCKER_SERVER} \
      --docker-username=${DOCKER_USERNAME} \
      --docker-password=${DOCKER_PASSWORD}
    kubectl patch serviceaccount default \
      --patch '{"imagePullSecrets": [{"name": "regcred"}]}' \
      --namespace default
    kubectl create secret generic ${COUCHDB_CHART_RELEASE}-couchdb \
      --from-literal=adminUsername=admin \
      --from-literal=adminPassword=${COUCHDB_PASSWORD} \
      --from-literal=cookieAuthSecret=${COUCHDB_COOKIE}
  )
  ;;

installcouchdb)
  (
    helm repo add couchdb https://apache.github.io/couchdb-helm
    helm uninstall ${COUCHDB_CHART_RELEASE}
    helm install \
      --version=${COUCHDB_CHART_VERSION} \
      --set ingress.hosts={${INGRESS_NAME}} \
      --set couchdbConfig.couchdb.uuid=${COUCHDB_INSTANCE_ID} \
      --set allowAdminParty=false \
      --set ingress.enabled=true \
      --set persistentVolume.storageClass=${K8S_STORAGECLASS} \
      --set createAdminSecret=false \
      --set persistentVolume.enabled=true \
      --set persistentVolume.size=${OS_VOLUME_SIZE} \
      --set clusterSize=${COUCHDB_CLUSTER_SIZE} \
      ${COUCHDB_CHART_RELEASE} couchdb/couchdb
  )
  ;;

completecouchdb)
  (
    kubectl exec --namespace default -it ${COUCHDB_CHART_RELEASE}-couchdb-0 -c couchdb -- \
      curl -s 'http://127.0.0.1:5984/_cluster_setup' \
      -X POST --header "Content-Type: application/json" \
      --data '{"action": "finish_cluster"}' \
      --user "admin:${COUCHDB_PASSWORD}"
  )
  ;;

uninstallcouchdb)
  (
    helm uninstall ${COUCHDB_CHART_RELEASE}
    kubectl get pvc -o json | jq '.items | .[].metadata.name' |
      xargs -i ./cmd.sh kubectl delete pvc {}
    kubectl get pv -o json | jq '.items | .[].metadata.name' |
      xargs -i kubectl patch pv {} --type json -p '[{"op": "remove", "path": "/spec/claimRef"}]'
  )
  ;;

dashboard)
  (
    kubectl create clusterrolebinding kubernetes-dashboard \
      --clusterrole=cluster-admin \
      --serviceaccount=kube-system:kubernetes-dashboard
    SECRET_NAME=$(kubectl -n kube-system get secret | grep kubernetes-dashboard-token | cut -f1 -d ' ')
    kubectl -n kube-system describe secret $SECRET_NAME | grep -E '^token' | cut -f2 -d':' | tr -d " "
    kubectl proxy &
    echo 'Go to'
    echo 'http://localhost:8001/api/v1/namespaces/kube-system/services/https:kubernetes-dashboard:/proxy/'
    echo '  and insert the token printed in the shell'
  )
  ;;

ingresssetup)
  (
    kubectl delete ingress couchdb-ingress
    kubectl delete service couchdb-ingress-service
    kubectl apply -f /tmp/couchdb-ingress.yaml
  )
  ;;

dnssetup)
  (
    IP=$(kubectl get ingress couchdb-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    ZONE_ID=$(openstack zone list -c id -f value)
    ZONE_NAME=$(openstack zone list -c name -f value)
    RS_IDS=$(openstack recordset list ${ZONE_ID} -f json |
      jq 'map(select(.name | contains($CLUSTER_NAME))) | .[].id' \
        --arg CLUSTER_NAME "${CLUSTER_NAME}")

    for rs in ${RS_IDS}; do
      openstack recordset delete ${ZONE_ID} $(echo ${rs} | sed s/\"//g)
    done

   openstack recordset create ${ZONE_ID} "couchdb.${CLUSTER_NAME}.${ZONE_NAME}" \
      --record ${IP} --type A
  )
  ;;

unsetdns)
  (
    INGRESSGATEWAY_IP=$(kubectl get svc istio-ingressgateway --namespace istio-system \
      --output jsonpath="{.status.loadBalancer.ingress[*]['ip']}")

    ZONE_ID=$(openstack zone list -c id -f value)
    ZONE_NAME=$(openstack zone list -c name -f value)
    RS_IDS=$(openstack recordset list ${ZONE_ID} -f json |
      jq 'map(select(.name | contains($DP_EP))) | .[].id' --arg DP_EP "${DP_EP}")
    for rs in ${RS_IDS}; do
      openstack recordset delete ${ZONE_ID} $(echo ${rs} | sed s/\"//g)
    done
  )
  ;;

unprovision)
  (
    openstack coe cluster delete ${CLUSTER_NAME}
    watch -n 20 openstack coe cluster show ${CLUSTER_NAME}
  )
  ;;

removefloats)
  (
    FLOATINGIPS_IDS=$(openstack floating ip list --format json | jq 'map(select(.["Fixed IP Address"] == null)) | .[].ID')
    for FLOATINGIP_ID in ${FLOATINGIPS_IDS}; do
      openstack floating ip delete $(echo ${FLOATINGIP_ID} | tr -d \")
    done
  )
  ;;

installcertmanager)
  (
    kubectl create namespace cert-manager
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    kubectl apply --validate=false \
      -f https://github.com/jetstack/cert-manager/releases/download/${CERTMANAGER_VERSION}/cert-manager.crds.yaml
    helm install \
      --set installCRDs=true \
      cert-manager jetstack/cert-manager \
      --namespace cert-manager \
      --version ${CERTMANAGER_VERSION}
  )
  ;;

logs)
  (
    kubectl logs -f \
      $(kubectl get pods --no-headers=true --output custom-columns=:metadata.name \
        --selector serving.knative.dev/service=${2}) \
      --all-containers=true
  )
  ;;

#
# NOTE: this is here just for documentary reasons, it is not meant to be run
# from a client
#
copyshards)
  (
    sudo mount /dev/vdi /mnt/couchdb

    FROM='/mnt/couchdbdatavolume/couchdb/data/shards'
    TO='/mnt/couchdb'

    sudo mkdir ${TO}/shards
    sudo rm -r ${TO}/shards/*

    sudo cp /mnt/couchdbdatavolume/couchdb/data/_dbs.couch ${TO}
    sudo cp /mnt/couchdbdatavolume/couchdb/data/_replicator.couch ${TO}
    sudo cp /mnt/couchdbdatavolume/couchdb/data/_users.couch ${TO}
    sudo cp /mnt/couchdbdatavolume/couchdb/data/_nodes.couch ${TO}

    for f in $(sudo find ${FROM} -mindepth 1 -maxdepth 1 -name "*"); do
      sudo mkdir -p ${TO}/shards/$(echo ${f} | cut -d'/' -f7)
    done

    for f in $(sudo find ${FROM} -name "insta*"); do
      sudo cp ${f} ${TO}/shards/$(echo ${f} | cut -d'/' -f7)
    done

    for f in $(sudo find ${FROM} -name "_users*"); do
      sudo cp ${f} ${TO}/shards/$(echo ${f} | cut -d'/' -f7)
    done

    for f in $(sudo find ${FROM} -name "_replic*"); do
      sudo cp ${f} ${TO}/shards/$(echo ${f} | cut -d'/' -f7)
    done

    for f in $(sudo find ${FROM} -name "_meta*"); do
      sudo cp ${f} ${TO}/shards/$(echo ${f} | cut -d'/' -f7)
    done
  )
  ;;

# Default handler
*)
  "${@:1:$#}"
  ;;

esac
