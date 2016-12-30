
// check to see if the lookup table has any entries,
// making sure to consider it empty even when it has
// inherited properties from supers.
function isLookupTableEmpty(table) {
  for(var i in table) {
    if(table.hasOwnProperty(i)) {
      return false;
    }
  }
  return true;
}