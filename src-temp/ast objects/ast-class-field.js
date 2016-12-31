import contextMappedString from "../context-mapped-string.js";

export default class AstClassField {
  constructor(definitions, fieldType, isStatic) {
    this.definitions = definitions;
    this.fieldType = fieldType;
    this.isStatic = isStatic;
  }

  getNames() {
    var names = [];
    for(var i=0,l=this.definitions.length;i<l;++i) {
      names.push(this.definitions[i].name);
    }
    return names;
  }

  toString(replaceContext) {
    var thisPrefix = replaceContext({ name: "[this]" });
    if(this.isStatic) {
      var className = this.owner.name;
      var staticDeclarations = [];
      for(var i=0,l=this.definitions.length;i<l;++i) {
        var definition = this.definitions[i];
        var name = definition.name;
        var staticName = className + "." + name;
        var declaration = "if(" + staticName + " === void(0)) {\n" +
          " " + staticName + " = " + definition.value + "; }\n" +
          "$p.defineProperty(" + thisPrefix + ", " +
          "'" + name + "', { get: function(){return " + staticName + ";}, " +
          "set: function(val){" + staticName + " = val;} });\n";
        staticDeclarations.push(declaration);
      }
      return contextMappedString(staticDeclarations, replaceContext, '');
    }
    return thisPrefix + "." + contextMappedString(this.definitions, replaceContext, "; " + thisPrefix + ".");
  }
};
