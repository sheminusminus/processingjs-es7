import virtEquals from "./utils/virtEquals";
import virtHashCode from "./utils/virtHashCode";

import Set from "./Set";
import Entry from "./Entry";
import Iterator from "./Iterator";
import JavaBaseClass from "../JavaBaseClass";

function getBucketIndex(key) {
  var index = virtHashCode(key) % buckets.length;
  return index < 0 ? buckets.length + index : index;
}

function ensureLoad() {
  if (count <= loadFactor * buckets.length) {
    return;
  }
  var allEntries = [];
  for (var i = 0; i < buckets.length; ++i) {
    if (buckets[i] !== undefined) {
      allEntries = allEntries.concat(buckets[i]);
    }
  }
  var newBucketsLength = buckets.length * 2;
  buckets = [];
  buckets.length = newBucketsLength;
  for (var j = 0; j < allEntries.length; ++j) {
    var index = getBucketIndex(allEntries[j].key);
    var bucket = buckets[index];
    if (bucket === undefined) {
      buckets[index] = bucket = [];
    }
    bucket.push(allEntries[j]);
  }
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
    if (other instanceof HashMap) {
      return arguments[0].clone();
    }

    var initialCapacity = arguments.length > 0 ? arguments[0] : 16;
    var loadFactor = arguments.length > 1 ? arguments[1] : 0.75;
    var buckets = [];
    buckets.length = initialCapacity;
    var count = 0;
    var hashMap = this;
  }


  clear() {
    count = 0;
    buckets = [];
    buckets.length = initialCapacity;
  }

  clone() {
    var map = new HashMap();
    map.putAll(this);
    return map;
  }

  containsKey(key) {
    var index = getBucketIndex(key);
    var bucket = buckets[index];
    if (bucket === undefined) {
      return false;
    }
    for (var i = 0; i < bucket.length; ++i) {
      if (virtEquals(bucket[i].key, key)) {
        return true;
      }
    }
    return false;
  }

  containsValue(value) {
    for (var i = 0; i < buckets.length; ++i) {
      var bucket = buckets[i];
      if (bucket === undefined) {
        continue;
      }
      for (var j = 0; j < bucket.length; ++j) {
        if (virtEquals(bucket[j].value, value)) {
          return true;
        }
      }
    }
    return false;
  }

  entrySet() {
    return new Set(
      function conversion(pair) {
        return new Entry(pair);
      },

      function isIn(pair) {
        return (pair instanceof Entry) && pair._isIn(hashMap);
      },

      function removeItem(pair) {
        return hashMap.remove(pair.getKey());
      }
    );
  }

  get(key) {
    var index = getBucketIndex(key);
    var bucket = buckets[index];
    if (bucket === undefined) {
      return null;
    }
    for (var i = 0; i < bucket.length; ++i) {
      if (virtEquals(bucket[i].key, key)) {
        return bucket[i].value;
      }
    }
    return null;
  }

  isEmpty() {
    return count === 0;
  }

  keySet() {
    return new Set(
      // get key from pair
      function(pair) {
        return pair.key;
      },
      // is-in test
      function(key) {
        return hashMap.containsKey(key);
      },
      // remove from hashmap by key
      function(key) {
        return hashMap.remove(key);
      }
    );
  }

  values() {
    return new Set(
      // get value from pair
      function(pair) {
        return pair.value;
      },
      // is-in test
      function(value) {
        return hashMap.containsValue(value);
      },
      // remove from hashmap by value
      function(value) {
        return hashMap.removeByValue(value);
      }
    );
  }

  put(key, value) {
    var index = getBucketIndex(key);
    var bucket = buckets[index];
    if (bucket === undefined) {
      ++count;
      buckets[index] = [{
        key: key,
        value: value
      }];
      ensureLoad();
      return null;
    }
    for (var i = 0; i < bucket.length; ++i) {
      if (virtEquals(bucket[i].key, key)) {
        var previous = bucket[i].value;
        bucket[i].value = value;
        return previous;
      }
    }
    ++count;
    bucket.push({
      key: key,
      value: value
    });
    ensureLoad();
    return null;
  }

  putAll(m) {
    var it = m.entrySet().iterator();
    while (it.hasNext()) {
      var entry = it.next();
      this.put(entry.getKey(), entry.getValue());
    }
  }

  remove(key) {
    var index = getBucketIndex(key);
    var bucket = buckets[index];
    if (bucket === undefined) {
      return null;
    }
    for (var i = 0; i < bucket.length; ++i) {
      if (virtEquals(bucket[i].key, key)) {
        --count;
        var previous = bucket[i].value;
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
    var bucket, i, ilen, pair;
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
    return count;
  }
};
