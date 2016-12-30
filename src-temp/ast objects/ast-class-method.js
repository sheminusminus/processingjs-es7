
  function AstClassMethod(name, params, body, isStatic) {
    this.name = name;
    this.params = params;
    this.body = body;
    this.isStatic = isStatic;
  }
  AstClassMethod.prototype.toString = function(){
    var paramNames = appendToLookupTable({}, this.params.getNames());
    var oldContext = replaceContext;
    replaceContext = function (subject) {
      return paramNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };
    var body = this.params.prependMethodArgs(this.body.toString());
    var result = "function " + this.methodId + this.params + " " + body +"\n";
    replaceContext = oldContext;
    return result;
  };