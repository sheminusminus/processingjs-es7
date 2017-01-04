export default class Entry {
  constructor(hashMap, pair) {
    this.hashMap = hashMap;
    this.pair = pair;
  }

  _isIn(map) {
    return map === this.hashMap && (this.pair.removed === undefined);
  }

  equals(o) {
    return virtEquals(this.pair.key, o.getKey());
  }

  getKey() {
    return this.pair.key;
  }

  getValue() {
    return this.pair.value;
  }

  hashCode(o) {
    return virtHashCode(this.pair.key);
  }

  setValue(value) {
    let pair = this.pair;
    let old = pair.value;
    pair.value = value;
    return old;
  }
};
