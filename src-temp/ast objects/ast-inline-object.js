export default class AstInlineObject {
  constructor(members) {
    this.members = members;
  }

  toString(replaceContext) {
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstInlineObject.toString");
      console.trace();
    }

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
  }
};
