FROM node:6.11

RUN mkdir /var/log/harvester
COPY ./startup.sh /root/
RUN chmod a+x /root/startup.sh 
ENTRYPOINT /root/startup.sh

