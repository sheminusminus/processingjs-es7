
// utility function for getting an atom's index.
// note that this cuts off the first 2, and last,
// character in the template string
function getAtomIndex(templ) {
  return templ.substring(2, templ.length - 1);
}
