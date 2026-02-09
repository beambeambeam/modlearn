# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

Core principle: If you didn't watch the test fail, you don't know if it tests the right thing.

Violating the letter of the rules is violating the spirit of the rules.

## When to Use

Always:

* New features
* Bug fixes
* Refactoring
* Behavior changes

Exceptions (ask your human partner):

* Throwaway prototypes
* Generated code
* Configuration files

Thinking "skip TDD just this once"? Stop. That's rationalization.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

No exceptions:

* Don't keep it as "reference"
* Don't "adapt" it while writing tests
* Don't look at it
* Delete means delete

Implement fresh from tests. Period.

## Red-Green-Refactor

```
digraph tdd_cycle {
    rankdir=LR;
    red [label="RED\nWrite failing test", shape=box, style=filled, fillcolor="#ffcccc"];
    verify_red [label="Verify fails\ncorrectly", shape=diamond];
    green [label="GREEN\nMinimal code", shape=box, style=filled, fillcolor="#ccffcc"];
    verify_green [label="Verify passes\nAll green", shape=diamond];
    refactor [label="REFACTOR\nClean up", shape=box, style=filled, fillcolor="#ccccff"];
    next [label="Next", shape=ellipse];

    red -> verify_red;
    verify_red -> green [label="yes"];
    verify_red -> red [label="wrong\nfailure"];
    green -> verify_green;
    verify_green -> refactor [label="yes"];
    verify_green -> green [label="no"];
    refactor -> verify_green [label="stay\ngreen"];
    verify_green -> next;
    next -> red;
}
```

### RED - Write Failing Test

Write one minimal test showing what should happen.

```
const result = await retryOperation(operation);

expect(result).toBe('success'); expect(attempts).toBe(3);
```

Requirements:

* One behavior
* Clear name
* Real code (no mocks unless unavoidable)

### Verify RED - Watch It Fail

Confirm:

* Test fails (not errors)
* Failure message is expected
* Fails because feature missing (not typos)

### GREEN - Minimal Code

Write simplest code to pass the test.

### Verify GREEN - Watch It Pass

Confirm:

* Test passes
* Other tests still pass
* Output pristine (no errors, warnings)

### REFACTOR - Clean Up

After green only:

* Remove duplication
* Improve names
* Extract helpers

Keep tests green. Don't add behavior.

### Repeat

Next failing test for next feature.

## Good Tests

Quality | Good | Bad
--- | --- | ---
Minimal | One thing | Multiple behaviors
Clear | Name describes behavior | Generic name
Shows intent | Demonstrates desired API | Obscures what code should do

## Why Order Matters

Writing tests after code:

* Might test wrong thing
* Might miss edge cases
* Passing immediately proves nothing

Test-first forces you to see the test fail. That proves it catches missing behavior.

## Common Rationalizations

Excuse | Reality
--- | ---
"Too simple to test" | Simple code breaks.
"I'll test after" | Tests passing immediately prove nothing.
"Already manually tested" | Manual is ad-hoc.
"Deleting X hours is wasteful" | Keeping unverified code is technical debt.
