class AstForEachExpression {
  constructor(initStatement, container) {
    this.initStatement = initStatement;
    this.container = container;

  }

  toString(replaceContext) {
    var init = this.initStatement.toString();
    var iterator = "$it" + (AstForEachExpression.iteratorId++);
    var variableName = init.replace(/^\s*var\s*/, "").split("=")[0];
    var initIteratorAndVariable = "var " + iterator + " = new $p.ObjectIterator(" + this.container + "), " +
       variableName + " = void(0)";
    var nextIterationCondition = iterator + ".hasNext() && ((" +
       variableName + " = " + iterator + ".next()) || true)";
    return "(" + initIteratorAndVariable + "; " + nextIterationCondition + ";)";
  }
};

AstForEachExpression.iteratorId = 0;

export default AstForEachExpression;
