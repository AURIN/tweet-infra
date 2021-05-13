module.exports = function (grunt) {
  grunt
    .initConfig({
      "couch-compile": {
        dbs: {
          files: {
            "/tmp/twitter.json": "couchdb/twitter/twitter"
          }
        }
      },
      "couch-push": {
        options: {
          user: 'admin',
          pass: process.env.COUCHDB_PASSWORD
        },
        twitter: {
        }
      }
    });

  grunt.config.set(`couch-push.twitter.files.http://${process.env.COUCHDB_SERVICE_ESCAPE}/${process.env.dbname}`, "/tmp/twitter.json");
  console.log(JSON.stringify(grunt.config.get()));
  grunt.loadNpmTasks("grunt-couch");
};
