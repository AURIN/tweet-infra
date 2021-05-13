function (newDoc, oldDoc, userCtx) {

  if (userCtx.roles.indexOf ('ro') !== -1) {
    throw({unauthorized: "you are not allowed to change this database"});
  }
}
