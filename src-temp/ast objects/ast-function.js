export default class AstFunction {
  constructor (name, params, body) {
    this.name = name;
    this.params = params;
    this.body = body;
  }

  toString(replaceContext) {
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstFunction.toString");
      console.trace();
    }

    // saving "this." and parameters
    var names = appendToLookupTable({"this":null}, this.params.getNames());
    replaceContext = function (subject) {
      return names.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };
    var result = "function";
    if(this.name) {
      result += " " + this.name;
    }
    var body = this.params.prependMethodArgs(this.body.toString());
    result += this.params + " " + body;
    replaceContext = oldContext;
    return result;
  }
};