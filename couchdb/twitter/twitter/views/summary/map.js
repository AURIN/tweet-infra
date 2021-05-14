function(doc) {

  if (!doc.created_at) {
    return;
  }

  var date = new Date(doc.created_at);
  emit(
    [ doc.location, date.getFullYear(), date.getMonth() + 1, date.getDate() ],
    1);
}
