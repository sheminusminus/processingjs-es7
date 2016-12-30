
  function AstPrefixStatement(name, argument, misc) {
    this.name = name;
    this.argument = argument;
    this.misc = misc;
  }
  AstPrefixStatement.prototype.toString = function() {
    var result = this.misc.prefix;
    if(this.argument !== undef) {
      result += this.argument.toString();
    }
    return result;
  };