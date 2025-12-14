/**
 * Readability.js - A standalone version of Mozilla's Readability library
 * Original: https://github.com/nicferrier/nicmozilla-readability
 * 
 * This is a simplified implementation for extracting main content from web pages.
 * For production use, replace with the full Mozilla Readability library.
 * 
 * Usage:
 *   const documentClone = document.cloneNode(true);
 *   const reader = new Readability(documentClone);
 *   const article = reader.parse();
 *   // article = { title, content, textContent, length, excerpt, byline, dir, siteName }
 */

var Readability = function(doc, options) {
  this._doc = doc;
  this._options = options || {};
  
  // Default options
  this._charThreshold = this._options.charThreshold || 500;
  this._classesToPreserve = this._options.classesToPreserve || [];
  
  // Regular expressions
  this.REGEXPS = {
    unlikelyCandidates: /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-hierarchical-nav|yom-remote/i,
    okMaybeItsACandidate: /and|article|body|column|content|main|shadow/i,
    positive: /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i,
    negative: /hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|foot|footer|footnote|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget/i,
    extraneous: /print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single|utility/i,
    byline: /byline|author|dateline|writtenby|p-author/i,
    replaceFonts: /<(\/?)font[^>]*>/gi,
    normalize: /\s{2,}/g,
    videos: /\/\/(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)/i,
    shareElements: /(\b|_)(share|sharedaddy)(\b|_)/i,
    nextLink: /(next|weiter|continue|>([^\|]|$)|»([^\|]|$))/i,
    prevLink: /(prev|earl|old|new|<|«)/i,
    tokenize: /\W+/g,
    whitespace: /^\s*$/,
    hasContent: /\S$/,
    hashUrl: /^#.+/,
    srcsetUrl: /(\S+)(\s+[\d.]+[xw])?(\s*(?:,|$))/g,
    b64DataUrl: /^data:\s*([^\s;,]+)\s*;\s*base64\s*,/i
  };
  
  // Element tags
  this.DIV_TO_P_ELEMS = new Set([
    "BLOCKQUOTE", "DL", "DIV", "IMG", "OL", "P", "PRE", "TABLE", "UL"
  ]);
  
  this.ALTER_TO_DIV_EXCEPTIONS = ["DIV", "ARTICLE", "SECTION", "P"];
  
  this.PRESENTATIONAL_ATTRIBUTES = [
    "align", "background", "bgcolor", "border", "cellpadding", "cellspacing",
    "frame", "hspace", "rules", "style", "valign", "vspace"
  ];
  
  this.DEPRECATED_SIZE_ATTRIBUTE_ELEMS = ["TABLE", "TH", "TD", "HR", "PRE"];
  
  this.PHRASING_ELEMS = [
    "ABBR", "AUDIO", "B", "BDO", "BR", "BUTTON", "CITE", "CODE", "DATA",
    "DATALIST", "DFN", "EM", "EMBED", "I", "IMG", "INPUT", "KBD", "LABEL",
    "MARK", "MATH", "METER", "NOSCRIPT", "OBJECT", "OUTPUT", "PROGRESS", "Q",
    "RUBY", "SAMP", "SCRIPT", "SELECT", "SMALL", "SPAN", "STRONG", "SUB",
    "SUP", "TEXTAREA", "TIME", "VAR", "WBR"
  ];
  
  // Content scores
  this._articleTitle = null;
  this._articleByline = null;
  this._articleDir = null;
  this._articleSiteName = null;
  this._attempts = [];
};

Readability.prototype = {
  
  /**
   * Get the article title
   */
  _getArticleTitle: function() {
    var doc = this._doc;
    var curTitle = "";
    var origTitle = "";
    
    try {
      curTitle = origTitle = doc.title.trim();
      
      // If they had an element with id "title" in their doc, use that
      if (typeof curTitle !== "string") {
        curTitle = origTitle = this._getInnerText(doc.getElementsByTagName("title")[0]);
      }
    } catch (e) {}
    
    var titleHadHierarchicalSeparators = false;
    
    function wordCount(str) {
      return str.split(/\s+/).length;
    }
    
    // If there's a separator in the title, first remove the final part
    if ((/ [\|\-\\\/>»] /).test(curTitle)) {
      titleHadHierarchicalSeparators = (/ [\\\/>»] /).test(curTitle);
      curTitle = origTitle.replace(/(.*)[\|\-\\\/>»] .*/gi, "$1");
      
      if (wordCount(curTitle) < 3) {
        curTitle = origTitle.replace(/[^\|\-\\\/>»]*[\|\-\\\/>»](.*)/gi, "$1");
      }
    } else if (curTitle.indexOf(": ") !== -1) {
      // Check if we have an pointless-like title and get the better part
      var headings = this._concatNodeLists(
        doc.getElementsByTagName("h1"),
        doc.getElementsByTagName("h2")
      );
      var trimmedTitle = curTitle.trim();
      var match = headings.some(function(heading) {
        return heading.textContent.trim() === trimmedTitle;
      });
      
      if (!match) {
        curTitle = origTitle.substring(origTitle.lastIndexOf(":") + 1);
        
        if (wordCount(curTitle) < 3) {
          curTitle = origTitle.substring(origTitle.indexOf(":") + 1);
        } else if (wordCount(origTitle.substr(0, origTitle.indexOf(":"))) > 5) {
          curTitle = origTitle;
        }
      }
    } else if (curTitle.length > 150 || curTitle.length < 15) {
      var hOnes = doc.getElementsByTagName("h1");
      
      if (hOnes.length === 1) {
        curTitle = this._getInnerText(hOnes[0]);
      }
    }
    
    curTitle = curTitle.trim().replace(this.REGEXPS.normalize, " ");
    
    var curTitleWordCount = wordCount(curTitle);
    if (curTitleWordCount <= 4 && (!titleHadHierarchicalSeparators || curTitleWordCount !== wordCount(origTitle.replace(/[\|\-\\\/>»]+/g, "")) - 1)) {
      curTitle = origTitle;
    }
    
    return curTitle;
  },
  
  _concatNodeLists: function() {
    var result = [];
    for (var i = 0; i < arguments.length; i++) {
      result = result.concat(Array.prototype.slice.call(arguments[i]));
    }
    return result;
  },
  
  _getInnerText: function(e, normalizeSpaces) {
    normalizeSpaces = (typeof normalizeSpaces === "undefined") ? true : normalizeSpaces;
    var textContent = e.textContent.trim();
    
    if (normalizeSpaces) {
      return textContent.replace(this.REGEXPS.normalize, " ");
    }
    return textContent;
  },
  
  /**
   * Get the density of links as a percentage of the content
   */
  _getLinkDensity: function(element) {
    var textLength = this._getInnerText(element).length;
    if (textLength === 0) {
      return 0;
    }
    
    var linkLength = 0;
    var links = element.getElementsByTagName("a");
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href");
      var coefficient = href && this.REGEXPS.hashUrl.test(href) ? 0.3 : 1;
      linkLength += this._getInnerText(links[i]).length * coefficient;
    }
    
    return linkLength / textLength;
  },
  
  /**
   * Get the class/id weight.
   */
  _getClassWeight: function(e) {
    if (!e.className && !e.id) {
      return 0;
    }
    
    var weight = 0;
    
    if (typeof e.className === "string" && e.className !== "") {
      if (this.REGEXPS.negative.test(e.className)) {
        weight -= 25;
      }
      if (this.REGEXPS.positive.test(e.className)) {
        weight += 25;
      }
    }
    
    if (typeof e.id === "string" && e.id !== "") {
      if (this.REGEXPS.negative.test(e.id)) {
        weight -= 25;
      }
      if (this.REGEXPS.positive.test(e.id)) {
        weight += 25;
      }
    }
    
    return weight;
  },
  
  /**
   * Initialize a node with its readability score
   */
  _initializeNode: function(node) {
    node.readability = {"contentScore": 0};
    
    switch (node.tagName) {
      case "DIV":
        node.readability.contentScore += 5;
        break;
      case "PRE":
      case "TD":
      case "BLOCKQUOTE":
        node.readability.contentScore += 3;
        break;
      case "ADDRESS":
      case "OL":
      case "UL":
      case "DL":
      case "DD":
      case "DT":
      case "LI":
      case "FORM":
        node.readability.contentScore -= 3;
        break;
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6":
      case "TH":
        node.readability.contentScore -= 5;
        break;
    }
    
    node.readability.contentScore += this._getClassWeight(node);
  },
  
  /**
   * Remove all scripts from element
   */
  _removeScripts: function(doc) {
    this._removeNodes(this._getAllNodesWithTag(doc, ["script", "noscript"]));
  },
  
  /**
   * Check if this node has only whitespace and single p elements
   */
  _hasSingleTagInsideElement: function(element, tag) {
    if (element.children.length !== 1 || element.children[0].tagName !== tag) {
      return false;
    }
    return !this._someNode(element.childNodes, function(node) {
      return node.nodeType === Node.TEXT_NODE && 
             this.REGEXPS.hasContent.test(node.textContent);
    }.bind(this));
  },
  
  _someNode: function(nodeList, fn) {
    return Array.prototype.some.call(nodeList, fn, this);
  },
  
  _everyNode: function(nodeList, fn) {
    return Array.prototype.every.call(nodeList, fn, this);
  },
  
  _forEachNode: function(nodeList, fn) {
    Array.prototype.forEach.call(nodeList, fn, this);
  },
  
  _getAllNodesWithTag: function(node, tagNames) {
    if (node.querySelectorAll) {
      return node.querySelectorAll(tagNames.join(","));
    }
    return [].concat.apply([], tagNames.map(function(tag) {
      var collection = node.getElementsByTagName(tag);
      return Array.isArray(collection) ? collection : Array.from(collection);
    }));
  },
  
  _removeNodes: function(nodeList, filterFn) {
    for (var i = nodeList.length - 1; i >= 0; i--) {
      var node = nodeList[i];
      var parentNode = node.parentNode;
      if (parentNode) {
        if (!filterFn || filterFn.call(this, node, i, nodeList)) {
          parentNode.removeChild(node);
        }
      }
    }
  },
  
  _replaceNodeTags: function(nodeList, newTagName) {
    for (var i = nodeList.length - 1; i >= 0; i--) {
      var node = nodeList[i];
      this._setNodeTag(node, newTagName);
    }
  },
  
  _setNodeTag: function(node, tag) {
    var replacement = node.ownerDocument.createElement(tag);
    while (node.firstChild) {
      replacement.appendChild(node.firstChild);
    }
    node.parentNode.replaceChild(replacement, node);
    
    if (node.readability) {
      replacement.readability = node.readability;
    }
    
    for (var i = 0; i < node.attributes.length; i++) {
      try {
        replacement.setAttribute(node.attributes[i].name, node.attributes[i].value);
      } catch (ex) {}
    }
    return replacement;
  },
  
  /**
   * Get the article content, including cleaning it up
   */
  _grabArticle: function(page) {
    var doc = this._doc;
    var isPaging = page !== null;
    page = page || this._doc.body;
    
    if (!page) {
      return null;
    }
    
    var pageCacheHtml = page.innerHTML;
    
    while (true) {
      var stripUnlikelyCandidates = true;
      
      // First, node prepping
      this._removeNodes(this._getAllNodesWithTag(page, ["style"]));
      
      var elementsToScore = [];
      var node = page;
      
      while (node) {
        var matchString = node.className + " " + node.id;
        
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if unlikely candidate
          if (stripUnlikelyCandidates) {
            if (this.REGEXPS.unlikelyCandidates.test(matchString) &&
                !this.REGEXPS.okMaybeItsACandidate.test(matchString) &&
                !this._hasAncestorTag(node, "table") &&
                !this._hasAncestorTag(node, "code") &&
                node.tagName !== "BODY" &&
                node.tagName !== "A") {
              node = this._removeAndGetNext(node);
              continue;
            }
          }
          
          // Turn divs into p if they don't contain block-level elements
          if (node.tagName === "DIV") {
            if (this._hasSingleTagInsideElement(node, "P") && this._getLinkDensity(node) < 0.25) {
              var newNode = node.children[0];
              node.parentNode.replaceChild(newNode, node);
              node = newNode;
            } else if (!this._hasChildBlockElement(node)) {
              node = this._setNodeTag(node, "P");
            }
          }
          
          // Add to scoring list if it's a paragraph-like element
          if (node.tagName === "P" || node.tagName === "TD" || node.tagName === "PRE") {
            elementsToScore.push(node);
          }
        }
        
        node = this._getNextNode(node);
      }
      
      // Scoring
      var candidates = [];
      this._forEachNode(elementsToScore, function(elementToScore) {
        if (!elementToScore.parentNode || typeof elementToScore.parentNode.tagName === "undefined") {
          return;
        }
        
        var innerText = this._getInnerText(elementToScore);
        if (innerText.length < 25) {
          return;
        }
        
        var ancestors = this._getNodeAncestors(elementToScore, 5);
        if (ancestors.length === 0) {
          return;
        }
        
        var contentScore = 0;
        contentScore += 1;
        contentScore += innerText.split(",").length;
        contentScore += Math.min(Math.floor(innerText.length / 100), 3);
        
        this._forEachNode(ancestors, function(ancestor, level) {
          if (!ancestor.tagName || !ancestor.parentNode || typeof ancestor.parentNode.tagName === "undefined") {
            return;
          }
          
          if (typeof ancestor.readability === "undefined") {
            this._initializeNode(ancestor);
            candidates.push(ancestor);
          }
          
          var scoreDivider;
          if (level === 0) {
            scoreDivider = 1;
          } else if (level === 1) {
            scoreDivider = 2;
          } else {
            scoreDivider = level * 3;
          }
          ancestor.readability.contentScore += contentScore / scoreDivider;
        });
      });
      
      // Find best candidate
      var topCandidates = [];
      for (var c = 0; c < candidates.length; c++) {
        var candidate = candidates[c];
        var candidateScore = candidate.readability.contentScore * (1 - this._getLinkDensity(candidate));
        candidate.readability.contentScore = candidateScore;
        
        for (var t = 0; t < 5; t++) {
          var aTopCandidate = topCandidates[t];
          if (!aTopCandidate || candidateScore > aTopCandidate.readability.contentScore) {
            topCandidates.splice(t, 0, candidate);
            if (topCandidates.length > 5) {
              topCandidates.pop();
            }
            break;
          }
        }
      }
      
      var topCandidate = topCandidates[0] || null;
      var neededToCreateTopCandidate = false;
      
      // If no top candidate found, create a new body container
      if (topCandidate === null || topCandidate.tagName === "BODY") {
        topCandidate = doc.createElement("DIV");
        neededToCreateTopCandidate = true;
        while (page.firstChild) {
          topCandidate.appendChild(page.firstChild);
        }
        page.appendChild(topCandidate);
        this._initializeNode(topCandidate);
      }
      
      // Create article content container
      var articleContent = doc.createElement("DIV");
      articleContent.id = "readability-content";
      
      var siblingScoreThreshold = Math.max(10, topCandidate.readability.contentScore * 0.2);
      var parentOfTopCandidate = topCandidate.parentNode;
      var siblings = parentOfTopCandidate ? parentOfTopCandidate.children : [];
      
      for (var s = 0; s < siblings.length; s++) {
        var sibling = siblings[s];
        var append = false;
        
        if (sibling === topCandidate) {
          append = true;
        } else {
          var contentBonus = 0;
          
          if (sibling.className === topCandidate.className && topCandidate.className !== "") {
            contentBonus += topCandidate.readability.contentScore * 0.2;
          }
          
          if (typeof sibling.readability !== "undefined" &&
              (sibling.readability.contentScore + contentBonus) >= siblingScoreThreshold) {
            append = true;
          } else if (sibling.nodeName === "P") {
            var linkDensity = this._getLinkDensity(sibling);
            var nodeContent = this._getInnerText(sibling);
            var nodeLength = nodeContent.length;
            
            if (nodeLength > 80 && linkDensity < 0.25) {
              append = true;
            } else if (nodeLength < 80 && nodeLength > 0 && linkDensity === 0 &&
                       nodeContent.search(/\.( |$)/) !== -1) {
              append = true;
            }
          }
        }
        
        if (append) {
          var appendedNode = sibling;
          if (sibling.nodeName !== "DIV" && sibling.nodeName !== "P") {
            appendedNode = this._setNodeTag(sibling, "DIV");
          }
          articleContent.appendChild(appendedNode);
        }
      }
      
      // Clean article content
      this._cleanConditionally(articleContent, "table");
      this._cleanConditionally(articleContent, "ul");
      this._cleanConditionally(articleContent, "div");
      
      this._removeNodes(this._getAllNodesWithTag(articleContent, ["iframe", "input", "textarea", "select", "button"]));
      this._removeNodes(this._getAllNodesWithTag(articleContent, ["h1"]));
      
      // Check content quality
      var textLength = this._getInnerText(articleContent, true).length;
      if (textLength < this._charThreshold) {
        page.innerHTML = pageCacheHtml;
        
        if (stripUnlikelyCandidates) {
          this._attempts.push({articleContent: articleContent, textLength: textLength});
        }
        
        // Return best attempt so far
        this._attempts.sort(function(a, b) {
          return b.textLength - a.textLength;
        });
        
        if (this._attempts.length > 0) {
          return this._attempts[0].articleContent;
        }
        
        return null;
      }
      
      return articleContent;
    }
  },
  
  _hasChildBlockElement: function(element) {
    return this._someNode(element.childNodes, function(node) {
      return this.DIV_TO_P_ELEMS.has(node.tagName) ||
             this._hasChildBlockElement(node);
    });
  },
  
  _hasAncestorTag: function(node, tagName, maxDepth, filterFn) {
    maxDepth = maxDepth || 3;
    tagName = tagName.toUpperCase();
    var depth = 0;
    while (node.parentNode) {
      if (maxDepth > 0 && depth > maxDepth) {
        return false;
      }
      if (node.parentNode.tagName === tagName && (!filterFn || filterFn(node.parentNode))) {
        return true;
      }
      node = node.parentNode;
      depth++;
    }
    return false;
  },
  
  _getNodeAncestors: function(node, maxDepth) {
    maxDepth = maxDepth || 0;
    var ancestors = [];
    while (node.parentNode) {
      ancestors.push(node.parentNode);
      if (maxDepth && ancestors.length === maxDepth) {
        break;
      }
      node = node.parentNode;
    }
    return ancestors;
  },
  
  _removeAndGetNext: function(node) {
    var nextNode = this._getNextNode(node, true);
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
    return nextNode;
  },
  
  _getNextNode: function(node, ignoreSelfAndKids) {
    if (!ignoreSelfAndKids && node.firstElementChild) {
      return node.firstElementChild;
    }
    if (node.nextElementSibling) {
      return node.nextElementSibling;
    }
    
    do {
      node = node.parentNode;
    } while (node && !node.nextElementSibling);
    
    return node && node.nextElementSibling;
  },
  
  _cleanConditionally: function(e, tag) {
    var tagsList = this._getAllNodesWithTag(e, [tag]);
    var curTagsLength = tagsList.length;
    
    for (var i = curTagsLength - 1; i >= 0; i--) {
      var node = tagsList[i];
      
      var weight = this._getClassWeight(node);
      
      if (weight < 0) {
        node.parentNode.removeChild(node);
        continue;
      }
      
      var linkDensity = this._getLinkDensity(node);
      var textContent = this._getInnerText(node);
      var textContentLength = textContent.length;
      
      if (linkDensity > 0.5 || textContentLength < 25) {
        node.parentNode.removeChild(node);
      }
    }
  },
  
  /**
   * Main parse method
   */
  parse: function() {
    // Remove scripts
    this._removeScripts(this._doc);
    
    // Get title
    this._articleTitle = this._getArticleTitle();
    
    // Get article content
    var articleContent = this._grabArticle();
    
    if (!articleContent) {
      return null;
    }
    
    // Get text content
    var textContent = articleContent.textContent;
    
    return {
      title: this._articleTitle,
      byline: this._articleByline,
      dir: this._articleDir,
      content: articleContent.innerHTML,
      textContent: textContent,
      length: textContent.length,
      excerpt: textContent.substring(0, 200),
      siteName: this._articleSiteName
    };
  }
};

// Export for different module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = Readability;
}
if (typeof window !== "undefined") {
  window.Readability = Readability;
}
