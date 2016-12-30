// masks parentheses, brackets and braces with '"A5"'
// where A is the bracket type, and 5 is the index in an array containing all brackets split into atoms
// 'while(true){}' -> 'while"B1""A2"'
//
//  The mapping used is:
//
//    braces{} = A
//    parentheses() = B
//    brackets[] = C
//
function splitToAtoms(code) {
  var atoms = [];
  var items = code.split(/([\{\[\(\)\]\}])/);
  var result = items[0];

  var stack = [];
  for(var i=1; i < items.length; i += 2) {
    var item = items[i];
    if(item === '[' || item === '{' || item === '(') {
      stack.push(result); result = item;
    } else if(item === ']' || item === '}' || item === ')') {
      var kind = item === '}' ? 'A' : item === ')' ? 'B' : 'C';
      var index = atoms.length; atoms.push(result + item);
      result = stack.pop() + '"' + kind + (index + 1) + '"';
    }
    result += items[i + 1];
  }
  atoms.unshift(result);
  return atoms;
}
