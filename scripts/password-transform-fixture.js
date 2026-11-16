#!/usr/bin/env node
'use strict';

/**
 * Writes server/habitcraft/testdata/node-password-transform.json: passwords
 * paired with what the Node backend's sanitizeBody turned them into before
 * bcrypt saw them (habitcraft-ti91).
 *
 * Usage:
 *   node scripts/password-transform-fixture.js            regenerate the file
 *   node scripts/password-transform-fixture.js --check    fail if it is stale
 *
 * WHY
 *
 * Node ran every register, login and change-password body through js-xss and
 * .trim(), passwords included, so a password with a < or > in it, or with
 * whitespace at either end, was stored as the hash of a different string. The
 * Go server compares the password as typed, and falls back to a Go port of the
 * transform (server/habitcraft/nodetransform.go) so those users can still sign
 * in. The port is only right if it matches js-xss byte for byte, and the only
 * honest oracle for that is the library itself.
 *
 * The outputs come from calling the real sanitizeBody middleware, so the
 * options cannot drift from backend/middleware/sanitize.js. The Go test reads
 * only the committed JSON, never Node, because backend/ will be deleted and
 * the fallback has to keep its proof after that. Once backend/ is gone this
 * script cannot run; the fixture is then frozen, which is what it should be.
 *
 * Every non-ASCII character below is written as a \u{...} escape so that none
 * is invisible in review. The random rows use a fixed seed, so a rerun
 * reproduces the file exactly.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'server/habitcraft/testdata/node-password-transform.json');
const { sanitizeBody } = require(path.join(ROOT, 'backend/middleware/sanitize.js'));
const xssVersion = require(path.join(ROOT, 'backend/node_modules/xss/package.json')).version;

function nodeTransform(password) {
  const req = { body: { password } };
  sanitizeBody(req, {}, () => {});
  return req.body.password;
}

// --- the hand-written corpus ------------------------------------------------

const handWritten = [
  // unchanged
  'Correct-Horse-1', 'plain password', 'pw&lt;x', 'a&amp;b', 'a&#60;b', '&gt;&lt;',
  'quote"inside', "quote'inside", 'both"\'quotes', '=equals=', 'a=b"c"d', '!!--??//',
  '', 'x', 'already trimmed', '\u{e9}t\u{e9} caf\u{e9}', '\u{5bc6}\u{7801}\u{5bc6}\u{7801}', '\u{1f600}\u{1f511}pw',
  '[removed]', '[/removed]', 'mid\tdle', 'mid\ndle', 'NUL\u{0}inside', '\u{1}\u{2}\u{7f}',

  // whitespace at the ends: what JavaScript's trim() strips
  ' lead trail ', '  two  ', '\tTabbed\t', '\nNewline\n', '\r\nCRLF\r\n', '\u{b}vt\u{c}',
  '\u{a0}nbsp\u{a0}', '\u{feff}bom\u{feff}', '\u{1680}ogham\u{1680}', '\u{2000}en quad\u{200a}',
  '\u{2028}line sep\u{2029}', '\u{202f}narrow\u{202f}', '\u{205f}math\u{205f}', '\u{3000}ideographic\u{3000}',
  // and what it does not
  '\u{85}nel\u{85}', '\u{180e}mongolian\u{180e}', '\u{200b}zero width\u{200b}', '\u{0}nul\u{0}',
  '\u{1c}file sep\u{1c}', '\u{ad}soft hyphen\u{ad}', '\u{2060}word joiner\u{2060}',
  ' \u{85} mixed \u{85} ', '\u{0} inner space \u{0}',

  // a lone < in every position
  '<abcdefgh', 'abcd<efgh', 'abcdefgh<', '<', ' < ', 'a < b', 'a <b', 'a< b', 'a<', '<a', '< a',
  // a lone > in every position
  '>abcdefgh', 'abcd>efgh', 'abcdefgh>', '>', ' > ', 'a > b', 'a>b12345', 'a>', '>a',
  // < followed by each kind of character
  'p<3 you&me', 'p<a you&me', 'p< you&me', 'p</ you&me', 'p<! you&me', 'p<? you&me',
  'p<- you&me', 'p<= you&me', 'p<" you&me', "p<' you&me", 'p<\u{e9} you', 'p<\u{1f600} you',
  'p<\u{a0}x', 'p<\u{3000}x', 'p<\tx', 'p<\nx', 'p<1', 'p</', 'p<!', 'p<?', 'p<<',
  // brackets in pairs
  '<>', 'a<>b', '<><>', '><', 'a><b', '<<>>', '<<a>>', '<<<', '>>>', 'a<<b>>c', 'x < y > z',
  'x<y>z', 'x <y> z', '1 < 2 and 3 > 2', '<a<b<c', 'a>b>c', '<a>b<c>d', 'a<b<c>d>e',
  // closed tags
  'a<b>c1234', '<b>bold</b>', '<B>BOLD</B>', 'pre<i>it</i>post', '<p>para', '</p>close',
  '<div class="x">in</div>', "<div class='x'>in</div>", '<div class=x>in</div>',
  '<a href="http://e.com">link</a>', '<img src=x onerror=alert(1)>', '<img src="x" />',
  // self-closing
  '<br/>', '<br />', 'a<br/>b', 'a<hr />b', '<x/>y', '</>', '<//>', '<a/b>c',
  // quotes inside a tag: > inside an attribute value does not end it
  '<a title="x>y">z', "<a title='x>y'>z", '<a title = "x>y">z', '<a title=\t"x>y">z',
  '<a title="x>y', "<a title='x>y", '<a "x>y">z', '<a title"x>y">z', '<a =">"', "<a ='>'",
  '<a x="1" y=\'2>\'>tail', '<a x="unclosed>tail', '<a x="q"', '<a x="q">', '<a x="q" >t',
  'p"<b>"q', "p'<b>'q", '"<"', '">"', '<a="b">c', '<a=\u{a0}"b>">c', '<a=\u{3000}"b>">c',
  '<a x=">', '<a x=">"', '<a x="><b>">t', '<a x="<b>">t', '<a x=\u{85}"b>">c', '<a x=\u{feff}"b>">c',
  // comments
  'a<!--x-->b', '<!--x-->', '<!---->', '<!-->', '<!--->', 'a<!--unclosed', 'a<!--x-->b<!--y',
  'a<!-- x -->b<!-- y -->c', '<!--a--b-->c', 'a-->b', 'a<!-b-->c', 'a<!--b<c>-->d',
  '<!--<script>-->x', 'a<!--x', '<!', '<!-', '<!--', 'a<!x>b', '<!DOCTYPE html>pw',
  '<?xml version="1.0"?>pw', '<?php echo 1; ?>pw',
  // script and style bodies
  '<script>pw</script>tail', 'pre<script>pw</script>tail', '<SCRIPT>pw</SCRIPT>tail',
  '<ScRiPt>pw</sCrIpT>tail', '<script type="text/javascript">pw</script>tail',
  '<script>pw', 'pre<script>pw', '</script>tail', 'pre</script>tail', '<script>a</script>b<script>c</script>d',
  '<script>a<script>b</script>c', 'z<script>a<script>b</script>c', '<script>a</script>b</script>c',
  '<style>body{}</style>pw', '<STYLE>x</STYLE>pw', '<style>x', 'pre<style>a</script>b', '<script>a</style>b',
  '<script/>pw', '<script />pw', '<script >pw</script >t', '< script>pw</script>t',
  '</ script>t', '<script\t>pw</script>t', '<script\n>pw</script>t', '<script\u{a0}>pw</script>t',
  '<scripts>x</scripts>y', '<scrip>x</scrip>y', 'x<scripts', 'x<script', 'x<script>',
  'x<script\u{20ac}', 'x<script\u{1f600}', 'x<style!', 'x</styles', '<\u{17f}cript>a</\u{17f}cript>b',
  '<SCR\u{130}PT>a</SCR\u{130}PT>b', '<\u{212a}>a</\u{212a}>b', '<script x="</script>">a</script>b',
  '<script>a<!--b-->c</script>d', '<script>x</script>', 'pw<script>', 'pw</script>', '<script></script>',
  '[removed]<script>a</script>b', '<script>a</script>[/removed]b', '<script>\u{e9}</script>\u{e9}',
  '<script>\u{1f600}</script>\u{1f600}t', '\u{e9}<script>\u{e9}\u{e9}</script>\u{e9}',
  '<SCRIPT >a</SCRIPT\t>b', '<script//>a', '<//script>a', '</script/>a', '<script\u{85}>a</script>b',
  // multi-byte text around brackets
  'caf\u{e9}<b>cr\u{e8}me</b>br\u{fb}l\u{e9}e', '\u{5bc6}<\u{7801}>\u{5bc6}', '\u{5bc6} < \u{7801}', '\u{1f600}>\u{1f600}',
  '\u{1f600}<\u{1f600}', '\u{e9}<\u{e9}', '<\u{e9}>\u{e9}', '\u{4e2d}\u{6587}<script>\u{4e2d}</script>\u{6587}',
  '<a title="\u{e9}>\u{e9}">\u{e9}', '\u{a0}<b>\u{a0}', '\u{3000}<b>x</b>\u{3000}',
  // control characters near brackets
  '<\u{0}>pw', 'a\u{0}<b>\u{0}c', '<a\u{0}b>c', '<\u{7}script>a</script>b', 'a\u{0}>b',
  // entities around brackets
  '&lt;b&gt;<b>', '<b>&amp;</b>', '&#60;script&#62;', '&lt;<&gt;>', 'a&<b', 'a>&b',
  // space then trim interaction
  ' <b> ', '<b> pw </b>', ' pw<b>', 'pw<b> ', '<b>\u{a0}pw\u{a0}</b>', ' <script>x</script> pw ',
  '\t<!--x-->\t', ' p<3 ', '  < b  ', 'pw  <', 'pw  < x',
];

// Lengths around bcrypt's 72 bytes: the stored hash covers only the first 72
// bytes of the transformed form, so the Go side must cut that form, not the
// typed one.
const long = [];
const fill = (n, c = 'a') => c.repeat(n);
for (const n of [60, 70, 71, 72, 73, 80]) {
  long.push(fill(n) + '<b>xyz');
  long.push('<b>' + fill(n));
  long.push(' ' + fill(n) + ' ');
  long.push(fill(n) + '>');
}
long.push(fill(70) + '<b>' + fill(10));
long.push(fill(68) + '>' + fill(10)); // grows by 3 bytes across 72
long.push(fill(71) + '>');
long.push('>' + fill(71));
long.push(fill(20, '>') + fill(20));
long.push(fill(30, '\u{e9}') + '<b>' + fill(30, '\u{e9}'));
long.push(fill(35, '\u{e9}') + '>' + fill(5));
long.push(fill(18, '\u{1f600}') + '<i>');
long.push('<script>' + fill(80) + '</script>' + fill(10));
long.push(fill(80) + '<script>x');
long.push(fill(100) + ' <unclosed tag ' + fill(10));
long.push(' '.repeat(10) + fill(72) + ' '.repeat(10));
long.push('<a title="' + fill(80, '>') + '">t');

// --- random rows, fixed seed ------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x71917191);
const pick = (list) => list[Math.floor(rand() * list.length)];

// Characters: heavy in what the parser reacts to.
const chars = [
  '<', '<', '<', '>', '>', '>', '/', '/', '!', '-', '-', '"', '"', "'", "'", '=', '=',
  ' ', ' ', ' ', '\t', '\n', '\u{a0}', '?', '&',
  'a', 'b', 'c', 'e', 'i', 'l', 'p', 'r', 's', 't', 'y', 'S', 'T', 'x', '1',
  '\u{e9}', '\u{20ac}', '\u{5bc6}', '\u{1f600}', '\u{0}',
];
// Tokens: so script/style tags and comments come up often enough to matter.
const tokens = [
  '<script>', '</script>', '<SCRIPT>', '</Script>', '<style>', '</style>', '<script ',
  '<script/>', '<!--', '-->', '<', '>', '<b>', '</b>', '<a x="', '">', "='", "'", '"',
  '=', ' ', 'pw', 'x', '\u{e9}', '[removed]', '<!', '</', '/>', '\t', ' a=', '<scripts',
];

const random = [];
for (let i = 0; i < 200; i++) {
  const len = 1 + Math.floor(rand() * 30);
  let s = '';
  for (let j = 0; j < len; j++) s += pick(chars);
  random.push(s);
}
for (let i = 0; i < 200; i++) {
  const len = 1 + Math.floor(rand() * 10);
  let s = '';
  for (let j = 0; j < len; j++) s += pick(tokens);
  random.push(s);
}

// --- output ---------------------------------------------------------------

const seen = new Set();
const rows = [];
for (const input of [...handWritten, ...long, ...random]) {
  if (seen.has(input)) continue;
  seen.add(input);
  rows.push({ in: input, out: nodeTransform(input) });
}

const fixture = {
  about:
    'Passwords and what the Node backend hashed in their place: js-xss with backend/middleware/sanitize.js options, then trim(). ' +
    'Generated by scripts/password-transform-fixture.js; do not edit by hand (habitcraft-ti91).',
  xssVersion,
  rows,
};
// JSON.stringify writes non-ASCII as itself; escape every UTF-16 code unit
// from 0x7f up (surrogate pairs as two escapes, which JSON allows) so the file
// is plain ASCII and no character in it is invisible or ambiguous in a diff.
function asciiOnly(json) {
  let out = '';
  for (let i = 0; i < json.length; i++) {
    const unit = json.charCodeAt(i);
    out += unit >= 0x7f ? '\\u' + unit.toString(16).padStart(4, '0') : json[i];
  }
  return out;
}
const text = asciiOnly(JSON.stringify(fixture, null, 1)) + '\n';

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== text) {
    console.error(`${path.relative(ROOT, OUT)} is stale: run node scripts/password-transform-fixture.js`);
    process.exit(1);
  }
  console.log(`${path.relative(ROOT, OUT)} is current (${rows.length} rows)`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${rows.length} rows)`);
}
