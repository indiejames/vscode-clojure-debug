# VS Code Continuum

This is a VS Code extension for developing Clojure projects. It provides a REPL as well
as language support and debugging functionality.

## Features

* Integrated REPL
* Support for attaching to an external REPL
* Code evaluation from editor
* Autocompletion
* Docstring lookup on hover
* Peek at / jump to symbol definition
* Run all tests in a project
* Run all tests in a file
* Run a single test
* Set breakpoints
* Examine stack frames / variables at breakpoint
* Eval code at breakpoints

![IDE](https://media.giphy.com/media/l3q2XfegYO1Xl3tHa/source.gif)

### Planned Features

* Snippets
* Symbol search
* Find references
* Linter support
* Test result / VS Code problems view integration
* Exception stack trace jump to file

## Installation

### Install the Extension
From the command palette (cmd-shift-p) select Install Extension and choose Continuum.

### Add the Debug Middleware to Your Project
After installing the extension in VS Code you need to add The nREPL debug middleware to your
project. If you are using leinengen the best way to do this is through a custom profile.
For a description of profiles see the [leiningen profiles documenation](https://github.com/technomancy/leiningen/blob/master/doc/PROFILES.md).
You can do this by adding the following to your project.clj file or to profiles.clj.

``` clojure
{:debug-repl {:resource-paths ["/Library/Java/JavaVirtualMachines/jdk1.8.0_45.jdk/Contents/Home/lib/tools.jar"]
              :repl-options {:nrepl-middleware [debug-middleware.core/debug-middleware]}
              :dependencies [[org.clojure/clojure "1.8.0"]
                             [debug-middleware "0.1.2-SNAPSHOT"]]}
```

### Setting up a launch.json file

Continuum supports launching REPLs as well as attaching to running
REPLs. This is controlled using launch configurations in a launch.json
file. I will demonstrate launching a REPL first and then demonstrate
connecting to an existing REPL later. If you are unfamiliar with VS Code debuging or launch.json, it
might be helpful to read through the [documenation](https://code.visualstudio.com/docs/editor/debugging).

You can get started by opening a Clojure project in VS Code and creating
a launch.json file. Open the Debug viewlet, click on the gear icon
in the upper right corner, and select 'Clojure Debug'.

![LAUNCH_JSON](http://i.giphy.com/l3q2QIUVVoMZax2Ny.gif)




### Known Issues

#### General

* Lines in Clojure do not always compile to a line in Java bytecode on which you can set a breakpoint. If you
attempt to set a breakpoint on a line and it gets grayed out, try moving it up or down.
* Watch variables are not supported *yet*.
* Arguments displayed at a breakpoing sometimes show up under local variables instead of arguments.

#### Side Channel Port

* The extension uses a socket for communication between the debug adapter process and the extension process.
The port used for the socket is set in the launch.json launch configuration file. It **must** be set for
*all* launch configurations.

#### Exception Breakpoints

* You can only break on one type (class) of exception at a time. You cannot set breakpoints for more than one type of
exception at a time.
* Exception breakponts apply to caught as well as uncaught exceptions. There is no way (yet) to only break on
uncaught exceptions. This is (I think) due to the fact the NREP untimately catches all exceptions to prevent thread
death, so there is in effect, no such thing as an uncaught exception.
* After changing the exception type for exception breakpoints you need to disable then enable exception breakpoints
to trigger an update to the exception type. This is due to a know bug in VS Code [#14615](https://github.com/Microsoft/vscode/issues/14615)
that prevents the update from happening automatically.
* It is advisable to temporarily disable exception breakponts before continuing after stopping on a breakpoint to due to
an exception. Otherwise you will stop on every frame of the stack trace and have to hit continue repeatedly until you
bubble back up out of the call stack.


### Dependencies

The environment utilizes several libraries to enable various features.

* debug-middleware provides the debug functionality, which in turn relies on
* cdt - the Clojure Debug Toolkit
* compliment is used to perform autocompletion

## Extension Preferences

## Suggested User Settings

* Set the word separators setting in your user settings to the following to make selecting Clojure code elements easier.
``` clojure
"editor.wordSeparators": " ()\"':,;~@#$%^&{}[]`"
```

### Why Continuum?

I see Clojure development as being fundamentally different from development in other langauges.
In traditional development we employ a workflow of code, compile, execute/test, repeat
(skipping the compile step for some languages). In Clojure, we employ a REPL driven approach
in which we are constantly evaluating code as we write it. This extension takes that a step
farther to pull in debugging. Instead of employing discrete steps during development
all the steps blend together into a contiuum of capabilities.
