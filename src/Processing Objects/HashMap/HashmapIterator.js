export default class HashmapIterator {
  constructor(buckets, conversion, removeItem) {
    this.buckets = buckets;
    this.bucketIndex = 0;
    this.itemIndex = -1;
    this.endOfBuckets = false;
    this.currentItem = undefined;
    // and now start at "item one"
    this.findNext();
  }

  findNext() {
    while (!this.endOfBuckets) {
      ++this.itemIndex;
      if (this.bucketIndex >= buckets.length) {
        this.endOfBuckets = true;
      } else if (this.buckets[this.bucketIndex] === undefined || this.itemIndex >= this.buckets[this.bucketIndex].length) {
        this.itemIndex = -1;
        ++this.bucketIndex;
      } else {
        return;
      }
    }
  }

  /*
  * @member Iterator
  * Checks if the Iterator has more items
  */
  hasNext() {
    return !this.endOfBuckets;
  };

  /*
  * @member Iterator
  * Return the next Item
  */
  next() {
    this.currentItem = this.conversion(this.buckets[this.bucketIndex][this.itemIndex]);
    this.findNext();
    return currentItem;
  };

  /*
  * @member Iterator
  * Remove the current item
  */
  remove() {
    if (this.currentItem !== undefined) {
      this.removeItem(currentItem);
      --this.itemIndex;
      this.findNext();
    }
  };
};
