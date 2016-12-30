
  function AstClass(name, body) {
    this.name = name;
    this.body = body;
    body.owner = this;
  }
  AstClass.prototype.toString = function() {
    return "var " + this.name + " = " + this.body + ";\n" +
      "$p." + this.name + " = " + this.name + ";\n";
  };