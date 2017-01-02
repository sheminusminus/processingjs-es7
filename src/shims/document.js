var document = {
  createElement(tag) {
    var element = {
      name: tag,
      textContent: '',
      async: false,
      toString() {
        return `${element.name}(async:${ element.async })[${ element.textContent }]`;
      }
    };
    return element;
  },
  querySelector(selector) {
    var head = {
      name: "head",
      children: [],
      appendChild(node) {
        this.children.push(node);
        return this;
      },
      toString() {
        return `head[${ head.children.map(e => e.toString()) }]`;
      }
    };
    return head;
  }
};

export default document;
