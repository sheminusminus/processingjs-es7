  // AstParam contains the name of a parameter inside a function declaration
  function AstParam(name) {
    this.name = name;
  }
  AstParam.prototype.toString = function() {
    return this.name;
  };