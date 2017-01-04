import replaceContextInVars from "../replace-context-in-vars";

export default class AstExpression {
  constructor(expr, transforms) {
    this.expr = expr;
    this.transforms = transforms;
  }

  toString(replaceContext) {
    var transforms = this.transforms;
    var expr = replaceContextInVars(this.expr, replaceContext);
    return expr.replace(/"!(\d+)"/g, (all, index) => transforms[index].toString(replaceContext));
  }
};
