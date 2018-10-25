'use strict';
function cell(content, node) {
  var colspan = node.getAttribute("colspan");
  var rowspan = node.getAttribute("rowspan");
  colspan = colspan ? " colspan=" + colspan : "";
  rowspan = rowspan ? " rowspan=" + rowspan : "";
  var suffix = " " + rowspan ? "|" : "|".repeat(colspan + 1);
  var index = Array.prototype.indexOf.call(node.parentNode.childNodes, node);
  var prefix = " ";
  if (index === 0) prefix = "| ";
  return prefix + content + suffix;
}

function toMarkdown(content) {
  // http://pandoc.org/README.html#pandocs-markdown
  var pandoc = [
    {
      filter: "h1",
      replacement: function(content, node) {
        var underline = Array(content.length + 1).join("=");
        return "\n\n" + content + "\n" + underline + "\n\n";
      }
    },

    {
      filter: "h2",
      replacement: function(content, node) {
        var underline = Array(content.length + 1).join("-");
        return "\n\n" + content + "\n" + underline + "\n\n";
      }
    },

    {
      filter: "sup",
      replacement: function(content) {
        return "^" + content + "^";
      }
    },

    {
      filter: "sub",
      replacement: function(content) {
        return "~" + content + "~";
      }
    },

    {
      filter: "br",
      replacement: function() {
        return "\n";
      }
    },

    {
      filter: "hr",
      replacement: function() {
        return "\n\n* * * * *\n\n";
      }
    },

    {
      filter: ["em", "i", "cite", "var"],
      replacement: function(content) {
        return "*" + content + "*";
      }
    },

    {
      filter: function(node) {
        var hasSiblings = node.previousSibling || node.nextSibling;
        var isCodeBlock = node.parentNode.nodeName === "PRE" && !hasSiblings;
        var isCodeElem =
          node.nodeName === "CODE" ||
          node.nodeName === "KBD" ||
          node.nodeName === "SAMP" ||
          node.nodeName === "TT";

        return isCodeElem && !isCodeBlock;
      },
      replacement: function(content) {
        return "`" + content + "`";
      }
    },

    {
      filter: function(node) {
        return node.nodeName === "A" && node.getAttribute("href");
      },
      replacement: function(content, node) {
        var url = node.getAttribute("href");
        var titlePart = node.title ? ' "' + node.title + '"' : "";
        if (content === url) {
          return "<" + url + ">";
        } else if (url === "mailto:" + content) {
          return "<" + content + ">";
        } else {
          return "[" + content + "](" + url + titlePart + ")";
        }
      }
    },

    {
      filter: "li",
      replacement: function(content, node) {
        content = content.replace(/^\s+/, "").replace(/\n/gm, "\n    ");
        var prefix = "-   ";
        var parent = node.parentNode;

        if (/ol/i.test(parent.nodeName)) {
          var index = Array.prototype.indexOf.call(parent.children, node) + 1;
          prefix = index + ". ";
          while (prefix.length < 4) {
            prefix += " ";
          }
        }

        return prefix + content;
      }
    },
    {
      filter: ["font", "span", "div"],
      replacement: function(content) {
        return content;
      }
    },
    {
      filter: ["pre"],
      replacement: function(content) {
        return `\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    },
    // {
    //     filter: 'table',
    //     replacement: function (content, node) {
    //         console.log('process table');
    //         return `\n\n<${node.nodeName}>${content}\n</${node.nodeName}>\n\n`
    //     }
    // },
    // {
    //     filter: ['thead', 'tbody', 'tfoot', 'th', 'tr'],
    //     replacement: function (content, node) {
    //         console.log(`process ${node.nodeName}`);
    //         return `\n<${node.nodeName}>${content}\n</${node.nodeName}>`
    //     }
    // },
    // {
    //     filter: ['td'],
    //     replacement: function (content, node) {
    //         console.log(`process ${node.nodeName}`);
    //         var colspan = node.getAttribute('colspan')
    //         var rowspan = node.getAttribute('rowspan')
    //         colspan = colspan? ' colspan=' + colspan: ""
    //         rowspan = rowspan? ' rowspan=' + rowspan: ""
    //         return `\n<${node.nodeName}${colspan}${rowspan}>${content.replace(/\n/gm, '')}</${node.nodeName}>`
    //     }
    // },

    // table
    {
      filter: ["colgroup"],
      replacement: function(content) {
        return "";
      }
    },
    {
      filter: ["th", "td"],
      replacement: function(content, node) {
        return cell(content.replace(/\n/gm, ""), node);
      }
    },
    {
      filter: "tr",
      replacement: function(content, node) {
        var borderCells = "";
        var alignMap = { left: ":--", right: "--:", center: ":-:" };

        if (
          node.parentNode.nodeName === "THEAD" ||
          (node.parentNode.nodeName === "TBODY" &&
            node.parentNode.previousSibling === null &&
            node.previousSibling === null)
        ) {
          for (var i = 0; i < node.childNodes.length; i++) {
            var align = node.childNodes[i].attributes.align;
            var border = "---";

            if (align) border = alignMap[align.value] || border;

            borderCells += cell(border, node.childNodes[i]);
          }
        }
        return "\n" + content + (borderCells ? "\n" + borderCells : "");
      }
    },
    {
      filter: "table",
      replacement: function(content) {
        return "\n\n" + content + "\n\n";
      }
    },
    {
      filter: ["thead", "tbody", "tfoot"],
      replacement: function(content) {
        return content;
      }
    }
  ];

  // http://pandoc.org/README.html#smart-punctuation
  var escape = function(str) {
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
      .replace(/^\s+|[\s\\]+$/g, "");
  };

  var to_Markdown = require("to-markdown");
  return escape(to_Markdown(content, { converters: pandoc }));
}

export { toMarkdown };
