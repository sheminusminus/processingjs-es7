export default class AstForInExpression {
  constructor(initStatement, container) {
    this.initStatement = initStatement;
    this.container = container;
  }

  toString(replaceContext) {
    var init = this.initStatement.toString();
    if(init.indexOf("=") >= 0) { // can be without var declaration
      init = init.substring(0, init.indexOf("="));
    }
    return "(" + init + " in " + this.container + ")";
  }
};
