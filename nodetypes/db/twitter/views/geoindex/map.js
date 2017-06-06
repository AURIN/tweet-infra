function(doc) {

  var geohash = require("views/lib/geohash");

  if (!doc.created_at || !doc.coordinates) {
    return;
  }

  var date = new Date(doc.created_at);
  emit([
      geohash.encodeGeoHash(doc.coordinates.coordinates[1],
          doc.coordinates.coordinates[0]), date.getFullYear(),
      date.getMonth() + 1, date.getDate() ], {
    type : "Feature",
    geometry : {
      type : "Point",
      coordinates : [ doc.coordinates.coordinates[1],
          doc.coordinates.coordinates[0] ]
    },
    properties : {
      created_at : doc.created_at,
      text : doc.text,
      location : doc.location
    }
  });
}