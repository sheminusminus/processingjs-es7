

  function AstSwitchCase(expr) {
    this.expr = expr;
  }
  AstSwitchCase.prototype.toString = function() {
    return "case " + this.expr + ":";
  };