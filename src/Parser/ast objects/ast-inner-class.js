export default class AstInnerClass {
  constructor(name, body, isStatic) {
    this.name = name;
    this.body = body;
    this.isStatic = isStatic;
    body.owner = this;
  }

  toString(replaceContext) {
    return "" + this.body;
  }
};
