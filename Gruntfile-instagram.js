module.exports = function (grunt) {
  grunt
    .initConfig({
      "couch-compile": {
        dbs: {
          files: {
            "/tmp/instagram.json": "couchdb/instagram/instagram"
          }
        }
      },
      "couch-push": {
        options: {
          user: 'admin',
          pass: process.env.COUCHDB_PASSWORD
        },
        instagram: {
        }
      }
    });

  grunt.config.set(`couch-push.instagram.files.http://${process.env.COUCHDB_SERVICE_ESCAPE}/${process.env.dbname}`, "/tmp/instagram.json");
  console.log(JSON.stringify(grunt.config.get()));
  grunt.loadNpmTasks("grunt-couch");
};
