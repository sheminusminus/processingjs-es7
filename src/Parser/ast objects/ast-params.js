// AstParams contains an array of AstParam objects
export default class AstParams {
  constructor(params, methodArgsParam) {
    this.params = params;
    this.methodArgsParam = methodArgsParam;
  }

  getNames() {
    var names = [];
    for(var i=0,l=this.params.length;i<l;++i) {
      names.push(this.params[i].name);
    }
    return names;
  }

  prependMethodArgs(body) {
    if (!this.methodArgsParam) {
      return body;
    }
    return "{\nvar " + this.methodArgsParam.name +
      " = Array.prototype.slice.call(arguments, " +
      this.params.length + ");\n" + body.substring(1);
  }

  toString(replaceContext) {
    if(this.params.length === 0) {
      return "()";
    }
    var result = "(";
    for(var i=0,l=this.params.length;i<l;++i) {
      result += this.params[i] + ", ";
    }
    return result.substring(0, result.length - 2) + ")";
  }
};