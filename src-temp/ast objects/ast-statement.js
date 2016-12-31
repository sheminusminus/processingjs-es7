export default class AstStatement {
  constructor(expression) {
    this.expression = expression;
  }

  toString(replaceContext) {
    return this.expression.toString(replaceContext);
  }
};
