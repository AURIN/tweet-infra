#
# Creates an HTTPd instance with load-balancing
#
FROM httpd:2.4

ENV APACHE_DIR /usr/local/apache2
ENV HOSTVOLUME_DIR /hostvolume
ENV LBCONF_DIR ${HOSTVOLUME_DIR}/lb
ENV APACHE_LOG_DIR ${HOSTVOLUME_DIR}
ENV APACHE_RUN_USER daemon
ENV APACHE_RUN_GROUP daemon

ENV COUCHDB_PORT 5984
ENV COUCHDB_BACKPORT 5986

RUN apt-get update 
RUN apt-get install -y curl &&\
    apt-get install -y telnet &&\
    apt-get install -y vim &&\
    apt-get install -y incron &&\
    apt-get install -y ngrep 
RUN  apt-get -y install libapache2-mod-proxy-html &&\
    mkdir ${APACHE_LOG_DIR} &&\
    cp /usr/lib/apache2/modules/mod_proxy_html.so ${APACHE_DIR}/modules &&\
    cp /usr/lib/apache2/modules/mod_slotmem_plain.so ${APACHE_DIR}/modules

COPY httpd.conf ${APACHE_DIR}/conf/
COPY htpasswd "${APACHE_DIR}/conf/htpasswd"

# This is to reload the Apache conf whenever a change in the vhost file happens
RUN echo "${LBCONF_DIR}/vhost.conf IN_CLOSE_WRITE ${APACHE_DIR}/bin/apachectl -k graceful" \
    >  /var/spool/incron/root
RUN /etc/init.d/incron start

