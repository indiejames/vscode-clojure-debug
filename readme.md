# Visual Studio Code Continuum - PREVIEW

This is a VS Code extension for developing Clojure projects. It provides a REPL as well
as language support and debugging.

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

#### Prerequisites
* [Visual Studio Code](https://code.visualstudio.com/) 1.8.1 or higher
* [leinengen](https://leiningen.org/) installed. Your project does not need to be a leinengen
project, but leinengen is used internally by the debugger.
* The Java SDK installed. Specifically the debugger needs to be able to find the tools.jar file
(usaually in the `lib` directory of your Java installation).

### Install the Extension

From the command palette (cmd-shift-p) select `Install Extension` and choose `Continuum`.

### Add the Debug Middleware to Your Project
After installing the extension in VS Code you need to add The nREPL debug middleware to your
project. If you are using leinengen the best way to do this is through a custom profile.
For a description of profiles see the [leiningen profiles documenation](https://github.com/technomancy/leiningen/blob/master/doc/PROFILES.md).
You can do this by adding the following to the profiles in your project.clj file or to profiles.clj.

``` clojure
{:debug-repl {:resource-paths ["/Library/Java/JavaVirtualMachines/jdk1.8.0_45.jdk/Contents/Home/lib/tools.jar"]
              :repl-options {:nrepl-middleware [debug-middleware.core/debug-middleware]}
              :dependencies [[org.clojure/clojure "1.8.0"]
                             [debug-middleware "0.1.2-SNAPSHOT"]]}
```

### Setting up a launch.json file

Continuum supports launching REPLs as well as attaching to running
REPLs. This is controlled using launch configurations in a launch.json
file. We will demonstrate launching a REPL first and then demonstrate
connecting to an existing REPL later. If you are unfamiliar with VS Code debuging or launch.json, it
might be helpful to read through the [documenation](https://code.visualstudio.com/docs/editor/debugging).

You can get started by opening a Clojure project in VS Code and creating
a launch.json file. Open the Debug viewlet by clicking on the debug icon ![DEBUG](http://i.imgur.com/8EP4T9n.png),
then click on the gear icon ![GEAR](http://i.imgur.com/8bMaP9g.png)
in the upper right corner and select 'Clojure Debug' from the menu.

![LAUNCH_JSON](http://i.giphy.com/l3q2QIUVVoMZax2Ny.gif)

A launch.json file will be created with a default launch configuration. You should edit this file
for your own environment. VS Code provides Intellisense support when editing this file to help
you make valid choices. The full details of the available settings are documented at the end of this
readme file, but for now the fields you need to change are the following:

* `commandLine` - the exact comand plus arguments needed to launch your REPL. The defualt uses
leinengen and sets the profile to `debug-repl` (the one defined in the example above). You _do not_
need to use leinengen, but you do need to make sure the REPL uses the debug middleware. Also,
if you do not start the REPL on port 5555 then you need to specify the port in the launch configuration
using the `replPort` setting. This gives you maximum flexibility in choosing the way to launch your
code. It just has to run in (or provide) nREPL running with the debug middleware.
* `replPort` - Set this if you are not launching on port 5555.
* `leinPath` - You must set the path to the `lein` command even if you are not using leingen to
lauch your program. The debugger starts up an internal nREPL that it uses to make a JDI (debugging)
connection to your program and needs leinengen for this.
* `toolsJar` - You must set this to the path of the Java `tools.jar` file. Typically this
is in the `lib` directory under your Java instgallation. The path must end in `tools.jar`.

The extension can launch the REPL in three different ways: in the internal debug console, in an internal
comand terminal, or in an extfernal temrinal. This is controlled by the **console** attribute. The
default uses the internal debug console. Running in a terminal can be useful if, for instance, you need
to type input into your program or if your program expects to run in a terminal environment.

### Starting the REPL

Most of the functionality of the extension is not available unless the REPL is running. Once you have set up
your profile (or otherwise enabled the nREPL middleware) and created a suitable launch.json file you can
launch the REPL invoking the command palette (shift+cmd+p (mac) /shift+ctrl+p (windows/linux)) and selecting
`Clojure: Start REPL` (type `repl` to see this command).

IMPORTANT: Do not try to start the REPL using the `start debugger` icon ![START](http://i.imgur.com/ZAmkn5M.png).
*This will not work.*

This will pop up a quick pick selector that will let you choose which launch configuration you want to use
(your launch.json file can define many).

![LAUNCH](https://media.giphy.com/media/26xBAd7JoMC9WadS8/source.gif)

This can take a while (minutes) depending on the size of your project. Eventually you should see a screen like the following
(note color change in status bar at bottom). You should see the status message 'Attached to process' at the bottom and
information in the debug console about the running REPLs and namespaces that were loaded.

![LAUNCHED](http://i.imgur.com/EV6D8i0.png)

### Contributed Commands

| Command | Command Palette Entry | Descritpion | Key bindings |
|---------|-------|-------------|--------------|
| clojure.eval | Clojure: Evaluate selected text | Evaluate the selected text in the file's namespace | cmd+alt+e (mac) / ctrl+alt+e (win/linux) |
| clojure.expand_selection | Clojure: Expand Selection | Expand selection to containing brackets/parentheses | shift+ctrl+m |
| clojure.debug | Clojure: Start REPL | Start a REPL. | |
| clojure.load-file | Clojure: Load File | Load the currently open Clojure source file. | |
| clojure.refresh | Clojure: Refresh Code |Refresh changed code without restarting the REPL. | |
| clojure.superRefresh | Clojure: Super Refresh Code | Refresh all code without restarting the REPL. | |
| clojure.run-test | Clojure: Run Test Under Cursor | Run the test under the cursor, optionally refreshing code first. | |
| clojure.run-test-file | Clojure: Run Tests in Current Namespace | Run the tests in the current namespace, optionally refreshing code first. | |
| clojure.run-all-tests | Clojure: Run All Tests | Run all the tests in the project after refreshing the code. | |

### Known Issues

#### General

* Lines in Clojure do not always compile to a line in Java bytecode on which you can set a breakpoint. If you
attempt to set a breakpoint on a line and it remains grayed out, try moving it up or down.
* Watch variables are not supported *yet*.
* Arguments displayed at a breakpoing sometimes show up under local variables instead of arguments.

#### Step debugging

* Step debugging in Clojure is not quite as straightforward as step debugging in Java. As
mentioned previously, lines in
Clojure may not correspond to a single line in Java bytecode and macros can be difficult,
so sometimes taking a single step can be unpredictable.
* Step-in is not fully working yet and should generally be avoided for now. A workaround is to set
a breakpoint in in function you wanted to step into and just hit the continue button ![CONTINUE](http://i.imgur.com/9LEKabg.png).
Step-over should more or less work the way you expect.

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

### Clojure Dependencies

The environment utilizes several clojure libraries to enable various features.

* debug-middleware provides the debug functionality, which in turn relies on
* cdt - the Clojure Debug Toolkit
* compliment is used to perform autocompletion

## Extension Preferences

## Suggested User Settings

* Set the word separators setting in your user settings to the following to make selecting Clojure code elements easier.
``` clojure
"editor.wordSeparators": " ()\"':,;~@#$%^&{}[]`"
```
* Install [parinfer](https://marketplace.visualstudio.com/items?itemName=shaunlebron.vscode-parinfer).
The latest version by Shaun LeBron is based on the Atom plugin and is excellent.

## Why Continuum?

I see Clojure development as being fundamentally different from development in other langauges.
In traditional development we employ a workflow of code, compile, execute/test, repeat
(skipping the compile step for some languages). In Clojure, we employ a REPL driven approach
in which we are constantly evaluating code as we write it. This extension takes that a step
farther to pull in debugging. Instead of employing discrete steps during development
all the steps blend together into a contiuum of capabilities.

## Full list of launch.json settings (from package.json)


| Property | Type | Descripition | Default Value |
|----------|------|--------------|---------------|
| commandLine | array | Command to run to launch the debugged program. | ["lein", "repl", ":start", "5555"] |
| console | enum: [ "internalConsole", "integratedTerminal", "externalTerminal" ] | Console to to use for launched programs. Defaults to internal debug console. | "internalConsole" |
| cwd | string | Workspace relative or absolute path to the working directory of the program being debugged. | The current workspace |
| debugPort | number | JDI port on which the debugger should connect to the process to be debugged. | 8030 |
| debugReplPort | number | Port on which the client/debugger nREPL should listen. | 5556 |
| env | map | Environment variables passed to the program. | {} |
| leinPath | string | Path the the lein executable. | "/usr/local/bin/lein" |
| refreshOnLaunch | boolean | Automatically load all namespaces on launch. | true |
| replHost | string | Host on which the debugged REPL is running | "localhost" |
| replPort | number | Port on which the debugged nREPL is listening. | 5555 |
| sideChannelPort | number | Port on which the debugger should talk to the extension. | 3030 |
| srcDirs | array | An array of directories relative to the project root that contain Clojure source files, e.g., src, test. | ["src", "test"]|
| toolsJar | string | Path to the tools.jar in your Java installation. | "${env.JAVA_HOME}/lib/tools.jar"|

`console`, `comandLine`, and `env` do not apply to `attach` configurations.
