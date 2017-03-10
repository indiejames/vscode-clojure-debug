# Changes

## V0.4.3

* Fixed bug related to version identification

## V0.4.2

* Fix for wrong version in exported `VS_CODE_CONTINUUM_VERSION`

## V0.4.1

* Added note at top of README.md to let users know about changes to REPL startup procedure.

## V0.4.0

* Starting the REPL/debugger is now done using the standard VS Code debugger launch button instead of using the command palette
* Extension now exports `VS_CODE_CONTINUUM_VERSION` as an environment variable that can be used in profiles.clj to automatically keep the debug-middleware version in sync with the extension version.
* Fixed bug that was preventing adding or removing breakpoints when stopped at a breakpoint.

## V0.3.10

* Added support for auto-cleaning namespace declarations via slamhound

## V0.3.9

* Windows support should be working now
* Synced version numbers for extension and debug-middleware

## V0.3.8

* Rolling back Windows support due to bugs

## V0.3.7

* Added full Windows support

## V0.3.6

* Fixed bug preventing syntax highlighting in REPL

## V0.3.5

* Added syntax highlighting in REPL

## V0.3.4

* Fixed an issue with output from threads.

## V0.3.3

* Re-added the YouTube video

## V0.3.2

* Temporarily removed YouTube video link

## V0.3.1

* Added link to YouTube video

## v0.3.0

* Added confirmation of Linux support

## v0.1.0

* Preview release