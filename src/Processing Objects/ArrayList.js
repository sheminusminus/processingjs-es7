/**
 * An ArrayList stores a variable number of objects.
 *
 * @param {int} initialCapacity optional defines the initial capacity of the list, it's empty by default
 *
 * @returns {ArrayList} new ArrayList object
 */


import virtEquals from "./common/virtEquals";
import virtHashCode from "./common/virtHashCode";
import Iterator from "./Iterator";
import JavaBaseClass from "../JavaBaseClass";

export default class ArrayList extends JavaBaseClass {
  constructor(a) {
    super();
    this.array = [];
    if (a && a.toArray) {
      this.array = a.toArray();
    }
  }

  /**
   * @member ArrayList
   * ArrayList.get() Returns the element at the specified position in this list.
   *
   * @param {int} i index of element to return
   *
   * @returns {Object} the element at the specified position in this list.
   */
  get(i) {
    return this.array[i];
  }

  /**
   * @member ArrayList
   * ArrayList.contains() Returns true if this list contains the specified element.
   *
   * @param {Object} item element whose presence in this List is to be tested.
   *
   * @returns {boolean} true if the specified element is present; false otherwise.
   */
  contains(item) {
    return this.indexOf(item)>-1;
  }

  /**
   * @member ArrayList
   * ArrayList.indexOf() Returns the position this element takes in the list, or -1 if the element is not found.
   *
   * @param {Object} item element whose position in this List is to be tested.
   *
   * @returns {int} the list position that the first match for this element holds in the list, or -1 if it is not in the list.
   */
  indexOf(item) {
    let array = this.array;
    for (let i = 0, len = array.length; i < len; ++i) {
      if (virtEquals(item, array[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * @member ArrayList
   * ArrayList.lastIndexOf() Returns the index of the last occurrence of the specified element in this list,
   * or -1 if this list does not contain the element. More formally, returns the highest index i such that
   * (o==null ? get(i)==null : o.equals(get(i))), or -1 if there is no such index.
   *
   * @param {Object} item element to search for.
   *
   * @returns {int} the index of the last occurrence of the specified element in this list, or -1 if this list does not contain the element.
   */
  lastIndexOf(item) {
    let array = this.array;
    for (let i = array.length-1; i >= 0; --i) {
      if (virtEquals(item, array[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * @member ArrayList
   * ArrayList.add() Adds the specified element to this list.
   *
   * @param {int}    index  optional index at which the specified element is to be inserted
   * @param {Object} object element to be added to the list
   */
  add(index, object) {
    let array = this.array;
    // add(Object)
    if (!object) {
      object = index;
      return array.push(object);
    }
    // add(i, Object)
    if (typeof index === 'number') {
      if (index < 0) {
        throw new Error(`ArrayList.add(index,Object): index cannot be less than zero (found ${number}).`);
      }
      if (index >= array.length) {
        throw new Error("ArrayList.add(index,Object): index cannot be higher than there are list elements (found ${number} for list size ${array.length}).");
      }
      return array.splice(index, 0, arguments[1]);
    }
    throw(`ArrayList.add(index,Object): index is not a number (found type ${typeof index} instead).`);
  }

  /**
   * @member ArrayList
   * ArrayList.addAll(collection) appends all of the elements in the specified
   * Collection to the end of this list, in the order that they are returned by
   * the specified Collection's Iterator.
   *
   * When called as addAll(index, collection) the elements are inserted into
   * this list at the position indicated by index.
   *
   * @param {index} Optional; specifies the position the colletion should be inserted at
   * @param {collection} Any iterable object (ArrayList, HashMap.keySet(), etc.)
   * @throws out of bounds error for negative index, or index greater than list size.
   */
  addAll(index, collection) {
    let iterator;
    let array = this.array;
    // addAll(Collection)
    if (!collection) {
      collection = index;
      iterator = new ObjectIterator(collection);
      while (iterator.hasNext()) {
        array.push(iterator.next());
      }
      return;
    }
    // addAll(int, Collection)
    if (typeof index === "number") {
      if (index < 0) {
        throw new Error(`ArrayList.addAll(index,Object): index cannot be less than zero (found ${number}).`);
      }
      if (index >= array.length) {
        throw new Error("ArrayList.addAll(index,Object): index cannot be higher than there are list elements (found ${number} for list size ${array.length}).");
      }
      iterator = new ObjectIterator(collection);
      while (iterator.hasNext()) {
        array.splice(index++, 0, iterator.next());
      }
      return;
    }
    throw(`ArrayList.addAll(index,collection): index is not a number (found type ${typeof index} instead).`);
  }

  /**
   * @member ArrayList
   * ArrayList.set() Replaces the element at the specified position in this list with the specified element.
   *
   * @param {int}    index  index of element to replace
   * @param {Object} object element to be stored at the specified position
   */
  set(index, object) {
    let array = this.array;
    if (!object) {
      throw new Error(`ArrayList.set(index,Object): missing object argument.`);
    }
    if (typeof index === 'number') {
      if (index < 0) {
        throw new Error(`ArrayList.set(index,Object): index cannot be less than zero (found ${number}).`);
      }
      if (index >= array.length) {
        throw new Error("ArrayList.set(index,Object): index cannot be higher than there are list elements (found ${number} for list size ${array.length}).");
      }
      return array.splice(index, 1, object);
    }
    throw(`ArrayList.set(index,Object): index is not a number (found type ${typeof index} instead).`);
  }

  /**
   * @member ArrayList
   * ArrayList.size() Returns the number of elements in this list.
   *
   * @returns {int} the number of elements in this list
   */
  size() {
    return this.array.length;
  }

  /**
   * @member ArrayList
   * ArrayList.clear() Removes all of the elements from this list. The list will be empty after this call returns.
   */
  clear() {
    this.array = [];
  };

  /**
   * @member ArrayList
   * ArrayList.remove() Removes an element either based on index, if the argument is a number, or
   * by equality check, if the argument is an object.
   *
   * @param {int|Object} item either the index of the element to be removed, or the element itself.
   *
   * @returns {Object|boolean} If removal is by index, the element that was removed, or null if nothing was removed. If removal is by object, true if removal occurred, otherwise false.
   */
  remove(item) {
    if (typeof item === 'number') {
      return array.splice(item, 1)[0];
    }
    item = this.indexOf(item);
    if (item > -1) {
      array.splice(item, 1);
      return true;
    }
    return false;
  };

   /**
   * @member ArrayList
   * ArrayList.removeAll Removes from this List all of the elements from
   * the current ArrayList which are present in the passed in paramater ArrayList 'c'.
   * Shifts any succeeding elements to the left (reduces their index).
   *
   * @param {ArrayList} the ArrayList to compare to the current ArrayList
   *
   * @returns {boolean} true if the ArrayList had an element removed; false otherwise
   */
  removeAll(other) {
    let oldlist = this.array;
    this.clear();
    // For every item that exists in the original ArrayList and not in the 'other' ArrayList
    // copy it into the empty 'this' ArrayList to create the new 'this' Array.
    oldlist.forEach( (item,i) => {
      if (!other.contains(item)) {
        this.add(x++, item);
      }
    });
    return (this.size() < newList.size());
  }

  /**
   * @member ArrayList
   * ArrayList.isEmpty() Tests if this list has no elements.
   *
   * @returns {boolean} true if this list has no elements; false otherwise
   */
  isEmpty() {
    return this.array.length === 0;
  };

  /**
   * @member ArrayList
   * ArrayList.clone() Returns a shallow copy of this ArrayList instance. (The elements themselves are not copied.)
   *
   * @returns {ArrayList} a clone of this ArrayList instance
   */
  clone() {
    return new ArrayList(this);
  };

  /**
   * @member ArrayList
   * ArrayList.toArray() Returns an array containing all of the elements in this list in the correct order.
   *
   * @returns {Object[]} Returns an array containing all of the elements in this list in the correct order
   */
  toArray() {
    return this.array.slice();
  };

  /**
   * FIXME: TODO: add missing documentation
   */
  iterator() {
    return new Iterator(this.array);
  }

  /**
   * toString override
   */
  toString() {
    return `[${ this.array.map(e => e.toString()).join(',') }]`;
  }
}
