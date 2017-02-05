# Visual Studio Code Continuum (PREVIEW)

Continuum is a VS Code extension/debugger for developing Clojure. It provides a REPL as well
as language support and debugging.

![IDE](https://media.giphy.com/media/l0ExfKVoLSKSNfX7a/source.gif)

## A Note about the Preview Version

Currently only known to work on Mac OS X. I can confirm that it does not work (yet) on Windows
due to issues in the underlying CDT library. I am working to get that fixed.
It may work fine on Linux - I have not tried it yet.
Most of the features are operational and work well enough to provide a useful workflow at this point.
Some of the features (mostly related to step debugging) are less reliable and should be used with care.

## Features

* Integrated REPL (nREPL)
* Support for attaching to an external REPL (must be nREPL)
* Code evaluation from within editor
* Autocompletion
* Docstring lookup on hover
* Code formatting
* Peek at / jump to symbol definition
* Run tests
* Set breakpoints
* Examine stack frames / variables at breakpoint
* Eval code at breakpoints
* Project type agnostic (leiningen, boot, etc.)

### Planned Features

* Conditional breakpoints
* Snippets
* Symbol search
* Find references
* Linter support
* Test result / VS Code problems view integration
* Exception stack trace jump to file

## Installation

#### Prerequisites
* [Visual Studio Code](https://code.visualstudio.com/) 1.8.1 or higher
* [leiningen](https://leiningen.org/) installed. Your project does not need to be a leiningen
project, but leiningen is used internally by the debugger.
* The Java SDK installed. Specifically the debugger needs to be able to find the tools.jar file
(usually in the `lib` directory of your Java installation).

#### Install the Extension

From the command palette (`cmd-shift-p`) select `Install Extension` and choose `Continuum`.

#### Add the Debug Middleware to Your Project
After installing the extension in VS Code you need to add The nREPL debug middleware to your
project. If you are using leiningen the best way to do this is through a custom profile.
For a description of profiles see the [leiningen profiles documentation](https://github.com/technomancy/leiningen/blob/master/doc/PROFILES.md).
You can do this by adding the following to the profiles in your project.clj file or to profiles.clj. Modify the
path to the tools.jar file as appropriate.

``` clojure
{:debug-repl {:resource-paths ["/Library/Java/JavaVirtualMachines/jdk1.8.0_45.jdk/Contents/Home/lib/tools.jar"]
              :repl-options {:nrepl-middleware [debug-middleware.core/debug-middleware]}
              :dependencies [[org.clojure/clojure "1.8.0"]
                             [debug-middleware "0.1.2-SNAPSHOT"]]}
```

#### Setting up a launch.json file

Continuum supports launching REPLs as well as attaching to running
REPLs. This is controlled using launch configurations in a launch.json
file. We will demonstrate launching a REPL first and then demonstrate
connecting to an existing REPL later. If you are unfamiliar with VS Code debugging or launch.json, it
might be helpful to read through the [documentation](https://code.visualstudio.com/docs/editor/debugging).

You can get started by opening a Clojure project in VS Code and creating
a launch.json file. Open the Debug viewlet by clicking on the debug icon ![DEBUG](http://i.imgur.com/8EP4T9n.png),
then click on the gear icon ![GEAR](http://i.imgur.com/8bMaP9g.png)
in the upper right corner and select 'Clojure Debug' from the menu.

![LAUNCH_JSON](https://media.giphy.com/media/l3q30oPyeg6hkQmje/source.gif)

A launch.json file will be created with a default launch configuration. You should edit this file
for your own environment. VS Code provides Intellisense support when editing this file to help
you make valid choices. The full details of the available settings are documented at the end of this
readme file, but for now the fields you need to change are the following:

* `commandLine` - the exact command plus arguments needed to launch your REPL. The default uses
leiningen and sets the profile to `debug-repl` (the one defined in the example above). You _do not_
need to use leiningen, but you do need to make sure the REPL uses the debug middleware. Also,
if you do not start the REPL on port 5555 then you need to specify the port in the launch configuration
using the `replPort` setting. This gives you maximum flexibility in choosing the way to launch your
code. It just has to run in (or provide) nREPL running with the debug middleware.
* `replPort` - Set this if you are not launching on port 5555.
* `leinPath` - You must set the path to the `lein` command even if you are not using leiningen to
launch your program. The debugger starts up an internal nREPL that it uses to make a JDI (debugging)
connection to your program and needs leiningen for this.
* `toolsJar` - You must set this to the path of the Java `tools.jar` file. Typically this
is in the `lib` directory under your Java installation. The path must end in `tools.jar`.

The extension can launch the REPL in three different ways: in the internal debug console, in an internal
command terminal, or in an external terminal. This is controlled by the **console** attribute. The
default uses the internal debug console. Running in a terminal can be useful if, for instance, you need
to type input into your program or if your program expects to run in a terminal environment.

## Starting the REPL

Most of the functionality of the extension is not available unless a REPL is running. You need to either
launch a REPL or attach to one. We will cover launching a REPL first.

#### Launching a REPL

Once you have set up your profile (or otherwise enabled the nREPL middleware) and created a suitable launch.json file you can
launch the REPL invoking the command palette (`shift+cmd+p` (mac) / `shift+ctrl+p` (windows/linux)) and selecting
`Clojure: Start REPL` (type 'repl' to see this command).

**IMPORTANT:** Do not try to start the REPL using the `start debugger` icon ![START](http://i.imgur.com/ZAmkn5M.png).
*This will not work.*

This will pop up a quick pick selector that will let you choose which configuration you want to use
(your launch.json file can define many).

On a mac an example launch configuration might look like this

```json
{
	"name": "Clojure-Debug Internal Console",
	"type": "clojure",
	"request": "launch",
	"leinPath": "/usr/local/bin/lein",
  "commandLine": [
    "/usr/local/bin/lein",
    "with-profile",
    "+debug-repl",
    "repl",
    ":headless",
    ":port",
    "7777"
  ],
  "toolsJar": "/Library/Java/JavaVirtualMachines/jdk1.8.0_74.jdk/Contents/Home/lib/tools.jar",
  "replPort": 7777,
  "debugReplPort": 7778,
  "debugPort": 9999,
  "cwd": "${workspaceRoot}",
  "refreshOnLaunch": true,
  "sideChannelPort": 3030
}
```

![LAUNCH](https://media.giphy.com/media/26xBAd7JoMC9WadS8/source.gif)

This can take a while (minutes for large projects). You should see output from the REPL as is starts up
in the debug console or in the terminal (for terminal launches). Eventually you should see a screen like the following
(note color change in status bar at bottom). You should see the status message 'Attached to process' at the bottom and
information in the debug console about the running REPLs and namespaces that were loaded.

![LAUNCHED](http://i.imgur.com/EV6D8i0.png)

The main elements to the interface are labeled in the next screenshot. These are the debug console, where
output from the REPL is displayed, the debug console input box, used to execute code in the `user` namespace
and at breakpoints, the status area, which displays messages related to the current operation, and the
call stack vew that displays the active threads as well as frames when a breakpoint is encountered.

![MAIN_ELEMENTS](http://i.imgur.com/YpY7YC4.png)

#### Attaching to a Running REPL

Using a configuration like the following, it is possible to attach to a running REPL (notice `request` is
set to "attach".

```json
{
			"name": "Clojure-Attach Console",
			"type": "clojure",
			"request": "attach",
			"leinPath": "/usr/local/bin/lein",
			"toolsJar": "/Library/Java/JavaVirtualMachines/jdk1.8.0_74.jdk/Contents/Home/lib/tools.jar",
			"replPort": 7777,
			"debugReplPort": 7778,
			"debugPort": 9999,
			"cwd": "${workspaceRoot}",
			"sideChannelPort": 3030
		}
```

Note that the REPL must have been started listening on a JDI port. This is possible on mac/linux using something
like this following:

```bash
env HOME=/Users/foo CLOJURE_DEBUG_JDWP_PORT=9999 JVM_OPTS=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=9999 /usr/local/bin/lein with-profile +debug-repl repl :start :port 7777
```

Once the REPL is started, you can connect using the same procedure as the one used for launching a REPL, namely,
selecting `Clojure: Start REPL` from the command pallet and choosing your "attach" configuration. The following
example illustrates this process.

![ATTACH](http://i.giphy.com/l3q2DGGzQJjfRo5Nu.gif)

### Primary Operations

#### Executing Code

There are two different ways to execute code in the REPL. The first way is to select code in an editor
and execute that using the `Clojure: Evaluate selected text` command from the command palette (`shift+cmd+p`), or
by using the key binding shortcut (`cmd+alt+e` on mac or `ctrl+alt+e` on win/linux). Code evaluated in this way is
evaluated in the namespace of the open file. Evaluating code from within an editor is facilitated by a helper
(`shift+ctrl+m`) that expands the current selection to the next outer form. Repeated invocation will continue to
expand the selection.

The second way to evaluate code is by typing it into the debug console input box as shown below. Code evaluated
from the debug input box is normally evaluated in the context of the `user` namespace. The exception to this
is when the program is stopped at a breakpoint, in which case the code is evaluated in the context of the current
frame (having access to any defined vars.). All three cases are shown below:

![EVAL](https://media.giphy.com/media/l0Exg8UQTazv9WO6A/source.gif)

#### Setting Breakpoints

Currently Continuum supports two kinds of breakpoints, line breakpoints and exceptions breakpoints. Line
breakpoints let you set set a breakpoint at a specific line in a given file. These are set by clicking in the
left margin of an open editor.

![BREAKPOINT](https://media.giphy.com/media/l3q2YGpocqMDRnMTS/source.gif)

Breakpoints can be set for exceptions by checking the 'Exceptions' box in the 'Breakpoints' view.
As discussed in the "Known Limitations" section below, exception breakpoints apply to both checked and
unchecked exceptions.
In the status bar to the right of the exception class icon ![EXCEPTIONS](http://i.imgur.com/IAq3tHv.png)
is an input box that can be used to set the type of exceptions on which to break. The default is `Throwable`.

In general it is advisable to leave exception breakpoints off and only turn them on (with the exception
class set appropriately) when an exception is encountered, so that the code can be run again and execution
is stopped at the exception. Also, if an exception breakpoint is hit, be sure to disable the breakpoint
before continuing or you are likely to retrigger it.

In this example, the exception occurs within the core Java code for Clojure. VS Code cannot display source
it can't access, but we can select the invoking Clojure frame farther up the stack to see that code and
inspect the vars.

![EXCEPTION](https://media.giphy.com/media/l0EwZj06vmFxn1pFC/source.gif)

If you have the source for the Java code in our source path then VS Code will display that as well.
Java variables can be inspected and invoked from Clojure code in the debug console input just as with
Clojure vars.

![EXCEPTION_JAVA](https://media.giphy.com/media/26xBzTfV7eCV565qw/source.gif)

### Contributed Commands

| Command | Command Palette Entry | Description | Key bindings |
|---------|-------|-------------|--------------|
| clojure.eval | Clojure: Evaluate selected text | Evaluate the selected text in the file's namespace | `cmd+alt+e` (mac) / `ctrl+alt+e` (win/linux) |
| clojure.expand_selection | Clojure: Expand Selection | Expand selection to containing brackets/parentheses | `shift+ctrl+m` |
| clojure.debug | Clojure: Start REPL | Start a REPL. | |
| clojure.load-file | Clojure: Load File | Load the currently open Clojure source file. | |
| clojure.refresh | Clojure: Refresh Code |Refresh changed code without restarting the REPL. | |
| clojure.superRefresh | Clojure: Super Refresh Code | Refresh all code without restarting the REPL. | |
| clojure.run-test | Clojure: Run Test Under Cursor | Run the test under the cursor, optionally refreshing code first. | |
| clojure.run-test-file | Clojure: Run Tests in Current Namespace | Run the tests in the current namespace, optionally refreshing code first. | |
| clojure.run-all-tests | Clojure: Run All Tests | Run all the tests in the project after refreshing the code. | |

### Known Limitations

#### General

* Lines in Clojure do not always compile to a line in Java bytecode on which you can set a breakpoint. If you
attempt to set a breakpoint on a line and it remains grayed out, try moving it up or down.
* Watch variables are not supported *yet*.
* Arguments displayed at a breakpoint sometimes show up under local variables instead of arguments.
* For large projects hitting a breakpoint may be slow, particularly the first time. Also, it may take several
seconds for variables to show up in the "Variables" pain.

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
* Exception breakpoints apply to caught as well as uncaught exceptions. There is no way (yet) to only break on
uncaught exceptions. This is (I think) due to the fact the nREPL ultimately catches all exceptions to prevent thread
death, so there is in effect, no such thing as an uncaught exception.
* The input for changing the exception class on which to break is not smart - you can type anything in it, so
be sure to type a valid class name. This should get fixed in a future update.
* After changing the exception type for exception breakpoints you need to disable then enable exception breakpoints
to trigger an update to the exception type. This is due to a know bug in VS Code [#14615](https://github.com/Microsoft/vscode/issues/14615)
that prevents the update from happening automatically.
* It is advisable to temporarily disable exception breakpoints before continuing after stopping on a breakpoint to due to
an exception. Otherwise you will stop on every frame of the stack trace and have to hit continue repeatedly until you
bubble back up out of the call stack.
* As mentioned previously, exceptions may occur inside Java code, in which case the source for the
frame will not be available. Look at the stack trace in the threads list and click on any of the
Clojure frames.

### Restarting the debugger

If the debugger seems to have stopped working (but language features like docstring lookup
or jump to definition still work), you might need to restart the debugger. You can do
this by clicking on the restart icon ![RESTART](http://i.imgur.com/DqzIJXf.png). This
will not trigger the launch indicator or change the color of the status bar. You
need to examine the REPL output to determine if things have restarted. If all else
fails, you may need to stop the REPL by clicking the stop button ![STOP](http://i.imgur.com/iSlKrWx.png)
and then restart.

### Clojure Dependencies

The environment utilizes several Clojure libraries to enable various features.

* [debug-middleware](https://clojars.org/debug-middleware) provides the debug functionality, which in turn relies on
* a modified [cdt](https://clojars.org/org.clojars.jnorton/cdt) - the Clojure Debug Toolkit
* [compliment](https://github.com/alexander-yakushev/compliment) is used to perform autocompletion
* [cljfmt](https://github.com/weavejester/cljfmt) is used to support code reformatting

## Suggested User Settings

* Set the word separators setting in your user settings to the following to make selecting Clojure code elements easier.
``` clojure
"editor.wordSeparators": " ()\"':,;~@#$%^&{}[]`"
```
* Install [parinfer](https://marketplace.visualstudio.com/items?itemName=shaunlebron.vscode-parinfer).
The latest version by Shaun LeBron is based on the Atom plugin and is excellent.

## Why Continuum?

I see Clojure development as being fundamentally different from development in other languages.
In traditional development we employ a workflow of code, compile, execute/test, repeat
(skipping the compile step for some languages). In Clojure, we employ a REPL driven approach
in which we are constantly evaluating code as we write it. This extension takes that a step
further to include debugging as part of a continuous development process.
Instead of employing discrete steps during development all the steps blend together into a
continuum. That, and all the good names were taken.

## Full list of launch.json settings (from package.json)


| Property | Type | Description | Default Value |
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
