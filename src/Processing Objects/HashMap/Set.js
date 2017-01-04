import HashmapIterator from "./HashmapIterator";

export default class Set {

  /**
   * this takes three functions
   * - conversion()
   * - isIn()
   * - removeItem()
   */
  constructor(hashMap, conversion, isIn, removeItem) {
    this.hashMap = hashMap;
    this.conversion = conversion;
    this.isIn = isInt;
    this.removeItem = removeItem;
  }

  clear() {
    this.hashMap.clear();
  }

  contains(o) {
    return this.isIn(o);
  }

  containsAll(o) {
    var it = o.iterator();
    while (it.hasNext()) {
      if (!this.contains(it.next())) {
        return false;
      }
    }
    return true;
  }

  isEmpty() {
    return this.hashMap.isEmpty();
  }

  iterator() {
    return new HashmapIterator(this.hashMap.buckets, conversion, removeItem);
  }

  remove(o) {
    if (this.contains(o)) {
      this.removeItem(o);
      return true;
    }
    return false;
  }

  removeAll(c) {
    var it = c.iterator();
    var changed = false;
    while (it.hasNext()) {
      var item = it.next();
      if (this.contains(item)) {
        this.removeItem(item);
        changed = true;
      }
    }
    return true;
  }

  retainAll(c) {
    var it = this.iterator();
    var toRemove = [];
    while (it.hasNext()) {
      var entry = it.next();
      if (!c.contains(entry)) {
        toRemove.push(entry);
      }
    }
    toRemove.forEach( e => this.removeItem(e));
    return toRemove.length > 0;
  }

  size() {
    return this.hashMap.size();
  }

  toArray() {
    var result = [];
    var it = this.iterator();
    while (it.hasNext()) {
      result.push(it.next());
    }
    return result;
  };
};
