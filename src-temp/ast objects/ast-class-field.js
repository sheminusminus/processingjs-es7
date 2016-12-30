  function AstClassField(definitions, fieldType, isStatic) {
    this.definitions = definitions;
    this.fieldType = fieldType;
    this.isStatic = isStatic;
  }
  AstClassField.prototype.getNames = function() {
    var names = [];
    for(var i=0,l=this.definitions.length;i<l;++i) {
      names.push(this.definitions[i].name);
    }
    return names;
  };
  AstClassField.prototype.toString = function() {
    var thisPrefix = replaceContext({ name: "[this]" });
    if(this.isStatic) {
      var className = this.owner.name;
      var staticDeclarations = [];
      for(var i=0,l=this.definitions.length;i<l;++i) {
        var definition = this.definitions[i];
        var name = definition.name, staticName = className + "." + name;
        var declaration = "if(" + staticName + " === void(0)) {\n" +
          " " + staticName + " = " + definition.value + "; }\n" +
          "$p.defineProperty(" + thisPrefix + ", " +
          "'" + name + "', { get: function(){return " + staticName + ";}, " +
          "set: function(val){" + staticName + " = val;} });\n";
        staticDeclarations.push(declaration);
      }
      return staticDeclarations.join("");
    }
    return thisPrefix + "." + this.definitions.join("; " + thisPrefix + ".");
  };