# Herdr — personal fork

Herdr is a desktop app for terminals and coding agents. Keep work in spaces, see which agents need you, and leave terminals running when you close the window.

## About this fork

This is [igalarey/herdr-app](https://github.com/igalarey/herdr-app), a personal fork of [Herdr](https://github.com/herdrdev/herdr-app).
It starts from upstream v0.1.13. It is not an official Herdr release.
The fork adds opt-in pane arrangement and an optional personal agents sidebar.

### Columns first, then rows

In a personal layout, add `"arrangement": "auto"` to the active-tab block's content:

```json
{ "tab": "active", "arrangement": "auto" }
```

Auto mode uses the fewest balanced rows that give each pane at least **360 logical pixels of content width**.
Height and aspect ratio do not add rows when width is sufficient.
For unchanged membership, fewer rows require **24 extra logical pixels per pane** to prevent resize jitter.
Membership changes and width reductions past the target recalculate immediately.
If one column cannot meet the target, each pane gets its own row.

This is a render-only projection. Saved splits, pane order and IDs, terminal ownership, mod instances, focus, and zoom remain intact.
Shared geometry accounts for padding, frames, borders, and headers.
Custom nested containers, stacks, fixed pixel sizes, and minimum/maximum constraints retain their manual arrangement.
Automatic boundaries cannot be dragged. Remove the option, or use `"manual"`, to restore saved splits.

[Verification and limits](docs/adaptive-panes-verification.md) distinguish automated checks from coordinator visual checks.
Verification covers Linux only. One native test requires an isolated core.
Four known upstream debug-selector tests fail under the unchanged release profile. The full release suite is not green.

### Optional personal agents sidebar

[extras/mods/personal-agents](extras/mods/personal-agents) contains the personal sidebar and its existing tests.
It is **not bundled or installed automatically**, and does not replace the shipped `agents` mod.
It displays adopted and unadopted descendants as one nested forest.
A parent shows Working while a descendant works, even if the parent reports Idle or Done.
Blocked status takes priority over Working. Completed descendants no longer keep a parent Working.

The inherited status is visual only: it does not change agent reports, terminal ownership, or agent execution.
Existing focus, peek, pin, and navigation actions remain available.
Like other mods, this code is trusted, not sandboxed.

To install it manually:

1. Read the code and the [mod guide](defaults/AGENTS.md).
2. Locate your app home: `~/.config/herdr-app`, or the directory selected by `HERDR_APP_HOME`.
3. If `mods/personal-agents` already exists, back it up and review differences before replacing files.
4. If the directory is absent, create `mods/personal-agents` inside the app home.
5. Copy `main.js` and `mod.json` from `extras/mods/personal-agents/` into that directory.
6. Keep the directory name `personal-agents`: the sort popup uses that name.
7. Duplicate a shipped layout through the command palette, or use an existing personal layout.
8. In that personal layout, change only the sidebar block's content from `{"mod":"agents"}` to `{"mod":"personal-agents"}`.
9. Validate the copied mod with `herdr-app check <app-home>/mods/personal-agents`.
10. Select the personal layout and inspect the sidebar and `herdr-app status` for errors.

To restore the shipped sidebar, change the personal layout's mod reference back to `agents`.
This resource includes no personal configuration, mod storage, or verification screenshots.
Run the existing sidebar tests from the repository root:

```sh
node --test extras/mods/personal-agents/tests/sidebar.test.cjs
```

## Install upstream releases

The installers in this section install **upstream Herdr**, not this fork or its optional sidebar.
To use this fork, [build from source](#build-from-source) and enable the features explicitly.

### Linux and macOS

```sh
curl -fsSL https://releases.herdr.dev/app/install.sh | sh
```

Linux needs a desktop session and a working Vulkan driver. macOS builds are available for Apple Silicon; Intel Mac users can [build from source](#build-from-source). Linux builds are x86-64 and ARM64.

The installer adds Herdr to your apps and puts the command in `~/.local/bin`.
Add that folder to your PATH if the installer asks.
On macOS the app lives in `~/Applications/Herdr.app`.
For drag-and-drop installation on Apple Silicon, download [Herdr.dmg](https://releases.herdr.dev/app/Herdr.dmg) and drag Herdr to Applications.

On macOS (Apple Silicon), you can also install with [Homebrew](https://brew.sh/):

```sh
brew install --cask herdr-app
```

### Windows

Run in PowerShell on x64 Windows with curl and tar installed (Windows 10 1803 or newer):

```powershell
irm https://releases.herdr.dev/app/install.ps1 | iex
```

Herdr appears in the Start menu. The installer adds `%LOCALAPPDATA%\Programs\herdr-app` to your user PATH. Open a new terminal to pick it up.

The shell and PowerShell installers download and run code. Read the [shell installer](distribution/install.sh) or [PowerShell installer](distribution/install.ps1) first if you prefer.
They also install [herdr-core](https://github.com/herdrdev/herdr-core) if it is missing.
The app can help install or update a core it cannot use.

## Find your work

A **space** holds work on one machine, usually in one repo. Each space has **tabs**. Split a tab into **panes** to put terminals or mod panels beside each other.

An unnamed space follows its first terminal's folder. Name a space or tab when you want a label that stays.
New tabs start in the focused terminal's folder.

The agents sidebar brings agents from your spaces into one list, including workers started by another agent.
Agents that report status show as:

- **Working:** still busy.
- **Blocked:** waiting for you.
- **Done:** finished while you were looking elsewhere.
- **Idle:** not working, or a finished agent you have looked at.

Click an agent to see it. A worker without a pane opens in **peek**, over your tab. Keep it as a tab if you want it beside your other work.
Ctrl-click a live terminal address in terminal text to peek at it; use Cmd-click on macOS.
An address such as `t7` means a terminal on the same machine as the terminal showing it. `vps/t7` names one on another machine.

The window arranges terminals. The core runs them.
Closing the window leaves them running; closing a pane or tab ends its terminals.
After a reboot or core crash, kept panes get fresh shells in their last folders, not their old programs.

## Work on another machine

Add an SSH machine from Settings → Machines or the sidebar's Add machine action.
Pick a host from your SSH config or type how SSH reaches it.
Spaces on that machine run their terminals there, not on your computer.

Each machine keeps its spaces, tabs and splits in its core. Connected screens share that structure and the live terminals, but keep their own focus and zoom.
Remote work keeps running when your local window closes or your laptop sleeps, as long as the remote machine and core stay up.

## Make it yours

Open the command palette to find an action by name, or open Settings to change fonts, colors, sounds and other preferences.
The built-in layouts include Herdr, Terminals and Herdr 98.
A **layout** arranges the window. **Mods** are small JavaScript programs that draw its panels, menus and dialogs.

Duplicate a shipped layout or mod before changing its structure or code. Your copies stay yours; Herdr updates the shipped ones on start.
Save a personal layout, mod or key file and the window reloads it.
A broken edit keeps the last good version and reports the error.

Ctrl+Shift+P shows every command and its key (Cmd+Shift+P on macOS). Change any key in `keys.json`; see [the keys section](defaults/AGENTS.md#keys-keysjson) of the mod guide for the format, including JSON objects for named, typed command arguments.

[Layouts and mods](docs/mods.md) · [Commands](docs/commands.md)

## Updates and privacy

Installed releases check for updates in the background and download a new app beside the running one. It takes over when you quit and reopen, or choose the update action. Your terminals keep running in the core.
Settings → Updates shows what is available. What's New opens after an update; you can open it again from the command palette.
Builds from source do not update themselves by default.
For this fork, build without `HERDR_APP_RELEASE` and keep `HERDR_RELEASES_URL` unset at runtime.
Review upstream changes manually before updating.

Usage telemetry is on by default in releases. Turn it off in Settings → Privacy.
Mods are trusted code, not sandboxed extensions. Read [security and privacy](docs/security.md) before installing someone else's mod.

## For agents

```sh
herdr-app --skill
```

This prints the agent guide for driving the window. The herdr-core skill points agents here.
Use herdr-core for running and coordinating programs; use the app to change what you see.

```sh
herdr-app ls
herdr-app status
herdr-app commands
```

The first two inspect the open window. The command list also works without one.
See the [command reference](docs/commands.md) for arguments.

## Build from source

For upstream contribution rules, see [Contributing](CONTRIBUTING.md). Report fork-specific behavior to this personal fork, not upstream.

Clone this repo with its submodules. Use Rust 1.95.0 and Zig 0.16.0, the versions used in [CI](.github/workflows/ci.yml).
Linux needs the development packages listed in that workflow.

```sh
git clone --recurse-submodules --branch feat/personal-herdr https://github.com/igalarey/herdr-app.git
cd herdr-app
just build
just test
just install
```

Install [just](https://github.com/casey/just) to use these recipes.
The platform installer builds a release and adds the app to your desktop.
On Linux it links to this checkout, so keep the checkout in place.
Quit and reopen Herdr to use the new build.

Documentation checks also need [Bun](https://bun.sh): `just docs-check` checks generated pages and CLI examples; `just docs-generate` refreshes the reference pages.

To compare drawing changes on Windows, Linux or macOS, run the same fixed workloads against each build:

```sh
python scripts/bench.py --bin <app executable> --set spinners --seconds 20
```

The runner requires `hc` on PATH and uses the Python executable running the script. It prints a unique artifact folder with the run settings, counters and results, then stops its private app, terminals and core. Both sets use Python fixture programs; the default set’s TUI workload replaces historical `btop` measurements. `--only spinners` measures just the quiet native spinner scenario. Keep the window visible and the display awake, and compare the same window activity and display settings; inactive windows may draw at a lower rate. Windows records visibility, foreground activity and display Hz at each measurement boundary; other platforms mark these observations unavailable. Visibility does not establish occlusion. Draws are window render calls. Render-to-paint elapsed time stops before scene finalization, backend drawing, uploads and presentation; it is separate from OS process CPU time. Neither measures physical presentation or the FPS HUD’s derived MAX FPS.

`python scripts/bench_compare.py ghostty --root <artifact folder>` reuses a run’s fake agent for the macOS comparison. Benchmark checks: `python -m unittest discover -s scripts -p test_bench.py`.
