//! "Copy for Grimoire": the owner's Grimoire app keeps a list of what they torrented (resolution,
//! codec, audio, size, the drive it's on). The export itself is put together by the frontend
//! (src/library/grimoire.ts) from what the library already knows; this only adds what the page
//! can't do by itself: the names the drives were given in Windows, and putting the text on the
//! clipboard (a whole library's export is finished long after the click, when the page may not be
//! allowed to write to the clipboard any more).

use std::collections::BTreeMap;

/// The name each of these drives ("F:") was given in Windows ("TOSHIBA EXT"). Drives without a
/// name, or not plugged in, are left out.
#[tauri::command]
pub fn drive_labels(letters: Vec<String>) -> BTreeMap<String, String> {
    let mut labels = BTreeMap::new();
    for letter in letters {
        let Some(c) = letter.chars().next().filter(char::is_ascii_alphabetic) else { continue };
        let drive = format!("{}:", c.to_ascii_uppercase());
        if let Some(label) = volume_label(&drive).filter(|l| !l.trim().is_empty()) {
            labels.insert(drive, label.trim().to_string());
        }
    }
    labels
}

#[cfg(windows)]
fn volume_label(drive: &str) -> Option<String> {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetVolumeInformationW(
            root: *const u16,
            name: *mut u16,
            name_len: u32,
            serial: *mut u32,
            max_component: *mut u32,
            flags: *mut u32,
            fs_name: *mut u16,
            fs_name_len: u32,
        ) -> i32;
    }
    let root: Vec<u16> = format!("{drive}\\").encode_utf16().chain(Some(0)).collect();
    let mut name = [0u16; 261];
    use std::ptr::null_mut;
    let ok = unsafe {
        GetVolumeInformationW(root.as_ptr(), name.as_mut_ptr(), name.len() as u32, null_mut(), null_mut(), null_mut(), null_mut(), 0)
    };
    if ok == 0 {
        return None;
    }
    let len = name.iter().position(|&c| c == 0).unwrap_or(name.len());
    Some(String::from_utf16_lossy(&name[..len]))
}

#[cfg(not(windows))]
fn volume_label(_drive: &str) -> Option<String> {
    None
}

/// Puts text on the clipboard.
#[tauri::command]
pub fn copy_text(text: String) -> Result<(), String> {
    set_clipboard(&text)
}

#[cfg(windows)]
fn set_clipboard(text: &str) -> Result<(), String> {
    use std::ffi::c_void;
    const CF_UNICODETEXT: u32 = 13;
    const GMEM_MOVEABLE: u32 = 0x0002;
    #[link(name = "user32")]
    extern "system" {
        fn OpenClipboard(owner: *mut c_void) -> i32;
        fn EmptyClipboard() -> i32;
        fn SetClipboardData(format: u32, data: *mut c_void) -> *mut c_void;
        fn CloseClipboard() -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalAlloc(flags: u32, bytes: usize) -> *mut c_void;
        fn GlobalLock(mem: *mut c_void) -> *mut c_void;
        fn GlobalUnlock(mem: *mut c_void) -> i32;
        fn GlobalFree(mem: *mut c_void) -> *mut c_void;
    }
    let wide: Vec<u16> = text.encode_utf16().chain(Some(0)).collect();
    let bytes = wide.len() * 2;
    unsafe {
        // Another program may be holding the clipboard for a moment.
        let mut opened = false;
        for _ in 0..10 {
            if OpenClipboard(std::ptr::null_mut()) != 0 {
                opened = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(30));
        }
        if !opened {
            return Err("The clipboard is busy. Try again in a moment.".into());
        }
        let result = (|| {
            EmptyClipboard();
            let mem = GlobalAlloc(GMEM_MOVEABLE, bytes);
            if mem.is_null() {
                return Err("Not enough memory for the clipboard.".to_string());
            }
            let ptr = GlobalLock(mem) as *mut u16;
            if ptr.is_null() {
                GlobalFree(mem);
                return Err("Couldn't write to the clipboard.".to_string());
            }
            std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
            GlobalUnlock(mem);
            // The clipboard owns the memory from here on.
            if SetClipboardData(CF_UNICODETEXT, mem).is_null() {
                GlobalFree(mem);
                return Err("Couldn't write to the clipboard.".to_string());
            }
            Ok(())
        })();
        CloseClipboard();
        result
    }
}

#[cfg(not(windows))]
fn set_clipboard(_text: &str) -> Result<(), String> {
    Err("Copying works on Windows only.".into())
}
