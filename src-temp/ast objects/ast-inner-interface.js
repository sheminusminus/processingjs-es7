export default class AstInnerInterface {
  constructor (name, body, isStatic) {
    this.name = name;
    this.body = body;
    this.isStatic = isStatic;
    body.owner = this;
  }

  toString(replaceContext) {
    return "" + this.body;
  }
};
