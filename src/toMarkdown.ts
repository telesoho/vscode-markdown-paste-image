type ListNode = { nodeName: string; parentNode: ListNode | null };

function isList(node: ListNode | null): boolean {
  return !!node && (node.nodeName === "UL" || node.nodeName === "OL");
}

/**
 * Count how many lists (ul/ol) this list item's list is nested in directly, without a list item
 * in between (e.g. <ul><ul><li>). Such lists are not indented by a parent list item, so their
 * items have to indent themselves.
 */
function getDirectListNesting(liNode: ListNode): number {
  let nesting = 0;
  let list = liNode.parentNode;
  while (list && isList(list.parentNode)) {
    nesting++;
    list = list.parentNode;
  }
  return nesting;
}

function genBorder(content, node) {
  const colspan = parseInt(node.getAttribute("colspan") || "0");
  let suffix = " " + content + " |";
  if (colspan) {
    suffix = suffix.repeat(colspan);
  }

  const index = Array.prototype.indexOf.call(node.parentNode.childNodes, node);
  let prefix = " ";
  if (index === 0) {
    prefix = "|";
  }
  return prefix + suffix;
}

function cell(content, node) {
  // Escape pipe characters in cell content to prevent Markdown parser from treating them as column separators
  content = content.replace(/\|/g, "\\|");

  const colspan = parseInt(node.getAttribute("colspan") || "0");
  let suffix = "|";
  if (colspan) {
    suffix = suffix.repeat(colspan);
  }

  const index = Array.prototype.indexOf.call(node.parentNode.childNodes, node);
  let prefix = " ";
  if (index === 0) {
    prefix = "| ";
  }
  return prefix + content + " " + suffix;
}

function toMarkdown(content, options) {
  // http://pandoc.org/README.html#pandocs-markdown
  const pandoc = [
    // {
    //   filter: "h1",
    //   replacement: function (content, node) {
    //     const underline = Array(content.length + 1).join("=");
    //     return "\n\n" + content + "\n" + underline + "\n\n";
    //   },
    // },

    // {
    //   filter: "h2",
    //   replacement: function (content, node) {
    //     const underline = Array(content.length + 1).join("-");
    //     return "\n\n" + content + "\n" + underline + "\n\n";
    //   },
    // },
    {
      filter: ["style", "script", "head", "meta"],
      replacement: function (content) {
        return "";
      },
    },
    {
      filter: "sup",
      replacement: function (content) {
        return "^" + content + "^";
      },
    },

    {
      filter: "sub",
      replacement: function (content) {
        return "~" + content + "~";
      },
    },

    {
      filter: "br",
      replacement: function () {
        return "\n";
      },
    },
    {
      filter: ["em", "i", "cite", "var"],
      replacement: function (content, node, options) {
        return options.emDelimiter + content + options.emDelimiter;
      },
    },

    {
      filter: function (node) {
        const hasSiblings = node.previousSibling || node.nextSibling;
        const isCodeBlock = node.parentNode.nodeName === "PRE" && !hasSiblings;
        const isCodeElem =
          node.nodeName === "CODE" ||
          node.nodeName === "KBD" ||
          node.nodeName === "SAMP" ||
          node.nodeName === "TT";

        return isCodeElem && !isCodeBlock;
      },
      replacement: function (content, node, options) {
        return "`" + content + "`";
      },
    },

    {
      filter: function (node) {
        return node.nodeName === "A" && node.getAttribute("href");
      },
      replacement: function (content, node, options) {
        const url = node.getAttribute("href");
        const titlePart = node.title ? ' "' + node.title + '"' : "";
        if (content === url) {
          return "<" + url + ">";
        } else if (url === "mailto:" + content) {
          return "<" + content + ">";
        } else if (content !== "") {
          return "[" + content + "](" + url + titlePart + ")";
        } else {
          return "";
        }
      },
    },

    {
      filter: ["font", "span"],
      replacement: function (content) {
        return content;
      },
    },
    {
      filter: ["div"],
      replacement: function (content) {
        return content + "\n";
      },
    },
    // Nested list support (Issues #145, #157). A list nested in a list item is indented by that
    // item, which indents all of its content by one level. So each item only adds its own level,
    // plus the levels of lists nested directly in a list, which no list item indents.
    {
      filter: "li",
      replacement: function (content, node, opts) {
        content = content.replace(/^\n+/, "").replace(/\n+$/, "\n");
        const indent = "    "; // 4 spaces per level (CommonMark)
        const leadingSpaces = indent.repeat(getDirectListNesting(node));
        const continuationIndent = leadingSpaces + indent;
        content = content.replace(/\n/gm, "\n" + continuationIndent);
        let prefix = (opts.bulletListMarker || "*") + "   ";
        const parent = node.parentNode;
        if (parent && parent.nodeName === "OL") {
          const start = parent.getAttribute("start");
          const index = Array.prototype.indexOf.call(parent.children, node);
          prefix = (start ? Number(start) + index : index + 1) + ".  ";
        }
        const lineEnd = node.nextSibling && !/\n$/.test(content) ? "\n" : "";
        return leadingSpaces + prefix + content + lineEnd;
      },
    },
    {
      filter: ["pre"],
      replacement: function (content) {
        return `\n\`\`\`\n${content}\n\`\`\`\n`;
      },
    },
    // {
    //     filter: 'table',
    //     replacement: function (content, node) {
    //         Logger.log('process table');
    //         return `\n\n<${node.nodeName}>${content}\n</${node.nodeName}>\n\n`
    //     }
    // },
    // {
    //     filter: ['thead', 'tbody', 'tfoot', 'th', 'tr'],
    //     replacement: function (content, node) {
    //         Logger.log(`process ${node.nodeName}`);
    //         return `\n<${node.nodeName}>${content}\n</${node.nodeName}>`
    //     }
    // },
    // {
    //     filter: ['td'],
    //     replacement: function (content, node) {
    //         Logger.log(`process ${node.nodeName}`);
    //         const colspan = node.getAttribute('colspan')
    //         const rowspan = node.getAttribute('rowspan')
    //         colspan = colspan? ' colspan=' + colspan: ""
    //         rowspan = rowspan? ' rowspan=' + rowspan: ""
    //         return `\n<${node.nodeName}${colspan}${rowspan}>${content.replace(/\n/gm, '')}</${node.nodeName}>`
    //     }
    // },

    // table
    {
      filter: ["colgroup"],
      replacement: function (content) {
        return "";
      },
    },
    {
      filter: ["th", "td"],
      replacement: function (content, node) {
        return cell(content.replace(/\n/gm, ""), node);
      },
    },
    {
      filter: "tr",
      replacement: function (content, node) {
        let borderCells = "";
        const alignMap = { left: ":--", right: "--:", center: ":-:" };

        if (
          node.parentNode.nodeName === "THEAD" ||
          (node.parentNode.nodeName === "TBODY" &&
            node.parentNode.previousSibling === null &&
            node.previousSibling === null) ||
          node.previousSibling === null ||
          node.previousSibling.nodeName === "COLGROUP"
        ) {
          for (const childNode of node.childNodes) {
            const align = childNode.attributes.align;
            let border = "---";

            if (align) border = alignMap[align.value] || border;

            borderCells += genBorder(border, childNode);
          }
        }
        return "\n" + content + (borderCells ? "\n" + borderCells : "");
      },
    },
    {
      filter: "table",
      replacement: function (content) {
        return "\n\n" + content + "\n\n";
      },
    },
    {
      filter: ["thead", "tbody", "tfoot"],
      replacement: function (content) {
        return content;
      },
    },
  ];

  // http://pandoc.org/README.html#smart-punctuation
  const escape = function (str) {
    return str
      .replace(/[\u2018\u2019\u00b4]/g, "'")
      .replace(/[\u201c\u201d\u2033]/g, '"')
      .replace(/[\u2212\u2022\u00b7\u25aa]/g, "-")
      .replace(/[\u2013\u2015]/g, "--")
      .replace(/\u2014/g, "---")
      .replace(/\u2026/g, "...")
      .replace(/[ ]+\n/g, "\n")
      .replace(/\s*\\\n/g, "\\\n")
      .replace(/\s*\\\n\s*\\\n/g, "\n\n")
      .replace(/\s*\\\n\n/g, "\n\n")
      .replace(/\n-\n/g, "\n")
      .replace(/\n\n\s*\\\n/g, "\n\n")
      .replace(/\n\n\n*/g, "\n\n")
      .replace(/[ ]+$/gm, "")
      .replace(/<!--\s*([\s\S]*?)\s*-->/gm, "")
      .replace(/^\s+|[\s\\]+$/g, "");
  };

  var TurndownService = require("turndown");
  var turndownService = new TurndownService(options);
  Object.entries(pandoc).forEach(([key, value]) => {
    turndownService.addRule(key, value);
  });
  return escape(turndownService.turndown(content));
}

export { toMarkdown };
