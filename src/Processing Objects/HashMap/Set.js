export default class Set {

  constructor(conversion, isIn, removeItem) {
    this.conversion = conversion;
    this.isIn = isInt;
    this.removeItem = removeItem;
  }

  clear() {
    hashMap.clear();
  };

  contains(o) {
    return isIn(o);
  };

  containsAll(o) {
    var it = o.iterator();
    while (it.hasNext()) {
      if (!this.contains(it.next())) {
        return false;
      }
    }
    return true;
  };

  isEmpty() {
    return hashMap.isEmpty();
  };

  iterator() {
    return new Iterator(conversion, removeItem);
  };

  remove(o) {
    if (this.contains(o)) {
      removeItem(o);
      return true;
    }
    return false;
  };

  removeAll(c) {
    var it = c.iterator();
    var changed = false;
    while (it.hasNext()) {
      var item = it.next();
      if (this.contains(item)) {
        removeItem(item);
        changed = true;
      }
    }
    return true;
  };

  retainAll(c) {
    var it = this.iterator();
    var toRemove = [];
    while (it.hasNext()) {
      var entry = it.next();
      if (!c.contains(entry)) {
        toRemove.push(entry);
      }
    }
    for (var i = 0; i < toRemove.length; ++i) {
      removeItem(toRemove[i]);
    }
    return toRemove.length > 0;
  };

  size() {
    return hashMap.size();
  };

  toArray() {
    var result = [];
    var it = this.iterator();
    while (it.hasNext()) {
      result.push(it.next());
    }
    return result;
  };
};
