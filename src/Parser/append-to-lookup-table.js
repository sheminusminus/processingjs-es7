// append a record to the lookup table
export default function appendToLookupTable(table, array) {
  for(var i=0,l=array.length;i<l;++i) {
    table[array[i]] = null;
  }
  return table;
}
