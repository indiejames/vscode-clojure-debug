# VS Code Clojure Debug

This is a VS Code package for developing Clojure projects. It provides a REPL as well
as debugging functionality.

## Features

* Integrated REPL
* Autocompletion
* Docstring lookup on hover
* Peek at / jump to symbol definition
* Run all tests in a project
* Run all tests in a file
* Run a single test

## Installation

After installing the extension in VS Code you need to add a leiningen profile to enable the
nREPL middleware and to add the tools.jar file that contains the Java Debug Interface (JDI) code to the classpath.
You can do this by adding the following to your project.clj file or to a profiles.clj file in ~/.lein/profiles.clj file,
For a description of profiles see the [leiningen profiles documenation](https://github.com/technomancy/leiningen/blob/master/doc/PROFILES.md).

```
{:debug-repl {:resource-paths ["/Library/Java/JavaVirtualMachines/jdk1.8.0_45.jdk/Contents/Home/lib/tools.jar"]
              :repl-options {:nrepl-middleware [debug-middleware.core/debug-middleware]}
              :plugins [[venantius/ultra "0.4.1"]]
              :dependencies [[org.clojure/clojure "1.8.0"]
                             [debug-middleware "0.1.1-SNAPSHOT"]
                             [compliment "0.2.7"]]}

```

### Known Issues

#### General

* Lines in Clojure do not always compile to a line in Java bytecode on which you can set a breakpoint. If you
attempt to set a breakpoint on a line and it gets grayed out, try moving it up or down.

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

* debug-middleware provides the debug functionality
* compliment is used to perform autocompletion

## Extension Preferences

## Suggest User Settings

* Set the word separators setting in your user settings to the following to make selecting Clojure code elements easier.
``` clojure
"editor.wordSeparators": " ()\"':,;~@#$%^&{}[]`"
```
