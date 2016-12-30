  function AstInnerInterface(name, body, isStatic) {
    this.name = name;
    this.body = body;
    this.isStatic = isStatic;
    body.owner = this;
  }
  AstInnerInterface.prototype.toString = function() {
    return "" + this.body;
  };