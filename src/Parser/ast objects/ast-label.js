export default class AstLabel {
  constructor(label) {
    this.label = label;
  }

  toString(replaceContext) {
    return this.label;
  }
};
