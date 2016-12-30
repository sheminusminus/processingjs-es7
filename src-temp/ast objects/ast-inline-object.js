  function AstInlineObject(members) {
    this.members = members;
  }
  AstInlineObject.prototype.toString = function() {
    var oldContext = replaceContext;
    replaceContext = function (subject) {
        return subject.name === "this" ? "this" : oldContext(subject); // saving "this."
    };
    var result = "";
    for(var i=0,l=this.members.length;i<l;++i) {
      if(this.members[i].label) {
        result += this.members[i].label + ": ";
      }
      result += this.members[i].value.toString() + ", ";
    }
    replaceContext = oldContext;
    return result.substring(0, result.length - 2);
  };