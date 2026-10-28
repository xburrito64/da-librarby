//! The stress test's side here (the test itself is src/perf): how it was asked for on the command
//! line, where its results go, how long the app took to show its first frame, and how much of the
//! processor, graphics card and memory the app uses (the app itself, its web view's processes and
//! mpv, which runs inside the app).
//!
//! `da-librarby.exe --stress` runs it and closes the app afterwards. Options:
//!   --stress-out=<folder>      where the results go (default: "perf" in the app's data folder)
//!   --stress-themes=a,b        only these themes (default: all of them)
//!   --stress-only=a,b          only these routines (see src/perf/scenarios.ts)
//!   --stress-big=<n>           a second round with the library made <n> titles big (copies)
//!   --stress-label=<text>      a name for the results (e.g. what changed)
//!   --stress-stay              stay open afterwards

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StressArgs {
    out: Option<String>,
    themes: Option<Vec<String>>,
    only: Option<Vec<String>>,
    big: Option<u32>,
    label: Option<String>,
    stay: bool,
}

fn stress_args() -> Option<StressArgs> {
    let args: Vec<String> = std::env::args().collect();
    if !args.iter().any(|a| a == "--stress") {
        return None;
    }
    let value = |name: &str| {
        let prefix = format!("--stress-{name}=");
        args.iter().find_map(|a| a.strip_prefix(&prefix).map(str::to_string))
    };
    let list = |name: &str| value(name).map(|v| v.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect());
    Some(StressArgs {
        out: value("out"),
        themes: list("themes"),
        only: list("only"),
        big: value("big").and_then(|v| v.parse().ok()),
        label: value("label"),
        stay: args.iter().any(|a| a == "--stress-stay"),
    })
}

/// The stress test to run, if the app was started for one.
#[tauri::command]
pub async fn perf_stress_args() -> Option<StressArgs> {
    stress_args()
}

/// Saves a stress test's results as `<name>.json`; returns where.
#[tauri::command]
pub async fn perf_save(app: AppHandle, name: String, json: String) -> Result<String, String> {
    let dir = match stress_args().and_then(|a| a.out) {
        Some(out) => PathBuf::from(out),
        None => app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("perf"),
    };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe: String = name.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    let path = dir.join(format!("{safe}.json"));
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// The stress test is over (and wasn't asked to stay): the app closes.
#[tauri::command]
pub async fn perf_exit(app: AppHandle) {
    app.exit(0);
}

static STARTED: OnceLock<Instant> = OnceLock::new();
static READY_MS: OnceLock<f64> = OnceLock::new();

/// Call first thing: the clock for how long the first frame took.
pub fn mark_start() {
    STARTED.get_or_init(Instant::now);
}

/// The page has drawn its first frame.
pub fn mark_ready() {
    // From when Windows created the process (it loads the program before our code runs), else
    // from our first line.
    let ms = process_age_ms().or_else(|| STARTED.get().map(|s| s.elapsed().as_secs_f64() * 1000.0));
    if let Some(ms) = ms {
        let _ = READY_MS.set(ms);
    }
}

/// How long the app took from being started to its first frame (ms).
#[tauri::command]
pub async fn perf_startup() -> Option<f64> {
    READY_MS.get().copied()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    /// Processor time used so far by the app and its processes, all cores together (ms).
    cpu_ms: f64,
    /// Since when (ms, a clock of its own): for the share of the processor between two readings.
    at_ms: f64,
    /// Logical processors (Task Manager's 100%).
    cores: usize,
    /// Memory in use by the app and its processes (bytes).
    memory: u64,
    /// The busiest graphics engine's use by the app since the last reading, in % (as Task
    /// Manager's GPU column); none on the first reading.
    gpu: Option<f64>,
}

/// How much the app uses right now (see `Usage`).
#[tauri::command]
pub async fn perf_usage() -> Usage {
    let pids = win::own_processes();
    let (cpu_ms, memory) = win::cpu_and_memory(&pids);
    let gpu = win::gpu_since_last(&pids);
    Usage {
        cpu_ms,
        at_ms: STARTED.get().map(|s| s.elapsed().as_secs_f64() * 1000.0).unwrap_or(0.0),
        cores: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        memory,
        gpu,
    }
}

fn process_age_ms() -> Option<f64> {
    win::process_age_ms()
}

/// The graphics counters, kept between readings (they give use since the last one).
static GPU_QUERY: Mutex<Option<win::Query>> = Mutex::new(None);

#[cfg(windows)]
mod win {
    use super::GPU_QUERY;
    use std::ffi::c_void;

    type Handle = *mut c_void;

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct FileTime {
        low: u32,
        high: u32,
    }

    impl FileTime {
        /// In 100 ns steps.
        fn ticks(self) -> u64 {
            ((self.high as u64) << 32) | self.low as u64
        }
    }

    #[repr(C)]
    struct ProcessEntry {
        size: u32,
        usage: u32,
        pid: u32,
        heap: usize,
        module: u32,
        threads: u32,
        parent: u32,
        priority: i32,
        flags: u32,
        exe: [u16; 260],
    }

    #[repr(C)]
    #[derive(Default)]
    struct MemoryCounters {
        size: u32,
        page_faults: u32,
        peak_working_set: usize,
        working_set: usize,
        peak_paged_pool: usize,
        paged_pool: usize,
        peak_non_paged_pool: usize,
        non_paged_pool: usize,
        page_file: usize,
        peak_page_file: usize,
        private: usize,
    }

    #[repr(C)]
    struct CounterItem {
        name: *const u16,
        status: u32,
        value: f64,
    }

    const SNAP_PROCESS: u32 = 0x2;
    const QUERY_LIMITED: u32 = 0x1000;
    const PDH_MORE_DATA: u32 = 0x8000_07D2;
    const PDH_FMT_DOUBLE: u32 = 0x200;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcessId() -> u32;
        fn GetCurrentProcess() -> Handle;
        fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> Handle;
        fn Process32FirstW(snap: Handle, entry: *mut ProcessEntry) -> i32;
        fn Process32NextW(snap: Handle, entry: *mut ProcessEntry) -> i32;
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> Handle;
        fn CloseHandle(h: Handle) -> i32;
        fn GetProcessTimes(h: Handle, created: *mut FileTime, exited: *mut FileTime, kernel: *mut FileTime, user: *mut FileTime) -> i32;
        fn K32GetProcessMemoryInfo(h: Handle, counters: *mut MemoryCounters, size: u32) -> i32;
        fn GetSystemTimeAsFileTime(time: *mut FileTime);
    }

    #[link(name = "pdh")]
    extern "system" {
        fn PdhOpenQueryW(source: *const u16, user: usize, query: *mut Handle) -> u32;
        fn PdhAddEnglishCounterW(query: Handle, path: *const u16, user: usize, counter: *mut Handle) -> u32;
        fn PdhCollectQueryData(query: Handle) -> u32;
        fn PdhGetFormattedCounterArrayW(counter: Handle, format: u32, size: *mut u32, count: *mut u32, items: *mut CounterItem) -> u32;
    }

    /// The app's own process and everything it started (the web view's, which start their own).
    pub fn own_processes() -> Vec<u32> {
        let me = unsafe { GetCurrentProcessId() };
        let mut all = Vec::new();
        unsafe {
            let snap = CreateToolhelp32Snapshot(SNAP_PROCESS, 0);
            if snap.is_null() || snap as isize == -1 {
                return vec![me];
            }
            let mut entry: ProcessEntry = std::mem::zeroed();
            entry.size = std::mem::size_of::<ProcessEntry>() as u32;
            let mut more = Process32FirstW(snap, &mut entry) != 0;
            while more {
                all.push((entry.pid, entry.parent));
                more = Process32NextW(snap, &mut entry) != 0;
            }
            CloseHandle(snap);
        }
        let mut mine = vec![me];
        let mut i = 0;
        while i < mine.len() {
            let parent = mine[i];
            for &(pid, p) in &all {
                if p == parent && pid != parent && !mine.contains(&pid) {
                    mine.push(pid);
                }
            }
            i += 1;
        }
        mine
    }

    pub fn cpu_and_memory(pids: &[u32]) -> (f64, u64) {
        let mut ticks = 0u64;
        let mut memory = 0u64;
        for &pid in pids {
            unsafe {
                let h = OpenProcess(QUERY_LIMITED, 0, pid);
                if h.is_null() {
                    continue;
                }
                let (mut c, mut e, mut k, mut u) = Default::default();
                if GetProcessTimes(h, &mut c, &mut e, &mut k, &mut u) != 0 {
                    ticks += k.ticks() + u.ticks();
                }
                let mut m = MemoryCounters { size: std::mem::size_of::<MemoryCounters>() as u32, ..Default::default() };
                if K32GetProcessMemoryInfo(h, &mut m, m.size) != 0 {
                    memory += m.private as u64;
                }
                CloseHandle(h);
            }
        }
        (ticks as f64 / 10_000.0, memory)
    }

    pub fn process_age_ms() -> Option<f64> {
        unsafe {
            let (mut c, mut e, mut k, mut u) = Default::default();
            if GetProcessTimes(GetCurrentProcess(), &mut c, &mut e, &mut k, &mut u) == 0 {
                return None;
            }
            let mut now = FileTime::default();
            GetSystemTimeAsFileTime(&mut now);
            Some(now.ticks().saturating_sub(c.ticks()) as f64 / 10_000.0)
        }
    }

    pub struct Query {
        query: Handle,
        counter: Handle,
    }

    // Only ever used behind GPU_QUERY's lock.
    unsafe impl Send for Query {}

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }

    /// Use of each graphics engine since the last reading, added up over the app's processes;
    /// the busiest engine's (as Task Manager shows it).
    pub fn gpu_since_last(pids: &[u32]) -> Option<f64> {
        let mut slot = GPU_QUERY.lock().ok()?;
        unsafe {
            let Some(q) = slot.as_ref() else {
                let mut query = std::ptr::null_mut();
                if PdhOpenQueryW(std::ptr::null(), 0, &mut query) != 0 {
                    return None;
                }
                let mut counter = std::ptr::null_mut();
                let path = wide("\\GPU Engine(*)\\Utilization Percentage");
                if PdhAddEnglishCounterW(query, path.as_ptr(), 0, &mut counter) != 0 {
                    return None;
                }
                PdhCollectQueryData(query);
                *slot = Some(Query { query, counter });
                return None;
            };
            if PdhCollectQueryData(q.query) != 0 {
                return None;
            }
            let (mut size, mut count) = (0u32, 0u32);
            let status = PdhGetFormattedCounterArrayW(q.counter, PDH_FMT_DOUBLE, &mut size, &mut count, std::ptr::null_mut());
            if status != PDH_MORE_DATA {
                return None;
            }
            // (The names are kept in the same buffer, after the items.)
            let mut buffer = vec![0u64; (size as usize).div_ceil(8)];
            let items = buffer.as_mut_ptr() as *mut CounterItem;
            if PdhGetFormattedCounterArrayW(q.counter, PDH_FMT_DOUBLE, &mut size, &mut count, items) != 0 {
                return None;
            }
            // "pid_1234_luid_0x0_0x1_phys_0_eng_3_engtype_3D"
            let mut engines: std::collections::HashMap<String, f64> = Default::default();
            for i in 0..count as usize {
                let item = &*items.add(i);
                if item.status != 0 || item.name.is_null() {
                    continue;
                }
                let len = (0..).take_while(|&n| *item.name.add(n) != 0).count();
                let name = String::from_utf16_lossy(std::slice::from_raw_parts(item.name, len));
                let Some(pid) = name.strip_prefix("pid_").and_then(|r| r.split('_').next()).and_then(|p| p.parse::<u32>().ok()) else { continue };
                if !pids.contains(&pid) {
                    continue;
                }
                let engine = name.split_once("_luid_").map(|(_, r)| r.to_string()).unwrap_or_default();
                *engines.entry(engine).or_default() += item.value;
            }
            Some(engines.values().fold(0.0, |a: f64, &b| a.max(b)).min(100.0))
        }
    }
}

#[cfg(not(windows))]
mod win {
    pub struct Query;
    pub fn own_processes() -> Vec<u32> {
        vec![std::process::id()]
    }
    pub fn cpu_and_memory(_: &[u32]) -> (f64, u64) {
        (0.0, 0)
    }
    pub fn process_age_ms() -> Option<f64> {
        None
    }
    pub fn gpu_since_last(_: &[u32]) -> Option<f64> {
        None
    }
}
