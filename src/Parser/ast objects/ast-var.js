import contextMappedString from "../context-mapped-string.js";

export default class AstVar {
  constructor(definitions, varType) {
    this.definitions = definitions;
    this.varType = varType;
  }

  getNames() {
    var names = [];
    for(var i=0,l=this.definitions.length;i<l;++i) {
      names.push(this.definitions[i].name);
    }
    return names;
  }

  toString(replaceContext) {
    return "var " + contextMappedString(this.definitions, replaceContext, ',');
  }
};
