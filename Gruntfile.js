"use strict";

module.exports = function(grunt) {

  grunt.sensitiveConfig = grunt.file.readJSON("./sensitive.json");
  grunt.customConfig = grunt.file.readJSON("./custom-configuration.json");

  grunt
      .initConfig({
        pkg : grunt.file.readJSON("./package.json"),
        wait : {
          pause : {
            options : {
              // Time to wait (it must be increased when the number of
              // nodes increases)
              delay : 60000,
              before : function(options) {
                console.log("Pausing %ds", options.delay / 1000);
              },
              after : function() {
                console.log("End pause");
              }
            }
          }
        },

        dock : {
          options : {
            auth : grunt.sensitiveConfig.docker.registry.auth,
            registry : grunt.sensitiveConfig.docker.registry.serveraddress,
            // Local docker demon used to send Docker commands to the cluster
            docker : grunt.sensitiveConfig.docker.master,
            // Options for the Docker clients on the servers
            dockerclient : grunt.sensitiveConfig.docker.client,
            images : {
              couchdbc : {
                dockerfile : "./images/couchdbc",
                tag : "2.0.0",
                repo : "couchdbc",
                options : {
                  build : {
                    t : grunt.sensitiveConfig.docker.registry.serveraddress
                        + "/couchdbc:2.0.0",
                    pull : false,
                    nocache : false
                  },
                  run : {
                    create : {
                      HostConfig : {
                        Binds : [ "/mnt:/hostvolume" ],
                        NetworkMode : "host"
                      },
                      Env : [
                          "NODENAME=<%= clouddityRuntime.node.node.address%>",
                          "COUCHDB_USER="
                              + grunt.sensitiveConfig.couchdb.auth.split(":")[0],
                          "COUCHDB_PASSWORD="
                              + grunt.sensitiveConfig.couchdb.auth.split(":")[1] ]
                    },
                    start : {},
                    cmd : []
                  }
                }
              }
            }
          }
        },

        clouddity : {
          pkgcloud : grunt.sensitiveConfig.pkgcloud,
          docker : grunt.sensitiveConfig.docker,
          ssh : grunt.sensitiveConfig.ssh,
          cluster : "tweet",

          nodetypes : [ {
            name : "lb",
            replication : 1, // NOTE: the can only be one load balancer
            imageRef : "73c6f8d8-f885-4253-8bee-e45da068fb65",
            flavorRef : "885227de-b7ee-42af-a209-2f1ff59bc330",
            securitygroups : [ "defaultsg", "lbsg" ],
            images : [ "couchdbc" ],
          }, {
            name : "db",
            replication : 2,
            imageRef : "73c6f8d8-f885-4253-8bee-e45da068fb65",
            flavorRef : "885227de-b7ee-42af-a209-2f1ff59bc330",
            securitygroups : [ "defaultsg", "couchdbsg" ],
            images : [ "couchdbc" ],
            volumes : [ "dbdata" ]
          } ],

          volumetypes : [ {
            name : "dbdata",
            size : 1,
            description : "CouchDB Data",
            availability_zone : grunt.sensitiveConfig.pkgcloud.availability_zone,
            mountpoint: "/hostvolume",
            fstype: "ext4"
          } ],

          securitygroups : {
            "lbsg" : {
              description : "Opens HTTP to the world, consul and ES port to nodes, plus Kibana to the loadbalancer",
              rules : [ {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 9200,
                portRangeMax : 9200,
                remoteIpPrefix : grunt.customConfig.devIPs,
                remoteIpNodePrefixes : [ "lb", "db" ]
              }, {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 5601,
                portRangeMax : 5601,
                remoteIpPrefix : grunt.customConfig.devIPs,
                remoteIpNodePrefixes : [ "lb" ]
              }, {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 80,
                portRangeMax : 80,
                remoteIpPrefix : "0.0.0.0/0"
              } ]
            },
            "defaultsg" : {
              description : "Opens the Docker demon and SSH ports to dev and cluster nodes",
              rules : [ {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 22,
                portRangeMax : 22,
                remoteIpPrefix : "0.0.0.0/0"
              }, {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 2375,
                portRangeMax : 2375,
                remoteIpPrefix : grunt.customConfig.devIPs
              }, {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 2375,
                portRangeMax : 2375,
                remoteIpPrefix : grunt.customConfig.devIPs
              } ]
            },
            "couchdbsg" : {
              description : "Opens CouchDB cluster ports to the cluster ,and 5984 to the world",
              rules : [ {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 5984,
                portRangeMax : 5984,
                remoteIpPrefix : "0.0.0.0/0"
              }, {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 4369,
                portRangeMax : 4369,
                remoteIpPrefix : grunt.customConfig.devIPs,
                remoteIpNodePrefixes : [ "couchdbc" ]
              }, {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 5986,
                portRangeMax : 5986,
                remoteIpPrefix : grunt.customConfig.devIPs,
                remoteIpNodePrefixes : [ "couchdbc" ]
              }, {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 9100,
                portRangeMax : 9200,
                remoteIpPrefix : grunt.customConfig.devIPs,
                remoteIpNodePrefixes : [ "couchdbc" ]
              } ]
            }
          }
        },

        // Add a node to the cluster
        http : {
          addusersdb : {
            options : {
              url : "http://" + grunt.option("ip") + ":5984/_users",
              method : "put",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}",
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          addchangesdb : {
            options : {
              url : "http://" + grunt.option("ip") + ":5984/_global_changes",
              method : "put",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}",
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          addmetadatadb : {
            options : {
              url : "http://" + grunt.option("ip") + ":5984/_metadata",
              method : "put",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}",
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          addreplicatordb : {
            options : {
              url : "http://" + grunt.option("ip") + ":5984/_replicator",
              method : "put",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}",
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          addcouchdbnode : {
            options : {
              url : "http://" + grunt.option("masterip")
                  + ":5986/_nodes/couchdb@" + grunt.option("slaveip"),
              method : "put",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}",
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          createtestdb : {
            options : {
              url : "http://" + (grunt.option("cluster") || "ccdev")
                  + "-1-couchdbc:5984/test",
              method : "put",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}",
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          removetestdb : {
            options : {
              url : "http://" + (grunt.option("cluster") || "ccdev")
                  + "-1-couchdbc:5984/test",
              method : "delete",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}",
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          adddoc1 : {
            options : {
              url : "http://" + (grunt.option("cluster") || "ccdev")
                  + "-1-couchdbc:5984/test",
              method : "post",
              headers : {
                "Content-Type" : "application/json"
              },
              body : JSON.stringify({
                name : "jock"
              }),
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          adddoc2 : {
            options : {
              url : "http://" + (grunt.option("cluster") || "ccdev")
                  + "-2-couchdbc:5984/test",
              method : "post",
              headers : {
                "Content-Type" : "application/json"
              },
              body : JSON.stringify({
                name : "tom"
              }),
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          adddoc3 : {
            options : {
              url : "http://" + (grunt.option("cluster") || "ccdev")
                  + "-3-couchdbc:5984/test",
              method : "post",
              headers : {
                "Content-Type" : "application/json"
              },
              body : JSON.stringify({
                name : "jean"
              }),
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          createdb : {
            options : {
              url : "http://" + (grunt.option("cluster") || "ccdev")
                  + "-1-couchdbc:5984/" + grunt.option("database"),
              method : "put",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}",
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          },
          compactdb : {
            options : {
              url : "http://" + (grunt.option("cluster") || "ccdev")
                  + "-1-couchdbc:5984/" + grunt.option("database")
                  + "/_compact",
              method : "post",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}",
              auth : grunt.sensitiveConfig.couchdb.auth
            }
          }
        }

      });

  // Dependent tasks declarations
  require("load-grunt-tasks")(grunt, {
    config : "./package.json"
  });
  grunt.loadNpmTasks("grunt-wait");

  // Setups and builds the Docker images
  grunt.registerTask("build", [ "dock:build" ]);

  // Pushes the Docker images to registry
  grunt.registerTask("push", [ "dock:push" ]);

  // Utility tasks to provision and un-provision the cluster in one go
  grunt.registerTask("launch", [ "clouddity:createsecuritygroups", "wait",
      "clouddity:createnodes", "wait", "clouddity:updatesecuritygroups",
      "wait", "clouddity:addhosts" ]);
  grunt.registerTask("destroy", [ "clouddity:destroynodes", "wait",
      "clouddity:destroysecuritygroups" ]);

  // Utility tasks to create/attach, and detach/delete volumes
  grunt.registerTask("launchvolumes", [ "clouddity:createvolumes", "wait",
      "clouddity:attachvolumes", "clouddity:mountvolumes" ]);
  grunt.registerTask("destroyvolumes", [ "clouddity:detachvolumes", "wait",
      "clouddity:deletevolumes" ]);

  // Pulls the Docker images from registry
  grunt.registerTask("pull", [ "clouddity:pull" ]);

  // Listing cluster components tasks
  grunt.registerTask("listnodes", [ "clouddity:listnodes" ]);
  grunt.registerTask("listsecuritygroups", [ "clouddity:listsecuritygroups" ]);
  grunt.registerTask("listvolumes", [ "clouddity:listvolumes" ]);
  grunt.registerTask("listcontainers", [ "clouddity:listcontainers" ]);

  // Docker containers creation
  grunt.registerTask("create", [ "clouddity:run" ]);

  // Docker containers management
  grunt.registerTask("stop", [ "clouddity:stop" ]);
  grunt.registerTask("start", [ "clouddity:start" ]);
  grunt.registerTask("restart", [ "clouddity:stop", "clouddity:start" ]);

  // Docker containers removal
  grunt
      .registerTask("remove", [ "clouddity:stop", "wait", "clouddity:remove" ]);

};
