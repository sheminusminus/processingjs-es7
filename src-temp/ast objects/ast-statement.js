  function AstStatement(expression) {
    this.expression = expression;
  }
  AstStatement.prototype.toString = function() {
    return this.expression.toString();
  };