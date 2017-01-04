import contextMappedString from "../context-mapped-string.js";
import appendToLookupTable from "../append-to-lookup-table";

export default class AstClassMethod {
  constructor(name, params, body, isStatic) {
    this.name = name;
    this.params = params;
    this.body = body;
    this.isStatic = isStatic;
  }

  toString(replaceContext) {
    var paramNames = appendToLookupTable({}, this.params.getNames());
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstClassMethod.toString");
      console.trace();
    }

    replaceContext = function (subject) {
      return paramNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };

    var body = this.params.prependMethodArgs(this.body.toString(replaceContext));
    var result = "function " + this.methodId + this.params.toString(replaceContext) + " " + body +"\n";
    return result;
  }
};
