// AstParam contains the name of a parameter inside a function declaration
export default class AstParam {
  constructor(name) {
    this.name = name;
  }

  toString(replaceContext) {
    return this.name;
  }
};
