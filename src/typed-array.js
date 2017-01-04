// Typed Arrays: fallback to WebGL arrays or Native JS arrays if unavailable
function setupTypedArray(name, fallback) {
  // Check if TypedArray exists, and use if so.
  if (name in window) {
    return window[name];
  }

  // Check if WebGLArray exists
  if (typeof window[fallback] === "function") {
    return window[fallback];
  }

  // Use Native JS array
  return function(obj) {
    if (obj instanceof Array) {
      return obj;
    }
    if (typeof obj === "number") {
      var arr = [];
      arr.length = obj;
      return arr;
    }
  };
}

export default const {
  Float32Array: setupTypedArray("Float32Array", "WebGLFloatArray"),
  Int32Array  : setupTypedArray("Int32Array",   "WebGLIntArray"),
  Uint16Array : setupTypedArray("Uint16Array",  "WebGLUnsignedShortArray"),
  Uint8Array  : setupTypedArray("Uint8Array",   "WebGLUnsignedByteArray")
};
