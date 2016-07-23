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

### Dependencies

The environment utilizes several libraries to enable various features.

* debug-middleware provides the debug functionality
* compliment is used to perform autocompletion