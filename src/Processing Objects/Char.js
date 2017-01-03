export default class Char {
  constructor(chr) {
    let type = typeof chr;
    if (type === 'string' && chr.length === 1) {
      this.code = chr.charCodeAt(0);
    } else if (type === 'number') {
      this.code = chr;
    } else if (chr instanceof Char) {
      this.code = chr.code;
    } else {
      this.code = NaN;
    }
  };

  toString() {
    return String.fromCharCode(this.code);
  }

  valueOf() {
    return this.code;
  }
};
