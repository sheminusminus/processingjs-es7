export default class Iterator {
  constructor(array) {
    this.index = -1;
    this.array = array;
  }

  hasNext() {
    return (this.index + 1) < this.array.length;
  }

  next() {
    return this.array[++this.index];
  }

  remove() {
    this.array.splice(this.index--, 1);
  }
}
