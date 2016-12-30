  function AstStatementsBlock(statements) {
    this.statements = statements;
  }
  AstStatementsBlock.prototype.toString = function() {
    var localNames = getLocalNames(this.statements);
    var oldContext = replaceContext;

    // replacing context only when necessary
    if(!isLookupTableEmpty(localNames)) {
      replaceContext = function (subject) {
        return localNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
      };
    }

    var result = "{\n" + this.statements.join('') + "\n}";
    replaceContext = oldContext;
    return result;
  };