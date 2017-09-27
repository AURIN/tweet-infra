function (head, req) {

  provides("json", function() {

    send('{"type" : "FeatureCollection", "features" : [');
    var sep="";
    
    while (row = getRow()) {
      send(sep + JSON.stringify(row.value));
      sep=",";
    }

    send("]}");
  });
}