# unframe-kit

One source of truth for the **unframe** way of building small web apps: a Claude skill
that documents the conventions, plus the reusable runtime it refers to.

```
.claude/skills/unframe/SKILL.md   the method, as a Claude Code skill
runtime/reactivity.js             ~120-line Proxy reactivity core (reactive + mount)
runtime/tpl.mk                    the awk "compose" macro for the single-file build
```

## Why this is its own repo

So every app you build can pull the skill and runtime from **one place** and stay in
sync. You edit the pattern here; consuming repos update the submodule to a new commit.
No copy-paste drift.

## Consume it in another repo (git submodule)

A submodule always tracks the **whole** repo (there is no "submodule one file"), but
this kit is deliberately tiny, and `sparse-checkout` lets you materialize only the
paths you use.

```bash
# add the kit
git submodule add https://github.com/anroleroux/unframe-kit vendor/unframe

# (optional) only check out the paths you need
cd vendor/unframe
git sparse-checkout init --cone
git sparse-checkout set runtime .claude
cd ../..
git add .gitmodules vendor/unframe && git commit -m "Vendor unframe-kit"
```

Anyone cloning your repo then runs:

```bash
git submodule update --init --recursive
```

### Wire the runtime into your build

Point your Makefile / `web.map` at the submodule paths instead of local copies:

```make
include vendor/unframe/runtime/tpl.mk        # the compose macro
```

```
{{reactivity-js}}:vendor/unframe/runtime/reactivity.js
```

That's the "single source of truth" — the runtime is never copied into the app; the
build inlines it from the submodule at build time.

### Make the skill load in the consuming repo

Claude Code auto-discovers skills in the **project root** `.claude/skills/`, not inside
a submodule. Symlink it so there is still only one real copy:

```bash
mkdir -p .claude/skills
ln -s ../../vendor/unframe/.claude/skills/unframe .claude/skills/unframe
git add .claude/skills/unframe
```

(If you prefer not to rely on symlinks, distribute the skill as a Claude Code plugin
instead — but then it is versioned separately from the runtime.)

## Updating the pattern everywhere

```bash
# in a consuming repo, move the submodule to the latest kit commit
cd vendor/unframe && git fetch && git checkout origin/main && cd ../..
git add vendor/unframe && git commit -m "Bump unframe-kit"
```

## Splitting this folder out of the origin app

This kit currently lives inside the `unframe` app repo under `unframe-kit/`. To give it
its own history and remote:

```bash
git subtree split --prefix=unframe-kit -b unframe-kit-split
# create an empty github.com/anroleroux/unframe-kit, then:
git push git@github.com:anroleroux/unframe-kit.git unframe-kit-split:main
```

Then delete `unframe-kit/` from the app and re-add it as a submodule per the steps
above — including this app itself, so the origin app becomes just another consumer.
