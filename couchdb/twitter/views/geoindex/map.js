function(doc) {

  var geohash = require("views/lib/geohash");

  if (!doc.created_at || !doc.coordinates) {
    return;
  }

  var date = new Date(doc.created_at);
  emit([ geohash.encodeGeoHash(doc.coordinates.coordinates[1], doc.coordinates.coordinates[0]), 
    date.getFullYear(), date.getMonth() + 1, date.getDate() ], 1);
}