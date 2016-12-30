  function AstInlineClass(baseInterfaceName, body) {
    this.baseInterfaceName = baseInterfaceName;
    this.body = body;
    body.owner = this;
  }
  AstInlineClass.prototype.toString = function() {
    return "new (" + this.body + ")";
  };