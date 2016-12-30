
  function AstExpression(expr, transforms) {
    this.expr = expr;
    this.transforms = transforms;
  }
  AstExpression.prototype.toString = function() {
    var transforms = this.transforms;
    var expr = replaceContextInVars(this.expr);
    return expr.replace(/"!(\d+)"/g, function(all, index) {
      return transforms[index].toString();
    });
  };