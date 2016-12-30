// trims off leading and trailing spaces
// returns an object. object.left, object.middle, object.right, object.untrim
function trimSpaces(string) {
  var m1 = /^\s*/.exec(string), result;
  if(m1[0].length === string.length) {
    result = {left: m1[0], middle: "", right: ""};
  } else {
    var m2 = /\s*$/.exec(string);
    result = {left: m1[0], middle: string.substring(m1[0].length, m2.index), right: m2[0]};
  }
  result.untrim = function(t) { return this.left + t + this.right; };
  return result;
}
