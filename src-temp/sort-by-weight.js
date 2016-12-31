export default function sortByWeight(array) {
  array.sort((a,b) => b.weight - a.weight);
}
