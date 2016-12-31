export default class AstClass {
  constructor(name, body) {
    this.name = name;
    this.body = body;
    body.owner = this;
  }

  toString(replaceContext) {
    return "var " + this.name + " = " + this.body.toString(replaceContext) + ";\n" +
      "$p." + this.name + " = " + this.name + ";\n";
  }
};
