// Minimal DOM shim for Node.js tests.
// Supports the exact subset used by brewEntryFromXml / equipmentProfileFromXml:
//   DOMParser.parseFromString(xml, "application/xml")
//   doc.querySelector("parsererror") → null or truthy
//   el.getElementsByTagName(tag) → array-like with [0]
//   el.textContent → string

function parseXml(src) {
  // Strip XML declaration and normalize line endings.
  const xml = src.replace(/<\?xml[^?]*\?>/i, "").replace(/\r\n?/g, "\n").trim();
  return parseElement(xml, 0).node;
}

function parseElement(src, start) {
  let i = start;
  // Skip whitespace and text nodes before opening tag
  while (i < src.length && src[i] !== "<") i++;
  if (i >= src.length) return { node: null, end: i };

  // CDATA
  if (src.startsWith("<![CDATA[", i)) {
    const close = src.indexOf("]]>", i + 9);
    const text = close === -1 ? src.slice(i + 9) : src.slice(i + 9, close);
    return { node: makeText(text), end: close === -1 ? src.length : close + 3 };
  }

  // Comment or PI — skip
  if (src.startsWith("<!--", i) || src.startsWith("<?", i)) {
    const close = src.indexOf(src[i + 1] === "!" ? "-->" : "?>", i + 2);
    return { node: null, end: close === -1 ? src.length : close + 3 };
  }

  // Closing tag — signal caller
  if (src[i + 1] === "/") return { node: null, end: i, closingTag: true };

  // Opening tag
  const tagEnd = src.indexOf(">", i + 1);
  if (tagEnd === -1) return { node: null, end: src.length };
  const tagContent = src.slice(i + 1, tagEnd);
  const selfClosing = tagContent.endsWith("/");
  const rawName = selfClosing ? tagContent.slice(0, -1) : tagContent;
  const tagName = rawName.trim().split(/\s+/)[0];

  const el = makeElement(tagName);
  let pos = tagEnd + 1;

  if (!selfClosing) {
    const closeTag = `</${tagName}>`;
    while (pos < src.length) {
      // Check for closing tag of this element
      if (src.startsWith(closeTag, pos)) {
        pos += closeTag.length;
        break;
      }
      if (src[pos] === "<") {
        const result = parseElement(src, pos);
        if (result.closingTag) { pos = src.indexOf(">", pos) + 1; break; }
        if (result.node) el._children.push(result.node);
        pos = result.end;
      } else {
        // Text content up to next tag or closing tag
        const nextTag = src.indexOf("<", pos);
        const text = nextTag === -1 ? src.slice(pos) : src.slice(pos, nextTag);
        if (text.trim()) el._children.push(makeText(text));
        pos = nextTag === -1 ? src.length : nextTag;
      }
    }
  }

  return { node: el, end: pos };
}

function makeText(text) {
  return { _type: "text", textContent: text, _children: [] };
}

function makeElement(tagName) {
  const el = {
    _type: "element",
    tagName,
    _children: [],
    get textContent() {
      return this._children.map((c) => c.textContent ?? "").join("");
    },
    getElementsByTagName(name) {
      const results = [];
      for (const child of this._children) {
        if (child._type === "element") {
          if (child.tagName === name) results.push(child);
          for (const r of child.getElementsByTagName(name)) results.push(r);
        }
      }
      return results;
    },
    querySelector(sel) {
      if (sel === "parsererror") return null; // set by parseFromString on error
      return null;
    },
  };
  return el;
}

class NodeDOMParser {
  parseFromString(src, _mimeType) {
    try {
      const root = parseXml(src);
      if (!root) return errorDoc("Empty document");
      const doc = makeElement("#document");
      doc._children = [root];
      doc.documentElement = root;
      doc.getElementsByTagName = (name) => root.getElementsByTagName(name);
      doc.querySelector = (sel) => {
        if (sel === "parsererror") return null;
        return null;
      };
      return doc;
    } catch (e) {
      return errorDoc(e.message);
    }
  }
}

function errorDoc(msg) {
  const doc = makeElement("#document");
  doc._parseError = msg;
  doc.querySelector = (sel) => {
    if (sel === "parsererror") return { textContent: msg };
    return null;
  };
  doc.getElementsByTagName = () => [];
  return doc;
}

globalThis.DOMParser = NodeDOMParser;
