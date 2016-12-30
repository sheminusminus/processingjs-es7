  function AstForExpression(initStatement, condition, step) {
    this.initStatement = initStatement;
    this.condition = condition;
    this.step = step;
  }
  AstForExpression.prototype.toString = function() {
    return "(" + this.initStatement + "; " + this.condition + "; " + this.step + ")";
  };