export default class AstForExpression {
  constructor(initStatement, condition, step) {
    this.initStatement = initStatement;
    this.condition = condition;
    this.step = step;
  }

  toString(replaceContext) {
    return "(" + this.initStatement + "; " + this.condition + "; " + this.step + ")";
  }
};
