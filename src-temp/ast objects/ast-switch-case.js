export default class AstSwitchCase {
  constructor(expr) {
    this.expr = expr;
  }

  toString(replaceContext) {
    return "case " + this.expr.toString(replaceContext) + ":";
  }
};
