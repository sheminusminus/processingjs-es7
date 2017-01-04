export default function replaceContextInVars(expr, replaceContext) {
  let contextInVarsRegExp = /(\.\s*)?((?:\b[A-Za-z_]|\$)[\w$]*)(\s*\.\s*([A-Za-z_$][\w$]*)(\s*\()?)?/g;

  let handler = (all, memberAccessSign, identifier, suffix, subMember, callSign) => {
    if(memberAccessSign) {
      return all;
    }

    let subject = {
      name: identifier,
      member: subMember,
      callSign: !!callSign
    };

    try {
      return replaceContext(subject) + (suffix === undefined ? "" : suffix);
    } catch (e) {
      console.error(e);
      return "<<<CONTEXT REPLACEMENT FAILED>>>";
    }
  };

  return expr.replace(contextInVarsRegExp, handler);
};
