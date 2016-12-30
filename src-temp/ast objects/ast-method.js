  function AstMethod(name, params, body) {
    this.name = name;
    this.params = params;
    this.body = body;
  }
  AstMethod.prototype.toString = function(){
    var paramNames = appendToLookupTable({}, this.params.getNames());
    var oldContext = replaceContext;
    replaceContext = function (subject) {
      return paramNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };
    var body = this.params.prependMethodArgs(this.body.toString());
    var result = "function " + this.name + this.params + " " + body + "\n" +
                 "$p." + this.name + " = " + this.name + ";\n" +
                 this.name + " = " + this.name + ".bind($p);";
//        "$p." + this.name + " = " + this.name + ";";
    replaceContext = oldContext;
    return result;
  };