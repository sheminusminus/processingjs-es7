// Pseudo-random generator
// see http://www.math.uni-bielefeld.de/~sillke/ALGORITHMS/random/marsaglia-c
export default class Marsaglia {
  constructor(i1, i2) {
    this.z=i1 || 362436069;
    this.w= i2 || 521288629;
  }

  intGenerator() {
    this.z=(36969*(this.z&65535)+(this.z>>>16)) & 0xFFFFFFFF;
    this.w=(18000*(this.w&65535)+(this.w>>>16)) & 0xFFFFFFFF;
    return (((this.z&0xFFFF)<<16) | (this.w&0xFFFF)) & 0xFFFFFFFF;
  }

  doubleGenerator() {
    var i = this.intGenerator() / 4294967296;
    return i < 0 ? 1 + i : i;
  }

  static createRandomized() {
    var now = new Date();
    return new Marsaglia((now / 60000) & 0xFFFFFFFF, now & 0xFFFFFFFF);
  }
};
