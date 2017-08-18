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

        "couch-compile" : {
          dbs : {
            files : {
              "/tmp/twitter.json" : "nodetypes/db/twitter/twitter",
              "/tmp/instagram.json" : "nodetypes/db/instagram/instagram"
            }
          }
        },
        "couch-push" : {
          options : {
            user : grunt.sensitiveConfig.couchdb.auth.split(":")[0],
            pass : grunt.sensitiveConfig.couchdb.auth.split(":")[1]
          },
          twitter : {
            files : (function() {
              var obj = {};
              obj[("http://" + grunt.option("masterip") + ":"
                  + grunt.sensitiveConfig.couchdb.port + "/twitter")] = "/tmp/twitter.json";
              return obj;
            })()
          },
          instagram : {
            files : (function() {
              var obj = {};
              obj[("http://" + grunt.option("masterip") + ":"
                  + grunt.sensitiveConfig.couchdb.port + "/instagram")] = "/tmp/instagram.json";
              return obj;
            })()
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
                        Binds : [ "/mnt/couchdbdatavolume:/datavolume" ],
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
              },
              harvester : {
                dockerfile : "./images/harvester",
                tag : "4.4",
                repo : "harvester",
                options : {
                  build : {
                    t : grunt.sensitiveConfig.docker.registry.serveraddress
                        + "/harvester:4.4",
                    pull : false,
                    nocache : false
                  },
                  run : {
                    create : {
                      HostConfig : {
                        Binds : [ "/home/ubuntu/:/hostvolume" ],
                        NetworkMode : "host"
                      }
                    },
                    start : {},
                    cmd : []
                  }
                }
              },
              apache : {
                dockerfile : "./images/apache",
                tag : "2.4",
                repo : "apache",
                options : {
                  build : {
                    t : grunt.sensitiveConfig.docker.registry.serveraddress
                        + "/apache:2.4",
                    pull : false,
                    nocache : false
                  },
                  run : {
                    create : {
                      HostConfig : {
                        Binds : [ "/home/ubuntu/:/hostvolume" ],
                        NetworkMode : "host"
                      }
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

          nodetypes : [
              {
                name : "lb",
                replication : 1,
                imageRef : "73c6f8d8-f885-4253-8bee-e45da068fb65",
                flavorRef : "639b8b2a-a5a6-4aa2-8592-ca765ee7af63",
                availability_zone : grunt.sensitiveConfig.pkgcloud.availability_zone,
                securitygroups : [ "defaultsg", "lbsg" ],
                images : [ "apache", "harvester" ],
                copytohost : [ {
                  from : "./target/nodetypes/lb/",
                  to : "/home/ubuntu"
                } ]
              },
              {
                name : "db",
                replication : 4,
                imageRef : "73c6f8d8-f885-4253-8bee-e45da068fb65",
                flavorRef : "4",
                availability_zone : grunt.sensitiveConfig.pkgcloud.availability_zone,
                securitygroups : [ "defaultsg", "couchdbsg" ],
                images : [ "couchdbc" ],
                volumes : [ "dbdata" ]
              } ],

          volumetypes : [ {
            name : "dbdata",
            size : 1800,
            description : "CouchDB Data",
            volumeType : grunt.sensitiveConfig.pkgcloud.volume_type,
            availability_zone : grunt.sensitiveConfig.pkgcloud.availability_zone_volume,
            mountpoint : "/mnt/couchdbdatavolume",
            fstype : "ext4"
          } ],

          securitygroups : {
            "lbsg" : {
              description : "Opens HTTP to the world",
              rules : [ {
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
                remoteIpNodePrefixes : [ "db" ]
              }, {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 5986,
                portRangeMax : 5986,
                remoteIpPrefix : grunt.customConfig.devIPs,
                remoteIpNodePrefixes : [ "db", "lb" ]
              }, {
                direction : "ingress",
                ethertype : "IPv4",
                protocol : "tcp",
                portRangeMin : 9100,
                portRangeMax : 9200,
                remoteIpPrefix : grunt.customConfig.devIPs,
                remoteIpNodePrefixes : [ "db" ]
              } ]
            }
          }
        },

        // Add usrs to the load-balancer
        run : {
          options : {},
          addharvester : {
            exec : "htpasswd -b ./images/apache/htpasswd "
                + grunt.sensitiveConfig.apache.users[0].split(":")[0] + " "
                + grunt.sensitiveConfig.apache.users[0].split(":")[1]
          },
          addreadonly : {
            exec : "htpasswd -b ./images/apache/htpasswd "
                + grunt.sensitiveConfig.apache.users[1].split(":")[0] + " "
                + grunt.sensitiveConfig.apache.users[1].split(":")[1]
          },
          addadmin : {
            exec : "htpasswd -b ./images/apache/htpasswd "
                + grunt.sensitiveConfig.couchdb.auth.split(":")[0] + " "
                + grunt.sensitiveConfig.couchdb.auth.split(":")[1]
          },
          // Compiles the Node,js applications
          compile : {
            exec : ". ~/.nvm/nvm.sh && nvm exec 4.2.2 npm install git+ssh://git@github.com:AURIN/tweet-harvester.git#"
                + grunt.customConfig.applications["tweet-harvester"]
          },
          move : {
            exec : "cp -r ./node_modules/tweet-harvester ./target/nodetypes/lb"
          },

          // Cleaning of build files
          clean : [ "./target" ],

          // Setting up of target directory
          mkdir : {
            all : {
              options : {
                create : [ "./target", "./target/nodetypes",
                    "./target/nodetypes/lb" ]
              }
            }
          },

        },

        // Expansion of properties referenced in EJS templates
        ejs : {
          all : {
            src : [ "./nodetypes/lb/vhost.conf" ],
            dest : "target/",
            expand : true
          },
        },

        // Add a node to the cluster
        http : {
          addcouchnode : {
            options : {
              url : "http://" + grunt.sensitiveConfig.couchdb.auth + "@"
                  + grunt.option("masterip") + ":5986/_nodes/couchdb@"
                  + grunt.option("slaveip"),
              method : "put",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}"
            }
          },
          removecouchnode : {
            options : {
              url : "http://" + grunt.sensitiveConfig.couchdb.auth + "@"
                  + grunt.option("masterip") + ":5986/_nodes/couchdb@"
                  + grunt.option("slaveip"),
              method : "delete",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}"
            }
          },
          clusternodes : {
            options : {
              url : "http://" + grunt.sensitiveConfig.couchdb.auth + "@"
                  + grunt.option("masterip") + ":5984/_membership",
              method : "get"
            },
            dest : "/tmp/membership.json"
          },
          createdb : {
            options : {
              url : "http://" + grunt.sensitiveConfig.couchdb.auth + "@"
                  + grunt.option("masterip") + ":"
                  + grunt.sensitiveConfig.couchdb.port + "/"
                  + grunt.option("database"),
              method : "put",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}"
            }
          },
          deletedb : {
            options : {
              url : "http://" + grunt.sensitiveConfig.couchdb.auth + "@"
                  + grunt.option("masterip") + ":"
                  + grunt.sensitiveConfig.couchdb.port + "/"
                  + grunt.option("database"),
              method : "delete",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}"
            }
          },
          compactdb : {
            options : {
              url : "http://" + grunt.sensitiveConfig.couchdb.auth + "@"
                  + grunt.option("masterip") + ":"
                  + grunt.sensitiveConfig.couchdb.port + "/"
                  + grunt.option("database") + "/_compact",
              method : "post",
              headers : {
                "Content-Type" : "application/json"
              },
              body : "{}"
            }
          }
        }
      });

  /**
   * After the config is declared it fills the ejs options object with the names
   * of nodes as defined in the clouddity config section
   */
  grunt.config.set("ejs.all.options", (function() {
    var nodes = {};
    var nodeNumber = 0;
    // NOTE: this is _very_ depedendent on the location of the grunt-clouddity
    // package
    var utils = require("./node_modules/grunt-clouddity/lib/utils.js");
    var options = grunt.config.get("clouddity");
    options.nodetypes.forEach(function(nodeType) {
      nodes[nodeType.name] = {
        names : []
      };
      for (var i = 1; i <= nodeType.replication; i++) {
        var name = utils.nodeName(options.cluster, nodeType.name, i);
        nodes[nodeType.name].names.push(name);
      }
    });
    return nodes;
  })());

  // Dependent tasks declarations
  require("load-grunt-tasks")(grunt, {
    config : "./package.json"
  });
  grunt.loadNpmTasks("grunt-wait");

  // Setups and builds the Docker images
  grunt.registerTask("build", [ "run:addreadonly", "run:addharvester",
      "run:addadmin", "dock:build" ]);

  // Pushes the Docker images to registry
  grunt.registerTask("push", [ "dock:push" ]);

  // Utility tasks to provision and un-provision the cluster in one go
  grunt.registerTask("launchnodes", [ "clouddity:createsecuritygroups", "wait",
      "clouddity:createnodes", "wait", "clouddity:updatesecuritygroups",
      "wait", "clouddity:addhosts" ]);
  grunt.registerTask("destroynodes", [ "clouddity:destroynodes", "wait",
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

  // Deployiment of tweet-harvester application, load balancer configuration
  // update,
  // and copy to the hosts
  grunt.registerTask("generate", [ "run:clean", "run:mkdir", "run:compile",
      "run:move", "ejs", "clouddity:copytohost" ]);

  // Docker containers management
  grunt.registerTask("stop", [ "clouddity:stop" ]);
  grunt.registerTask("start", [ "clouddity:start" ]);
  grunt.registerTask("restart", [ "clouddity:stop", "clouddity:start" ]);

  // Docker containers removal
  grunt
      .registerTask("remove", [ "clouddity:stop", "wait", "clouddity:remove" ]);

};
