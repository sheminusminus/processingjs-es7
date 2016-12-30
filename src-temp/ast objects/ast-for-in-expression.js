

  function AstForInExpression(initStatement, container) {
    this.initStatement = initStatement;
    this.container = container;
  }
  AstForInExpression.prototype.toString = function() {
    var init = this.initStatement.toString();
    if(init.indexOf("=") >= 0) { // can be without var declaration
      init = init.substring(0, init.indexOf("="));
    }
    return "(" + init + " in " + this.container + ")";
  };
