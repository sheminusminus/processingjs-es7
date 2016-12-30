
  function AstInnerClass(name, body, isStatic) {
    this.name = name;
    this.body = body;
    this.isStatic = isStatic;
    body.owner = this;
  }
  AstInnerClass.prototype.toString = function() {
    return "" + this.body;
  };