export default class AstInlineClass {
  constructor (baseInterfaceName, body) {
    this.baseInterfaceName = baseInterfaceName;
    this.body = body;
    body.owner = this;
  }

  toString(replaceContext) {
    return "new (" + this.body + ")";
  }
};
