package habitcraft

import (
	"strings"
	"unicode/utf8"
)

// The Node backend ran every register, login and change-password body through
// js-xss 1.0.15, with the options in backend/middleware/sanitize.js (no tag
// allowed, every tag stripped, script and style bodies removed), and then
// JavaScript's trim(). Passwords too, so a password with a < or > in it, or
// whitespace at either end, was hashed in an altered form. nodeTransform
// reproduces that, so the Go server can still recognise those passwords
// (habitcraft-ti91; see checkPassword).
//
// This is a port of js-xss's own algorithm (lib/xss.js, parser.js,
// default.js), quirks included, and not a sanitizer: it must give the same
// bytes as the library for every input, and
// testdata/node-password-transform.json, written by the real library, is the
// proof. Do not "fix" anything here that the fixture does not show is wrong.
//
// js-xss walks UTF-16 code units; this walks bytes. Every character the parser
// reacts to is ASCII, and UTF-8 never puts an ASCII byte inside a multi-byte
// character, so the two walks find the same tags and the same text. The only
// places the difference shows are handled where they occur: whitespace tests
// decode whole characters, and tagNameIsBodyTag drops a last UTF-16 unit.
func nodeTransform(password string) string {
	return jsTrim(xssStripAll(password))
}

// jsTrim is JavaScript's String.prototype.trim. It is not strings.TrimSpace,
// which strips U+0085 and keeps U+FEFF.
func jsTrim(s string) string {
	return strings.TrimFunc(s, isJSSpace)
}

// isJSSpace is JavaScript's WhiteSpace and LineTerminator set: what trim()
// strips and what \s matches.
func isJSSpace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0x00A0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
		return true
	}
	return r >= 0x2000 && r <= 0x200A
}

const (
	removedOpen  = "[removed]"
	removedClose = "[/removed]"
)

// xssStripAll is FilterXSS.process with those options.
func xssStripAll(html string) string {
	if html == "" {
		return ""
	}
	html = stripCommentTag(html)

	// StripTagBody: an opening script or style tag writes [removed] and marks
	// where the cut starts; its closing tag writes [/removed] and records the
	// span, which is cut out once the whole string is parsed. An opening tag
	// with no closing one therefore leaves "[removed]" in the output.
	var out strings.Builder
	var cuts [][2]int
	const unset = -1 // js-xss's posStart = false
	cutStart := unset
	onTag := func(tag string) {
		if !tagNameIsBodyTag(tag) {
			return // stripIgnoreTag: every other tag becomes ""
		}
		position := out.Len()
		if strings.HasPrefix(tag, "</") {
			start := position
			if cutStart != unset {
				start = cutStart
			}
			out.WriteString(removedClose)
			cuts = append(cuts, [2]int{start, out.Len()})
			cutStart = unset
			return
		}
		// js-xss tests `if (!posStart)`, which a start at position 0 also
		// passes, so a second opening tag moves a cut that began at 0.
		if cutStart <= 0 {
			cutStart = position
		}
		out.WriteString(removedOpen)
	}

	// parseTag.
	lastPos, tagStart := 0, unset
	var quote byte
	n := len(html)
	for i := 0; i < n; i++ {
		c := html[i]
		if tagStart == unset {
			if c == '<' {
				tagStart = i
			}
			continue
		}
		if quote != 0 {
			if c == quote {
				quote = 0
			}
			continue
		}
		switch {
		case c == '<':
			// A second < before any >: what came before is text.
			out.WriteString(escapeHTML(html[lastPos:i]))
			tagStart, lastPos = i, i
		case c == '>' || i == n-1:
			// The end of the string closes a tag as a > would.
			out.WriteString(escapeHTML(html[lastPos:tagStart]))
			onTag(html[tagStart : i+1])
			lastPos, tagStart = i+1, unset
		case (c == '"' || c == '\'') && followsEquals(html[:i]):
			// Inside an attribute value, < and > are ignored and the end
			// of the string does not close the tag.
			quote = c
		}
	}
	if lastPos < n {
		out.WriteString(escapeHTML(html[lastPos:]))
	}

	result := out.String()
	if len(cuts) == 0 {
		return result
	}
	// The cuts are in order and do not overlap: each starts at or after
	// the position the previous one ended.
	var kept strings.Builder
	last := 0
	for _, cut := range cuts {
		kept.WriteString(result[last:cut[0]])
		last = cut[1]
	}
	kept.WriteString(result[last:])
	return kept.String()
}

// followsEquals reports whether before ends in = and then nothing but
// whitespace, which is when js-xss treats a quote as opening an attribute
// value. The tag's own < always stops the walk.
func followsEquals(before string) bool {
	for before != "" {
		r, size := utf8.DecodeLastRuneInString(before)
		if r == '=' {
			return true
		}
		if !isJSSpace(r) {
			return false
		}
		before = before[:len(before)-size]
	}
	return false
}

// tagNameIsBodyTag is getTagName's answer compared with script and style.
// The name runs from after the < to the first whitespace; with no whitespace,
// it is the tag minus its first and last UTF-16 code unit, whether or not that
// last unit is a >, so "<scripts" at the end of a string is a script tag.
func tagNameIsBodyTag(tag string) bool {
	var name string
	if i := strings.IndexFunc(tag, isJSSpace); i >= 0 {
		name = tag[1:i]
	} else {
		r, size := utf8.DecodeLastRuneInString(tag)
		if r > 0xFFFF {
			// js-xss drops only the low surrogate, leaving a lone high
			// one in the name, which then matches nothing.
			return false
		}
		name = tag[1 : len(tag)-size]
	}
	// toLowerCase, then one / off each end. Only ASCII letters can lower to
	// "script" or "style": the non-ASCII characters whose JavaScript lower
	// case is ASCII are U+212A (k) and U+0130 (i plus a combining dot), and
	// neither spells either name. Go's ToLower would map U+0130 to a plain i.
	name = asciiLower(name)
	name = strings.TrimPrefix(name, "/")
	name = strings.TrimSuffix(name, "/")
	return name == "script" || name == "style"
}

func asciiLower(s string) string {
	b := []byte(s)
	for i, c := range b {
		if 'A' <= c && c <= 'Z' {
			b[i] = c + ('a' - 'A')
		}
	}
	return string(b)
}

// escapeHTML is js-xss's escapeHtml: only < and > change.
func escapeHTML(s string) string {
	return strings.NewReplacer("<", "&lt;", ">", "&gt;").Replace(s)
}

// stripCommentTag removes each <!-- ... -->, and everything from an unclosed
// <!-- to the end. The --> is searched for from the <!-- itself, so "<!-->" is
// a whole comment.
func stripCommentTag(html string) string {
	var out strings.Builder
	for html != "" {
		i := strings.Index(html, "<!--")
		if i < 0 {
			out.WriteString(html)
			break
		}
		out.WriteString(html[:i])
		j := strings.Index(html[i:], "-->")
		if j < 0 {
			break
		}
		html = html[i+j+3:]
	}
	return out.String()
}
