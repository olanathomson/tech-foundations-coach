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

// Stand-in for the browser's CSS.supports(property, value).
const PROPERTIES = new Set('color background background-color font font-size font-family font-weight font-style text-align text-decoration line-height letter-spacing width height margin padding border border-radius display float'.split(' '));
const supports = (property, value) => PROPERTIES.has(property) && !(property === 'font-size' && /^[\d.]+$/.test(String(value).trim()));

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
