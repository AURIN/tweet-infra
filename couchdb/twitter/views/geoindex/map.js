function(doc) {

  var geohash = require("lib/geohash");

  if (!doc.created_at || !doc.coordinates) {
    return;
  }

  var date = new Date(doc.created_at);
  emit([ geohash.encodeGeoHash(doc.coordinates[1], doc.coordinates[0]),
      date.getFullYear(), date.getMonth() + 1, date.getDate() ], 1);
}