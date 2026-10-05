//! Minimal binding to libmpv's client API, loaded at runtime from `libmpv-2.dll`.
//!
//! Video is embedded by giving mpv the native window handle (`wid`): mpv draws
//! into the app window, and the transparent webview sits on top with our own
//! controls. Only the handful of client API calls the app needs are bound here.

use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::path::Path;

use libloading::Library;
use serde_json::{Map, Number, Value};

const FORMAT_NONE: c_int = 0;
const FORMAT_STRING: c_int = 1;
const FORMAT_FLAG: c_int = 3;
const FORMAT_INT64: c_int = 4;
const FORMAT_DOUBLE: c_int = 5;
const FORMAT_NODE: c_int = 6;
const FORMAT_NODE_ARRAY: c_int = 7;
const FORMAT_NODE_MAP: c_int = 8;

const EVENT_NONE: c_int = 0;
const EVENT_SHUTDOWN: c_int = 1;
const EVENT_START_FILE: c_int = 6;
const EVENT_END_FILE: c_int = 7;
const EVENT_FILE_LOADED: c_int = 8;
const EVENT_SEEK: c_int = 20;
const EVENT_PLAYBACK_RESTART: c_int = 21;
const EVENT_PROPERTY_CHANGE: c_int = 22;

type Handle = *mut c_void;

#[repr(C)]
struct RawEvent {
    event_id: c_int,
    error: c_int,
    reply_userdata: u64,
    data: *mut c_void,
}

#[repr(C)]
struct RawEventProperty {
    name: *const c_char,
    format: c_int,
    data: *mut c_void,
}

#[repr(C)]
struct RawEventEndFile {
    reason: c_int,
    error: c_int,
}

#[repr(C)]
#[derive(Clone, Copy)]
union RawNodeValue {
    string: *mut c_char,
    flag: c_int,
    int64: i64,
    double: f64,
    list: *mut RawNodeList,
    ba: *mut c_void,
}

#[repr(C)]
struct RawNode {
    u: RawNodeValue,
    format: c_int,
}

#[repr(C)]
struct RawNodeList {
    num: c_int,
    values: *mut RawNode,
    keys: *mut *mut c_char,
}

struct Api {
    create: unsafe extern "C" fn() -> Handle,
    initialize: unsafe extern "C" fn(Handle) -> c_int,
    set_option_string: unsafe extern "C" fn(Handle, *const c_char, *const c_char) -> c_int,
    command: unsafe extern "C" fn(Handle, *mut *const c_char) -> c_int,
    set_property_string: unsafe extern "C" fn(Handle, *const c_char, *const c_char) -> c_int,
    get_property: unsafe extern "C" fn(Handle, *const c_char, c_int, *mut c_void) -> c_int,
    observe_property: unsafe extern "C" fn(Handle, u64, *const c_char, c_int) -> c_int,
    wait_event: unsafe extern "C" fn(Handle, f64) -> *mut RawEvent,
    free_node_contents: unsafe extern "C" fn(*mut RawNode),
    error_string: unsafe extern "C" fn(c_int) -> *const c_char,
    terminate_destroy: unsafe extern "C" fn(Handle),
    // Must outlive the function pointers above.
    _lib: Library,
}

impl Api {
    unsafe fn load(path: &Path) -> Result<Self, String> {
        let lib = Library::new(path)
            .map_err(|e| format!("Could not load {}: {e}", path.display()))?;

        macro_rules! sym {
            ($name:literal) => {
                *lib.get(concat!($name, "\0").as_bytes())
                    .map_err(|e| format!("libmpv is missing {}: {e}", $name))?
            };
        }

        Ok(Self {
            create: sym!("mpv_create"),
            initialize: sym!("mpv_initialize"),
            set_option_string: sym!("mpv_set_option_string"),
            command: sym!("mpv_command"),
            set_property_string: sym!("mpv_set_property_string"),
            get_property: sym!("mpv_get_property"),
            observe_property: sym!("mpv_observe_property"),
            wait_event: sym!("mpv_wait_event"),
            free_node_contents: sym!("mpv_free_node_contents"),
            error_string: sym!("mpv_error_string"),
            terminate_destroy: sym!("mpv_terminate_destroy"),
            _lib: lib,
        })
    }
}

pub enum Event {
    Shutdown,
    StartFile,
    FileLoaded,
    EndFile { reason: &'static str, error: Option<String> },
    Seek,
    PlaybackRestart,
    PropertyChange { name: String, value: Value },
    /// Timed out, or an event we don't care about.
    Nothing,
}

pub struct Mpv {
    api: Api,
    handle: Handle,
}

// The mpv client API is thread-safe; the handle may be used from any thread.
unsafe impl Send for Mpv {}
unsafe impl Sync for Mpv {}

impl Mpv {
    /// Loads libmpv from `lib_path`, applies `options` (before init) and starts mpv.
    pub fn new(lib_path: &Path, options: &[(&str, String)]) -> Result<Self, String> {
        let api = unsafe { Api::load(lib_path)? };
        let handle = unsafe { (api.create)() };
        if handle.is_null() {
            return Err("mpv_create failed".into());
        }
        let mpv = Self { api, handle };

        for (name, value) in options {
            let (n, v) = (cstr(name)?, cstr(value)?);
            let code = unsafe { (mpv.api.set_option_string)(mpv.handle, n.as_ptr(), v.as_ptr()) };
            mpv.check(code).map_err(|e| format!("option {name}={value}: {e}"))?;
        }

        let code = unsafe { (mpv.api.initialize)(mpv.handle) };
        mpv.check(code).map_err(|e| format!("mpv_initialize: {e}"))?;
        Ok(mpv)
    }

    pub fn command<S: AsRef<str>>(&self, args: &[S]) -> Result<(), String> {
        let owned = args
            .iter()
            .map(|a| cstr(a.as_ref()))
            .collect::<Result<Vec<_>, _>>()?;
        let mut ptrs: Vec<*const c_char> = owned.iter().map(|s| s.as_ptr()).collect();
        ptrs.push(std::ptr::null());
        let code = unsafe { (self.api.command)(self.handle, ptrs.as_mut_ptr()) };
        self.check(code)
    }

    pub fn set_property(&self, name: &str, value: &Value) -> Result<(), String> {
        let text = match value {
            Value::Bool(true) => "yes".to_string(),
            Value::Bool(false) => "no".to_string(),
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            Value::Null => String::new(),
            other => other.to_string(),
        };
        let (n, v) = (cstr(name)?, cstr(&text)?);
        let code = unsafe { (self.api.set_property_string)(self.handle, n.as_ptr(), v.as_ptr()) };
        self.check(code)
    }

    pub fn get_property(&self, name: &str) -> Result<Value, String> {
        let n = cstr(name)?;
        let mut node = RawNode { u: RawNodeValue { int64: 0 }, format: FORMAT_NONE };
        let code = unsafe {
            (self.api.get_property)(
                self.handle,
                n.as_ptr(),
                FORMAT_NODE,
                &mut node as *mut RawNode as *mut c_void,
            )
        };
        self.check(code)?;
        let value = unsafe { node_to_json(&node) };
        unsafe { (self.api.free_node_contents)(&mut node) };
        Ok(value)
    }

    pub fn observe(&self, name: &str) -> Result<(), String> {
        let n = cstr(name)?;
        let code = unsafe { (self.api.observe_property)(self.handle, 0, n.as_ptr(), FORMAT_NODE) };
        self.check(code)
    }

    /// Blocks for up to `timeout` seconds (negative = forever) waiting for the next event.
    /// Only call this from one thread at a time.
    pub fn wait_event(&self, timeout: f64) -> Event {
        unsafe {
            let ev = &*(self.api.wait_event)(self.handle, timeout);
            match ev.event_id {
                EVENT_NONE => Event::Nothing,
                EVENT_SHUTDOWN => Event::Shutdown,
                EVENT_START_FILE => Event::StartFile,
                EVENT_FILE_LOADED => Event::FileLoaded,
                EVENT_SEEK => Event::Seek,
                EVENT_PLAYBACK_RESTART => Event::PlaybackRestart,
                EVENT_END_FILE => {
                    let end = &*(ev.data as *const RawEventEndFile);
                    let reason = match end.reason {
                        0 => "eof",
                        2 => "stop",
                        3 => "quit",
                        4 => "error",
                        5 => "redirect",
                        _ => "unknown",
                    };
                    let error = (end.error < 0).then(|| self.error_text(end.error));
                    Event::EndFile { reason, error }
                }
                EVENT_PROPERTY_CHANGE => {
                    let prop = &*(ev.data as *const RawEventProperty);
                    let name = CStr::from_ptr(prop.name).to_string_lossy().into_owned();
                    let value = if prop.format == FORMAT_NODE && !prop.data.is_null() {
                        node_to_json(&*(prop.data as *const RawNode))
                    } else {
                        Value::Null
                    };
                    Event::PropertyChange { name, value }
                }
                _ => Event::Nothing,
            }
        }
    }

    fn check(&self, code: c_int) -> Result<(), String> {
        if code >= 0 {
            Ok(())
        } else {
            Err(self.error_text(code))
        }
    }

    fn error_text(&self, code: c_int) -> String {
        unsafe { CStr::from_ptr((self.api.error_string)(code)) }
            .to_string_lossy()
            .into_owned()
    }
}

impl Drop for Mpv {
    fn drop(&mut self) {
        unsafe { (self.api.terminate_destroy)(self.handle) };
    }
}

fn cstr(s: &str) -> Result<CString, String> {
    CString::new(s).map_err(|_| format!("text contains a NUL character: {s:?}"))
}

unsafe fn node_to_json(node: &RawNode) -> Value {
    match node.format {
        FORMAT_STRING => Value::String(CStr::from_ptr(node.u.string).to_string_lossy().into_owned()),
        FORMAT_FLAG => Value::Bool(node.u.flag != 0),
        FORMAT_INT64 => Value::Number(node.u.int64.into()),
        FORMAT_DOUBLE => Number::from_f64(node.u.double).map_or(Value::Null, Value::Number),
        FORMAT_NODE_ARRAY | FORMAT_NODE_MAP => {
            let list = &*node.u.list;
            let len = list.num.max(0) as usize;
            let values = if len == 0 { &[][..] } else { std::slice::from_raw_parts(list.values, len) };
            if node.format == FORMAT_NODE_ARRAY {
                Value::Array(values.iter().map(|v| node_to_json(v)).collect())
            } else {
                let keys = if len == 0 { &[][..] } else { std::slice::from_raw_parts(list.keys, len) };
                let mut map = Map::with_capacity(len);
                for (key, value) in keys.iter().zip(values) {
                    let key = CStr::from_ptr(*key).to_string_lossy().into_owned();
                    map.insert(key, node_to_json(value));
                }
                Value::Object(map)
            }
        }
        _ => Value::Null,
    }
}
