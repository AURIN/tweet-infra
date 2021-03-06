function(doc) {

  var geohash = require("views/lib/geohash");

  if (!doc.created_time || !doc.coordinates) {
    return;
  }

  var date = new Date(doc.created_time * 1000);
  emit([
    geohash.encodeGeoHash(doc.coordinates.coordinates[1],
      doc.coordinates.coordinates[0]), date.getFullYear(),
    date.getMonth() + 1, date.getDate() ], {
    type : "Feature",
    geometry : {
      type : "Point",
      coordinates : [ doc.coordinates.coordinates[0],
        doc.coordinates.coordinates[1] ]
    },
    properties : {
      created_at : doc.created_time,
      text : doc.caption.text,
      location : doc.location
    }
  });
}
