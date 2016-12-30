
  // AstParams contains an array of AstParam objects
  function AstParams(params, methodArgsParam) {
    this.params = params;
    this.methodArgsParam = methodArgsParam;
  }
  AstParams.prototype.getNames = function() {
    var names = [];
    for(var i=0,l=this.params.length;i<l;++i) {
      names.push(this.params[i].name);
    }
    return names;
  };
  AstParams.prototype.prependMethodArgs = function(body) {
    if (!this.methodArgsParam) {
      return body;
    }
    return "{\nvar " + this.methodArgsParam.name +
      " = Array.prototype.slice.call(arguments, " +
      this.params.length + ");\n" + body.substring(1);
  };
  AstParams.prototype.toString = function() {
    if(this.params.length === 0) {
      return "()";
    }
    var result = "(";
    for(var i=0,l=this.params.length;i<l;++i) {
      result += this.params[i] + ", ";
    }
    return result.substring(0, result.length - 2) + ")";
  };