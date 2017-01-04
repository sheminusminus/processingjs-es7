import virtEquals from "../utils/virtEquals";
import virtHashCode from "../utils/virtHashCode";

import Set from "./Set";
import Entry from "./Entry";
import JavaBaseClass from "../../JavaBaseClass";

function getBucketIndex(buckets, key) {
  let index = virtHashCode(key) % buckets.length;
  return index < 0 ? buckets.length + index : index;
}

function ensureLoad(buckets, loadFactor, count) {
  if (count <= loadFactor * buckets.length) {
    return;
  }
  let allEntries = [];
  buckets.forEach(bucket => {
    if (bucket) {
      allEntries = allEntries.concat(bucket);
    }
  });
  let newBucketsLength = buckets.length * 2;
  let newbuckets = [];
  newbuckets.length = newBucketsLength;
  allEntries.forEach(entry => {
    let index = getBucketIndex(buckets, allEntries[j].key);
    // FIXME: TODO: bit convoluted...?
    let bucket = newbuckets[index];
    if (bucket === undefined) {
      newbuckets[index] = bucket = [];
    }
    bucket.push(allEntries[j]);
  })
  return buckets;
}

/**
* A HashMap stores a collection of objects, each referenced by a key. This is similar to an Array, only
* instead of accessing elements with a numeric index, a String  is used. (If you are familiar with
* associative arrays from other languages, this is the same idea.)
*
* @param {int} initialCapacity          defines the initial capacity of the map, it's 16 by default
* @param {float} loadFactor             the load factor for the map, the default is 0.75
* @param {Map} m                        gives the new HashMap the same mappings as this Map
*/
export default class HashMap extends JavaBaseClass {

  /**
  * @member HashMap
  * A HashMap stores a collection of objects, each referenced by a key. This is similar to an Array, only
  * instead of accessing elements with a numeric index, a String  is used. (If you are familiar with
  * associative arrays from other languages, this is the same idea.)
  *
  * @param {int} initialCapacity          defines the initial capacity of the map, it's 16 by default
  * @param {float} loadFactor             the load factor for the map, the default is 0.75
  * @param {Map} m                        gives the new HashMap the same mappings as this Map
  */
  constructor(other) {
    super();
    if (other instanceof HashMap) {
      return arguments[0].clone();
    }
    this.initialCapacity = arguments.length > 0 ? arguments[0] : 16;
    this.loadFactor = arguments.length > 1 ? arguments[1] : 0.75;
    this.clear();
  }


  clear() {
    this.count = 0;
    this.buckets = [];
    this.buckets.length = this.initialCapacity;
  }

  clone() {
    let map = new HashMap();
    map.putAll(this);
    return map;
  }

  containsKey(key) {
    let buckets = this.buckets;
    let index = getBucketIndex(buckets, key);
    let bucket = buckets[index];
    if (bucket === undefined) {
      return false;
    }
    for (let i = 0; i < bucket.length; ++i) {
      if (virtEquals(bucket[i].key, key)) {
        return true;
      }
    }
    return false;
  }

  containsValue(value) {
    let buckets = this.buckets;
    for (let i = 0; i < buckets.length; ++i) {
      let bucket = buckets[i];
      if (bucket === undefined) {
        continue;
      }
      for (let j = 0; j < bucket.length; ++j) {
        if (virtEquals(bucket[j].value, value)) {
          return true;
        }
      }
    }
    return false;
  }

  entrySet() {
    let conversion = pair => new Entry(pair);
    let isIn = pair => (pair instanceof Entry) && pair._isIn(this);
    let removeItem = pair => this.remove(pair.getKey());
    return new Set(this, conversion, isIn, removeItem);
  }

  get(key) {
    let buckets = this.buckets;
    let index = getBucketIndex(buckets, key);
    let bucket = buckets[index];
    if (bucket === undefined) {
      return null;
    }
    for (let i = 0; i < bucket.length; ++i) {
      if (virtEquals(bucket[i].key, key)) {
        return bucket[i].value;
      }
    }
    return null;
  }

  isEmpty() {
    return this.count === 0;
  }

  keySet() {
    let conversion = pair => pair.key;
    let isIn = key => this.containsKey(key);
    let removeItem = key => this.remove(key);
    return new Set(this, conversion, isIn, removeItem);
  }

  values() {
    let conversion = pair => pair.value;
    let isIn = value => this.containsValue(value);
    let removeItem = value => this.removeByValue(value);
    return new Set(this, conversion, isIn, removeItem);
  }

  put(key, value) {
    let buckets = this.buckets;
    let index = getBucketIndex(buckets, key);
    let bucket = buckets[index];
    if (bucket === undefined) {
      ++this.count;
      buckets[index] = [{
        key: key,
        value: value
      }];
      ensureLoad(buckets, this.loadFactor, this.count);
      return null;
    }
    for (let i = 0; i < bucket.length; ++i) {
      if (virtEquals(bucket[i].key, key)) {
        let previous = bucket[i].value;
        bucket[i].value = value;
        return previous;
      }
    }
    ++this.count;
    bucket.push({
      key: key,
      value: value
    });
    ensureLoad(buckets, this.loadFactor, this.count);
    return null;
  }

  putAll(m) {
    let it = m.entrySet().iterator();
    while (it.hasNext()) {
      let entry = it.next();
      this.put(entry.getKey(), entry.getValue());
    }
  }

  remove(key) {
    let buckets = this.buckets;
    let index = getBucketIndex(buckets, key);
    let bucket = buckets[index];
    if (bucket === undefined) {
      return null;
    }
    for (let i = 0; i < bucket.length; ++i) {
      if (virtEquals(bucket[i].key, key)) {
        --this.count;
        let previous = bucket[i].value;
        bucket[i].removed = true;
        if (bucket.length > 1) {
          bucket.splice(i, 1);
        } else {
          buckets[index] = undefined;
        }
        return previous;
      }
    }
    return null;
  }

  removeByValue(value) {
    // FIXME: TODO: surely this can be done better now
    let buckets = this.buckets, bucket, i, ilen, pair;
    for (bucket in buckets) {
      if (buckets.hasOwnProperty(bucket)) {
        for (i = 0, ilen = buckets[bucket].length; i < ilen; i++) {
          pair = buckets[bucket][i];
          // removal on values is based on identity, not equality
          if (pair.value === value) {
            buckets[bucket].splice(i, 1);
            return true;
          }
        }
      }
    }
    return false;
  }

  size() {
    return this.count;
  }

  // toString override
  toString() {
    let buckets = this.buckets;
    let rset = [];
    buckets.forEach(bucket => {
      bucket.forEach(pair => {
        rset.push(pair.key + "=" + pair.value.toString());
      })
    })
    return `{${ rset.join(',') }}`;
  }
};
