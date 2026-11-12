# tech-foundations-coach

A browser-based coach that helps Grade 7 and 8 students diagnose their own HTML and CSS problems in Code.org Web Lab. It asks before it tells: support climbs from Diagnose to Nudge, Scaffold, Explicit hint, and then Teacher, and a reported fix is followed by a fresh example.

Live page: https://olanathomson.github.io/tech-foundations-coach/

## How it decides what to ask

1. **Code check.** The Coach reads the pasted snippet first. It looks for an unknown tag name, a tag with a missing bracket, an element left open, CSS typed into the HTML file, a selector written with angle brackets, a missing semicolon, an unknown property name, a class selector with no dot, and a selector that matches nothing in the pasted HTML. A finding names a line and a concept. The student still does the thinking.
2. **Keyword pathways.** If the code check finds nothing, the Coach uses the student's description and the selected lesson to choose a scripted pathway.
3. **Teacher.** If no pathway fits, or the student rejects the hypothesis and nothing else applies, the Coach hands off to the teacher with the session notes.

## Privacy

The page makes no network requests and stores nothing. Session notes clear on reload. A student can copy, print, or download the notes. The download is a small JSON file that leaves out the student's name, code, and conversation.

## Limits

The Coach uses scripted questions and pattern checks. It does not run the student's code, it does not connect to an AI model, and it covers the coding lessons from 2 to 14 of the Code.org Web Development unit.

## Tests

```
node tests/run.js
```

The tests load the scripts straight from `index.html` and run 30 realistic student problems through the router, then check the support ladder, the transfer check, and the handling of a rejected hypothesis. Add a case to `tests/cases.json` whenever a real student problem reaches the wrong pathway.
