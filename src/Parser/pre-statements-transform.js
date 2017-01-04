export default function preStatementsTransform(statements) {
  let s = statements;
  // turns multiple catch blocks into one, because we have no way to properly get into them anyway.
  return s.replace(/\b(catch\s*"B\d+"\s*"A\d+")(\s*catch\s*"B\d+"\s*"A\d+")+/g, "$1");
};
