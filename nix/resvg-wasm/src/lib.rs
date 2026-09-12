//! Rasterizes SVG bytes to PNG bytes for Saerskriven's renderer.
//!
//! The module instantiates with no imports and no JavaScript glue. Bytes cross
//! the boundary as a pointer and a length into the module's own memory, which
//! `alloc` hands out and `dealloc` takes back. `add_font` and `render` read the
//! buffer they are given rather than taking it, so the caller deallocs
//! everything it allocs. `render` answers with a pointer to five 32-bit words,
//! status, width, height, payload pointer and payload length, which `release`
//! frees. Status 0 means the payload is a PNG, status 1 that it is a UTF-8
//! sentence naming what was refused.

use std::cell::RefCell;
use std::sync::Arc;

use resvg::tiny_skia;
use resvg::usvg;

const RENDERED: u32 = 0;
const REFUSED: u32 = 1;

thread_local! {
    static FONTS: RefCell<usvg::fontdb::Database> =
        RefCell::new(usvg::fontdb::Database::new());
}

/// What `render` answers with, read by the caller and freed by `release`.
#[repr(C)]
pub struct Outcome {
    status: u32,
    width: u32,
    height: u32,
    payload: *mut u8,
    length: usize,
}

/// Reserves `length` bytes of the module's memory for the caller to write into.
#[unsafe(no_mangle)]
pub extern "C" fn alloc(length: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(length);
    let pointer = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    pointer
}

/// Returns a buffer `alloc` handed out, at the length it was asked for.
///
/// # Safety
///
/// `pointer` and `length` are one `alloc` call's answer and its argument.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(pointer: *mut u8, length: usize) {
    drop(unsafe { Vec::from_raw_parts(pointer, length, length) });
}

/// Adds a font the next `render` may typeset with. Faces stack in call order,
/// and a family the document names that no face carries falls back to the
/// first face offered.
///
/// # Safety
///
/// `pointer` and `length` name a buffer the caller owns for the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn add_font(pointer: *const u8, length: usize) {
    let face = unsafe { std::slice::from_raw_parts(pointer, length) }.to_vec();
    FONTS.with_borrow_mut(|fonts| {
        fonts.load_font_data(face);
        fall_back_to_first(fonts);
    });
}

/// Rasterizes an SVG, scaled so its longer side is `long_edge` pixels, or at
/// the size the document names when `long_edge` is 0.
///
/// # Safety
///
/// `pointer` and `length` name a buffer the caller owns for the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn render(pointer: *const u8, length: usize, long_edge: u32) -> *mut Outcome {
    let svg = unsafe { std::slice::from_raw_parts(pointer, length) };
    match rasterize(svg, long_edge) {
        Ok(raster) => hand_over(RENDERED, raster.width, raster.height, raster.png),
        Err(refusal) => hand_over(REFUSED, 0, 0, refusal.into_bytes()),
    }
}

/// Frees an outcome and its payload.
///
/// # Safety
///
/// `outcome` is one `render` call's answer, not yet released.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn release(outcome: *mut Outcome) {
    let held = unsafe { Box::from_raw(outcome) };
    drop(unsafe { Vec::from_raw_parts(held.payload, held.length, held.length) });
}

// usvg answers an unmatched family with its serif generic, which resolves
// through these names and defaults to faces no caller here loads. Left alone,
// a document asking for Helvetica draws no text at all.
fn fall_back_to_first(fonts: &mut usvg::fontdb::Database) {
    let Some((family, _)) = fonts
        .faces()
        .next()
        .and_then(|face| face.families.first())
        .cloned()
    else {
        return;
    };
    fonts.set_serif_family(family.clone());
    fonts.set_sans_serif_family(family.clone());
    fonts.set_cursive_family(family.clone());
    fonts.set_fantasy_family(family.clone());
    fonts.set_monospace_family(family);
}

fn hand_over(status: u32, width: u32, height: u32, bytes: Vec<u8>) -> *mut Outcome {
    let mut payload = bytes.into_boxed_slice();
    let outcome = Outcome {
        status,
        width,
        height,
        payload: payload.as_mut_ptr(),
        length: payload.len(),
    };
    std::mem::forget(payload);
    Box::into_raw(Box::new(outcome))
}

struct Raster {
    width: u32,
    height: u32,
    png: Vec<u8>,
}

fn rasterize(svg: &[u8], long_edge: u32) -> Result<Raster, String> {
    let tree = usvg::Tree::from_data(svg, &options()).map_err(|refusal| refusal.to_string())?;
    let scale = scale_of(tree.size(), long_edge);
    let width = pixels(tree.size().width() * scale);
    let height = pixels(tree.size().height() * scale);
    let mut pixmap = tiny_skia::Pixmap::new(width, height)
        .ok_or_else(|| format!("a {width} by {height} pixel image is past what can be drawn"))?;
    resvg::render(
        &tree,
        tiny_skia::Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );
    let png = pixmap
        .encode_png()
        .map_err(|refusal| format!("the image did not encode as a PNG: {refusal}"))?;
    Ok(Raster { width, height, png })
}

// resolve_string treats an unresolved href as a file path. Answering None keeps
// this module off every path the host might hold, on top of a target that has
// no syscall to reach one with.
fn options<'a>() -> usvg::Options<'a> {
    let mut options = usvg::Options {
        fontdb: FONTS.with_borrow(|fonts| Arc::new(fonts.clone())),
        ..usvg::Options::default()
    };
    options.image_href_resolver.resolve_string = Box::new(|_href, _options| None);
    options
}

fn scale_of(size: usvg::Size, long_edge: u32) -> f32 {
    match long_edge {
        0 => 1.0,
        edge => edge as f32 / size.width().max(size.height()),
    }
}

fn pixels(edge: f32) -> u32 {
    edge.round().max(1.0) as u32
}
