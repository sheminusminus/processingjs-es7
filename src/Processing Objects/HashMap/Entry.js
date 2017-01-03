    function Entry(pair) {
      this._isIn = function(map) {
        return map === hashMap && (pair.removed === undefined);
      };

      this.equals = function(o) {
        return virtEquals(pair.key, o.getKey());
      };

      this.getKey = function() {
        return pair.key;
      };

      this.getValue = function() {
        return pair.value;
      };

      this.hashCode = function(o) {
        return virtHashCode(pair.key);
      };

      this.setValue = function(value) {
        var old = pair.value;
        pair.value = value;
        return old;
      };
    }