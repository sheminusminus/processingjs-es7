export default class AstConstructor {
  constructor(params, body) {
    this.params = params;
    this.body = body;
  }

  toString(replaceContext) {
    var paramNames = appendToLookupTable({}, this.params.getNames());

    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstConstructor.toString");
      console.trace();
    }

    replaceContext = function (subject) {
      return paramNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };

    var prefix = "function $constr_" + this.params.params.length + this.params.toString();
    var body = this.params.prependMethodArgs(this.body.toString());
    if(!/\$(superCstr|constr)\b/.test(body)) {
      body = "{\n$superCstr();\n" + body.substring(1);
    }
    replaceContext = oldContext;
    return prefix + body + "\n";
  }
};
