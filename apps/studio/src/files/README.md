# Opening and saving

The studio reaches files through `FileBridge`, a record of functions the app
is handed rather than a platform it calls. `browser-bridge.ts` is the browser
one: the File System Access API where it exists, so a save writes back to the
file that was opened, and otherwise a hidden file input for opening and a
download for saving. A spec is handed a recording one instead, and the typed
IPC an Electron shell will offer (issue #43) replaces the record without a
view changing. Every path answers with an outcome; nothing throws.

`NoPicker` is the browser's arm of that union and nobody else's: only a
component can hold a file input, so a bridge without a picker says "not me"
and the view opens one. The handle a picker returned is held in the bridge,
not the store, and only where the crossing it names happened: a read that
produced a text, and a save-as whose write landed.

`session.ts` is what the studio does with a file, as pure functions the
component calls and a spec calls directly. A read is the size against
`readLimits.maxTextBytes` first, since that bound keeps the parse finite, then
`readAnyFormat`, then one action: the model, or the codec's own failure, which
the panel renders with the paths it carries. A write is the codec's own write
for the file's format, then the bridge, then one action.

Which document a write merges onto is the whole difference between keeping
what Panoptes does not model and dropping it, so the document a read retained
rides in the store beside the file's name ([the store's
README](../store/README.md)). Saving in the format a model was read from merges
onto it; saving in any other format has nothing to merge onto and the codec
projects, which is where a loss report comes from. A read reports too: a wire
schema drops every key it does not declare, and the retained document has lost
them as well, so no later save can say what became of them. Both are held by
the component, each describing one crossing of the file boundary rather than
the model, and each stands until a save starts or an open lands: an open that
was refused leaves the report alone, nothing having crossed.

`file-commands.ts` holds the three commands as one session the app owns
rather than handlers a control closes over: Open, Save and Save as are
registered commands ([the commands](../commands/README.md)), so a chord and a
button run the same three and the report one of them produces is the one the
view beside them shows. Each reads the store as it runs rather than closing
over a render, which is what lets the three be built once. The reducer is
total and cannot refuse an open over work in no file, so the session asks
first.

`file-bar.tsx` mounts the rest: the controls, what file the model lives in
and whether it holds everything on screen, the last refusal, and the report.
It holds the fallback picker's input, which only a component can, and the
guard on closing the tab, armed by the same unsaved state the asking reads.
