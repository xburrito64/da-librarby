//! Downloads artwork once and keeps resized copies on disk, so the library works offline
//! and the cover grid only ever loads small files.

use std::path::PathBuf;
use std::time::Duration;

use image::imageops::FilterType;
use image::DynamicImage;

/// Widths in pixels. Thumbnails are what the cover grid shows.
const COVER_WIDTH: u32 = 600;
const THUMB_WIDTH: u32 = 300;
const BANNER_WIDTH: u32 = 1920;
const STILL_WIDTH: u32 = 400;

pub struct Images {
    dir: PathBuf,
    agent: ureq::Agent,
}

/// File names (inside the images folder) of a saved cover.
pub struct SavedCover {
    pub cover: String,
    pub thumb: String,
}

impl Images {
    pub fn new(dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&dir);
        let agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(30)))
            .build()
            .into();
        Self { dir, agent }
    }

    /// Saves a cover and its thumbnail as `<key>-cover.jpg` / `<key>-thumb.jpg`.
    /// Already-saved covers aren't downloaded again.
    pub fn cover(&self, key: &str, url: Option<&str>) -> Option<SavedCover> {
        let cover = format!("{key}-cover.jpg");
        let thumb = format!("{key}-thumb.jpg");
        if !(self.dir.join(&cover).exists() && self.dir.join(&thumb).exists()) {
            let image = self.download(url?)?;
            self.save(&image, COVER_WIDTH, &cover)?;
            self.save(&image, THUMB_WIDTH, &thumb)?;
        }
        Some(SavedCover { cover, thumb })
    }

    /// Saves a wide banner image as `<key>-banner.jpg`.
    pub fn banner(&self, key: &str, url: Option<&str>) -> Option<String> {
        let name = format!("{key}-banner.jpg");
        if !self.dir.join(&name).exists() {
            let image = self.download(url?)?;
            self.save(&image, BANNER_WIDTH, &name)?;
        }
        Some(name)
    }

    /// Saves an episode thumbnail as `<key>.jpg`.
    pub fn still(&self, key: &str, url: Option<&str>) -> Option<String> {
        let name = format!("{key}.jpg");
        if !self.dir.join(&name).exists() {
            let image = self.download(url?)?;
            self.save(&image, STILL_WIDTH, &name)?;
        }
        Some(name)
    }

    fn download(&self, url: &str) -> Option<DynamicImage> {
        let mut response = self.agent.get(url).call().map_err(|e| eprintln!("image download failed {url}: {e}")).ok()?;
        let bytes = response.body_mut().with_config().limit(30 * 1024 * 1024).read_to_vec().ok()?;
        image::load_from_memory(&bytes).map_err(|e| eprintln!("unreadable image {url}: {e}")).ok()
    }

    fn save(&self, image: &DynamicImage, max_width: u32, name: &str) -> Option<()> {
        let resized = if image.width() > max_width {
            let height = (image.height() as f64 * max_width as f64 / image.width() as f64).round() as u32;
            image.resize_exact(max_width, height.max(1), FilterType::Lanczos3)
        } else {
            image.clone()
        };
        let rgb = resized.to_rgb8();
        // Write to a temporary name first so a crash never leaves a half-written image behind.
        let final_path = self.dir.join(name);
        let temp_path = self.dir.join(format!("{name}.part"));
        let file = std::fs::File::create(&temp_path).ok()?;
        let mut writer = std::io::BufWriter::new(file);
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut writer, 86)
            .encode_image(&rgb)
            .map_err(|e| eprintln!("saving {name} failed: {e}"))
            .ok()?;
        drop(writer);
        std::fs::rename(&temp_path, &final_path).ok()
    }
}
