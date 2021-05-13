function(doc) {

  if (!doc.created_time) {
    return;
  }

  var date = new Date(doc.created_time * 1000);
  emit(
    [ doc.location, date.getFullYear(), date.getMonth() + 1, date.getDate() ],
    1);
}
