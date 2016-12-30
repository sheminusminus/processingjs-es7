  function AstCatchStatement(argument, misc) {
    this.argument = argument;
    this.misc = misc;
  }
  AstCatchStatement.prototype.toString = function() {
    return this.misc.prefix + this.argument.toString();
  };