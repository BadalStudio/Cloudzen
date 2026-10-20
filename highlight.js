/* Pocket Code - tiny dependency-free syntax highlighter.
 * Highlighter.highlight(code, lang) -> HTML string (already escaped).
 * Supported: html, css, js, json, py, java, c, cpp, md. Anything else = plain text.
 */
(function (root) {
  'use strict';

  var esc = function (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var span = function (cls, s) {
    return '<span class="t-' + cls + '">' + esc(s) + '</span>';
  };
  var words = function (list) {
    return new RegExp('\\b(?:' + list.trim().split(/\s+/).join('|') + ')\\b');
  };
  var END = '(?![\\s\\S])'; // end of input (works with the "m" flag)

  /* Run an ordered list of [className, regex] rules over text. */
  function run(code, rules) {
    var re = new RegExp(
      rules.map(function (r) { return '(' + r[1].source + ')'; }).join('|'),
      'gm'
    );
    var out = '', last = 0, m, i;
    while ((m = re.exec(code))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      out += esc(code.slice(last, m.index));
      i = 1;
      while (m[i] === undefined) i++;
      out += span(rules[i - 1][0], m[0]);
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  /* ---------- JavaScript / TypeScript ---------- */
  var JS_RULES = [
    ['comment', new RegExp('\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|' + END + ')')],
    ['string', new RegExp('`(?:\\\\[\\s\\S]|[^`\\\\])*(?:`|' + END + ')|"(?:\\\\.|[^"\\\\\\n])*(?:"|$)|\'(?:\\\\.|[^\'\\\\\\n])*(?:\'|$)')],
    ['number', /\b(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/],
    ['keyword', words('break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return super switch this throw try typeof var void while with yield async await static get set interface type enum implements public private protected readonly as')],
    ['builtin', words('true false null undefined NaN Infinity console window document Math JSON Object Array String Number Boolean Date Promise Map Set RegExp Error parseInt parseFloat setTimeout setInterval fetch localStorage')],
    ['func', /\b[A-Za-z_$][\w$]*(?=\s*\()/]
  ];

  /* ---------- CSS ---------- */
  var CSS_RULES = [
    ['comment', new RegExp('\\/\\*[\\s\\S]*?(?:\\*\\/|' + END + ')')],
    ['string', /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/],
    ['atrule', /@[\w-]+/],
    ['color', /#[\da-fA-F]{3,8}\b/],
    ['prop', /-?-?[A-Za-z][\w-]*(?=\s*:(?!:))/],
    ['selector', /[.#][A-Za-z_][\w-]*/],
    ['number', /-?\d*\.?\d+(?:px|em|rem|%|vh|vw|vmin|vmax|ch|s|ms|deg|fr)?\b/],
    ['func', /\b[\w-]+(?=\()/]
  ];

  /* ---------- JSON ---------- */
  var JSON_RULES = [
    ['prop', /"(?:\\.|[^"\\\n])*"(?=\s*:)/],
    ['string', /"(?:\\.|[^"\\\n])*"/],
    ['number', /-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/],
    ['keyword', /\b(?:true|false|null)\b/]
  ];

  /* ---------- Python ---------- */
  var PY_RULES = [
    ['comment', /#[^\n]*/],
    ['string', /[rbfRBF]{0,2}(?:"""[\s\S]*?(?:"""|(?![\s\S]))|'''[\s\S]*?(?:'''|(?![\s\S]))|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/],
    ['decorator', /@[A-Za-z_][\w.]*/],
    ['number', /\b(?:0[xX][\da-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/],
    ['keyword', words('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case')],
    ['builtin', words('True False None self cls print len range int str float list dict set tuple bool input open type isinstance enumerate zip map filter sorted sum min max abs round super')],
    ['func', /\b[A-Za-z_]\w*(?=\s*\()/]
  ];

  /* ---------- C / C++ / Java ---------- */
  function cLike(keywords, types, builtins) {
    return [
      ['comment', new RegExp('\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|' + END + ')')],
      ['string', /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])+'/],
      ['preproc', /^[ \t]*#[ \t]*\w+/],
      ['decorator', /@[A-Za-z_]\w*/],
      ['number', /\b(?:0[xX][\da-fA-F]+|\d+\.?\d*(?:[eEfFlLuU]+)?)\b/],
      ['keyword', words(keywords)],
      ['type', words(types)],
      ['builtin', words(builtins)],
      ['func', /\b[A-Za-z_]\w*(?=\s*\()/]
    ];
  }
  var JAVA_RULES = cLike(
    'abstract assert break case catch class continue default do else enum extends final finally for if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while var record',
    'boolean byte char double float int long short void String Integer Double Long Boolean List Map Set ArrayList HashMap Object Scanner',
    'true false null System out println'
  );
  var C_RULES = cLike(
    'auto break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while',
    'int char float double long short unsigned signed void size_t FILE bool',
    'NULL true false printf scanf malloc free main'
  );
  var CPP_RULES = cLike(
    'alignas auto break case catch class const constexpr continue default delete do else enum explicit export extern for friend goto if inline namespace new noexcept operator private protected public return sizeof static struct switch template this throw try typedef typename union using virtual volatile while override final',
    'int char float double long short unsigned signed void bool string vector map set size_t wchar_t',
    'NULL nullptr true false std cout cin endl cerr main'
  );

  /* ---------- Markdown ---------- */
  var MD_RULES = [
    ['comment', /<!--[\s\S]*?(?:-->|(?![\s\S]))/],
    ['string', /```[\s\S]*?(?:```|(?![\s\S]))|`[^`\n]+`/],
    ['heading', /^#{1,6}[^\n]*/],
    ['keyword', /\*\*[^*\n]+\*\*|__[^_\n]+__/],
    ['link', /\[[^\]\n]*\]\([^)\n]*\)/],
    ['builtin', /^[ \t]*(?:[-*+]|\d+\.)[ \t]/]
  ];

  /* ---------- HTML (with embedded <style> and <script>) ---------- */
  var TAG_RULES = [
    ['string', /"[^"]*"|'[^']*'/],
    ['tag', /<\/?[\w:-]+/],
    ['attr', /[\w:@.-]+(?=\s*=)/],
    ['punct', /\/?>/]
  ];
  var tag = function (t) { return run(t, TAG_RULES); };

  function html(code) {
    var re = new RegExp(
      '<!--[\\s\\S]*?(?:-->|' + END + ')' +
      '|<(script|style)\\b[^>]*>[\\s\\S]*?(?:<\\/\\1\\s*>|' + END + ')' +
      '|<\\/?[A-Za-z][^<>]*>?' +
      '|&[#\\w]+;', 'gi');
    var out = '', last = 0, m, t, open, closeM, close, inner;
    while ((m = re.exec(code))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      out += esc(code.slice(last, m.index));
      t = m[0];
      if (t.slice(0, 4) === '<!--') {
        out += span('comment', t);
      } else if (m[1]) {
        open = /^<[^>]*>/.exec(t)[0];
        closeM = /<\/(?:script|style)\s*>$/i.exec(t);
        close = closeM ? closeM[0] : '';
        inner = t.slice(open.length, t.length - close.length);
        out += tag(open) +
          (m[1].toLowerCase() === 'script' ? run(inner, JS_RULES) : run(inner, CSS_RULES)) +
          (close ? tag(close) : '');
      } else if (t.charAt(0) === '&') {
        out += span('entity', t);
      } else {
        out += tag(t);
      }
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  var TABLE = {
    js: JS_RULES, css: CSS_RULES, json: JSON_RULES, py: PY_RULES,
    java: JAVA_RULES, c: C_RULES, cpp: CPP_RULES, md: MD_RULES
  };

  function highlight(code, lang) {
    try {
      if (lang === 'html') return html(code);
      if (TABLE[lang]) return run(code, TABLE[lang]);
    } catch (e) { /* fall through to plain text */ }
    return esc(code);
  }

  var api = { highlight: highlight, escape: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Highlighter = api;
})(typeof window !== 'undefined' ? window : this);
