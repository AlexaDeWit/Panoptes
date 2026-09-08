# Opening, saving, importing and exporting

The studio reaches files through `FileBridge`, a record of functions the app
is handed rather than a platform it calls. `browser-bridge.ts` is the browser
one: the File System Access API where it exists, so a save writes back to the
file that was opened, and otherwise a hidden file input for opening and a
download for saving. A spec is handed a recording one instead, and the typed
IPC an Electron shell will offer (issue #43) replaces the record without a
view changing. Every path answers with an outcome; nothing throws.

`NoPicker` is the browser's arm of that union and nobody else's: only a
component can hold a file input, so a bridge without a picker says "not me"
and the view opens one. `asksWhere` is the same fact on the save side, and a
question rather than an answer: a save-as puts every registered format in the
platform's picker, so a platform with none is asked in advance and the studio
puts the question in its own menu instead, handing the save-as the one format
it settled on. The bridge holds the native handle only after the session
accepts the outcome of the current operation.

Each bridge open, fallback read, save, or save-as starts one operation identity.
Without a save picker, Save As opens the format menu without bridge I/O.
Selecting a format calls `chooseFormat` and starts the operation. Cancelling
the format menu leaves an older read active.
The latest request owns settlement, regardless of completion order. The
bridge returns an outcome and a settlement function without changing its
held handle. The session validates the read and settles the handle before
dispatching the matching store action, with no asynchronous step between them.
A stale settlement returns false and changes neither association. Close
releases the handle and invalidates pending operations. Exports own no file
association and do not interrupt these operations.

A failed open keeps the model, history, saved checkpoint, and loss report,
but drops the file association and releases the bridge's handle. This applies
to a read failure and to text a codec refuses. The next Save downloads native
YAML, leaving both the previous file and any rejected file untouched. A
refused save retains the current file and handle for retry. Unsaved changes
stay guarded. Dismissing a picker keeps the last settled association but does
not revive an older pending operation. An empty fallback selection starts no
operation.

A save already in progress can still write its target. Once another file
operation starts, that save cannot rename or mark the current model saved.
A successful fallback selection settles with no handle, so its next Save
downloads under the selected name.

`session.ts` is what the studio does with a file, as pure functions the
component calls and a spec calls directly. A read is the size against
`readLimits.maxTextBytes` first, since that bound keeps the parse finite, then
`readAnyFormat`, then one action: the model, or the codec's own failure, which
the panel renders with the paths it carries. A write is the codec's own write
for the file's format, then the bridge, then one action.

Import sits beside Export in the File menu and creates an unsaved native
model. Its successful read releases the source handle and proposes a YAML
name. A cancelled or refused import preserves the previous file association.
Import shares operation ownership and unsaved-work guards with Open.
[Format conversion rules](../../../../packages/formats/IMPORT.md) describe
what each importer carries over and reports.

`export-commands.ts` projects the current model through `@saerskriven/render`.
It writes a diagram as SVG, the register as markdown, and the whole model as
Typst. The PDF path compiles that Typst source through the render package's
`pdf` subpath. An export uses the bridge's picker or download path but never
replaces the file handle that Save writes back to.

`pdf-assets.ts` fetches the WebAssembly module and the five Liberation faces
that the Vite build emits. Vite's `?url` import owns the module. The face list
and compiler order come from the same render-owned build module as the CLI.
The loader caches the bytes after the first successful read and returns a
typed failure when an asset is not available.

The render subpath loads the compiler JavaScript on the first PDF export.
Vite keeps that code in a separate hashed chunk.

The WebAssembly module and fonts load only after the PDF item runs. Other
exports load none of those runtime assets.

`formatFiles` is the one table saying how a format appears as a file: the
words a person reads, the media type a picker files it under, and the
extensions it is written with. `saveTypes` is that table as a picker takes it,
the file's own format first so it is the one proposed, and `formatOfName` is
the way back: a picker answers with the name the person settled on, and its
extension is what says which codec writes the text. Nothing else reads an
extension as a format.

Which document a write merges onto is the whole difference between keeping
what Saerskriven does not model and dropping it, so the document a read retained
rides in the store beside the file's name ([the store's
README](../store/README.md)). Saving in the format a model was read from merges
onto it; saving in any other format has nothing to merge onto and the codec
projects, which is where a loss report comes from. A read reports too: a wire
schema drops every key it does not declare, and the retained document has lost
them as well, so no later save can say what became of them. Both are held by
the component, each describing one crossing of the file boundary rather than
the model, and each stands until a save starts, an open lands, or the file is
closed: an open that was refused leaves the report alone, nothing having
crossed, and a close drops it because the file it describes is gone.

Recovery stores that file name, format, and retained document with the current
model. It stores no native handle. After a reload, Save follows the browser
bridge's no-handle path and still merges through the retained document.

`file-commands.ts` holds one session the app owns rather than handlers a
control closes over. Its file and export actions are registered commands
([the commands](../commands/README.md)). A chord and a menu item therefore run
the same dispatch where a chord exists. Save as writes the format the file is
already in, and the picker is where a person says otherwise: the text is
written once the picker has answered, because until then which codec writes it
is the person's to decide. Each reads the store as it runs rather than
closing over a render, which is what lets the commands be built once. The reducer
is total and cannot refuse an open or a close over work in no file, so the
session asks first.

Open and New model ask before replacing unsaved work. The session holds
these questions as `opening` and `closing`. A second press confirms Discard
changes and open or Discard changes and create new model. Cancel keeps the
current model. The session owns the question so a keyboard shortcut also
opens the menu. Answering or dismissing the menu clears the question.
The session also clears it when the model becomes clean.

`choosing` is that shape a second time, for the format a save-as writes, and
the studio asks it only where the platform has no picker to ask it in. Save as
holds the menu open and becomes the registered formats, the file's own in the
place the item stood, so the person is still on the item they pressed. Firefox
and Safari are that browser today, so the question is a path in its own
right, not a fallback. It is a second press on an item rather than a submenu
because that is one press deep, keeps the keyboard where it already was, and
adds no second overlay to walk into. Whether the platform asks is read as the
item is drawn rather than after a save-as has started, so nothing has to close
the menu and open it again around an answer.

`menu.tsx` mounts the rest: the burger button over the top left of the canvas,
the file and edit commands, the Export submenu, the project link, and the
state of the open file. The Project group links to GitHub. The app shows the
built version above the React Flow attribution, with `development` for builds
without a release tag. The submenu has one SVG item per diagram when the
model has several.
The other items export the register as markdown, or the whole model as Typst
or PDF. Every proposed name replaces the open file's extension, or starts
with `Untitled` when no file is open. The menu also holds the fallback
picker's input and the guard on closing the tab. The guard stands only while
the model is dirty and the latest recovery write is unconfirmed. Open and
New model still ask before they replace or clear a dirty recovered session. New model
releases the native handle only after the recovery snapshot clears.

The report of the last crossing, an export report, and the failure notice sit
below the button and over the canvas. The crossing report and export report
share one live region. An export reports every endpoint its projection could
not place after it writes the file. A PDF compile refusal reports the
compiler's sentences and writes nothing.

The File menu also exposes Appearance with System, Light, and Dark choices. The selected choice is shown in words and persists in `localStorage` under `saerskrivenColourMode`. Invalid or unavailable stored data selects System.
