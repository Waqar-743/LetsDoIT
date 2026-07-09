use futures_util::StreamExt;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize)]
struct DesktopEnvironment {
    app_data_dir: String,
    model_dir: String,
    model_state_file: String,
    runtime: String,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))
}

fn read_json_file<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Unable to read file: {error}"))?;
    let value = serde_json::from_str(&raw)
        .map_err(|error| format!("Unable to parse file: {error}"))?;
    Ok(Some(value))
}

fn write_json_file<T: Serialize>(path: &PathBuf, value: &T) -> Result<(), String> {
    fs::create_dir_all(path.parent().unwrap_or(path))
        .map_err(|error| format!("Unable to create directory: {error}"))?;
    let raw = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Unable to serialize: {error}"))?;
    fs::write(path, raw)
        .map_err(|error| format!("Unable to write file: {error}"))
}

#[tauri::command]
fn desktop_environment(app: AppHandle) -> Result<DesktopEnvironment, String> {
    let app_data_dir = app_data_dir(&app)?;
    let model_dir = app_data_dir.join("models");
    fs::create_dir_all(&model_dir)
        .map_err(|error| format!("Unable to create model directory: {error}"))?;

    Ok(DesktopEnvironment {
        model_state_file: app_data_dir
            .join("model-state.json")
            .to_string_lossy()
            .to_string(),
        app_data_dir: app_data_dir.to_string_lossy().to_string(),
        model_dir: model_dir.to_string_lossy().to_string(),
        runtime: "tauri-rust".to_string(),
    })
}

#[tauri::command]
fn load_model_state(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let state_file = app_data_dir(&app)?.join("model-state.json");
    read_json_file(&state_file)
}

#[tauri::command]
fn save_model_state(app: AppHandle, state: serde_json::Value) -> Result<(), String> {
    let state_file = app_data_dir(&app)?.join("model-state.json");
    write_json_file(&state_file, &state)
}

#[tauri::command]
fn load_ai_cache(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let cache_file = app_data_dir(&app)?.join("ai-cache.json");
    read_json_file(&cache_file)
}

#[tauri::command]
fn save_ai_cache(app: AppHandle, cache: serde_json::Value) -> Result<(), String> {
    let cache_file = app_data_dir(&app)?.join("ai-cache.json");
    write_json_file(&cache_file, &cache)
}

// ─── AI Settings ───────────────────────────────────────────────────────────────

#[tauri::command]
fn load_ai_settings(app: AppHandle) -> Result<Option<String>, String> {
    let file = app_data_dir(&app)?.join("ai-settings.json");
    if !file.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&file)
        .map_err(|e| format!("Unable to read AI settings: {e}"))?;
    Ok(Some(raw))
}

#[tauri::command]
fn save_ai_settings(app: AppHandle, settings: String) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("ai-settings.json");
    // `settings` is already a JSON string from the frontend — parse then write as object
    let value: serde_json::Value = serde_json::from_str(&settings)
        .map_err(|e| format!("Invalid AI settings JSON: {e}"))?;
    write_json_file(&file, &value)
}

// ─── Courses ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn load_courses(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("courses.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_courses(app: AppHandle, courses: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("courses.json");
    write_json_file(&file, &courses)
}

// ─── Materials ────────────────────────────────────────────────────────────────

#[tauri::command]
fn load_materials(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("materials.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_materials(app: AppHandle, materials: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("materials.json");
    write_json_file(&file, &materials)
}

// ─── Quizzes ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn load_quizzes(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("quizzes.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_quizzes(app: AppHandle, quizzes: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("quizzes.json");
    write_json_file(&file, &quizzes)
}

// ─── Attempts ────────────────────────────────────────────────────────────────

#[tauri::command]
fn load_attempts(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("attempts.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_attempts(app: AppHandle, attempts: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("attempts.json");
    write_json_file(&file, &attempts)
}

// ─── Student Profile ─────────────────────────────────────────────────────────

#[tauri::command]
fn load_student(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("student.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_student(app: AppHandle, student: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("student.json");
    write_json_file(&file, &student)
}

// ─── Teacher Profile ─────────────────────────────────────────────────────────

#[tauri::command]
fn load_teacher(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("teacher.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_teacher(app: AppHandle, teacher: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("teacher.json");
    write_json_file(&file, &teacher)
}

// ─── Practice Sets ───────────────────────────────────────────────────────────

#[tauri::command]
fn load_practice_sets(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("practice-sets.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_practice_sets(app: AppHandle, practice_sets: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("practice-sets.json");
    write_json_file(&file, &practice_sets)
}

// ─── System Logs ─────────────────────────────────────────────────────────────

#[tauri::command]
fn load_system_logs(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("system-logs.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_system_logs(app: AppHandle, logs: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("system-logs.json");
    write_json_file(&file, &logs)
}

// ─── HTTP proxy (bypasses WebView CORS / mixed-content blocks) ────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpRequestArgs {
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    /// Timeout in ms. 0 = no timeout. Default 120_000.
    timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponsePayload {
    status: u16,
    ok: bool,
    headers: HashMap<String, String>,
    body: String,
}

fn is_allowed_proxy_url(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("Invalid URL: {e}"))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(format!("Blocked URL scheme: {scheme}"));
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "URL is missing a host".to_string())?
        .to_ascii_lowercase();

    // OpenRouter cloud
    if host == "openrouter.ai" || host.ends_with(".openrouter.ai") {
        return Ok(());
    }

    // Google AI Studio / Generative Language API (free Gemma fallback)
    if host == "generativelanguage.googleapis.com"
        || host == "googleapis.com"
        || host.ends_with(".googleapis.com")
    {
        return Ok(());
    }

    // Local offline runtime / loopback
    if host == "localhost"
        || host == "127.0.0.1"
        || host == "::1"
        || host == "0.0.0.0"
        || host.ends_with(".local")
    {
        return Ok(());
    }

    // Hugging Face (model metadata / downloads when proxied)
    if host == "huggingface.co"
        || host.ends_with(".huggingface.co")
        || host == "hf.co"
        || host.ends_with(".hf.co")
        || host == "cdn-lfs.huggingface.co"
        || host.ends_with(".cdn-lfs.huggingface.co")
    {
        return Ok(());
    }

    // GitHub releases (offline llama.cpp runtime)
    if host == "github.com"
        || host == "objects.githubusercontent.com"
        || host.ends_with(".githubusercontent.com")
    {
        return Ok(());
    }

    Err(format!(
        "HTTP proxy blocked host \"{host}\". Allowed: openrouter.ai, googleapis.com, huggingface.co, github.com, localhost."
    ))
}

#[tauri::command]
async fn http_request(request: HttpRequestArgs) -> Result<HttpResponsePayload, String> {
    is_allowed_proxy_url(&request.url)?;

    let method = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .trim()
        .to_ascii_uppercase();
    if method.is_empty() {
        return Err("HTTP method is empty".into());
    }

    let timeout_ms = request.timeout_ms.unwrap_or(120_000);
    let mut client_builder = reqwest::Client::builder()
        .user_agent("LetsDoIT-Classroom/0.1 (Tauri HTTP proxy)")
        .redirect(reqwest::redirect::Policy::limited(5));

    if timeout_ms == 0 {
        client_builder = client_builder.pool_max_idle_per_host(2);
    } else {
        client_builder = client_builder.timeout(Duration::from_millis(timeout_ms));
    }

    let client = client_builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let mut builder = client.request(
        reqwest::Method::from_bytes(method.as_bytes())
            .map_err(|e| format!("Invalid HTTP method \"{method}\": {e}"))?,
        &request.url,
    );

    if let Some(headers) = &request.headers {
        for (key, value) in headers {
            // Skip hop-by-hop / forbidden headers that reqwest/browser reject
            let lower = key.to_ascii_lowercase();
            if matches!(
                lower.as_str(),
                "host" | "content-length" | "connection" | "transfer-encoding"
            ) {
                continue;
            }
            builder = builder.header(key.as_str(), value.as_str());
        }
    }

    if let Some(body) = &request.body {
        builder = builder.body(body.clone());
    }

    let response = builder.send().await.map_err(|e| {
        if e.is_timeout() {
            format!("Request timed out talking to {}", request.url)
        } else if e.is_connect() {
            format!("Connection failed for {}: {e}", request.url)
        } else {
            format!("HTTP request failed for {}: {e}", request.url)
        }
    })?;

    let status = response.status().as_u16();
    let ok = response.status().is_success();

    let mut headers = HashMap::new();
    for (key, value) in response.headers().iter() {
        if let Ok(v) = value.to_str() {
            headers.insert(key.to_string(), v.to_string());
        }
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    Ok(HttpResponsePayload {
        status,
        ok,
        headers,
        body,
    })
}

/// Quick connectivity probe (no auth). Used by settings UI diagnostics.
#[tauri::command]
async fn probe_endpoint(url: String) -> Result<HttpResponsePayload, String> {
    http_request(HttpRequestArgs {
        url,
        method: Some("GET".into()),
        headers: None,
        body: None,
        timeout_ms: Some(8_000),
    })
    .await
}

// ─── Hugging Face offline models (no Ollama) ─────────────────────────────────

const OFFLINE_PORT: u16 = 3928;
const LLAMA_RELEASE_ZIP: &str =
    "https://github.com/ggml-org/llama.cpp/releases/download/b9940/llama-b9940-bin-win-cpu-x64.zip";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LocalGgufModel {
    name: String,
    path: String,
    size_bytes: u64,
    size_label: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgressEvent {
    percent: u32,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    status: String,
    detail: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct OfflineRuntimeStatus {
    running: bool,
    endpoint: String,
    model_path: Option<String>,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HfResolveResult {
    repo: String,
    filename: String,
    download_url: String,
    size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadResult {
    ok: bool,
    message: String,
    path: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatMessageIn {
    role: String,
    content: String,
}

struct OfflineRuntimeState {
    child: Option<Child>,
    model_path: Option<PathBuf>,
}

static OFFLINE_RUNTIME: Lazy<Mutex<OfflineRuntimeState>> = Lazy::new(|| {
    Mutex::new(OfflineRuntimeState {
        child: None,
        model_path: None,
    })
});

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("models");
    fs::create_dir_all(&dir).map_err(|e| format!("Unable to create models dir: {e}"))?;
    Ok(dir)
}

fn runtime_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("runtime");
    fs::create_dir_all(&dir).map_err(|e| format!("Unable to create runtime dir: {e}"))?;
    Ok(dir)
}

fn format_bytes(n: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    let v = n as f64;
    if v >= GB {
        format!("{:.2} GB", v / GB)
    } else if v >= MB {
        format!("{:.1} MB", v / MB)
    } else if v >= KB {
        format!("{:.1} KB", v / KB)
    } else {
        format!("{n} B")
    }
}

fn parse_hf_repo(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Paste a Hugging Face model link or repo id.".into());
    }

    // Full URL: https://huggingface.co/org/model[/...]
    if let Ok(url) = reqwest::Url::parse(trimmed) {
        let host = url.host_str().unwrap_or("").to_ascii_lowercase();
        if host == "huggingface.co" || host == "hf.co" || host.ends_with(".huggingface.co") {
            let segments: Vec<&str> = url
                .path_segments()
                .map(|s| s.filter(|p| !p.is_empty()).collect())
                .unwrap_or_default();
            if segments.len() >= 2 {
                return Ok(format!("{}/{}", segments[0], segments[1]));
            }
            return Err("Could not parse repo from Hugging Face URL. Expected https://huggingface.co/org/model".into());
        }
    }

    // Bare repo id org/model
    let re = Regex::new(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$").unwrap();
    if re.is_match(trimmed) {
        return Ok(trimmed.to_string());
    }

    Err(
        "Invalid Hugging Face link. Examples:\n\
         • https://huggingface.co/bartowski/gemma-2-2b-it-GGUF\n\
         • bartowski/gemma-2-2b-it-GGUF"
            .into(),
    )
}

fn filename_from_hf_url(input: &str) -> Option<String> {
    let url = reqwest::Url::parse(input.trim()).ok()?;
    let segs: Vec<&str> = url
        .path_segments()
        .map(|s| s.collect())
        .unwrap_or_default();
    // .../resolve/main/file.gguf or /blob/main/file.gguf
    if segs.len() >= 5 && (segs[2] == "resolve" || segs[2] == "blob") {
        let name = segs[4..].join("/");
        if name.to_ascii_lowercase().ends_with(".gguf") {
            return Some(name);
        }
    }
    segs
        .last()
        .filter(|s| s.to_ascii_lowercase().ends_with(".gguf"))
        .map(|s| s.to_string())
}

async fn hf_client(token: Option<&str>) -> Result<reqwest::Client, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        "LetsDoIT-Classroom/0.1 (HF offline downloader)"
            .parse()
            .unwrap(),
    );
    if let Some(t) = token.map(str::trim).filter(|t| !t.is_empty()) {
        headers.insert(
            reqwest::header::AUTHORIZATION,
            format!("Bearer {t}")
                .parse()
                .map_err(|e| format!("Invalid HF token header: {e}"))?,
        );
    }
    reqwest::Client::builder()
        .default_headers(headers)
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(Duration::from_secs(60 * 60))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))
}

#[tauri::command]
async fn resolve_hf_model_target(
    url_or_repo: String,
    preferred_filename: Option<String>,
    hf_token: Option<String>,
) -> Result<HfResolveResult, String> {
    let repo = parse_hf_repo(&url_or_repo)?;
    let client = hf_client(hf_token.as_deref()).await?;

    // Direct file URL
    if let Some(file) = preferred_filename
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| filename_from_hf_url(&url_or_repo))
    {
        let download_url = format!("https://huggingface.co/{repo}/resolve/main/{file}");
        return Ok(HfResolveResult {
            repo,
            filename: file,
            download_url,
            size_bytes: None,
        });
    }

    // List repo files via HF API and pick best GGUF
    let api = format!("https://huggingface.co/api/models/{repo}/tree/main?recursive=1");
    let response = client
        .get(&api)
        .send()
        .await
        .map_err(|e| format!("Failed to query Hugging Face API: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Hugging Face API error ({status}).\n\n{body}\n\n\
             If this is a gated model (official Google Gemma), add a Hugging Face token with access."
        ));
    }

    let entries: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|e| format!("Invalid HF tree response: {e}"))?;

    let mut ggufs: Vec<(String, u64)> = Vec::new();
    for entry in entries {
        let path = entry
            .get("path")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if !path.to_ascii_lowercase().ends_with(".gguf") {
            continue;
        }
        let size = entry.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
        ggufs.push((path, size));
    }

    if ggufs.is_empty() {
        return Err(format!(
            "No .gguf files found in repo `{repo}`.\n\n\
             Paste a GGUF model repo (example: bartowski/gemma-2-2b-it-GGUF)\n\
             or a direct file URL ending in .gguf."
        ));
    }

    // Prefer Q4_K_M, then Q5_K_M, then smallest reasonable
    let pick = ggufs
        .iter()
        .find(|(p, _)| p.contains("Q4_K_M"))
        .or_else(|| ggufs.iter().find(|(p, _)| p.contains("Q5_K_M")))
        .or_else(|| ggufs.iter().find(|(p, _)| p.contains("Q4_0")))
        .cloned()
        .unwrap_or_else(|| {
            let mut sorted = ggufs.clone();
            sorted.sort_by_key(|(_, s)| *s);
            sorted.into_iter().next().unwrap()
        });

    let (filename, size_bytes) = pick;
    let download_url = format!("https://huggingface.co/{repo}/resolve/main/{filename}");
    Ok(HfResolveResult {
        repo,
        filename,
        download_url,
        size_bytes: if size_bytes > 0 { Some(size_bytes) } else { None },
    })
}

#[tauri::command]
async fn download_hf_model(
    app: AppHandle,
    url_or_repo: String,
    preferred_filename: Option<String>,
    hf_token: Option<String>,
) -> Result<DownloadResult, String> {
    let target = resolve_hf_model_target(
        url_or_repo.clone(),
        preferred_filename,
        hf_token.clone(),
    )
    .await?;

    let client = hf_client(hf_token.as_deref()).await?;
    let dest_dir = models_dir(&app)?;
    // Flatten nested paths to a single filename for local storage
    let safe_name = target
        .filename
        .replace('\\', "/")
        .split('/')
        .last()
        .unwrap_or("model.gguf")
        .to_string();
    let dest_path = dest_dir.join(&safe_name);
    let part_path = dest_dir.join(format!("{safe_name}.part"));

    let _ = app.emit(
        "hf-download-progress",
        DownloadProgressEvent {
            percent: 0,
            downloaded_bytes: 0,
            total_bytes: target.size_bytes,
            status: "starting".into(),
            detail: Some(format!("Downloading {}", target.filename)),
        },
    );

    let response = client
        .get(&target.download_url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Ok(DownloadResult {
            ok: false,
            message: format!(
                "Hugging Face download failed (HTTP {status}).\n\n{body}\n\n\
                 Tips:\n\
                 • Accept the model license on the Hugging Face page\n\
                 • Paste a HF access token if the model is gated\n\
                 • Use a public GGUF repo (e.g. bartowski/gemma-2-2b-it-GGUF)"
            ),
            path: None,
            name: None,
        });
    }

    let total = response
        .content_length()
        .or(target.size_bytes)
        .filter(|n| *n > 0);

    let mut file = fs::File::create(&part_path)
        .map_err(|e| format!("Cannot create download file: {e}"))?;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emit = 0u64;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {e}"))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Write error: {e}"))?;
        downloaded += chunk.len() as u64;

        // Throttle progress events (~every 256KB)
        if downloaded - last_emit > 256 * 1024 || total.map(|t| downloaded >= t).unwrap_or(false) {
            last_emit = downloaded;
            let percent = total
                .map(|t| ((downloaded as f64 / t as f64) * 100.0).min(99.0) as u32)
                .unwrap_or(0);
            let _ = app.emit(
                "hf-download-progress",
                DownloadProgressEvent {
                    percent,
                    downloaded_bytes: downloaded,
                    total_bytes: total,
                    status: "downloading".into(),
                    detail: Some(format!(
                        "{} / {}",
                        format_bytes(downloaded),
                        total.map(format_bytes).unwrap_or_else(|| "?".into())
                    )),
                },
            );
        }
    }

    file.flush().map_err(|e| format!("Flush error: {e}"))?;
    drop(file);

    // Basic GGUF magic check
    {
        let mut probe = fs::File::open(&part_path).map_err(|e| format!("Cannot read download: {e}"))?;
        let mut magic = [0u8; 4];
        probe
            .read_exact(&mut magic)
            .map_err(|_| "Downloaded file is empty or unreadable.".to_string())?;
        if &magic != b"GGUF" {
            let _ = fs::remove_file(&part_path);
            return Ok(DownloadResult {
                ok: false,
                message: format!(
                    "Downloaded file is not a GGUF model (got {:?}).\n\n\
                     Use a Hugging Face GGUF repo or a direct .gguf file link.",
                    String::from_utf8_lossy(&magic)
                ),
                path: None,
                name: None,
            });
        }
    }

    if dest_path.exists() {
        let _ = fs::remove_file(&dest_path);
    }
    fs::rename(&part_path, &dest_path).map_err(|e| format!("Finalize download failed: {e}"))?;

    let _ = app.emit(
        "hf-download-progress",
        DownloadProgressEvent {
            percent: 100,
            downloaded_bytes: downloaded,
            total_bytes: total.or(Some(downloaded)),
            status: "success".into(),
            detail: Some("Model saved on this computer".into()),
        },
    );

    Ok(DownloadResult {
        ok: true,
        message: format!(
            "Model downloaded for offline use.\nFile: {}\nSize: {}\nPath: {}",
            safe_name,
            format_bytes(downloaded),
            dest_path.to_string_lossy()
        ),
        path: Some(dest_path.to_string_lossy().to_string()),
        name: Some(safe_name),
    })
}

#[tauri::command]
fn list_local_gguf_models(app: AppHandle) -> Result<Vec<LocalGgufModel>, String> {
    let dir = models_dir(&app)?;
    let mut out = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("Cannot read models dir: {e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("gguf"))
            .unwrap_or(false)
        {
            let meta = entry.metadata().ok();
            let size = meta.map(|m| m.len()).unwrap_or(0);
            out.push(LocalGgufModel {
                name: path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("model.gguf")
                    .to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: size,
                size_label: format_bytes(size),
            });
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

fn llama_server_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(runtime_dir(app)?.join("llama-server.exe"))
}

#[tauri::command]
fn open_models_folder(app: AppHandle) -> Result<String, String> {
    let dir = models_dir(&app)?;
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(dir.as_os_str())
            .spawn()
            .map_err(|e| format!("Could not open models folder: {e}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("xdg-open").arg(&dir).spawn();
    }
    Ok(dir.to_string_lossy().to_string())
}

/// Copy a user-selected GGUF into the app models folder (manual offline install).
#[tauri::command]
fn import_local_gguf(app: AppHandle, source_path: String) -> Result<DownloadResult, String> {
    let src = PathBuf::from(source_path.trim());
    if !src.exists() {
        return Ok(DownloadResult {
            ok: false,
            message: format!("File not found:\n{}", src.to_string_lossy()),
            path: None,
            name: None,
        });
    }
    let name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("model.gguf")
        .to_string();
    if !name.to_ascii_lowercase().ends_with(".gguf") {
        return Ok(DownloadResult {
            ok: false,
            message: "Only .gguf model files can be imported for offline use.".into(),
            path: None,
            name: None,
        });
    }

    // Verify GGUF magic
    {
        let mut probe =
            fs::File::open(&src).map_err(|e| format!("Cannot read file: {e}"))?;
        let mut magic = [0u8; 4];
        probe
            .read_exact(&mut magic)
            .map_err(|_| "File is empty or unreadable.".to_string())?;
        if &magic != b"GGUF" {
            return Ok(DownloadResult {
                ok: false,
                message: format!(
                    "Not a GGUF model (magic {:?}). Download a .gguf from Hugging Face.",
                    String::from_utf8_lossy(&magic)
                ),
                path: None,
                name: None,
            });
        }
    }

    let dest_dir = models_dir(&app)?;
    let dest = dest_dir.join(&name);
    fs::copy(&src, &dest).map_err(|e| format!("Failed to copy model into app folder: {e}"))?;
    let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);

    Ok(DownloadResult {
        ok: true,
        message: format!(
            "Model imported for offline use.\nFile: {name}\nSize: {}\nPath: {}",
            format_bytes(size),
            dest.to_string_lossy()
        ),
        path: Some(dest.to_string_lossy().to_string()),
        name: Some(name),
    })
}

/// Register an existing GGUF path without copying (e.g. user keeps models on D:).
#[tauri::command]
fn register_external_gguf(path: String) -> Result<DownloadResult, String> {
    let src = PathBuf::from(path.trim());
    if !src.exists() {
        return Ok(DownloadResult {
            ok: false,
            message: format!("File not found:\n{}", src.to_string_lossy()),
            path: None,
            name: None,
        });
    }
    let name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("model.gguf")
        .to_string();
    if !name.to_ascii_lowercase().ends_with(".gguf") {
        return Ok(DownloadResult {
            ok: false,
            message: "Path must point to a .gguf file.".into(),
            path: None,
            name: None,
        });
    }
    let mut probe = fs::File::open(&src).map_err(|e| format!("Cannot read file: {e}"))?;
    let mut magic = [0u8; 4];
    probe
        .read_exact(&mut magic)
        .map_err(|_| "File is empty or unreadable.".to_string())?;
    if &magic != b"GGUF" {
        return Ok(DownloadResult {
            ok: false,
            message: "File is not a valid GGUF model.".into(),
            path: None,
            name: None,
        });
    }
    let size = fs::metadata(&src).map(|m| m.len()).unwrap_or(0);
    Ok(DownloadResult {
        ok: true,
        message: format!(
            "External GGUF registered.\nFile: {name}\nSize: {}\nPath: {}",
            format_bytes(size),
            src.to_string_lossy()
        ),
        path: Some(src.to_string_lossy().to_string()),
        name: Some(name),
    })
}

async fn ensure_llama_server_binary(app: &AppHandle) -> Result<PathBuf, String> {
    let bin = llama_server_path(app)?;
    if bin.exists() {
        return Ok(bin);
    }

    let dir = runtime_dir(app)?;
    let zip_path = dir.join("llama-server-runtime.zip");
    let client = reqwest::Client::builder()
        .user_agent("LetsDoIT-Classroom/0.1")
        .timeout(Duration::from_secs(60 * 30))
        .build()
        .map_err(|e| format!("Runtime client error: {e}"))?;

    let _ = app.emit(
        "hf-download-progress",
        DownloadProgressEvent {
            percent: 0,
            downloaded_bytes: 0,
            total_bytes: None,
            status: "runtime".into(),
            detail: Some("Downloading local inference engine (one-time)...".into()),
        },
    );

    let response = client
        .get(LLAMA_RELEASE_ZIP)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Could not download local inference engine.\n\n{e}\n\n\
                 Check your internet once so LetsDoIT can install the offline runtime.\n\
                 After that, models run fully offline."
            )
        })?;
    if !response.status().is_success() {
        return Err(format!(
            "Failed to download offline runtime (HTTP {}).\nURL: {LLAMA_RELEASE_ZIP}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Runtime download incomplete: {e}"))?;
    fs::write(&zip_path, &bytes).map_err(|e| format!("Cannot save runtime zip: {e}"))?;

    let file = fs::File::open(&zip_path).map_err(|e| format!("Cannot open runtime zip: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid runtime zip: {e}"))?;
    let mut found = false;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip entry error: {e}"))?;
        let name = entry.name().replace('\\', "/");
        let base = name.split('/').last().unwrap_or("");
        if base.eq_ignore_ascii_case("llama-server.exe") {
            let mut out = fs::File::create(&bin).map_err(|e| format!("Cannot write llama-server: {e}"))?;
            std::io::copy(&mut entry, &mut out).map_err(|e| format!("Extract error: {e}"))?;
            found = true;
            break;
        }
    }
    let _ = fs::remove_file(&zip_path);
    if !found {
        return Err(
            "Runtime package downloaded but llama-server.exe was not found inside the zip.".into(),
        );
    }

    let _ = app.emit(
        "hf-download-progress",
        DownloadProgressEvent {
            percent: 100,
            downloaded_bytes: bytes.len() as u64,
            total_bytes: Some(bytes.len() as u64),
            status: "runtime-ready".into(),
            detail: Some("Offline engine ready".into()),
        },
    );

    Ok(bin)
}

fn stop_runtime_locked(state: &mut OfflineRuntimeState) {
    if let Some(mut child) = state.child.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    state.model_path = None;
}

fn is_runtime_alive(state: &mut OfflineRuntimeState) -> bool {
    if let Some(child) = state.child.as_mut() {
        match child.try_wait() {
            Ok(None) => true,
            Ok(Some(_)) => {
                state.child = None;
                false
            }
            Err(_) => false,
        }
    } else {
        false
    }
}

async fn wait_for_runtime(endpoint: &str, timeout_ms: u64) -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .ok();
    let Some(client) = client else {
        return false;
    };
    let health = format!("{endpoint}/health");
    let start = std::time::Instant::now();
    while start.elapsed() < Duration::from_millis(timeout_ms) {
        if let Ok(resp) = client.get(&health).send().await {
            if resp.status().is_success() {
                return true;
            }
        }
        // also try models endpoint
        if let Ok(resp) = client.get(format!("{endpoint}/v1/models")).send().await {
            if resp.status().is_success() {
                return true;
            }
        }
        tokio::time::sleep(Duration::from_millis(400)).await;
    }
    false
}

#[tauri::command]
async fn ensure_offline_runtime(app: AppHandle, model_path: String) -> Result<OfflineRuntimeStatus, String> {
    let path = PathBuf::from(model_path.trim());
    if !path.exists() {
        return Ok(OfflineRuntimeStatus {
            running: false,
            endpoint: format!("http://127.0.0.1:{OFFLINE_PORT}"),
            model_path: None,
            message: format!("Model file not found:\n{}", path.to_string_lossy()),
        });
    }

    {
        let mut state = OFFLINE_RUNTIME.lock();
        if is_runtime_alive(&mut state) {
            if state.model_path.as_ref() == Some(&path) {
                return Ok(OfflineRuntimeStatus {
                    running: true,
                    endpoint: format!("http://127.0.0.1:{OFFLINE_PORT}"),
                    model_path: Some(path.to_string_lossy().to_string()),
                    message: "Offline runtime already running with this model.".into(),
                });
            }
            stop_runtime_locked(&mut state);
        }
    }

    let bin = ensure_llama_server_binary(&app).await?;
    let endpoint = format!("http://127.0.0.1:{OFFLINE_PORT}");

    let log_path = runtime_dir(&app)?.join("llama-server.log");
    let log_file = fs::File::create(&log_path)
        .map_err(|e| format!("Cannot create runtime log: {e}"))?;
    let log_err = log_file
        .try_clone()
        .map_err(|e| format!("Cannot clone runtime log handle: {e}"))?;

    let mut cmd = Command::new(&bin);
    cmd.arg("-m")
        .arg(&path)
        .arg("--port")
        .arg(OFFLINE_PORT.to_string())
        .arg("--host")
        .arg("127.0.0.1")
        .arg("-c")
        .arg("4096")
        .arg("-ngl")
        .arg("0")
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_err));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to start offline runtime.\n\n{e}\n\nBinary: {}\n\n\
             If download of the runtime failed earlier, reinstall the app or check internet once.",
            bin.to_string_lossy()
        )
    })?;

    {
        let mut state = OFFLINE_RUNTIME.lock();
        state.child = Some(child);
        state.model_path = Some(path.clone());
    }

    let ready = wait_for_runtime(&endpoint, 120_000).await;
    if !ready {
        let mut state = OFFLINE_RUNTIME.lock();
        stop_runtime_locked(&mut state);
        let log_tail = fs::read_to_string(&log_path)
            .unwrap_or_default()
            .chars()
            .rev()
            .take(1500)
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>();
        return Ok(OfflineRuntimeStatus {
            running: false,
            endpoint,
            model_path: Some(path.to_string_lossy().to_string()),
            message: format!(
                "Offline engine started but did not become ready in time.\n\
                 Model: {}\n\
                 Tips: use a smaller Q4 GGUF (2B), free ~4GB RAM, or re-download the model.\n\n\
                 Runtime log (tail):\n{}",
                path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("model.gguf"),
                if log_tail.trim().is_empty() {
                    "(empty — process may have crashed immediately)"
                } else {
                    log_tail.trim()
                }
            ),
        });
    }

    Ok(OfflineRuntimeStatus {
        running: true,
        endpoint,
        model_path: Some(path.to_string_lossy().to_string()),
        message: format!(
            "Offline runtime ready.\nModel: {}\nEndpoint: http://127.0.0.1:{OFFLINE_PORT}",
            path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("model.gguf")
        ),
    })
}

#[tauri::command]
fn stop_offline_runtime() -> Result<(), String> {
    let mut state = OFFLINE_RUNTIME.lock();
    stop_runtime_locked(&mut state);
    Ok(())
}

#[tauri::command]
fn offline_runtime_status() -> Result<OfflineRuntimeStatus, String> {
    let mut state = OFFLINE_RUNTIME.lock();
    let running = is_runtime_alive(&mut state);
    let model_path = state
        .model_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string());
    Ok(OfflineRuntimeStatus {
        running,
        endpoint: format!("http://127.0.0.1:{OFFLINE_PORT}"),
        model_path,
        message: if running {
            "Offline runtime is running.".into()
        } else {
            "Offline runtime is stopped.".into()
        },
    })
}

#[tauri::command]
async fn offline_chat(
    messages: Vec<ChatMessageIn>,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
) -> Result<serde_json::Value, String> {
    let (running, model_path) = {
        let mut state = OFFLINE_RUNTIME.lock();
        (is_runtime_alive(&mut state), state.model_path.clone())
    };
    if !running {
        return Err(
            "Offline runtime is not running.\n\n\
             Download a Hugging Face GGUF model, then click Test Offline Model."
                .into(),
        );
    }

    let endpoint = format!("http://127.0.0.1:{OFFLINE_PORT}/v1/chat/completions");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| format!("Chat client error: {e}"))?;

    let body = serde_json::json!({
        "messages": messages.iter().map(|m| serde_json::json!({
            "role": m.role,
            "content": m.content,
        })).collect::<Vec<_>>(),
        "max_tokens": max_tokens.unwrap_or(1024),
        "temperature": temperature.unwrap_or(0.7),
        "stream": false,
    });

    let response = client
        .post(&endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Offline chat request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Offline chat failed (HTTP {status}).\n{text}"));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid offline chat JSON: {e}"))?;
    let text = data
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let model_name = model_path
        .as_ref()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .unwrap_or_else(|| "local-gguf".into());

    Ok(serde_json::json!({
        "text": text,
        "providerName": format!("Local HF GGUF ({model_name})"),
    }))
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            desktop_environment,
            load_model_state,
            save_model_state,
            load_ai_cache,
            save_ai_cache,
            load_ai_settings,
            save_ai_settings,
            load_courses,
            save_courses,
            load_materials,
            save_materials,
            load_quizzes,
            save_quizzes,
            load_attempts,
            save_attempts,
            load_student,
            save_student,
            load_teacher,
            save_teacher,
            load_practice_sets,
            save_practice_sets,
            load_system_logs,
            save_system_logs,
            http_request,
            probe_endpoint,
            resolve_hf_model_target,
            download_hf_model,
            list_local_gguf_models,
            open_models_folder,
            import_local_gguf,
            register_external_gguf,
            ensure_offline_runtime,
            stop_offline_runtime,
            offline_runtime_status,
            offline_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LetsDoIT desktop app");
}
