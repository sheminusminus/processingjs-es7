  function AstVar(definitions, varType) {
    this.definitions = definitions;
    this.varType = varType;
  }
  AstVar.prototype.getNames = function() {
    var names = [];
    for(var i=0,l=this.definitions.length;i<l;++i) {
      names.push(this.definitions[i].name);
    }
    return names;
  };
  AstVar.prototype.toString = function() {
    return "var " + this.definitions.join(",");
  };