//! Is there a newer version? Asks GitHub for the latest release of the project (no account
//! needed, nothing is sent but the request itself). The page shows a note with a download
//! button when there is one; installing is up to the person using the app.

use std::time::Duration;

use serde::{Deserialize, Serialize};

const LATEST: &str = "https://api.github.com/repos/xburrito64/da-librarby/releases/latest";

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Update {
    /// "0.5.0"
    pub version: String,
    /// The release's page, with its notes.
    pub page: String,
    /// The installer itself, if the release has one.
    pub download: Option<String>,
}

/// The newer version, if there is one (None also when GitHub can't be reached).
#[tauri::command]
pub async fn update_check(app: tauri::AppHandle) -> Result<Option<Update>, String> {
    let current = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || latest().map(|r| newer(&current, r)))
        .await
        .map_err(|e| e.to_string())?
}

fn latest() -> Result<Release, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(15)))
        .user_agent("DaLibrarby (+https://github.com/xburrito64/da-librarby)")
        .build()
        .into();
    let mut response = agent
        .get(LATEST)
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("GitHub can't be reached right now ({e})"))?;
    response.body_mut().read_json().map_err(|e| format!("GitHub sent something unexpected ({e})"))
}

fn newer(current: &str, release: Release) -> Option<Update> {
    if release.draft || release.prerelease {
        return None;
    }
    let version = release.tag_name.trim_start_matches('v').to_string();
    if parse(&version)? <= parse(current)? {
        return None;
    }
    let download = release
        .assets
        .iter()
        .find(|a| a.name.ends_with("-setup.exe"))
        .map(|a| a.browser_download_url.clone());
    Some(Update { version, page: release.html_url, download })
}

/// "0.4.10" -> (0, 4, 10)
fn parse(version: &str) -> Option<(u32, u32, u32)> {
    let mut parts = version.split(['.', '-']).map(|p| p.parse::<u32>().ok());
    Some((parts.next()??, parts.next().flatten().unwrap_or(0), parts.next().flatten().unwrap_or(0)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str) -> Release {
        Release {
            tag_name: tag.into(),
            html_url: "page".into(),
            draft: false,
            prerelease: false,
            assets: vec![Asset { name: format!("Da.Librarby_{}_x64-setup.exe", tag.trim_start_matches('v')), browser_download_url: "exe".into() }],
        }
    }

    #[test]
    fn only_newer_versions() {
        assert_eq!(newer("0.4.0", release("v0.4.1")).map(|u| u.version), Some("0.4.1".into()));
        assert_eq!(newer("0.4.0", release("v0.10.0")).and_then(|u| u.download), Some("exe".into()));
        assert!(newer("0.4.0", release("v0.4.0")).is_none());
        assert!(newer("0.4.0", release("v0.3.9")).is_none());
        assert!(newer("0.4.0", release("nonsense")).is_none());
    }
}
