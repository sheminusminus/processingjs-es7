import appendToLookupTable from "../append-to-lookup-table";

export default class AstMethod {
  constructor(name, params, body) {
    this.name = name;
    this.params = params;
    this.body = body;
  }

  toString(replaceContext) {
    var paramNames = appendToLookupTable({}, this.params.getNames());
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstMethod.toString");
      console.trace();
    }

    replaceContext = function (subject) {
      return paramNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };

    var body = this.params.prependMethodArgs(this.body.toString(replaceContext));

    return "function " + this.name + this.params + " " + body + "\n" +
                 "$p." + this.name + " = " + this.name + ";\n" +
                 this.name + " = " + this.name + ".bind($p);";
  }
};
