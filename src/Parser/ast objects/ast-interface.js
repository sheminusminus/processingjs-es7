export default class AstInterface {
  constructor(name, body) {
    this.name = name;
    this.body = body;
    body.owner = this;
  }

  toString(replaceContext) {
    return "var " + this.name + " = " + this.body + ";\n" +
      "$p." + this.name + " = " + this.name + ";\n";
  }
};
