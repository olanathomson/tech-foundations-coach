// Regression tests for the Coach's routing and coaching ladders.
// Run from the repository root:  node tests/run.js
// The scripts are loaded straight from index.html, so the tests always check the published file.
const fs = require('fs'), path = require('path'), vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const window = {};
const context = vm.createContext({window, console});
// Every script except the two that need a page (the controller and the screen manager).
scripts.filter(code => !/document\.getElementById/.test(code)).forEach(code => vm.runInContext(code, context));

// Stand-in for the browser's CSS.supports(property, value): a known property with a value it accepts.
const COLOURS = 'red blue green yellow orange purple pink black white gray grey gold brown teal navy lightblue lightgreen lightgray'.split(' ');
const isColour = value => COLOURS.includes(value) || /^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\(/.test(value);
const isLength = value => value.split(/\s+/).every(part => part === '0' || part === 'auto' || /^-?\d*\.?\d+(px|em|rem|%|vw|vh)$/.test(part));
const keywords = list => value => list.split(' ').includes(value);
const VALUES = {
  'color':isColour, 'background-color':isColour, 'border-color':isColour, 'background':() => true,
  'font':() => true, 'font-family':() => true, 'font-weight':() => true, 'font-style':() => true, 'line-height':() => true, 'letter-spacing':() => true,
  'font-size':value => /^\d*\.?\d+(px|em|rem|%)$/.test(value) || keywords('small medium large x-large')(value),
  'text-align':keywords('left right center justify'), 'text-decoration':keywords('none underline overline line-through'),
  'width':isLength, 'height':isLength, 'margin':isLength, 'padding':isLength, 'border-width':isLength, 'border-radius':isLength,
  'border':() => true, 'border-style':keywords('none solid dashed dotted double groove ridge inset outset'),
  'float':keywords('left right none'), 'display':keywords('block inline inline-block flex inline-flex none'),
  'flex-direction':keywords('row row-reverse column column-reverse'), 'flex-wrap':keywords('nowrap wrap wrap-reverse'),
  'justify-content':keywords('flex-start flex-end center space-between space-around space-evenly'),
  'align-items':keywords('flex-start flex-end center stretch baseline'), 'align-content':keywords('flex-start flex-end center stretch space-between space-around'),
  'align-self':keywords('auto flex-start flex-end center stretch baseline'),
  'order':value => /^-?\d+$/.test(value), 'flex-grow':value => /^\d*\.?\d+$/.test(value), 'flex-shrink':value => /^\d*\.?\d+$/.test(value)
};
const supports = (property, value) => property in VALUES && (value === 'inherit' || VALUES[property](String(value).trim().toLowerCase()));

const route = item => window.TFC_ROUTER.route({goal:item.goal, actual:item.actual, html:item.html || '', css:item.css || '', lesson:item.lesson, supports});
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) { failed++; console.log(`FAIL  ${name}${detail ? '\n      ' + detail : ''}`); } else console.log(`ok    ${name}`); };

// 1. Routing: each realistic student problem reaches the expected pathway.
for (const item of require('./cases.json')) {
  const result = route(item);
  const label = result.session ? result.session.view().pathLabel || 'Class selectors' : result.pathwayKey;
  const got = `${result.source}:${result.topic || label}`;
  check(`[L${item.lesson}] ${item.name}`, got.startsWith(item.expect), `expected ${item.expect}, got ${got}`);
}

// 2. Ladder: "Still stuck" withholds the explicit fix until level 4, then hands off to the teacher.
{
  const session = route({lesson:'6', goal:'Make the paragraph red', actual:'Nothing happens', html:'<p>Hello</p>', css:'p {\n  colour: red;\n}'}).session;
  const seen = [session.view()];
  while (seen[seen.length - 1].phase === 'coaching' && seen.length < 8) seen.push(session.stuck());
  const levels = seen.map(view => view.level).join(',');
  check('ladder climbs 1,2,3,4,5', levels === '1,2,3,4,5', levels);
  check('fix is withheld before level 4', seen.slice(0, 3).every(view => !/spells this word color/.test(view.prompt)));
  check('fix is stated at level 4', /spells this word color/.test(seen[3].prompt));
  check('level 5 hands off to the teacher', seen[4].stage === 'handoff');
}

// 3. Transfer check: a reported fix leads to a fresh example, and a correct answer resolves the session.
{
  const session = route({lesson:'3', goal:'Only the title should be big', actual:'All of my writing is big', html:'<h2>My Hobbies\n<p>I like hockey.</p>'}).session;
  session.answer('', 'correct'); session.answer('', 'correct');
  const asked = session.fixed();
  check('reported fix opens a check', asked.phase === 'verification' && asked.choices.length === 3);
  check('correct check resolves', session.answer('', 'correct').stage === 'resolved');
}

// 4. Rejection: "That isn't my issue" records the misroute and falls back to the keyword pathway.
{
  const session = route({lesson:'2', goal:'Make a big heading', actual:'It shows as normal small text', html:'<hl>My Pets</hl>'}).session;
  const next = session.answer('', 'different');
  check('rejection is recorded in the evidence', /did not fit/.test(next.evidence.join(' ')));
  check('rejection falls back to another pathway', next.phase === 'coaching' && !/code check/.test(next.pathLabel || ''));
  const alone = route({lesson:'6', goal:'Make my heading orange', actual:'It is still black', html:'<h1>My Page</h1>', css:'h2 {\n  color: orange;\n}'}).session;
  check('rejection with no other pathway hands off to the teacher', alone.answer('', 'different').stage === 'handoff');
}

// 5. Clean code produces no code-check finding.
for (const [name, html, css] of [
  ['valid page', '<html>\n<head><title>Hi</title></head>\n<body>\n<h1>Hi</h1>\n<p>One</p>\n<ul>\n<li>A\n<li>B</li>\n</ul>\n</body>\n</html>', 'h1 {\n  color: blue;\n  text-align: center;\n}\n.note, p { color: red }'],
  ['snippet that starts part-way through', '<li>Pears</li>\n</ul>\n<p>Done <strong>now</strong></p>', ''],
  ['plain text with no tags', 'Welcome to our school garden.\nWe grow flowers.', ''],
  ['comment containing a broken tag', '<!-- <p unfinished -->\n<p>Fine</p>', '/* h9 { colour: red } */\np { color: red; }']
]) check(`no finding: ${name}`, window.TFC_LINT_COACH.inspect({html, css, supports}) === null, JSON.stringify(window.TFC_LINT_COACH.inspect({html, css, supports})));

console.log(failed ? `\n${failed} test(s) failed.` : '\nAll tests passed.');
process.exit(failed ? 1 : 0);
