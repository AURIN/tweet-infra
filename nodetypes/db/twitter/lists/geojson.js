function(head, req) {

  provides("json", function() {

    var fc = {
      type : "FeatureCollection",
      features : []
    };

    while (row = getRow()) {
      fc.features.push(row.value);
    }

    // make sure to stringify the results :)
    send(JSON.stringify(fc));
  });
}