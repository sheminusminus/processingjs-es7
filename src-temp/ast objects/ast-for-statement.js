  function AstForStatement(argument, misc) {
    this.argument = argument;
    this.misc = misc;
  }
  AstForStatement.prototype.toString = function() {
    return this.misc.prefix + this.argument.toString();
  };