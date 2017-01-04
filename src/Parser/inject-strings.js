// replaces strings and regexs keyed by index with an array of strings
export default function injectStrings(code, strings) {
  return code.replace(/'(\d+)'/g, function(all, index) {
    var val = strings[index];
    if(val.charAt(0) === "/") {
      return val;
    }
    return (/^'((?:[^'\\\n])|(?:\\.[0-9A-Fa-f]*))'$/).test(val) ? "(new $p.Character(" + val + "))" : val;
  });
}